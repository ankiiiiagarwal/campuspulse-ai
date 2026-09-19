"use client";

import { HELP_CHAT_EVENT } from "@/lib/chat-open";
import { speechLang, useLang } from "@/lib/i18n";
import { canListen, speak, startListening, stopSpeaking, warmupVoice, type ListenHandle } from "@/lib/voice";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

interface Bubble {
  role: Role;
  content: string;
  suggestReport?: boolean;
}

const STORAGE_KEY = "campuspulse-help-chat";

function ticketFromPath(pathname: string): string {
  const m = pathname.match(/^\/ticket\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : "";
}

function loadSaved(): Bubble[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Bubble[]) : [];
    return Array.isArray(parsed) ? parsed.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-16) : [];
  } catch {
    return [];
  }
}

export function HelpChat() {
  const pathname = usePathname();
  const { lang, t } = useLang();
  const staff = pathname.startsWith("/admin") || pathname.startsWith("/dept");
  const ticketCode = ticketFromPath(pathname);
  const starters = ticketCode
    ? [t("starterTicket", { code: ticketCode }), t("starterWifi"), t("starterTap"), t("starterLight")]
    : [t("starterWifi"), t("starterTap"), t("starterLight"), t("starterReport"), t("starterTrack")];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [listening, setListening] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const messagesRef = useRef<Bubble[]>([]);
  const busyRef = useRef(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const pathRef = useRef({ pathname, ticketCode, lang });
  pathRef.current = { pathname, ticketCode, lang };

  useEffect(() => {
    const saved = loadSaved();
    setMessages(saved);
    messagesRef.current = saved;
    warmupVoice();
    stopSpeaking();
    return () => {
      listenRef.current?.stop();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-16)));
    } catch {
      /* ignore quota */
    }
  }, [messages]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, open, busy]);

  function stopMic() {
    listenRef.current?.stop();
    listenRef.current = null;
    setListening(false);
  }

  function closeChat() {
    stopMic();
    stopSpeaking();
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busyRef.current) return;
    if (content.length > 600) { setError(lang === "hi" ? "कृपया 600 अक्षरों में पूछें।" : "Keep your question within 600 characters."); return; }
    stopMic();
    setError("");
    setDraft("");
    const next: Bubble[] = [...messagesRef.current, { role: "user", content }];
    messagesRef.current = next;
    setMessages(next);
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        signal: AbortSignal.timeout(45000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-16).map((m) => ({ role: m.role, content: m.content })),
          context: {
            page: pathRef.current.pathname,
            ticketCode: pathRef.current.ticketCode,
            lang: pathRef.current.lang,
          },
        }),
      });
      const data = (await res.json()) as { reply?: string; suggestReport?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not answer");
      const reply = data.reply || "Try again in a moment.";
      const withReply: Bubble[] = [...next, { role: "assistant", content: reply, suggestReport: Boolean(data.suggestReport) }];
      messagesRef.current = withReply;
      setMessages(withReply);
    } catch (e) {
      setError(e instanceof Error && e.name === "TimeoutError" ? "That took too long. Please try again." : e instanceof Error ? e.message : "Could not answer");
      messagesRef.current = next.slice(0, -1); setMessages(next.slice(0, -1)); setDraft(content);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setTimeout(() => { if (openRef.current) inputRef.current?.focus(); }, 50);
    }
  }

  function toggleListen() {
    if (listening) {
      stopMic();
      return;
    }
    if (!canListen()) {
      setError(t("voiceNeedChrome"));
      return;
    }
    stopSpeaking();
    setError("");
    const handle = startListening({
      lang: speechLang(lang),
      continuous: false,
      onStart: () => setListening(true),
      onInterim: (text) => setDraft(text),
      onFinal: (text) => {
        setDraft(text);
        stopMic();
        void send(text);
      },
      onError: (message) => setError(message),
      onEnd: () => {
        listenRef.current = null;
        setListening(false);
      },
    });
    listenRef.current = handle;
  }

  useEffect(() => {
    if (staff) return;
    function onOpen(ev: Event) {
      const prefill = String((ev as CustomEvent<{ prefill?: string }>).detail?.prefill || "").trim();
      setOpen(true);
      warmupVoice();
      if (prefill) void send(prefill);
      else setTimeout(() => inputRef.current?.focus(), 50);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") closeChat();
    }
    window.addEventListener(HELP_CHAT_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(HELP_CHAT_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  if (staff) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <div className="cp-chat-shell pointer-events-none fixed z-[1300] flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <section
          role="dialog"
          id="campus-assistant"
          aria-label={t("chatTitle")}
          className="cp-chat-panel cp-chat-enter pointer-events-auto flex flex-col overflow-hidden rounded-3xl border border-rule bg-paper shadow-[0_18px_70px_-12px_rgba(18,61,53,.28)]"
        >
          <header className="flex items-center justify-between gap-3 bg-navy px-5 py-4 text-white">
            <div>
              <p className="font-serif text-xl font-semibold">{lang === "hi" ? "कैंपस साथी" : "Your campus assistant"}</p>
              <p className="text-xs text-paper/70">
                {ticketCode ? `${t("chatAnonTicket")} · ${ticketCode}.` : t("chatAnon")}
              </p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-xl text-white/80 hover:bg-white/10"
              aria-label={t("close")}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div ref={scroller} role="log" aria-live="polite" aria-label={lang === "hi" ? "बातचीत" : "Conversation"} className="cp-chat-log min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <div className="text-sm text-ink/75">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-navy/10 text-navy"><ChatIcon /></div>
                <p className="mb-2 font-serif text-2xl text-navy">{lang === "hi" ? "कैसे मदद करूँ?" : "How can I help?"}</p>
                <p className="leading-relaxed">{t("chatIntro")}</p>
                <div className="mt-5 grid gap-2">
                  {starters.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void send(q)}
                      className="rounded-xl border border-rule bg-white px-3 py-2.5 text-left text-sm font-semibold text-navy hover:bg-navy/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`cp-message flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-rule bg-white text-ink"
                  }`}
                >
                  {m.content}
                  {m.role === "assistant" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => speak(m.content, (message) => setError(message), speechLang(lang))}
                        className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-navy"
                      >
                        {t("readAloud")}
                      </button>
                      {m.suggestReport ? (
                        <Link href="/report" onClick={closeChat} className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-paper">
                          {t("fileAReport")}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {busy ? <p role="status" className="flex items-center gap-2 text-xs text-ink/60"><span aria-hidden="true" className="flex gap-1"><span className="cp-dot" /><span className="cp-dot" /><span className="cp-dot" /></span>{t("thinking")}</p> : null}
            {listening ? <p className="text-xs font-semibold text-onit">{t("listeningTap")}</p> : null}
            {error ? <p role="alert" className="rounded-xl bg-critical/5 p-3 text-sm text-critical">{error}</p> : null}
          </div>

          <form onSubmit={onSubmit} className="border-t border-rule bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                aria-label={lang === "hi" ? "अपना सवाल लिखें" : "Message the campus assistant"}
                maxLength={600}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={2}
                placeholder={listening ? t("listening") : t("whatBroken")}
                className="max-h-24 min-h-[2.5rem] min-w-0 flex-1 resize-none rounded-xl border border-rule bg-paper/50 px-3 py-2 text-sm outline-none ring-navy/20 focus:ring-2"
              />
              <button
                type="button"
                onClick={toggleListen}
                aria-label={listening ? t("stopListening") : t("speakQuestion")}
                title={listening ? t("stopListening") : t("speakQuestion")}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  listening ? "bg-critical text-white" : "bg-navy text-paper"
                }`}
              >
                <MicIcon pulse={listening} />
              </button>
              <button
                type="submit"
                disabled={busy || draft.trim().length < 2}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-xl font-semibold text-white disabled:opacity-50"
                aria-label={t("ask")}
              >
                <span aria-hidden="true">↑</span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-ink/50">{lang === "hi" ? "सुझावों की जाँच करें। खतरा हो तो स्टाफ को बताएँ।" : "Guidance, not a repair crew. Report hazards to staff."}</p>
          </form>
        </section>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          if (open) closeChat();
          else {
            setOpen(true);
            warmupVoice();
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className="cp-lift pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 bg-navy px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_24px_-4px_rgba(18,61,53,.3)]"
        aria-controls="campus-assistant"
        aria-expanded={open}
        aria-label={open ? t("close") : t("askHow")}
      >
        <ChatIcon />
        {open ? t("hide") : t("askHow")}
      </button>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5v2h10V9H7Zm0 4v2h7v-2H7Z" />
    </svg>
  );
}

function MicIcon({ pulse }: { pulse?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${pulse ? "animate-pulse" : ""}`} fill="currentColor" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}
