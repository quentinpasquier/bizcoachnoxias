"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DifficultyBadge } from "@/components/ui/Badge";
import { VoiceOrb, type OrbState } from "@/components/VoiceOrb";
import {
  createRecognition,
  dedupeRepeats,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  isWhisperAvailable,
  loadVoices,
  pickRecorderMimeType,
  requestMicrophoneStream,
  speak,
  stopSpeaking,
  transcribeAudio,
  type MinimalSpeechRecognition,
  type SpeechRecognitionEvent,
} from "@/lib/voice";
import type { Difficulty, Gender, MessageRow, SessionRow } from "@/lib/supabase/types";
import type { CallStage, DeltaCategory } from "@/lib/prospect-engine";

// Label court affiché dans le pop éphémère sur la barre CallPipeline.
// Tient en max ~16 chars pour ne pas casser le layout.
const DELTA_CATEGORY_LABEL: Record<DeltaCategory, string> = {
  "bonne-question": "Bonne question",
  acquittement: "Acquittement",
  "benefice-chiffre": "Bénéfice chiffré",
  reformulation: "Reformulation",
  "creneau-precis": "Créneau précis",
  "relance-tenue": "Relance tenue",
  "pitch-deroule": "Pitch déroulé",
  "question-fermee": "Question fermée",
  capitulation: "Capitulation",
  baratin: "Baratin",
  esquive: "Esquive",
  agressivite: "Agressif",
};

const STAGE_LABELS: { key: CallStage; label: string; short: string }[] = [
  { key: "brise_glace", label: "Brise-glace", short: "Décrochage" },
  { key: "presentation", label: "Présentation", short: "Cadre" },
  { key: "ouverture", label: "Ouverture", short: "Intérêt" },
  { key: "objections", label: "Objections", short: "Levée" },
  { key: "action", label: "Passage à l'action", short: "Closing" },
];
const STAGE_ORDER: CallStage[] = STAGE_LABELS.map((s) => s.key);

interface DeltaPop {
  id: string;
  type: "+" | "-";
  stage: CallStage;
  category?: DeltaCategory;
}
type StageScore = { plus: number; minus: number };

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
  // Pipeline progression de l'appel (5 étapes)
  const [currentStage, setCurrentStage] = useState<CallStage>("brise_glace");
  const [deltas, setDeltas] = useState<DeltaPop[]>([]);
  const [stageScores, setStageScores] = useState<Record<CallStage, StageScore>>({
    brise_glace: { plus: 0, minus: 0 },
    presentation: { plus: 0, minus: 0 },
    ouverture: { plus: 0, minus: 0 },
    objections: { plus: 0, minus: 0 },
    action: { plus: 0, minus: 0 },
  });
  const [ttsEngine, setTtsEngine] = useState<"openai" | "webspeech" | null>(null);

  // États du Mode 2 "Coaching embarqué". coachAttempts compte les
  // reformulations sur LA réplique en cours (reset après chaque envoi
  // accepté). coachState porte le panneau d'explication affiché quand
  // bloqué. coachThinking : true pendant l'appel à /coach-check.
  const [coachAttempts, setCoachAttempts] = useState(0);
  const [coachThinking, setCoachThinking] = useState(false);
  const [coachState, setCoachState] = useState<{
    blocked: boolean;
    reason: string;
    suggestion: string;
    lastBlockedText: string | null;
  }>({ blocked: false, reason: "", suggestion: "", lastBlockedText: null });

  const transcriptRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whisper backend pour la transcription finale (haute qualité). Le micro
  // partagé est gardé dans micStreamRef ; MediaRecorder collecte les chunks
  // pendant que SpeechRecognition fait l'interim live. À la fin du silence,
  // on envoie le blob audio à /api/transcribe et on utilise ce texte (pas
  // celui du Web Speech) comme transcription finale.
  const [whisperEnabled, setWhisperEnabled] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Vérifie une fois si l'OPENAI_API_KEY est configurée côté serveur.
    void isWhisperAvailable().then(setWhisperEnabled);
    recorderMimeRef.current = pickRecorderMimeType();
  }, []);

  // Délai de silence avant de considérer que le commercial a fini sa phrase.
  // L'auto-VAD natif du navigateur coupe vers 700-1000ms : trop court pour
  // une vraie pause de réflexion. 800ms = compromis serré pour un vrai
  // ping-pong (gain de 400ms vs avant), tout en restant au-dessus du
  // micro-silence naturel entre deux mots.
  const SILENCE_END_MS = 800;
  // Délai après que le prospect a fini de parler avant de relancer le mic.
  // Laisse au commercial le temps de respirer, sans casser le rythme.
  const POST_PROSPECT_DELAY_MS = 400;

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
      // Stop MediaRecorder + libère le flux micro pour éteindre l'indicateur
      // d'enregistrement du navigateur. Sans ça, le voyant rouge reste allumé
      // dans l'onglet après la navigation.
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
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
              void startListening();
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
    progress?: {
      stage?: CallStage;
      delta?: "+" | "-";
      deltaCategory?: DeltaCategory;
    };
    sessionEnded?: boolean;
  }) {
    if (data.progress?.stage) {
      setCurrentStage(data.progress.stage);
    }
    if (data.progress?.delta) {
      const id = `delta-${Date.now()}-${Math.random()}`;
      const stageForDelta = data.progress.stage ?? currentStage;
      const newDelta: DeltaPop = {
        id,
        type: data.progress.delta,
        stage: stageForDelta,
        category: data.progress.deltaCategory,
      };
      setDeltas((d) => [...d, newDelta]);
      setStageScores((s) => {
        const cur = s[stageForDelta] ?? { plus: 0, minus: 0 };
        return {
          ...s,
          [stageForDelta]:
            data.progress!.delta === "+"
              ? { ...cur, plus: cur.plus + 1 }
              : { ...cur, minus: cur.minus + 1 },
        };
      });
      // Le delta "pop" disparaît après 4s mais le compteur reste
      setTimeout(() => {
        setDeltas((d) => d.filter((x) => x.id !== id));
      }, 4000);
    }
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

  // Mode 2 "Coaching embarqué" : avant d'envoyer la réponse au prospect,
  // on la fait évaluer par le coach IA. Si verdict='block', on bloque
  // l'envoi, on fait jouer une explication audio par le coach (voix Onyx),
  // et on demande au commercial de reformuler. Après 3 reformulations
  // sans succès, le coach donne la formulation modèle et on débloque.
  async function runCoachCheck(text: string): Promise<{
    proceed: boolean;
    showModel: boolean;
    reason: string;
    suggestion: string;
  }> {
    try {
      const res = await fetch(`/api/sessions/${session.id}/coach-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: text,
          attemptsOnThisReply: coachAttempts,
        }),
      });
      if (!res.ok) {
        // Sécurité : si l'endpoint plante, on laisse passer pour ne pas
        // bloquer la session entière sur un bug coach.
        return { proceed: true, showModel: false, reason: "", suggestion: "" };
      }
      const data = (await res.json()) as {
        verdict: "pass" | "block" | "force_unlock";
        reason: string;
        suggestion: string;
      };
      if (data.verdict === "pass") {
        return {
          proceed: true,
          showModel: false,
          reason: "",
          suggestion: "",
        };
      }
      if (data.verdict === "force_unlock") {
        // 3e tentative : le coach donne la formulation modèle et on
        // débloque. On l'affiche ET on la joue, mais on enchaîne sur
        // sendMessage pour faire avancer la conversation.
        return {
          proceed: true,
          showModel: true,
          reason: data.reason ?? "",
          suggestion: data.suggestion ?? "",
        };
      }
      // verdict = 'block'
      return {
        proceed: false,
        showModel: false,
        reason: data.reason ?? "",
        suggestion: data.suggestion ?? "",
      };
    } catch {
      return { proceed: true, showModel: false, reason: "", suggestion: "" };
    }
  }

  async function dispatchUserText(text: string) {
    if (session.training_mode !== "embedded") {
      void sendMessage(text);
      return;
    }
    // Mode embarqué : on consulte le coach avant d'envoyer.
    setCoachThinking(true);
    const check = await runCoachCheck(text);
    setCoachThinking(false);

    if (!check.proceed) {
      // Blocage : on incrémente, on affiche la raison, on fait jouer
      // l'audio coach. Le commercial reformule via le mic ou le textarea.
      setCoachAttempts((a) => a + 1);
      setCoachState({
        blocked: true,
        reason: check.reason,
        suggestion: "",
        lastBlockedText: text,
      });
      if (check.reason) {
        void speakCoach(check.reason);
      }
      return;
    }

    // proceed = true. Si showModel (force_unlock après 3 tentatives),
    // on joue d'abord la suggestion modèle puis on enchaîne avec le
    // texte réel du commercial (sa 3e tentative quoi).
    if (check.showModel && check.suggestion) {
      setCoachState({
        blocked: false,
        reason: check.reason,
        suggestion: check.suggestion,
        lastBlockedText: null,
      });
      const intro = `Voici comment vous auriez pu formuler. ${check.suggestion}`;
      void speakCoach(intro);
    } else {
      setCoachState({
        blocked: false,
        reason: "",
        suggestion: "",
        lastBlockedText: null,
      });
    }
    setCoachAttempts(0);
    void sendMessage(text);
  }

  // Wrapper : joue un texte avec la voix coach (Onyx fixe, ton pédagogique).
  // Fait pause sur l'audio prospect en cours si nécessaire.
  function speakCoach(text: string) {
    stopSpeaking();
    setIsSpeaking(true);
    void speak({
      text,
      gender: "homme",
      seed: "coach",
      role: "coach",
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
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

  // Stop le MediaRecorder en cours et résout avec le blob audio final.
  // Le blob inclut la dernière `ondataavailable` déclenchée par stop().
  function stopRecorderAndGetBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const type = recorderMimeRef.current ?? "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        resolve(blob.size > 0 ? blob : null);
      };
      try {
        rec.stop();
      } catch {
        mediaRecorderRef.current = null;
        resolve(null);
      }
    });
  }

  // Construit un prompt de contexte pour Whisper à partir du client + persona
  // de la session. CRITIQUE : doit être une PHRASE NATURELLE et non une liste
  // de termes. Une liste type "Noxias, Dirigeant PME" ressemble à une
  // transcription possible et Whisper la recrache parfois telle quelle
  // dans la sortie (bug bien documenté de prompt bleed). Une phrase prose
  // contextualisée force Whisper à comprendre que c'est un échantillon de
  // style, pas du contenu à reproduire.
  function buildWhisperPrompt(): string {
    if (!session.client_name_snapshot) return "";
    const persona = session.persona_label?.toLowerCase() ?? "dirigeant";
    return `Conversation entre un commercial qui prospecte pour ${session.client_name_snapshot} et un ${persona} en France.`;
  }

  async function startListening() {
    if (!voiceSupported.stt || isListening || sending || ended || transcribing) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }

    finalTranscriptRef.current = "";
    setInterimTranscript("");
    clearSilenceTimer();

    // Si Whisper est dispo, on prépare en parallèle un MediaRecorder qui
    // capture l'audio. Le Web Speech sert toujours pour l'interim live ;
    // Whisper donnera la transcription finale envoyée au bot. Le micro
    // stream est partagé et conservé pendant toute la session pour éviter
    // de re-demander la permission à chaque utterance.
    if (whisperEnabled && recorderMimeRef.current) {
      try {
        if (!micStreamRef.current) {
          micStreamRef.current = await requestMicrophoneStream();
        }
        if (micStreamRef.current) {
          const rec = new MediaRecorder(micStreamRef.current, {
            mimeType: recorderMimeRef.current,
          });
          audioChunksRef.current = [];
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          rec.start();
          mediaRecorderRef.current = rec;
        }
      } catch {
        // Si MediaRecorder échoue, on continue avec Web Speech seul.
        mediaRecorderRef.current = null;
      }
    }

    // En mode auto, on garde continuous=true et on gère NOUS-MÊMES la fin
    // de phrase via un timer de silence (1800ms). C'est plus permissif que
    // le VAD natif du navigateur (700-1000ms) qui coupait trop tôt.
    const recognition = createRecognition({ continuous: true });
    if (!recognition) {
      setError("Reconnaissance vocale non disponible dans ce navigateur.");
      return;
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // IMPORTANT : on reconstruit le transcript FINAL en repartant de
      // l'index 0 à chaque événement, plutôt que d'accumuler depuis
      // event.resultIndex. Certains navigateurs (Chrome continuous mode)
      // re-émettent les anciens résultats finals dans des événements
      // successifs avec resultIndex=0. Si on accumulait, ça produirait
      // "B2B B2B B2B..." dans finalTranscriptRef. En reconstruisant à
      // chaque fois depuis la full results list, on évite cette boucle.
      let interim = "";
      let finalAll = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalAll += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = finalAll.trim();
      setInterimTranscript(interim);

      // En auto-mode, chaque update repousse le timer de silence.
      // Tant que le commercial parle (final ou interim), on patiente.
      if (autoMode && (finalAll.length > 0 || interim.length > 0)) {
        scheduleSilenceStop(recognition);
      }
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = async () => {
      clearSilenceTimer();
      setIsListening(false);
      const fallbackText = finalTranscriptRef.current.trim();
      setInterimTranscript("");
      finalTranscriptRef.current = "";

      // Si Whisper était activé et qu'on a un enregistrement, on attend la
      // transcription serveur (haute qualité) avant d'envoyer au bot. C'est
      // ~1s de latence en plus mais beaucoup moins de fautes sur le métier.
      if (whisperEnabled && mediaRecorderRef.current) {
        setTranscribing(true);
        try {
          const blob = await stopRecorderAndGetBlob();
          // 1024 bytes seuil : sous ce volume, l'audio est probablement vide
          // (clic accidentel, micro pas encore monté). On retombe sur le
          // texte Web Speech (ou rien).
          if (blob && blob.size > 1024) {
            const whisperText = await transcribeAudio(blob, {
              prompt: buildWhisperPrompt(),
            });
            if (whisperText && whisperText.length > 0) {
              setTranscribing(false);
              // Défense en profondeur : le serveur déduplique déjà, on
              // refait une passe côté client au cas où.
              void dispatchUserText(dedupeRepeats(whisperText));
              return;
            }
          }
        } catch {
          // Fallback Web Speech ci-dessous.
        }
        setTranscribing(false);
      }

      if (fallbackText.length > 0) {
        // Web Speech peut parfois ré-émettre des résultats finals avec le
        // même index, ce qui produit des doublons. dedupeRepeats nettoie
        // les patterns évidents (acronymes redoublés, phrases répétées).
        void dispatchUserText(dedupeRepeats(fallbackText));
      }
    };
    recognition.onerror = (e: Event) => {
      const err = (e as unknown as { error?: string }).error ?? "unknown";
      clearSilenceTimer();
      // Si une erreur survient en cours d'enregistrement, on jette le blob.
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      }
      if (err === "no-speech" || err === "aborted") {
        setIsListening(false);
        // En auto-mode, on retente après une pause si no-speech, mais SANS
        // envoyer (le commercial n'a rien dit, on ne va pas lui envoyer du vide)
        if (autoMode && err === "no-speech" && !ended && !sending && !isSpeaking) {
          setTimeout(() => {
            if (!isListening && !sending && !ended && !isSpeaking) {
              void startListening();
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
      void startListening();
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
    : transcribing
      ? "Transcription..."
      : isListening
        ? "À toi de jouer"
        : sending
          ? "Il prend son temps..."
          : ended
            ? "Appel terminé"
            : "En ligne";

  const stateColor = isSpeaking
    ? "var(--color-purple)"
    : transcribing
      ? "var(--color-gray)"
      : isListening
        ? "var(--color-red)"
        : sending
          ? "var(--color-gray)"
          : ended
            ? "var(--color-gray)"
            : "var(--color-green)";

  const useVoice = voiceMode && voiceSupported.tts && voiceSupported.stt;

  // Classe de thème : propage la couleur du mode actif dans toute la
  // ChatRoom. Un liseré 2px en haut de l'écran rappelle visuellement le
  // mode sans distraire pendant l'appel (hors zone de focus).
  const themeClass = `training-theme-${session.training_mode ?? "full"}`;

  return (
    <div
      className={`flex flex-col chatroom ${themeClass}`}
      style={{ minHeight: "calc(100vh - 4rem)" }}
    >
      <div className="training-mode-rim" aria-hidden="true" />
      {/* TOP BAR */}
      <div
        className="border-b chatroom-topbar"
        style={{
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
              <div className="text-meta truncate" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
                {personaRole || session.persona_label} · pour{" "}
                <span style={{ color: "#b495ff", fontWeight: 600 }}>
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
                style={{ color: "rgba(255, 255, 255, 0.65)" }}
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
          <div className="flex-1 flex relative">
            <CallPipeline
              currentStage={currentStage}
              stageScores={stageScores}
              deltas={deltas}
            />
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
                  <div className="text-body" style={{ color: "#FFFFFF" }}>
                    {interimTranscript || "Vas-y, je t'écoute..."}
                  </div>
                </div>
              ) : (
                <div className="text-meta" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
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
                    color: "#FFFFFF",
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
                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    onClick={replayProspect}
                    disabled={isSpeaking || sending}
                    className="text-meta hover:underline disabled:opacity-40"
                    style={{ color: "rgba(255, 255, 255, 0.65)" }}
                  >
                    Réécouter
                  </button>
                  <button
                    type="button"
                    onClick={handleEnd}
                    disabled={endLoading}
                    className="inline-flex items-center gap-2 rounded-pill px-4 py-2 transition disabled:opacity-50"
                    style={{
                      background: "rgba(233, 75, 75, 0.14)",
                      border: "1px solid rgba(233, 75, 75, 0.45)",
                      color: "#FFB4B4",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      letterSpacing: "0.02em",
                    }}
                    aria-label="Raccrocher l'appel"
                  >
                    <HangupIcon />
                    {endLoading ? "Fin..." : "Raccrocher"}
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
            className="border-t chatroom-bottombar"
          >
            <details className="container-noxias py-3">
              <summary
                className="text-meta uppercase tracking-widest cursor-pointer flex items-center gap-2 select-none"
                style={{ color: "rgba(255, 255, 255, 0.65)" }}
              >
                <span>Transcript</span>
                <span className="badge" style={{ background: "var(--color-lavender)", color: "#b495ff" }}>
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
                    <p className="text-body" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
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
                      style={{ color: "rgba(255, 255, 255, 0.65)" }}
                    >
                      Il prend son temps...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t chatroom-bottombar">
            <div className="container-noxias py-4 max-w-3xl">
              {/* Panneau coach embarqué : visible uniquement en mode
                  'embedded' quand le coach est en train d'évaluer ou
                  qu'il a bloqué la réponse / proposé une formulation. */}
              {session.training_mode === "embedded" && coachThinking && (
                <div className="coach-panel coach-panel-thinking">
                  <div className="coach-panel-eyebrow">Le coach évalue…</div>
                </div>
              )}
              {session.training_mode === "embedded" &&
                !coachThinking &&
                coachState.blocked && (
                  <div className="coach-panel coach-panel-blocked">
                    <div className="coach-panel-header">
                      <div className="coach-panel-eyebrow">
                        Coach · reformulation demandée
                      </div>
                      <div className="coach-panel-attempts">
                        Tentative {coachAttempts}/3
                      </div>
                    </div>
                    <p className="coach-panel-reason">{coachState.reason}</p>
                    <p className="coach-panel-help">
                      Reformule ta réponse au micro ou en texte. Au bout de 3
                      essais, le coach te donnera la formulation modèle.
                    </p>
                  </div>
                )}
              {session.training_mode === "embedded" &&
                !coachThinking &&
                !coachState.blocked &&
                coachState.suggestion && (
                  <div className="coach-panel coach-panel-model">
                    <div className="coach-panel-eyebrow">
                      Coach · formulation modèle
                    </div>
                    <p className="coach-panel-reason">
                      « {coachState.suggestion} »
                    </p>
                    <p className="coach-panel-help">
                      Le coach vient de te jouer cette formulation. Garde-la
                      en tête pour la prochaine fois.
                    </p>
                  </div>
                )}
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
                  <p className="text-body" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
                    L&apos;appel est terminé. Redirection vers la restitution.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void dispatchUserText(draft);
                  }}
                  className="flex gap-3 items-end"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void dispatchUserText(draft);
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

function HangupIcon({ size = 16 }: { size?: number }) {
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.89.36 1.76.71 2.58a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.5-1.28a2 2 0 0 1 2.11-.45c.82.35 1.69.59 2.58.71A2 2 0 0 1 22 16.92z" transform="rotate(135 12 12)" />
      <line x1="23" y1="1" x2="1" y2="23" />
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
        style={{ color: "rgba(255, 255, 255, 0.65)" }}
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
      <span style={{ color: "#FFFFFF" }}>{message.content}</span>
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
            background: "rgba(157, 107, 255, 0.18)",
            color: "#b495ff",
            border: "1px solid rgba(157, 107, 255, 0.32)",
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
        className={`rounded-lg px-5 py-3 max-w-[80%] ${
          isUser ? "chat-bubble-user" : "chat-bubble-prospect"
        }`}
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

function CallPipeline({
  currentStage,
  stageScores,
  deltas,
}: {
  currentStage: CallStage;
  stageScores: Record<CallStage, StageScore>;
  deltas: DeltaPop[];
}) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  return (
    <aside className="call-pipeline">
      <div className="call-pipeline-header">
        <span className="call-pipeline-eyebrow">Progression de l&apos;appel</span>
        <h3 className="call-pipeline-title">5 étapes du cold call</h3>
      </div>
      <ol className="call-pipeline-list">
        {STAGE_LABELS.map((s, idx) => {
          const score = stageScores[s.key];
          const status =
            idx < currentIdx
              ? "done"
              : idx === currentIdx
                ? "current"
                : "pending";
          const popsForThisStage = deltas.filter((d) => d.stage === s.key);
          // 3 paliers de teinte selon le solde plus-minus sur cette étape.
          // positive : le commercial a marqué plus de bons points sur cette
          //            étape ; negative : il a accumulé plus de fautes ; neutre
          //            par défaut. La teinte est subtile (bordure colorée),
          //            elle ne court-circuite pas le statut done/current/pending.
          const net = score.plus - score.minus;
          const tone =
            net > 0 ? "positive" : net < 0 ? "negative" : "neutral";
          return (
            <li
              key={s.key}
              className={`call-pipeline-step call-pipeline-step-${status} call-pipeline-step-tone-${tone}`}
            >
              <span className="call-pipeline-step-num">
                {status === "done" ? "✓" : idx + 1}
              </span>
              <div className="call-pipeline-step-body">
                <div className="call-pipeline-step-label">{s.label}</div>
                <div className="call-pipeline-step-short">{s.short}</div>
                {(score.plus > 0 || score.minus > 0) && (
                  <div className="call-pipeline-step-counts">
                    {score.plus > 0 && (
                      <span className="call-pipeline-count call-pipeline-count-plus">
                        +{score.plus}
                      </span>
                    )}
                    {score.minus > 0 && (
                      <span className="call-pipeline-count call-pipeline-count-minus">
                        −{score.minus}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Pops éphémères avec label catégorie */}
              <div className="call-pipeline-pops">
                {popsForThisStage.map((d) => {
                  const label = d.category
                    ? DELTA_CATEGORY_LABEL[d.category]
                    : null;
                  return (
                    <span
                      key={d.id}
                      className={`call-pipeline-pop ${
                        d.type === "+"
                          ? "call-pipeline-pop-plus"
                          : "call-pipeline-pop-minus"
                      }`}
                    >
                      <span className="call-pipeline-pop-sign">
                        {d.type === "+" ? "+1" : "−1"}
                      </span>
                      {label && (
                        <span className="call-pipeline-pop-label">{label}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
