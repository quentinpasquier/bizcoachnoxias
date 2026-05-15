"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DifficultyBadge } from "@/components/ui/Badge";
import { VoiceOrb, type OrbState } from "@/components/VoiceOrb";
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
import type { Difficulty, Gender, MessageRow, SessionRow } from "@/lib/supabase/types";

const DIFFICULTY_INTENSITY: Record<Difficulty, 1 | 2 | 3 | 4> = {
  debutant: 1,
  intermediaire: 2,
  avance: 3,
  expert: 4,
};

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
  const personaName = (session.scenario_data as { persona_name?: string } | null)?.persona_name ?? "";
  const personaRole = (session.scenario_data as { persona_role?: string } | null)?.persona_role ?? "";

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

  const [voiceMode, setVoiceMode] = useState<boolean>(true);
  const [autoMode, setAutoMode] = useState<boolean>(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [voiceSupported, setVoiceSupported] = useState({ tts: false, stt: false });
  const [ttsEngine, setTtsEngine] = useState<"openai" | "webspeech" | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Délai de silence avant de considérer que le commercial a fini sa phrase.
  // L'auto-VAD natif du navigateur coupe vers 700-1000ms : trop court pour
  // une vraie pause de réflexion. On gère manuellement avec 1800ms.
  const SILENCE_END_MS = 1800;
  // Délai après que le prospect a fini de parler avant de relancer le mic.
  // Laisse au commercial le temps de respirer et de poser ses idées.
  const POST_PROSPECT_DELAY_MS = 700;

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

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, interimTranscript]);

  useEffect(() => {
    if (hasOpenedRef.current) return;
    hasOpenedRef.current = true;
    if (initialMessages.length > 0) {
      const lastProspect = [...initialMessages]
        .reverse()
        .find((m) => m.role === "prospect");
      if (lastProspect && voiceMode) {
        void playProspectAudio(lastProspect.content);
      }
      return;
    }
    void requestProspectOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  async function playProspectAudio(text: string) {
    if (!voiceMode || !voiceSupported.tts || ended) return;
    setIsSpeaking(true);
    const result = await speak({
      text,
      gender,
      seed: session.id,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        // Auto-mode : redémarre l'écoute après une vraie respiration
        if (autoMode && !ended && voiceSupported.stt) {
          setTimeout(() => {
            if (!isListening && !sending && !ended) {
              startListening();
            }
          }, POST_PROSPECT_DELAY_MS);
        }
      },
      onError: () => setIsSpeaking(false),
    });
    setTtsEngine(result.engine);
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
      void playProspectAudio(data.prospectMessage.content);
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
          content: `RDV obtenu. ${data.signal.date ?? ""}`.trim(),
        },
      ]);
      setEnded(true);
    }

    if (data.sessionEnded) {
      setTimeout(() => router.push(`/sessions/${session.id}/feedback?celebrate=1`), 3500);
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

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function scheduleSilenceStop(recognition: MinimalSpeechRecognition) {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // On ne ferme que s'il y a effectivement quelque chose à envoyer.
      // Sinon on laisse le mic ouvert : le commercial réfléchit encore.
      if (finalTranscriptRef.current.trim().length > 0) {
        try {
          recognition.stop();
        } catch {}
      }
    }, SILENCE_END_MS);
  }

  function startListening() {
    if (!voiceSupported.stt || isListening || sending || ended) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    finalTranscriptRef.current = "";
    setInterimTranscript("");
    clearSilenceTimer();

    // En mode auto, on garde continuous=true et on gère NOUS-MÊMES la fin
    // de phrase via un timer de silence (1800ms). C'est plus permissif que
    // le VAD natif du navigateur (700-1000ms) qui coupait trop tôt.
    const recognition = createRecognition({ continuous: true });
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

      // En auto-mode, chaque update repousse le timer de silence.
      // Tant que le commercial parle (final ou interim), on patiente.
      if (autoMode && (final.length > 0 || interim.length > 0)) {
        scheduleSilenceStop(recognition);
      }
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      const finalText = finalTranscriptRef.current.trim();
      setInterimTranscript("");
      if (finalText.length > 0) {
        void sendMessage(finalText);
      }
      finalTranscriptRef.current = "";
    };
    recognition.onerror = (e: Event) => {
      const err = (e as unknown as { error?: string }).error ?? "unknown";
      clearSilenceTimer();
      if (err === "no-speech" || err === "aborted") {
        setIsListening(false);
        // En auto-mode, on retente après une pause si no-speech, mais SANS
        // envoyer (le commercial n'a rien dit, on ne va pas lui envoyer du vide)
        if (autoMode && err === "no-speech" && !ended && !sending && !isSpeaking) {
          setTimeout(() => {
            if (!isListening && !sending && !ended && !isSpeaking) {
              startListening();
            }
          }, 800);
        }
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
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }

  function toggleListening() {
    if (sending || ended || isSpeaking) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
      router.push(`/sessions/${session.id}/feedback?celebrate=1`);
    } catch (err) {
      setError((err as Error).message);
      setEndLoading(false);
    }
  }

  function replayProspect() {
    const lastProspect = [...messages].reverse().find((m) => m.role === "prospect");
    if (lastProspect) void playProspectAudio(lastProspect.content);
  }

  const stateLabel = isSpeaking
    ? "Il te répond"
    : isListening
      ? "À toi de jouer"
      : sending
        ? "Il prend son temps..."
        : ended
          ? "Appel terminé"
          : "En ligne";

  const stateColor = isSpeaking
    ? "var(--color-purple)"
    : isListening
      ? "var(--color-red)"
      : sending
        ? "var(--color-gray)"
        : ended
          ? "var(--color-gray)"
          : "var(--color-green)";

  const useVoice = voiceMode && voiceSupported.tts && voiceSupported.stt;

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "calc(100vh - 4rem)", background: "#FAF9FC" }}
    >
      {/* TOP BAR */}
      <div
        className="border-b"
        style={{
          background: "#FFFFFF",
          borderColor: "var(--color-gray-border)",
        }}
      >
        <div className="container-noxias py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="hidden sm:flex items-center justify-center rounded-pill flex-shrink-0"
              style={{
                width: "44px",
                height: "44px",
                background: "var(--color-purple)",
                color: "#FFFFFF",
                fontWeight: 700,
              }}
            >
              {(personaName || session.persona_label).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-h4 truncate">
                {personaName || session.persona_label}
              </div>
              <div className="text-meta truncate" style={{ color: "var(--color-gray)" }}>
                {personaRole || session.persona_label} · pour{" "}
                <span style={{ color: "var(--color-purple)", fontWeight: 600 }}>
                  {session.client_name_snapshot ?? "Client"}
                </span>
              </div>
            </div>
            <DifficultyBadge difficulty={session.difficulty} />
          </div>
          <div className="flex items-center gap-3">
            {ttsEngine && (
              <span
                className="text-meta hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-pill"
                style={{
                  background:
                    ttsEngine === "openai"
                      ? "rgba(60, 200, 121, 0.10)"
                      : "rgba(245, 165, 36, 0.12)",
                  color:
                    ttsEngine === "openai" ? "#1F6A3F" : "#8A5A0E",
                  border: `1px solid ${
                    ttsEngine === "openai"
                      ? "rgba(60, 200, 121, 0.32)"
                      : "rgba(245, 165, 36, 0.32)"
                  }`,
                }}
              >
                {ttsEngine === "openai"
                  ? "Voix : OpenAI HD"
                  : "Voix : navigateur (fallback)"}
              </span>
            )}
            {!ended && (
              <button
                type="button"
                onClick={toggleVoiceMode}
                className="text-meta hover:underline"
                style={{ color: "var(--color-gray)" }}
              >
                {useVoice ? "Mode texte" : "Mode voix"}
              </button>
            )}
            {!ended ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleEnd}
                loading={endLoading}
              >
                Raccrocher
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push(`/sessions/${session.id}/feedback?celebrate=1`)}
              >
                Voir la restitution →
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MODE VOIX, prend tout l'espace */}
      {useVoice && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
            {/* État textuel */}
            <div className="flex items-center gap-3">
              <span
                className="rounded-pill"
                style={{
                  width: "10px",
                  height: "10px",
                  background: stateColor,
                  boxShadow:
                    isSpeaking || isListening
                      ? `0 0 0 6px ${stateColor}26`
                      : "none",
                  transition: "box-shadow 0.2s",
                }}
                aria-hidden="true"
              />
              <span
                className="section-eyebrow"
                style={{ color: stateColor }}
              >
                {stateLabel}
              </span>
            </div>

            {/* Orbe animé style GPT */}
            <VoiceOrb
              state={
                ended
                  ? "ended"
                  : sending
                    ? "thinking"
                    : isSpeaking
                      ? "speaking"
                      : isListening
                        ? "listening"
                        : "idle"
              }
              size={260}
              intensity={DIFFICULTY_INTENSITY[session.difficulty as Difficulty] ?? 1}
            />

            {/* Interim transcript */}
            <div
              className="rounded-lg px-6 py-4 max-w-2xl w-full text-center min-h-[80px] flex items-center justify-center transition-all"
              style={{
                background: isListening
                  ? "rgba(60, 200, 121, 0.08)"
                  : "transparent",
                border: isListening
                  ? "1px dashed rgba(60, 200, 121, 0.4)"
                  : "1px dashed transparent",
                opacity: isListening || interimTranscript ? 1 : 0.4,
              }}
            >
              {isListening ? (
                <div>
                  <div
                    className="text-meta uppercase tracking-widest mb-1"
                    style={{ color: "var(--color-green)" }}
                  >
                    Tu dis
                  </div>
                  <div className="text-body" style={{ color: "var(--color-dark)" }}>
                    {interimTranscript || "Vas-y, je t'écoute..."}
                  </div>
                </div>
              ) : (
                <div className="text-meta" style={{ color: "var(--color-gray)" }}>
                  {ended
                    ? "L'appel est terminé."
                    : sending
                      ? "Il prend son temps..."
                      : autoMode
                        ? "Le micro va se relancer tout seul"
                        : "Clique le micro et lance-toi. Re-clique pour envoyer."}
                </div>
              )}
            </div>

            {/* MIC BUTTON */}
            {!ended && (
              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={sending || isSpeaking}
                  className="rounded-pill flex items-center justify-center transition-all duration-base disabled:opacity-40 disabled:cursor-not-allowed relative"
                  style={{
                    width: "112px",
                    height: "112px",
                    background: isListening
                      ? "var(--color-red)"
                      : "var(--color-green)",
                    color: "var(--color-dark)",
                  }}
                  aria-label={isListening ? "Cliquer pour envoyer" : "Cliquer pour parler"}
                >
                  {isListening && (
                    <span
                      className="absolute inset-0 rounded-pill animate-ring"
                      aria-hidden="true"
                    />
                  )}
                  <MicIcon size={48} />
                </button>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={replayProspect}
                    disabled={isSpeaking || sending}
                    className="text-meta hover:underline disabled:opacity-40"
                    style={{ color: "var(--color-gray)" }}
                  >
                    Réécouter
                  </button>
                </div>
              </div>
            )}

            {ended && (
              <Button
                type="button"
                variant="primary"
                onClick={() => router.push(`/sessions/${session.id}/feedback?celebrate=1`)}
              >
                Voir la restitution
              </Button>
            )}
          </div>

          {/* Transcript collapsible */}
          <div
            className="border-t"
            style={{ borderColor: "var(--color-gray-border)", background: "#FFFFFF" }}
          >
            <details className="container-noxias py-3">
              <summary
                className="text-meta uppercase tracking-widest cursor-pointer flex items-center gap-2 select-none"
                style={{ color: "var(--color-gray)" }}
              >
                <span>Transcript</span>
                <span className="badge" style={{ background: "var(--color-lavender)", color: "var(--color-purple)" }}>
                  {messages.filter((m) => m.role !== "system").length}
                </span>
              </summary>
              <div
                ref={transcriptRef}
                className="mt-3 max-h-[260px] overflow-y-auto space-y-2 pr-2"
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

      {/* MODE TEXTE */}
      {!useVoice && (
        <>
          {!voiceSupported.stt && (
            <div
              className="px-4 py-2 text-meta text-center"
              style={{
                background: "rgba(245, 165, 36, 0.10)",
                color: "#8A5A0E",
                borderBottom: "1px solid rgba(245, 165, 36, 0.24)",
              }}
            >
              Mode voix indisponible dans ce navigateur. Utilise Chrome ou Edge pour la voix.
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
                      Il prend son temps...
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
              borderColor: "var(--color-gray-border)",
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
                    L&apos;appel est terminé. Redirection vers la restitution.
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
                    placeholder="Tape ta réponse, Entrée pour envoyer..."
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
      strokeWidth={2.2}
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

function _UnusedSoundWave({
  active,
  listening,
  thinking,
}: {
  active: boolean;
  listening: boolean;
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

  const isAnimating = active || listening;
  const color = listening ? "var(--color-red)" : "var(--color-green)";

  return (
    <div className="flex items-center justify-center gap-1.5 h-16">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className="w-1.5 rounded-pill"
          style={{
            background: isAnimating ? color : "rgba(139, 127, 163, 0.24)",
            height: "8px",
            transformOrigin: "center",
            animation: isAnimating
              ? `wave-bar ${0.6 + (i % 3) * 0.15}s ease-in-out infinite alternate`
              : "none",
            transform: isAnimating ? `scaleY(${1 + (i % 4)})` : "scaleY(1)",
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

function TranscriptLine({ message }: { message: DisplayMessage }) {
  if (message.role === "system") {
    return (
      <div
        className="text-meta italic text-center py-1"
        style={{ color: "var(--color-gray)" }}
      >
        {message.content}
      </div>
    );
  }
  const isUser = message.role === "user";
  return (
    <div className="text-small flex gap-3">
      <span
        className="font-semibold uppercase tracking-widest text-meta shrink-0"
        style={{
          color: isUser ? "var(--color-green)" : "var(--color-purple)",
          minWidth: "70px",
        }}
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
          background: isUser ? "var(--color-green)" : "#FFFFFF",
          color: "var(--color-dark)",
          border: isUser ? "none" : "1px solid var(--color-gray-border)",
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
