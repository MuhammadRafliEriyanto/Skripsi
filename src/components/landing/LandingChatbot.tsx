"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  GraduationCap,
  MapPin,
  MessageCircle,
  SendHorizonal,
  Sparkles,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: number;
  role: "bot" | "user";
  text: string;
  cta?: {
    label: string;
    href: string;
    external?: boolean;
  };
};

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "bot",
    text: "Halo! Saya asisten AI Bina Cendekia. Ada yang bisa saya bantu hari ini?",
  },
];

const LANDING_CHATBOT_FALLBACK_TEXT =
  "Maaf, asisten sedang mengalami kendala. Silakan coba beberapa saat lagi.";

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function requestBotReply(message: string) {
  const response = await fetch("/api/landing-chatbot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
    }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        text?: unknown;
      }
    | null;
  const replyText = typeof payload?.text === "string" ? payload.text.trim() : "";

  if (replyText) {
    return replyText;
  }

  throw new Error("Landing chatbot API mengembalikan respons yang tidak valid.");
}

export default function LandingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const nextIdRef = useRef(initialMessages.length + 1);
  const latestReplyRequestRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({
        block: "end",
        behavior: "smooth",
      });
    }
  }, [isOpen, isTyping, messages]);

  useEffect(() => {
    return () => {
      latestReplyRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const closeChatbotWhenDialogOpens = () => {
      const hasOpenDialog = Boolean(
        document.querySelector('[role="dialog"][data-state="open"]'),
      );

      if (hasOpenDialog) {
        setIsOpen(false);
      }
    };

    closeChatbotWhenDialogOpens();

    const observer = new MutationObserver(() => {
      closeChatbotWhenDialogOpens();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "role"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  function appendMessage(message: Omit<ChatMessage, "id">) {
    setMessages((current) => [
      ...current,
      {
        ...message,
        id: nextIdRef.current++,
      },
    ]);
  }

  async function queueBotReply(prompt: string) {
    const requestId = ++latestReplyRequestRef.current;
    setIsTyping(true);

    try {
      const [replyResult] = await Promise.allSettled([requestBotReply(prompt), wait(520)]);

      if (latestReplyRequestRef.current !== requestId) {
        return;
      }

      if (replyResult.status !== "fulfilled") {
        throw replyResult.reason;
      }

      appendMessage({
        role: "bot",
        text: replyResult.value,
      });
    } catch (error) {
      if (latestReplyRequestRef.current !== requestId) {
        return;
      }

      console.error("[landing-chatbot] request_failed", error);

      appendMessage({
        role: "bot",
        text: LANDING_CHATBOT_FALLBACK_TEXT,
      });
    } finally {
      if (latestReplyRequestRef.current === requestId) {
        setIsTyping(false);
      }
    }
  }

  function handleSubmitMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isTyping) {
      return;
    }

    appendMessage({
      role: "user",
      text: trimmedMessage,
    });
    setInputValue("");
    setIsOpen(true);
    void queueBotReply(trimmedMessage);
  }

  function handleAnchorNavigation(href: string) {
    if (!href.startsWith("#")) {
      return;
    }

    const target = document.getElementById(href.slice(1));
    if (!target) {
      return;
    }

    const targetTop = target.getBoundingClientRect().top + window.scrollY - 92;
    window.history.replaceState(null, "", href);
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
    setIsOpen(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6 flex flex-col items-end">
      {/* Chat Window */}
      <div
        className={cn(
          "mb-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 origin-bottom-right sm:mb-5 border border-slate-100",
          "w-[calc(100vw-2rem)] h-[480px] max-h-[calc(100vh-6rem)] sm:w-[380px]",
          isOpen
            ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
            : "scale-90 opacity-0 translate-y-8 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-white px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <Bot className="size-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">Asisten AI</h2>
              <p className="text-[12px] text-slate-500">Ada yang bisa kami bantu?</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
                  message.role === "user"
                    ? "bg-orange-500 text-white rounded-br-sm"
                    : "bg-white text-slate-700 border border-slate-100 shadow-sm rounded-bl-sm"
                )}
              >
                <p>{message.text}</p>
                {message.cta && (
                  <div className="mt-3">
                    {message.cta.href.startsWith("#") ? (
                      <button
                        type="button"
                        onClick={() => handleAnchorNavigation(message.cta!.href)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-[12px] font-medium text-orange-600 transition-colors hover:bg-orange-100"
                      >
                        {message.cta.label}
                        <ArrowRight className="size-3" />
                      </button>
                    ) : (
                      <Link
                        href={message.cta.href}
                        target={message.cta.external ? "_blank" : undefined}
                        rel={message.cta.external ? "noreferrer" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-[12px] font-medium text-orange-600 transition-colors hover:bg-orange-100"
                        onClick={() => setIsOpen(false)}
                      >
                        {message.cta.label}
                        <ArrowRight className="size-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-slate-300 animate-[bounce_1s_infinite]" />
                  <span className="size-2 rounded-full bg-slate-300 animate-[bounce_1s_0.2s_infinite]" />
                  <span className="size-2 rounded-full bg-slate-300 animate-[bounce_1s_0.4s_infinite]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-100 bg-white p-4">
          <form
            onSubmit={(e) => {
               e.preventDefault();
               handleSubmitMessage(inputValue);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ketik pesan..."
              className="h-11 rounded-full border-slate-200 bg-slate-50 px-4 text-[13px] focus-visible:ring-1 focus-visible:ring-orange-500"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <SendHorizonal className="size-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex size-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 sm:size-16",
          isOpen ? "rotate-90 scale-90" : "rotate-0 scale-100"
        )}
      >
        {isOpen ? <X className="size-6" /> : <MessageCircle className="size-6 sm:size-7" />}
      </button>
    </div>
  );
}
