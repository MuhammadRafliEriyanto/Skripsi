"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  MessageCircle,
  SendHorizonal,
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
    text:
      "Halo! Saya asisten AI Bina Cendekia. Ada yang bisa saya bantu hari ini?",
  },
];

const LANDING_CHATBOT_FALLBACK_TEXT =
  "Maaf, asisten sedang mengalami kendala. Silakan coba beberapa saat lagi.";
const MAX_REQUEST_MESSAGES = 8;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function toRequestMessages(messages: ChatMessage[]) {
  return messages.slice(-MAX_REQUEST_MESSAGES).map((message) => ({
    role: message.role,
    text: message.text,
  }));
}

async function requestBotReply(messages: ChatMessage[]) {
  const response = await fetch("/api/landing-chatbot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: toRequestMessages(messages),
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
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
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
    const nextMessage = {
      ...message,
      id: nextIdRef.current++,
    };

    setMessages((current) => [
      ...current,
      nextMessage,
    ]);

    return nextMessage;
  }

  async function queueBotReply(conversationMessages: ChatMessage[]) {
    const requestId = ++latestReplyRequestRef.current;
    setIsTyping(true);

    try {
      const [replyResult] = await Promise.allSettled([
        requestBotReply(conversationMessages),
        wait(520),
      ]);

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

    const userMessage = appendMessage({
      role: "user",
      text: trimmedMessage,
    });
    setInputValue("");
    setIsOpen(true);
    void queueBotReply([...messages, userMessage]);
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
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-end sm:inset-x-4 sm:bottom-4 lg:inset-x-5 lg:bottom-5">
      {/* Label removed */}
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-[26px] border border-white/12 bg-white/12 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.56)] backdrop-blur-2xl transition-all duration-300 origin-bottom-right",
            "h-[min(460px,calc(100dvh-10rem))] w-full max-w-[318px] sm:h-[min(500px,calc(100dvh-10.5rem))] sm:max-w-[330px]",
            isOpen
              ? "scale-100 opacity-100 translate-y-0 pointer-events-auto relative"
              : "scale-90 opacity-0 translate-y-8 pointer-events-none absolute bottom-0 right-0"
          )}
        >
            <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,rgba(136,19,55,0.94)_0%,rgba(194,65,12,0.93)_54%,rgba(251,146,60,0.9)_100%)] px-3.5 py-3 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0)_34%,rgba(15,23,42,0.12)_100%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[15px] bg-white/14 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.34)]">
                    <Bot className="size-4.5 text-yellow-200" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <h2 className="text-[15px] font-semibold">Cendekia AI</h2>
                    <p className="mt-0.5 text-[12px] leading-5 text-white/78">
                      Ada yang bisa kami bantu?
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-full border border-white/14 bg-white/10 text-white/86 transition hover:bg-white/16"
                  aria-label="Tutup chatbot"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,250,245,0.96))]">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[20px] px-3 py-2.5 text-[12px] leading-5 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.18)]",
                        message.role === "user"
                          ? "rounded-br-[10px] bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] text-white"
                          : "rounded-bl-[10px] border border-orange-100 bg-white text-slate-700",
                      )}
                    >
                      <p className="whitespace-pre-line">{message.text}</p>

                      {message.cta ? (
                        message.cta.href.startsWith("#") ? (
                          <button
                            type="button"
                            onClick={() => handleAnchorNavigation(message.cta!.href)}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100"
                          >
                            {message.cta.label}
                            <ArrowRight className="size-3" />
                          </button>
                        ) : (
                          <Link
                            href={message.cta.href}
                            target={message.cta.external ? "_blank" : undefined}
                            rel={message.cta.external ? "noreferrer" : undefined}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100"
                            onClick={() => setIsOpen(false)}
                          >
                            {message.cta.label}
                            <ArrowRight className="size-3" />
                          </Link>
                        )
                      ) : null}
                    </div>
                  </div>
                ))}

                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="rounded-[20px] rounded-bl-[10px] border border-orange-100 bg-white px-3 py-2.5 text-[12px] text-slate-500 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.18)]">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-orange-300 animate-[pulse_1.2s_ease-in-out_infinite]" />
                        <span className="size-2 rounded-full bg-orange-400 animate-[pulse_1.2s_ease-in-out_0.15s_infinite]" />
                        <span className="size-2 rounded-full bg-orange-500 animate-[pulse_1.2s_ease-in-out_0.3s_infinite]" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-orange-100/80 px-3 pb-3 pt-2.5">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmitMessage(inputValue);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder="Tulis pertanyaanmu..."
                    className="h-9 rounded-full border-orange-100 bg-white/96 pr-4 text-[12px] shadow-[0_8px_20px_-18px_rgba(15,23,42,0.2)]"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isTyping}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] text-white shadow-[0_24px_36px_-24px_rgba(249,115,22,0.38)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Kirim pesan"
                  >
                    <SendHorizonal className="size-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            "group inline-flex size-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] text-white shadow-[0_26px_42px_-24px_rgba(249,115,22,0.44)] transition-all duration-300 hover:brightness-105 sm:size-12 lg:size-13",
            isOpen ? "scale-50 opacity-0 pointer-events-none absolute bottom-0 right-0" : "scale-100 opacity-100 pointer-events-auto hover:-translate-y-0.5 relative"
          )}
          aria-label="Buka chatbot"
        >
          <MessageCircle className="size-4.5 transition duration-300 group-hover:scale-105 sm:size-5" />
        </button>
      </div>
    </div>
  );
}
