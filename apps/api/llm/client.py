"""
Unified LLM Provider Interface for SAANS.
Enforces safety rules in code, redline medical intercepts, prompt injection defense,
and strict numeric traceability (LLM never does the math).
Integrates with real LLM providers (Gemini / OpenAI API) with function calling over
deterministic tools, and falls back gracefully to MockLLM for local offline use.

Strict Guarantees (Audit 2 R6, R7):
- Non-blocking async client (httpx.AsyncClient) for live provider calls in async streaming endpoints.
- Passes household profile data to the model and tools to personalize recommendations.
- Truthful labeling:
  * When no live API key: 'Scripted demo assistant (no language model connected)'
  * When live key and guard verified: 'Grounded Model (Verified Traceability)'
"""

import json
import logging
import os
import time
from collections import defaultdict
from collections.abc import AsyncGenerator, Generator
from typing import Any

import httpx

from .mock import MockLLM
from .safety import check_medical_emergency, sanitize_user_input
from .tools import execute_tool
from .traceability import (
    build_failclosed_template,
    extract_numbers_from_text,
    verify_numeric_traceability,
)

logger = logging.getLogger("saans.llm")

# In-memory per-IP sliding window rate limiter (max 60 requests / minute)
_RATE_LIMIT_STORE: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW_SECONDS = 60.0
RATE_LIMIT_MAX_REQUESTS = 60

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_air",
            "description": "Retrieves current CPCB AQI, PM2.5, and active GRAP stage for an Indian city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name, e.g. Ghaziabad, Delhi, Gurugram, Pune",
                    },
                    "lat": {"type": "number", "description": "Latitude"},
                    "lon": {"type": "number", "description": "Longitude"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_day_plan",
            "description": "Computes optimized daily schedule shifts (e.g. morning walk, window ventilation) to avoid winter inversion.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name, e.g. Delhi, Pune"},
                    "lat": {"type": "number", "description": "Latitude"},
                    "lon": {"type": "number", "description": "Longitude"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate",
            "description": "Simulates intervention combinations (HEPA purifiers, N95 masks, ventilation shifts) and computes dose reduction, cost in INR, and cigarette equivalents saved.",
            "parameters": {
                "type": "object",
                "properties": {
                    "selected_intervention_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Intervention IDs, e.g. 'hepa_room_purifier', 'family_n95_masks', 'shift_ventilation_afternoon'",
                    },
                    "community_count": {
                        "type": "integer",
                        "description": "Community household multiplier",
                    },
                    "current_pm2_5": {
                        "type": "number",
                        "description": "Current ambient PM2.5 to establish baseline",
                    },
                },
                "required": ["selected_intervention_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_guidance",
            "description": "Searches verified scientific corpus and medical guidelines (myths on plants/jaggery/steam, CADR purifier sizing, mask standards, pediatric/senior vulnerability).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search topic query",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of chunks to retrieve (1-3)",
                    },
                },
                "required": ["query"],
            },
        },
    },
]

SYSTEM_PROMPT = """You are SanjhiHawa Assistant, a specialized AI clean air and smog decision assistant for Indian households during severe winter pollution.
NON-NEGOTIABLE CORE INVARIANTS:
1. THE LLM NEVER DOES THE MATH. You must select appropriate tools (get_air, get_day_plan, simulate, lookup_guidance) and narrate their returned values ONLY.
2. Every numeric claim you make (concentrations, percentages, costs, CADR, times) MUST originate strictly from tool results or user context. Do NOT invent numbers.
3. If the user asks about medical symptoms or clinical diagnoses, refer them to medical professionals. Never prescribe medication.
4. Tailor your guidance to the user's household profile (e.g. vulnerable elderly or children, asthmatics, outdoor workers).
5. Keep answers concise, actionable, and cite sources in brackets like [cpcb-naqi-bands] or [myth-indoor-plants].
"""


def check_ip_rate_limit(client_ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = time.time()
    timestamps = _RATE_LIMIT_STORE[client_ip]
    # Prune old timestamps
    _RATE_LIMIT_STORE[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(_RATE_LIMIT_STORE[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    _RATE_LIMIT_STORE[client_ip].append(now)
    return True


class LLMService:
    def __init__(self):
        self.api_key = (
            os.environ.get("LLM_API_KEY")
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
            or os.environ.get("GROQ_API_KEY")
            or "mock-dev-key"
        )
        # Automatic provider & model routing based on API key prefix
        if self.api_key.startswith("AIza") or self.api_key.startswith("AQ."):
            # Google Gemini (OpenAI compatible endpoint)
            self.base_url = os.environ.get(
                "LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
            ).rstrip("/")
            self.model = os.environ.get("LLM_MODEL", "gemini-2.5-flash")
        elif self.api_key.startswith("gsk_"):
            # Groq high-speed endpoint
            self.base_url = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip(
                "/"
            )
            self.model = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")
        else:
            self.base_url = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
            self.model = os.environ.get("LLM_MODEL", "gpt-4o-mini")

        self.mock_llm = MockLLM()

    def stream_chat_sync(
        self,
        user_query: str,
        profile_data: dict[str, Any] | None = None,
        language: str = "en",
        simplify_for_child: bool = False,
        client_ip: str = "127.0.0.1",
    ) -> Generator[dict[str, Any], None, None]:
        """
        Synchronous chat workflow (for evaluation test suites or CLI usage).
        """
        # STEP 1: Rate Limiting
        if not check_ip_rate_limit(client_ip):
            yield {
                "event": "token",
                "data": {
                    "token": "Rate limit exceeded (max 60 requests/minute). Please pause a moment before asking again."
                },
            }
            yield {"event": "done", "data": {"status": "rate_limited"}}
            return

        # STEP 2: Medical Red-Line Triage Check (NON-NEGOTIABLE SAFETY RULE)
        emergency_msg = check_medical_emergency(user_query, language=language)
        if emergency_msg:
            yield {
                "event": "medical_intercept",
                "data": {"is_emergency": True, "message": emergency_msg},
            }
            for word in emergency_msg.split(" "):
                yield {"event": "token", "data": {"token": word + " "}}
            yield {
                "event": "citations",
                "data": {
                    "citations": [
                        {
                            "id": "medical-triage-redlines",
                            "title": "Emergency Warning Signs for Severe Respiratory and Asthma Distress",
                            "publisher": "Ministry of Health and Family Welfare (MoHFW) / National Health Mission",
                        }
                    ]
                },
            }
            yield {"event": "done", "data": {"status": "emergency_refusal"}}
            return

        # STEP 3: Prompt Injection Defense
        sanitized_query, _was_flagged = sanitize_user_input(user_query)

        # STEP 4: Live Provider Execution or Fallback to MockLLM
        is_live_key = (
            bool(self.api_key)
            and self.api_key != "mock-dev-key"
            and not self.api_key.startswith("mock")
        )

        if is_live_key:
            try:
                yield from self._stream_live_provider_sync(
                    sanitized_query,
                    profile_data,
                    language=language,
                    simplify_for_child=simplify_for_child,
                )
                return
            except (httpx.HTTPError, OSError, ValueError, KeyError) as ex:
                logger.warning(
                    f"Live LLM provider failed ({ex}); falling back to deterministic MockLLM."
                )

        # Audit 2 R7: Truthful mode label for unkeyed scripted mode
        yield {
            "event": "provider_info",
            "data": {
                "mode": "scripted_demo",
                "label": "Scripted demo assistant (no language model connected)",
                "note": "Running local keyword-matched demo script without external LLM API.",
            },
        }

        # Route to MockLLM sync stream
        yield from self.mock_llm.chat_stream_sync(
            query=sanitized_query,
            profile_data=profile_data,
            language=language,
            simplify_for_child=simplify_for_child,
        )

    def _stream_live_provider_sync(
        self,
        query: str,
        profile_data: dict[str, Any] | None,
        language: str = "en",
        simplify_for_child: bool = False,
    ) -> Generator[dict[str, Any], None, None]:
        """
        Synchronous live provider fallback using httpx.Client.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        user_content = f"[Language: {language}, Child-friendly: {simplify_for_child}]\n"
        if profile_data:
            user_content += f"[Household Context: {json.dumps(profile_data, ensure_ascii=False)}]\n"
        user_content += f"User Query: {query}"

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        tool_results: list[dict[str, Any]] = []
        citations: list[dict[str, str]] = []

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "tools": TOOL_SCHEMAS,
                    "tool_choice": "auto",
                    "max_tokens": 600,
                },
            )
            resp.raise_for_status()
            choice = resp.json()["choices"][0]["message"]

            if choice.get("tool_calls"):
                messages.append(choice)
                for tc in choice["tool_calls"]:
                    fn_name = tc["function"]["name"]
                    try:
                        fn_args = json.loads(tc["function"]["arguments"])
                    except (json.JSONDecodeError, TypeError, KeyError):
                        fn_args = {}

                    if fn_name == "get_day_plan" and profile_data and "profile_data" not in fn_args:
                        fn_args["profile_data"] = profile_data

                    res = execute_tool(fn_name, fn_args)
                    tool_results.append(res)

                    if fn_name == "lookup_guidance" and "results" in res:
                        for chunk in res["results"]:
                            citations.append(
                                {
                                    "id": chunk.get("source_id", "source"),
                                    "title": chunk.get("title", ""),
                                    "publisher": chunk.get("publisher", ""),
                                }
                            )

                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": json.dumps(res, ensure_ascii=False),
                        }
                    )

                yield {
                    "event": "tool_executed",
                    "data": {"tools_used": [tc["function"]["name"] for tc in choice["tool_calls"]]},
                }

                narration_resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": 600,
                    },
                )
                narration_resp.raise_for_status()
                narrative_text = narration_resp.json()["choices"][0]["message"]["content"]
            else:
                narrative_text = choice.get("content", "")

        user_nums = extract_numbers_from_text(query)
        is_valid, untraceable = verify_numeric_traceability(
            narrative_text, tool_results, user_context_numbers=user_nums
        )
        if not is_valid:
            logger.warning(
                f"Untraceable numbers in LLM reply ({untraceable}); failing closed to deterministic template."
            )
            narrative_text = build_failclosed_template(tool_results, language=language)

        yield {
            "event": "provider_info",
            "data": {
                "mode": "grounded_live",
                "label": "Grounded Model (Verified Traceability)",
                "note": "Output verified by numeric traceability guard.",
            },
        }

        for word in narrative_text.split(" "):
            yield {"event": "token", "data": {"token": word + " "}}

        if citations:
            yield {"event": "citations", "data": {"citations": citations}}

        yield {"event": "done", "data": {"status": "completed"}}

    async def _stream_live_provider_async(
        self,
        query: str,
        profile_data: dict[str, Any] | None,
        language: str = "en",
        simplify_for_child: bool = False,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Audit 2 R6: Truly non-blocking asynchronous provider using httpx.AsyncClient.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        user_content = f"[Language: {language}, Child-friendly: {simplify_for_child}]\n"
        if profile_data:
            user_content += f"[Household Context: {json.dumps(profile_data, ensure_ascii=False)}]\n"
        user_content += f"User Query: {query}"

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        tool_results: list[dict[str, Any]] = []
        citations: list[dict[str, str]] = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "tools": TOOL_SCHEMAS,
                    "tool_choice": "auto",
                    "max_tokens": 600,
                },
            )
            resp.raise_for_status()
            choice = resp.json()["choices"][0]["message"]

            if choice.get("tool_calls"):
                messages.append(choice)
                for tc in choice["tool_calls"]:
                    fn_name = tc["function"]["name"]
                    try:
                        fn_args = json.loads(tc["function"]["arguments"])
                    except (json.JSONDecodeError, TypeError, KeyError):
                        fn_args = {}

                    if fn_name == "get_day_plan" and profile_data and "profile_data" not in fn_args:
                        fn_args["profile_data"] = profile_data

                    res = execute_tool(fn_name, fn_args)
                    tool_results.append(res)

                    if fn_name == "lookup_guidance" and "results" in res:
                        for chunk in res["results"]:
                            citations.append(
                                {
                                    "id": chunk.get("source_id", "source"),
                                    "title": chunk.get("title", ""),
                                    "publisher": chunk.get("publisher", ""),
                                }
                            )

                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": json.dumps(res, ensure_ascii=False),
                        }
                    )

                yield {
                    "event": "tool_executed",
                    "data": {"tools_used": [tc["function"]["name"] for tc in choice["tool_calls"]]},
                }

                narration_resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": 600,
                    },
                )
                narration_resp.raise_for_status()
                narrative_text = narration_resp.json()["choices"][0]["message"]["content"]
            else:
                narrative_text = choice.get("content", "")

        user_nums = extract_numbers_from_text(query)
        is_valid, untraceable = verify_numeric_traceability(
            narrative_text, tool_results, user_context_numbers=user_nums
        )
        if not is_valid:
            logger.warning(
                f"Untraceable numbers in LLM reply ({untraceable}); failing closed to deterministic template."
            )
            narrative_text = build_failclosed_template(tool_results, language=language)

        yield {
            "event": "provider_info",
            "data": {
                "mode": "grounded_live",
                "label": "Grounded Model (Verified Traceability)",
                "note": "Output verified by numeric traceability guard.",
            },
        }

        for word in narrative_text.split(" "):
            yield {"event": "token", "data": {"token": word + " "}}

        if citations:
            yield {"event": "citations", "data": {"citations": citations}}

        yield {"event": "done", "data": {"status": "completed"}}

    async def stream_chat(
        self,
        user_query: str,
        profile_data: dict[str, Any] | None = None,
        language: str = "en",
        simplify_for_child: bool = False,
        client_ip: str = "127.0.0.1",
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Async streaming method for FastAPI SSE endpoints.
        Uses AsyncClient for live API calls to prevent blocking the event loop.
        """
        # STEP 1: Rate Limiting
        if not check_ip_rate_limit(client_ip):
            yield {
                "event": "token",
                "data": {
                    "token": "Rate limit exceeded (max 60 requests/minute). Please pause a moment before asking again."
                },
            }
            yield {"event": "done", "data": {"status": "rate_limited"}}
            return

        # STEP 2: Medical Red-Line Triage Check
        emergency_msg = check_medical_emergency(user_query, language=language)
        if emergency_msg:
            yield {
                "event": "medical_intercept",
                "data": {"is_emergency": True, "message": emergency_msg},
            }
            for word in emergency_msg.split(" "):
                yield {"event": "token", "data": {"token": word + " "}}
            yield {
                "event": "citations",
                "data": {
                    "citations": [
                        {
                            "id": "medical-triage-redlines",
                            "title": "Emergency Warning Signs for Severe Respiratory and Asthma Distress",
                            "publisher": "Ministry of Health and Family Welfare (MoHFW) / National Health Mission",
                        }
                    ]
                },
            }
            yield {"event": "done", "data": {"status": "emergency_refusal"}}
            return

        # STEP 3: Prompt Injection Defense
        sanitized_query, _was_flagged = sanitize_user_input(user_query)

        # STEP 4: Live Provider or MockLLM
        is_live_key = (
            bool(self.api_key)
            and self.api_key != "mock-dev-key"
            and not self.api_key.startswith("mock")
        )

        if is_live_key:
            try:
                async for event in self._stream_live_provider_async(
                    sanitized_query,
                    profile_data,
                    language=language,
                    simplify_for_child=simplify_for_child,
                ):
                    yield event
                return
            except (httpx.HTTPError, OSError, ValueError, KeyError) as ex:
                logger.warning(
                    f"Live LLM provider failed ({ex}); falling back to deterministic MockLLM."
                )

        yield {
            "event": "provider_info",
            "data": {
                "mode": "scripted_demo",
                "label": "Scripted demo assistant (no language model connected)",
                "note": "Running local keyword-matched demo script without external LLM API.",
            },
        }

        for event in self.mock_llm.chat_stream_sync(
            query=sanitized_query,
            profile_data=profile_data,
            language=language,
            simplify_for_child=simplify_for_child,
        ):
            yield event


_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
