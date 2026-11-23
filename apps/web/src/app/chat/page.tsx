"use client";

import React, { useState, useEffect, useRef } from "react";
import { sendChatSync, ChatCitation } from "@/lib/api";
import { getStoredProfile } from "@/lib/storage";
import { useTranslation } from "@/lib/i18n";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  isEmergency?: boolean;
  citations?: ChatCitation[];
  timestamp: string;
}

export default function ChatPage() {
  const { t, lang } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      sender: "assistant",
      text: "Namaste. I am SanjhiHawa, your winter smog and clean air assistant. I use deterministic exposure equations and peer-reviewed air research to advise on routines, indoor air quality hacks, and mask usage. Ask me anything, or pick a prompt below.",
      citations: [
        {
          id: "cpcb-naqi-bands",
          title: "National Air Quality Index",
          publisher: "Central Pollution Control Board",
        },
      ],
      timestamp: "",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // Populate client-side timestamp for the initial welcome message only after mounting
    setMessages((prev) =>
      prev.map((m) =>
        m.id === "intro" && !m.timestamp
          ? { ...m, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
          : m
      )
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const quickPrompts = [
    {
      label: lang === "hi" ? "पौधों का भ्रम" : lang === "mr" ? "झाडांचा गैरसमज" : "Do plants clean smog?",
      query:
        lang === "hi"
          ? "क्या घर में पौधे लगाने से PM2.5 प्रदूषण कम होता है?"
          : lang === "mr"
          ? "घरातील झाडे हवेतील धूर स्वच्छ करू शकतात का?"
          : "Do indoor snake plants actually filter PM2.5 smog?",
    },
    {
      label: lang === "hi" ? "गुड़ का सच" : lang === "mr" ? "गूळ गैरसमज" : "Can jaggery detox lungs?",
      query:
        lang === "hi"
          ? "क्या गुड़ खाने से फेफड़ों का प्रदूषण साफ होता है?"
          : "Does eating jaggery (gur) clean inhaled particulate matter from lungs?",
    },
    {
      label: lang === "hi" ? "N95 बनाम कपड़ा" : lang === "mr" ? "N95 विरुद्ध कापड" : "N95 vs cloth mask",
      query: "Why are cloth masks and handkerchiefs ineffective against PM2.5 compared to N95?",
    },
    {
      label: lang === "hi" ? "प्यूरीफायर साइज" : lang === "mr" ? "प्युरिफायर क्षमता" : "Purifier sizing",
      query: "How do I calculate the required CADR for an 12x10 ft bedroom?",
    },
    {
      label: lang === "hi" ? "सैर का समय" : lang === "mr" ? "व्यायामाची वेळ" : "Best walk time",
      query: "When is the lowest exposure window for a morning walk in Ghaziabad?",
    },
    {
      label: lang === "hi" ? "DIY प्यूरीफायर" : lang === "mr" ? "DIY प्युरिफायर" : "DIY Corsi-Rosenthal",
      query: "How do I build a DIY Corsi-Rosenthal box air purifier?",
    },
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: "u_" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Get household profile from client storage
      const profile = getStoredProfile();

      const res = await sendChatSync(textToSend, profile, lang);

      const botMsg: Message = {
        id: "b_" + Date.now(),
        sender: "assistant",
        text: res.reply,
        isEmergency: res.is_medical_refusal,
        citations: res.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "err_" + Date.now(),
          sender: "assistant",
          text: "I encountered a communication error with the exposure engine. Please check your connection and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto flex flex-col font-sans text-ink space-y-4">
      {/* Page Header */}
      <div className="border-b hairline border-rule pb-4 mb-2">
        <div>
          <span className="font-mono text-xs md:text-sm uppercase tracking-wider text-ink-muted font-bold">
            {t("chat.eyebrow")}
          </span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mt-1 text-ink tracking-tight">
            {t("chat.title")}
          </h1>
          <p className="text-sm md:text-base text-ink-muted mt-1 max-w-2xl leading-relaxed">
            {t("chat.subtitle")}
          </p>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="mb-4">
        <div className="font-mono text-xs text-ink-muted font-bold mb-2">{t("chat.quick_queries_title")}</div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((p, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => handleSend(p.query)}
              disabled={loading}
              className="px-3.5 py-1.5 bg-surface border hairline border-rule hover:bg-paper hover:border-ink text-xs md:text-sm font-medium text-ink transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Message Window */}
      <div
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Conversation with SanjhiHawa assistant"
        className="flex-1 bg-surface border hairline border-rule p-5 overflow-y-auto min-h-[400px] max-h-[540px] flex flex-col space-y-4 mb-4 rounded-none"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] p-4 border text-sm md:text-base ${
                m.sender === "user"
                  ? "bg-ink text-paper border-ink shadow-xs"
                  : "bg-paper text-ink border-rule shadow-xs"
              }`}
            >
                {/* Message Body */}
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

                {/* Citations Box */}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-3 pt-2 border-t hairline border-rule/50 text-xs font-mono">
                    <span className="text-ink-muted uppercase tracking-wider block mb-1">
                      VERIFIED PEER-REVIEWED SOURCES:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 bg-surface border border-rule text-ink-muted text-[11px]"
                          title={`${c.title} — ${c.publisher}`}
                        >
                          [{c.id}] {c.publisher}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10px] font-mono text-ink-muted mt-1 px-1" suppressHydrationWarning>
                {m.sender === "user" ? "You" : "SanjhiHawa"} {mounted && m.timestamp ? `• ${m.timestamp}` : ""}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="p-3 bg-paper border hairline border-rule text-sm text-ink-muted font-mono flex items-center space-x-2">
                <span className="inline-block w-2 h-2 bg-ink animate-pulse"></span>
                <span>Calculating exposure & retrieving verified chunks...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="border border-rule bg-surface p-2 flex items-center gap-2">
          <label htmlFor="chat-input" className="sr-only">
            {t("chat.input_placeholder")}
          </label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.input_placeholder")}
            disabled={loading}
            className="flex-1 bg-paper border border-rule px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink font-sans"
          />

          <button
            type="button"
            aria-label="Send message"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-5 py-2 bg-ink text-paper text-sm font-semibold hover:bg-ink-muted transition-colors disabled:opacity-50 font-mono uppercase"
          >
            {loading ? "..." : t("chat.btn_send")}
          </button>
        </div>
    </div>
  );
}
