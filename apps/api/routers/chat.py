"""
Streaming Chat Router for Ask Saans.
Delivers real-time Server-Sent Events (SSE) streaming with citations and safety intercept.
"""

import json
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from llm import get_llm_service
from pydantic import BaseModel, Field
from schemas.contracts import HouseholdProfile
from services.rate_limiter import chat_rate_limiter

router = APIRouter(tags=["Chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    profile: HouseholdProfile | None = None
    language: Literal["en", "hi", "mr"] = "en"
    simplify_for_child: bool = False


class CitationItem(BaseModel):
    id: str
    title: str
    publisher: str


class ChatSyncResponse(BaseModel):
    reply: str
    is_medical_refusal: bool
    citations: list[CitationItem]
    language: str


@router.post("/chat")
async def chat_stream_endpoint(req: ChatRequest, request: Request):
    """
    Server-Sent Events (SSE) streaming endpoint for Ask Saans.
    Emits token chunks, executed tool summaries, and citations in real time.
    """
    chat_rate_limiter.enforce(request)
    llm_service = get_llm_service()
    profile_dict = req.profile.model_dump() if req.profile else None
    client_ip = request.client.host if request.client else "127.0.0.1"

    async def event_generator():
        async for event in llm_service.stream_chat(
            user_query=req.message,
            profile_data=profile_dict,
            language=req.language,
            simplify_for_child=req.simplify_for_child,
            client_ip=client_ip,
        ):
            payload = json.dumps(event, ensure_ascii=False)
            yield f"data: {payload}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def chat_sync_service(req: ChatRequest, client_ip: str = "127.0.0.1") -> ChatSyncResponse:
    llm_service = get_llm_service()
    profile_dict = req.profile.model_dump() if req.profile else None

    collected_tokens = []
    is_emergency = False
    citations = []

    for event in llm_service.stream_chat_sync(
        user_query=req.message,
        profile_data=profile_dict,
        language=req.language,
        simplify_for_child=req.simplify_for_child,
        client_ip=client_ip,
    ):
        evt_type = event.get("event")
        data = event.get("data", {})
        if evt_type == "token":
            collected_tokens.append(data.get("token", ""))
        elif evt_type == "medical_intercept":
            is_emergency = True
        elif evt_type == "citations":
            for c in data.get("citations", []):
                citations.append(CitationItem(**c))

    return ChatSyncResponse(
        reply="".join(collected_tokens).strip(),
        is_medical_refusal=is_emergency,
        citations=citations,
        language=req.language,
    )


@router.post("/chat/sync", response_model=ChatSyncResponse)
async def chat_sync_endpoint(req: ChatRequest, request: Request):
    """
    Synchronous fallback endpoint returning the complete grounded reply and citations.
    """
    chat_rate_limiter.enforce(request)
    client_ip = request.client.host if request.client else "127.0.0.1"
    return chat_sync_service(req, client_ip)
