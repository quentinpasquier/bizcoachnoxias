"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DifficultyBadge } from "@/components/ui/Badge";
import {
  createRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  loadVoices,
  speak,
  stopSpeaking,
  type MinimalSpeechRecognition,
  type SpeechRecognitionEvent,
} from "@/lib/voice";
import type { Gender, MessageRow, SessionRow } from "@/lib/supabase/types";

interface Props {
  session: SessionRow;
  initialMessages: MessageRow[];
}

interface DisplayMessage {
  id: string;
  role: "user" | "prospect" | "system";
  content: string;
}

export function ChatRoom({ session, initialMessages }: Props) {
  const router = useRouter();
  const gender: Gender = (session.gender as Gender) ?? "homme";

  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "prospect" | "system",
      content: m.content,
    })),
  );

  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice state
  const [voiceMode, setVoiceMode] = useState<boolean>(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [voiceSupported, setVoiceSupported] = useState({ tts: false, stt: false });

  // Refs
  const transcriptRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  // ----- Initialisation voix -----
  useEffect(() => {
    setVoiceSupported({
      tts: isSpeechSynthesisSupported(),
      stt: isSpeechRecognitionSupported(),
    });
    void loadVoices();
    return () => {
      stopSpeaking();
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, []);

  // ----- Auto-scroll -----
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, interimTranscript]);

  // ----- Décrochage initial -----
  useEffect(() => {
    if (hasOpenedRef.current) return;
    hasOpenedRef.current = true;
    if (initialMessages.length > 0) {
      // Joue la dernière prospect si reload
      const lastProspect = [...initialMessages]
        .reverse()
        .find((m) => m.role === "prospect");
      if (lastProspect && voiceMode) {
        playProspectAudio(lastProspect.content);
      }
      return;
    }
    void requestProspectOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playProspectAudio(text: string) {
    if (!voiceMode || !voiceSupported.tts || ended) return;
    setIsSpeaking(true);
    speak({
      text,
      gender,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  async function requestProspectOpening() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: null, opening: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Le prospect ne décroche pas.");
      }
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
      playProspectAudio(data.prospectMessage.content);
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
      setTimeout(() => router.push(`/sessions/${session.id}/feedback`), 3500);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || sending || ended) return;

    const optimistic: DisplayMessage = {
      id: `optim-${Date.now()}`,
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
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
      setDraft(text.trim());
    } finally {
      setSending(false);
    }
  }

  // ----- Reconnaissance vocale -----
  function startListening() {
    if (!voiceSupported.stt || isListening || sending || ended) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    finalTranscriptRef.current = "";
    setInterimTranscript("");
    const recognition = createRecognition();
    if (!recognition) {
      setError("Reconnaissance vocale non disponible dans ce navigateur.");
      return;
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current = (finalTranscriptRef.current + " " + final).trim();
      }
      setInterimTranscript(interim);
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      const finalText = finalTranscriptRef.current.trim();
      const interimText = setInterimTranscript("") ?? "";
      void interimText;
      if (finalText.length > 0) {
        void sendMessage(finalText);
      }
      finalTranscriptRef.current = "";
    };
    recognition.onerror = (e: Event) => {
      const err = (e as unknown as { error?: string }).error ?? "unknown";
      if (err === "no-speech" || err === "aborted") {
        setIsListening(false);
        return;
      }
      setError(`Erreur micro : ${err}. Bascule en mode texte si besoin.`);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setError(`Impossible d'accéder au micro : ${(err as Error).message}`);
      setIsListening(false);
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }

  function toggleVoiceMode() {
    if (isListening) stopListening();
    if (isSpeaking) stopSpeaking();
    setVoiceMode((v) => !v);
  }

  async function handleEnd() {
    if (endLoading) return;
    if (!confirm("Mettre fin à l'appel maintenant ?")) return;
    if (isListening) stopListening();
    stopSpeaking();
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

  function replayProspect() {
    const lastProspect = [...messages].reverse().find((m) => m.role === "prospect");
    if (lastProspect) playProspectAudio(lastProspect.content);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
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
            <button
              type="button"
              onClick={toggleVoiceMode}
              className="text-meta hover:underline"
              style={{ color: "var(--color-gray)" }}
            >
              Mode {voiceMode ? "texte" : "voix"}
            </button>
            {!ended && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleEnd}
                loading={endLoading}
              >
                Raccrocher
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

      {/* Mode VOICE : interface call */}
      {voiceMode && voiceSupported.tts && voiceSupported.stt && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            {/* Indicateur d'état */}
            <div className="text-center">
              <div
                className={`text-meta uppercase tracking-widest mb-3 ${isSpeaking ? "" : "opacity-50"}`}
                style={{ color: "var(--color-purple)" }}
              >
                {isSpeaking
                  ? "Le prospect parle..."
                  : isListening
                    ? "À toi de parler"
                    : sending
                      ? "Le prospect réfléchit..."
                      : ended
                        ? "Appel terminé"
                        : "En ligne"}
              </div>
              <div className="font-display" style={{ fontSize: "2.5rem", color: "var(--color-purple)" }}>
                {session.persona_label}
              </div>
              {session.scenario_data && (
                <div className="text-body" style={{ color: "var(--color-gray)" }}>
                  {(session.scenario_data as { persona_name?: string; persona_role?: string }).persona_name}
                  {(session.scenario_data as { persona_role?: string }).persona_role
                    ? ` — ${(session.scenario_data as { persona_role?: string }).persona_role}`
                    : ""}
                </div>
              )}
            </div>

            {/* Visualiser état */}
            <SoundIndicator active={isSpeaking || isListening} thinking={sending} />

            {/* Transcript en cours (interim) */}
            {(isListening || interimTranscript) && (
              <div
                className="rounded-lg px-5 py-3 max-w-2xl text-center min-h-[56px] flex items-center justify-center"
                style={{
                  background: "rgba(60, 200, 121, 0.10)",
                  color: "var(--color-dark)",
                  border: "1px solid rgba(60, 200, 121, 0.32)",
                }}
              >
                <div>
                  <div
                    className="text-meta uppercase tracking-widest mb-1"
                    style={{ color: "var(--color-green)" }}
                  >
                    Tu dis...
                  </div>
                  <div className="text-body">
                    {interimTranscript || "(parle, je t'écoute)"}
                  </div>
                </div>
              </div>
            )}

            {/* Bouton micro géant */}
            {!ended && (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startListening();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    stopListening();
                  }}
                  disabled={sending || isSpeaking}
                  className="rounded-pill flex items-center justify-center transition-all duration-base disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    width: "120px",
                    height: "120px",
                    background: isListening
                      ? "var(--color-red)"
                      : "var(--color-green)",
                    color: "var(--color-dark)",
                    boxShadow: isListening
                      ? "0 0 0 8px rgba(233, 75, 75, 0.32)"
                      : "var(--shadow-lg)",
                    transform: isListening ? "scale(1.06)" : "scale(1)",
                  }}
                  aria-label={isListening ? "Relâche pour envoyer" : "Maintiens pour parler"}
                >
                  <MicIcon size={56} />
                </button>
                <div
                  className="text-meta uppercase tracking-widest"
                  style={{ color: "var(--color-gray)" }}
                >
                  {isListening ? "Relâche pour envoyer" : "Maintiens pour parler"}
                </div>
                <button
                  type="button"
                  onClick={replayProspect}
                  className="text-meta hover:underline"
                  style={{ color: "var(--color-gray)" }}
                >
                  Réécouter le prospect
                </button>
              </div>
            )}
          </div>

          {/* Transcript discret en bas */}
          <div
            className="border-t"
            style={{ borderColor: "rgba(52, 36, 75, 0.08)" }}
          >
            <details className="container-noxias py-3">
              <summary
                className="text-meta uppercase tracking-widest cursor-pointer"
                style={{ color: "var(--color-gray)" }}
              >
                Transcript ({messages.filter((m) => m.role !== "system").length} échange
                {messages.filter((m) => m.role !== "system").length > 1 ? "s" : ""})
              </summary>
              <div
                ref={transcriptRef}
                className="mt-3 max-h-[200px] overflow-y-auto space-y-2"
              >
                {messages.map((m) => (
                  <TranscriptLine key={m.id} message={m} />
                ))}
                {error && (
                  <div
                    className="text-meta px-3 py-2 rounded-md"
                    style={{
                      background: "rgba(233, 75, 75, 0.08)",
                      color: "var(--color-error)",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </details>
          </div>
        </>
      )}

      {/* Mode TEXT (fallback / Firefox / debug) */}
      {(!voiceMode || !voiceSupported.tts || !voiceSupported.stt) && (
        <>
          {!voiceSupported.stt && (
            <div
              className="px-4 py-2 text-meta text-center"
              style={{
                background: "rgba(245, 165, 36, 0.12)",
                color: "#8A5A0E",
              }}
            >
              Mode voix non disponible dans ce navigateur. Utilise Chrome ou Edge pour la voix. Ici, mode texte.
            </div>
          )}

          <div ref={transcriptRef} className="flex-1 overflow-y-auto">
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendMessage(draft);
                  }}
                  className="flex gap-3 items-end"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage(draft);
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
        </>
      )}
    </div>
  );
}

function MicIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SoundIndicator({
  active,
  thinking,
}: {
  active: boolean;
  thinking: boolean;
}) {
  if (thinking) {
    return (
      <div className="flex items-center gap-2">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    );
  }
  return (
    <div className="flex items-end gap-1.5 h-12">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-2 rounded-pill"
          style={{
            background: active
              ? "var(--color-green)"
              : "rgba(139, 127, 163, 0.32)",
            height: active ? `${20 + ((i * 13) % 36)}px` : "8px",
            transition: "height 0.2s",
            animation: active ? `wave ${0.6 + i * 0.1}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0% { height: 12px; }
          100% { height: 44px; }
        }
      `}</style>
    </div>
  );
}

function TranscriptLine({ message }: { message: DisplayMessage }) {
  if (message.role === "system") {
    return (
      <div
        className="text-meta italic text-center"
        style={{ color: "var(--color-gray)" }}
      >
        {message.content}
      </div>
    );
  }
  const isUser = message.role === "user";
  return (
    <div className="text-small">
      <span
        className="font-medium uppercase tracking-widest text-meta mr-2"
        style={{ color: isUser ? "var(--color-green)" : "var(--color-purple)" }}
      >
        {isUser ? "Toi" : "Prospect"}
      </span>
      <span style={{ color: "var(--color-dark)" }}>{message.content}</span>
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
