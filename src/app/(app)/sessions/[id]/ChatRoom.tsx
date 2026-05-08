"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DifficultyBadge } from "@/components/ui/Badge";
import type { MessageRow, SessionRow } from "@/lib/supabase/types";

interface Props {
  session: SessionRow;
  initialMessages: MessageRow[];
}

interface DisplayMessage {
  id: string;
  role: "user" | "prospect" | "system";
  content: string;
  pending?: boolean;
}

export function ChatRoom({ session, initialMessages }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "prospect" | "system",
      content: m.content,
    })),
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  useEffect(() => {
    if (hasOpenedRef.current) return;
    if (initialMessages.length > 0) {
      hasOpenedRef.current = true;
      return;
    }
    hasOpenedRef.current = true;
    void requestProspectOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages.length]);

  async function requestProspectOpening() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: null, opening: true }),
      });
      if (!res.ok) throw new Error("Le prospect ne décroche pas.");
      const data = await res.json();
      handleProspectReply(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function handleProspectReply(data: {
    prospectMessage?: { id: string; content: string };
    signal: { type: "continue" | "hangup" | "appointment"; reason?: string; date?: string };
    sessionEnded?: boolean;
  }) {
    if (data.prospectMessage) {
      setMessages((prev) => [
        ...prev,
        {
          id: data.prospectMessage!.id,
          role: "prospect",
          content: data.prospectMessage!.content,
        },
      ]);
    }

    if (data.signal.type === "hangup") {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-hangup-${Date.now()}`,
          role: "system",
          content: `Le prospect a raccroché.${data.signal.reason ? ` Raison : ${data.signal.reason}.` : ""}`,
        },
      ]);
      setEnded(true);
    } else if (data.signal.type === "appointment") {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-appt-${Date.now()}`,
          role: "system",
          content: `RDV obtenu ! ${data.signal.date ?? ""}`.trim(),
        },
      ]);
      setEnded(true);
    }

    if (data.sessionEnded) {
      setTimeout(() => router.push(`/sessions/${session.id}/feedback`), 2200);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || sending || ended) return;

    const optimistic: DisplayMessage = {
      id: `optim-${Date.now()}`,
      role: "user",
      content: draft.trim(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const content = draft.trim();
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de l'envoi.");
      }
      const data = await res.json();
      handleProspectReply(data);
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
    if (endLoading) return;
    if (!confirm("Mettre fin à l'appel maintenant ?")) return;
    setEndLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endedBy: "user" }),
      });
      if (!res.ok) throw new Error("Impossible de terminer la session.");
      router.push(`/sessions/${session.id}/feedback`);
    } catch (err) {
      setError((err as Error).message);
      setEndLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div
        className="border-b"
        style={{
          background: "var(--color-lavender)",
          borderColor: "rgba(52, 36, 75, 0.08)",
        }}
      >
        <div className="container-noxias py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-h4">{session.persona_label}</div>
              <div
                className="text-meta uppercase tracking-widest"
                style={{ color: "var(--color-gray)" }}
              >
                Appel en cours pour{" "}
                <span style={{ color: "var(--color-purple)" }}>
                  {session.client_name_snapshot ?? "—"}
                </span>
              </div>
            </div>
            <DifficultyBadge difficulty={session.difficulty} />
          </div>
          <div className="flex items-center gap-3">
            {!ended && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleEnd}
                loading={endLoading}
              >
                Mettre fin à l'appel
              </Button>
            )}
            {ended && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push(`/sessions/${session.id}/feedback`)}
              >
                Voir la restitution →
              </Button>
            )}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="container-noxias py-8 max-w-3xl">
          <div className="space-y-4">
            {messages.length === 0 && !sending && (
              <div className="text-center py-12">
                <p className="text-body" style={{ color: "var(--color-gray)" }}>
                  Le téléphone sonne...
                </p>
              </div>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 pl-4">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span
                  className="text-meta ml-2"
                  style={{ color: "var(--color-gray)" }}
                >
                  Le prospect réfléchit...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="border-t"
        style={{
          background: "#FFFFFF",
          borderColor: "rgba(52, 36, 75, 0.08)",
        }}
      >
        <div className="container-noxias py-4 max-w-3xl">
          {error && (
            <div
              className="rounded-md px-3 py-2 text-small mb-3"
              style={{
                background: "rgba(233, 75, 75, 0.08)",
                color: "var(--color-error)",
                border: "1px solid rgba(233, 75, 75, 0.24)",
              }}
            >
              {error}
            </div>
          )}

          {ended ? (
            <div className="text-center py-3">
              <p className="text-body" style={{ color: "var(--color-gray)" }}>
                L'appel est terminé. Tu vas être redirigé vers la restitution.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex gap-3 items-end">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={2}
                disabled={sending}
                placeholder="Réponds au prospect... (Entrée pour envoyer, Shift+Entrée pour passer à la ligne)"
                className="input flex-1 resize-none"
                style={{ minHeight: "60px" }}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!draft.trim() || sending}
              >
                Envoyer
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: DisplayMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center my-4 animate-fade-in">
        <div
          className="rounded-pill px-4 py-2 text-small"
          style={{
            background: "rgba(52, 36, 75, 0.08)",
            color: "var(--color-purple)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div
      className={`flex animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className="rounded-lg px-5 py-3 max-w-[80%]"
        style={{
          background: isUser ? "var(--color-green)" : "var(--color-lavender)",
          color: "var(--color-dark)",
          border: isUser ? "none" : "1px solid rgba(52, 36, 75, 0.08)",
        }}
      >
        <div
          className="text-meta uppercase tracking-wider mb-1"
          style={{ opacity: 0.6 }}
        >
          {isUser ? "Toi" : "Prospect"}
        </div>
        <div className="text-body whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
