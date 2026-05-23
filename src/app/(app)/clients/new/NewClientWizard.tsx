"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Loader } from "@/components/Loader";
import { CoachAvatar } from "@/components/CoachAvatar";
import { CoachTip } from "@/components/CoachTip";
import type {
  GuidedPersonaInput,
  GuidedWizardPayload,
} from "@/lib/guided-serializer";
import type { SuggestedPersona } from "@/lib/guided-suggester";

const DRAFT_STORAGE_KEY = "bizcoach_wizard_draft_v1";

const COMMON_OBJECTIONS: string[] = [
  "On a déjà un prestataire",
  "On n'a pas le budget cette année",
  "Ce n'est pas le bon moment, rappelez-moi plus tard",
  "Je ne suis pas le bon interlocuteur",
  "Envoyez-moi un mail, je regarderai",
  "On va y réfléchir en interne",
  "On est très bien comme ça aujourd'hui",
  "On a déjà essayé, ça n'a pas marché",
  "C'est trop cher pour nous",
  "Je n'ai pas le temps là, je suis en réunion",
  "Vous appelez tous les jours, vous nous saoulez",
  "On gère ça en interne",
  "On n'a pas de problème là-dessus",
  "Mon associé / ma direction décide, pas moi",
  "Donnez-moi un prix par mail",
];

const STEPS = [
  { id: 1, label: "Offre", short: "Ton offre" },
  { id: 2, label: "Proposition de valeur", short: "Ta valeur" },
  { id: 3, label: "Personas", short: "Tes cibles" },
  { id: 4, label: "Objections", short: "Les freins" },
  { id: 5, label: "Accroche", short: "Le hook" },
];

function emptyPersona(): GuidedPersonaInput {
  return {
    label: "",
    role: "",
    typical_company: "",
    key_pains: "",
    key_kpis: "",
    motivations: "",
    triggers: "",
    decision_signals: "",
  };
}

function emptyPayload(): GuidedWizardPayload {
  return {
    name: "",
    sector: "",
    value_prop_one_liner: "",
    product_pitch: "",
    ideal_targets: "",
    tangible_value: "",
    channels: "",
    differentiation: "",
    personas: [],
    selected_common_objections: [],
    specific_objections: "",
    hook: "",
    killer_arguments: "",
  };
}

interface NewClientWizardProps {
  initial?: {
    id: string;
    payload: GuidedWizardPayload;
  };
}

export function NewClientWizard({ initial }: NewClientWizardProps = {}) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [step, setStep] = useState(0);
  const [payload, setPayload] = useState<GuidedWizardPayload>(
    initial?.payload ?? emptyPayload(),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState<
    null | "personas" | "objections" | "hook"
  >(null);
  const [expandedPersona, setExpandedPersona] = useState<number | null>(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [restorePromptOpen, setRestorePromptOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    payload: GuidedWizardPayload;
    savedAt?: number;
  } | null>(null);
  const hydrated = useRef(false);

  // Hydratation localStorage : si un brouillon existe en mode création, on
  // propose à l'utilisateur de le reprendre via un prompt explicite plutôt que
  // de le restaurer silencieusement. hydrated.current ne passe à true qu'une
  // fois la décision prise (resume ou fresh), pour empêcher la sauvegarde
  // automatique d'écraser le brouillon pendant que le prompt est ouvert.
  useEffect(() => {
    if (isEdit) return;
    if (typeof window === "undefined") return;
    if (hydrated.current) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        hydrated.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as {
        payload: GuidedWizardPayload;
        savedAt?: number;
      };
      if (parsed && typeof parsed.payload === "object") {
        setPendingDraft({ payload: parsed.payload, savedAt: parsed.savedAt });
        setRestorePromptOpen(true);
      } else {
        hydrated.current = true;
      }
    } catch {
      hydrated.current = true;
    }
  }, [isEdit]);

  function resumeDraft() {
    if (pendingDraft) {
      setPayload(pendingDraft.payload);
      setDraftRestored(true);
    }
    setRestorePromptOpen(false);
    setPendingDraft(null);
    hydrated.current = true;
  }

  function startFresh() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    setRestorePromptOpen(false);
    setPendingDraft(null);
    hydrated.current = true;
  }

  // Sauvegarde localStorage à chaque changement du payload en mode création.
  useEffect(() => {
    if (isEdit) return;
    if (typeof window === "undefined") return;
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ payload, savedAt: Date.now() }),
      );
    } catch {
      // ignore : quota dépassé / mode privé
    }
  }, [payload, isEdit]);

  function clearDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }

  function resetWizard() {
    if (!confirm("Repartir de zéro ? Le brouillon en cours sera effacé.")) return;
    setPayload(emptyPayload());
    setStep(0);
    setDraftRestored(false);
    clearDraft();
  }

  function patch(p: Partial<GuidedWizardPayload>) {
    setPayload((prev) => ({ ...prev, ...p }));
  }

  function patchPersona(idx: number, p: Partial<GuidedPersonaInput>) {
    setPayload((prev) => ({
      ...prev,
      personas: prev.personas.map((persona, i) =>
        i === idx ? { ...persona, ...p } : persona,
      ),
    }));
  }

  function addPersona() {
    setPayload((prev) => {
      const next = [...prev.personas, emptyPersona()];
      setExpandedPersona(next.length - 1);
      return { ...prev, personas: next };
    });
  }

  function removePersona(idx: number) {
    setPayload((prev) => ({
      ...prev,
      personas: prev.personas.filter((_, i) => i !== idx),
    }));
    setExpandedPersona(null);
  }

  function toggleCommonObjection(o: string) {
    setPayload((prev) => ({
      ...prev,
      selected_common_objections: prev.selected_common_objections.includes(o)
        ? prev.selected_common_objections.filter((x) => x !== o)
        : [...prev.selected_common_objections, o],
    }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!payload.name.trim()) return "Donne un nom à ton offre.";
      if (!payload.value_prop_one_liner.trim() && !payload.product_pitch.trim())
        return "Renseigne au moins la promesse ou le pitch produit.";
    }
    if (s === 2) {
      if (payload.personas.length === 0)
        return "Ajoute au moins un persona cible.";
      const incomplete = payload.personas.findIndex((p) => !p.label.trim());
      if (incomplete >= 0)
        return `Persona n°${incomplete + 1} : donne-lui au moins un nom court (label).`;
    }
    if (s === 3) {
      const total =
        payload.selected_common_objections.length +
        payload.specific_objections.split(/\r?\n/).filter((l) => l.trim()).length;
      if (total < 3)
        return "Sélectionne ou ajoute au moins 3 objections.";
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function goPrev() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSuggestPersonas() {
    if (!payload.value_prop_one_liner.trim() && !payload.product_pitch.trim()) {
      setError(
        "Remplis d'abord la promesse ou le pitch produit (étape 1-2) pour que le cerveau IA puisse suggérer.",
      );
      return;
    }
    setError(null);
    setSuggesting("personas");
    try {
      const res = await fetch("/api/clients/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "personas",
          count: 3,
          context: {
            name: payload.name,
            sector: payload.sector,
            value_prop_one_liner: payload.value_prop_one_liner,
            product_pitch: payload.product_pitch,
            ideal_targets: payload.ideal_targets,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de la suggestion");
      const suggested: SuggestedPersona[] = data.personas ?? [];
      const mapped: GuidedPersonaInput[] = suggested.map((p) => ({
        label: p.label,
        role: p.role,
        typical_company: p.typical_company,
        key_pains: (p.key_pains ?? []).join("\n"),
        key_kpis: (p.key_kpis ?? []).join("\n"),
        motivations: (p.motivations ?? []).join("\n"),
        triggers: (p.triggers ?? []).join("\n"),
        decision_signals: p.decision_signals ?? "",
      }));
      setPayload((prev) => {
        const next = [...prev.personas, ...mapped];
        setExpandedPersona(prev.personas.length); // expand the 1st new one
        return { ...prev, personas: next };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(null);
    }
  }

  async function handleSuggestHook() {
    if (!payload.value_prop_one_liner.trim() && !payload.product_pitch.trim()) {
      setError(
        "Remplis d'abord la promesse ou le pitch produit pour que le cerveau IA puisse suggérer.",
      );
      return;
    }
    setError(null);
    setSuggesting("hook");
    try {
      const res = await fetch("/api/clients/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "hook",
          context: {
            name: payload.name,
            sector: payload.sector,
            value_prop_one_liner: payload.value_prop_one_liner,
            product_pitch: payload.product_pitch,
            ideal_targets: payload.ideal_targets,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de la suggestion");
      const newHook = (data.hook ?? "").trim();
      const newArgs: string[] = data.killer_arguments ?? [];
      const existingArgs = payload.killer_arguments
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...existingArgs, ...newArgs]));
      patch({
        hook: payload.hook.trim() ? payload.hook : newHook,
        killer_arguments: merged.join("\n"),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(null);
    }
  }

  async function handleSuggestObjections() {
    if (!payload.value_prop_one_liner.trim() && !payload.product_pitch.trim()) {
      setError(
        "Remplis d'abord la promesse ou le pitch produit pour que le cerveau IA puisse suggérer.",
      );
      return;
    }
    setError(null);
    setSuggesting("objections");
    try {
      const res = await fetch("/api/clients/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "objections",
          count: 15,
          context: {
            name: payload.name,
            sector: payload.sector,
            value_prop_one_liner: payload.value_prop_one_liner,
            product_pitch: payload.product_pitch,
            ideal_targets: payload.ideal_targets,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de la suggestion");
      const newOnes: string[] = data.objections ?? [];
      const existing = payload.specific_objections
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = Array.from(new Set([...existing, ...newOnes]));
      patch({ specific_objections: merged.join("\n") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(null);
    }
  }

  async function handleSubmit() {
    for (let s = 0; s <= 4; s++) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setError(err);
        return;
      }
    }
    setError(null);
    setLoading(true);
    try {
      const url = isEdit
        ? `/api/clients/${initial!.id}/from-guided`
        : "/api/clients/from-guided";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enregistrement échoué");
      if (!isEdit) clearDraft();
      router.push(`/clients/${data.id ?? initial!.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{
          background: "rgba(34, 25, 50, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="flex flex-col items-center gap-5">
          <CoachAvatar state="thinking" size={84} withHalo />
          <Loader
            size="lg"
            message="Quentin assemble ton coach personnalisé"
            detail="20 à 40 secondes : extraction des personas, génération des briefings, structuration des objections."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal : reprise de configuration */}
      {restorePromptOpen && pendingDraft && (
        <RestoreDraftModal
          draftPayload={pendingDraft.payload}
          savedAt={pendingDraft.savedAt}
          onResume={resumeDraft}
          onFresh={startFresh}
        />
      )}

      {/* Banner brouillon restauré */}
      {draftRestored && !isEdit && (
        <div
          className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "rgba(157, 107, 255, 0.10)",
            border: "1px solid rgba(157, 107, 255, 0.30)",
          }}
        >
          <p className="text-small" style={{ color: "#FFFFFF" }}>
            <strong>Brouillon restauré.</strong>{" "}
            <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
              On reprend là où tu t'es arrêté.
            </span>
          </p>
          <button
            type="button"
            onClick={resetWizard}
            className="text-meta"
            style={{
              color: "#FFB4B4",
              background: "rgba(233, 75, 75, 0.10)",
              border: "1px solid rgba(233, 75, 75, 0.25)",
              padding: "6px 14px",
              borderRadius: 999,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            Repartir de zéro
          </button>
        </div>
      )}

      {/* Stepper */}
      <ol
        className="flex flex-wrap items-center gap-2"
        style={{ fontSize: "0.78rem" }}
      >
        {STEPS.map((s, i) => {
          const reached = i <= step;
          const current = i === step;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: current
                    ? "linear-gradient(135deg, rgba(60, 200, 121, 0.22), rgba(60, 200, 121, 0.08))"
                    : reached
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(255, 255, 255, 0.03)",
                  border: `1px solid ${
                    current
                      ? "rgba(60, 200, 121, 0.55)"
                      : reached
                        ? "rgba(255, 255, 255, 0.18)"
                        : "rgba(255, 255, 255, 0.08)"
                  }`,
                  color: current
                    ? "var(--color-green)"
                    : reached
                      ? "#FFFFFF"
                      : "rgba(255, 255, 255, 0.4)",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  cursor: i < step ? "pointer" : "default",
                }}
              >
                {s.id}. {s.short}
              </button>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 1,
                    background: "rgba(255, 255, 255, 0.18)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step body */}
      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: "rgba(34, 25, 50, 0.55)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(16px) saturate(160%)",
        }}
      >
        {step === 0 && (
          <StepOffer payload={payload} patch={patch} />
        )}
        {step === 1 && (
          <StepValueProp payload={payload} patch={patch} />
        )}
        {step === 2 && (
          <StepPersonas
            payload={payload}
            patch={patch}
            patchPersona={patchPersona}
            addPersona={addPersona}
            removePersona={removePersona}
            expanded={expandedPersona}
            setExpanded={setExpandedPersona}
            onSuggest={handleSuggestPersonas}
            suggesting={suggesting === "personas"}
          />
        )}
        {step === 3 && (
          <StepObjections
            payload={payload}
            patch={patch}
            toggleCommon={toggleCommonObjection}
            onSuggest={handleSuggestObjections}
            suggesting={suggesting === "objections"}
          />
        )}
        {step === 4 && (
          <StepHook
            payload={payload}
            patch={patch}
            onSuggest={handleSuggestHook}
            suggesting={suggesting === "hook"}
          />
        )}
      </div>

      {error && (
        <div
          className="rounded-md px-4 py-3 text-small"
          style={{
            background: "rgba(233, 75, 75, 0.10)",
            color: "#FFB4B4",
            border: "1px solid rgba(233, 75, 75, 0.30)",
          }}
        >
          {error}
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={goPrev} disabled={step === 0}>
          ← Précédent
        </Button>
        <span
          className="text-meta"
          style={{
            color: "rgba(255, 255, 255, 0.55)",
            letterSpacing: "0.18em",
          }}
        >
          Étape {step + 1} / {STEPS.length}
        </span>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={goNext}>
            Suivant →
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={handleSubmit}>
            {isEdit ? "Enregistrer les modifications →" : "Créer l'offre →"}
          </Button>
        )}
      </div>
    </div>
  );
}

// =================== Sub-steps ===================

function StepIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
        {title}
      </h2>
      <p
        className="text-small mt-1"
        style={{ color: "rgba(255, 255, 255, 0.65)" }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function StepOffer({
  payload,
  patch,
}: {
  payload: GuidedWizardPayload;
  patch: (p: Partial<GuidedWizardPayload>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepIntro
        title="Ton offre, en quelques mots"
        subtitle="Le coach a besoin de connaître ce que tu vends pour générer un prospect réaliste."
      />
      <CoachTip>
        Le secret d&apos;une promesse qui fait dire &quot;continue&quot; au
        prospect, c&apos;est la formule{" "}
        <strong style={{ color: "#FFFFFF" }}>
          &quot;On aide [persona ultra précis] à [outcome chiffré] sans [pain
          habituel]&quot;
        </strong>
        . Le mot &quot;on&quot;, un verbe d&apos;action, un résultat. Pas
        &quot;nous proposons une solution de...&quot;. Si ta promesse commence
        par ton entreprise au lieu du prospect, t&apos;as déjà perdu son
        attention.
      </CoachTip>
      <Input
        id="name"
        label="Nom de l'offre / produit *"
        placeholder="Ex : SiteLine, TrésoFlow, Cabinet Lelong RH"
        value={payload.name}
        onChange={(e) => patch({ name: e.target.value })}
        required
      />
      <Input
        id="sector"
        label="Secteur"
        placeholder="Ex : Agence web, SaaS finance, Cabinet RH"
        hint="Quel univers métier ? Ça aide l'IA à ancrer le contexte du prospect."
        value={payload.sector}
        onChange={(e) => patch({ sector: e.target.value })}
      />
      <CoachTip variant="compact">
        L&apos;erreur la plus fréquente :{" "}
        <strong style={{ color: "#FFFFFF" }}>promesse trop large</strong>.
        &quot;On aide les entreprises à mieux vendre&quot; = audible par
        personne. &quot;On aide les directions commerciales de SaaS série A à
        doubler leur taux de prise de RDV en 6 semaines&quot; = ça décroche.
        Plus tu cibles, plus ça mord.
      </CoachTip>
      <Textarea
        id="value_prop_one_liner"
        label="Promesse en une phrase *"
        placeholder="Ex : Transformer l'image de marque des PME en autorité de marché grâce à un site sur-mesure."
        hint="La phrase clé qu'un commercial doit pouvoir dire à l'oral en 5 secondes."
        rows={3}
        value={payload.value_prop_one_liner}
        onChange={(e) => patch({ value_prop_one_liner: e.target.value })}
      />
    </div>
  );
}

function StepValueProp({
  payload,
  patch,
}: {
  payload: GuidedWizardPayload;
  patch: (p: Partial<GuidedWizardPayload>) => void;
}) {
  return (
    <div className="space-y-5">
      <StepIntro
        title="Le pitch et la valeur livrée"
        subtitle="Ce que le commercial doit vendre, et la preuve concrète qu'il peut avancer."
      />
      <CoachTip>
        Le mythe à casser :{" "}
        <strong style={{ color: "#FFFFFF" }}>
          &quot;plus c&apos;est court, mieux c&apos;est&quot;
        </strong>
        . Faux. Les data sur 300M d&apos;appels analysés (Gong) montrent que
        les pitchs qui décrochent un RDV durent en moyenne{" "}
        <strong style={{ color: "#FFFFFF" }}>53 secondes, pas 25</strong>. Un
        pitch trop court signale du vide. Ce que je cherche dans un pitch :{" "}
        <strong style={{ color: "#FFFFFF" }}>un chiffre</strong>,{" "}
        <strong style={{ color: "#FFFFFF" }}>une preuve concrète</strong> (cas
        client, livrable),{" "}
        <strong style={{ color: "#FFFFFF" }}>un opposant</strong> (ce que tu
        n&apos;es pas). Sans ces trois, t&apos;es mort en 30 secondes.
      </CoachTip>
      <CoachTip variant="compact">
        Trigger phrase qui double le taux de RDV (data Gong) :{" "}
        <strong style={{ color: "#FFFFFF" }}>
          &quot;La raison de mon appel, c&apos;est...&quot;
        </strong>
        . La structure 45-60s qui marche : (1) nomme un pair connu du prospect,
        (2) décris SON pain spécifique, (3) délivre l&apos;outcome chiffré, (4)
        demande 15 min sans engagement, jamais une &quot;démo&quot;.
      </CoachTip>
      <Textarea
        id="product_pitch"
        label="Pitch produit"
        placeholder="Ex : Refonte de site orientée image, SEO et conversion, livrée en 6 semaines, avec identité visuelle et expérience de marque sur-mesure."
        hint="2 à 3 phrases. Le pitch que tu attendrais d'un commercial qui ne connaît pas encore l'offre."
        rows={3}
        value={payload.product_pitch}
        onChange={(e) => patch({ product_pitch: e.target.value })}
      />
      <CoachTip variant="compact">
        Tangible = ce que le prospect peut{" "}
        <strong style={{ color: "#FFFFFF" }}>
          tenir dans sa main 60 jours après signature
        </strong>
        . Pas &quot;gain de productivité&quot;, mais &quot;un site en ligne, un
        dashboard partagé, 3 réunions hebdo&quot;. Si t&apos;écris
        &quot;amélioration du ROI&quot; ici, t&apos;as encore raisonné en
        feature. Reformule en LIVRABLE.
      </CoachTip>
      <Textarea
        id="tangible_value"
        label="Valeur tangible livrée en 30-60 jours"
        placeholder="Ex : Un site en ligne, une identité visuelle complète, +30% de demandes qualifiées."
        rows={2}
        value={payload.tangible_value}
        onChange={(e) => patch({ tangible_value: e.target.value })}
      />
      <CoachTip variant="compact">
        La meilleure façon de te différencier, c&apos;est de{" "}
        <strong style={{ color: "#FFFFFF" }}>dire ce que tu n&apos;es pas</strong>.
        &quot;On n&apos;est pas une agence qui vous facture l&apos;heure&quot;,
        &quot;on n&apos;est pas un SaaS générique à configurer 6 mois&quot;.
        L&apos;opposition reste en mémoire mieux que l&apos;affirmation. Vise 2
        oppositions concrètes contre ton concurrent type.
      </CoachTip>
      <Textarea
        id="differentiation"
        label="Différenciation concurrentielle"
        placeholder="Ex : Site propriétaire (pas d'abonnement), expertise identité + SEO en un seul prestataire, références locales."
        rows={2}
        value={payload.differentiation}
        onChange={(e) => patch({ differentiation: e.target.value })}
      />
    </div>
  );
}

function StepPersonas({
  payload,
  patch,
  patchPersona,
  addPersona,
  removePersona,
  expanded,
  setExpanded,
  onSuggest,
  suggesting,
}: {
  payload: GuidedWizardPayload;
  patch: (p: Partial<GuidedWizardPayload>) => void;
  patchPersona: (idx: number, p: Partial<GuidedPersonaInput>) => void;
  addPersona: () => void;
  removePersona: (idx: number) => void;
  expanded: number | null;
  setExpanded: (idx: number | null) => void;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  return (
    <div className="space-y-5">
      <StepIntro
        title="Tes personas cibles"
        subtitle="Qui le commercial va appeler. Ajoute autant de profils distincts que tu veux entraîner (recommandé : 2-4)."
      />
      <CoachTip>
        Un persona n&apos;est PAS un job title. C&apos;est un trio :{" "}
        <strong style={{ color: "#FFFFFF" }}>un job to be done</strong> (le
        résultat qu&apos;il veut accomplir),{" "}
        <strong style={{ color: "#FFFFFF" }}>
          une douleur précise qui le réveille la nuit
        </strong>
        , et un{" "}
        <strong style={{ color: "#FFFFFF" }}>événement déclencheur</strong> qui
        rend le moment opportun. Gartner documente que la décision B2B implique
        6 à 10 stakeholders. Tu n&apos;as pas besoin de tous les avoir, mais tu
        dois savoir lequel tu pitches.
      </CoachTip>
      <CoachTip variant="compact">
        Un ICP solide se construit en 4 couches :{" "}
        <strong style={{ color: "#FFFFFF" }}>firmographique</strong> (taille,
        secteur, géo),{" "}
        <strong style={{ color: "#FFFFFF" }}>technographique</strong> (stack en
        place, concurrents installés),{" "}
        <strong style={{ color: "#FFFFFF" }}>comportementale</strong>{" "}
        (recrutement, contenu consommé), et{" "}
        <strong style={{ color: "#FFFFFF" }}>trigger events</strong> (levée,
        expansion, leadership). Si tu maîtrises 2-3 couches, c&apos;est assez,
        l&apos;IA peut combler les autres.
      </CoachTip>

      <Textarea
        id="ideal_targets"
        label="Cibles idéales (libre)"
        placeholder="Ex : PME industrielles 10-50 salariés, marques premium locales, dirigeants de cabinets BtoB."
        hint="Texte libre, vue d'ensemble. Tu détailles les personas un par un en dessous."
        rows={2}
        value={payload.ideal_targets}
        onChange={(e) => patch({ ideal_targets: e.target.value })}
      />

      <div
        className="flex items-center justify-between gap-3 flex-wrap rounded-xl p-4"
        style={{
          background: "rgba(157, 107, 255, 0.08)",
          border: "1px solid rgba(157, 107, 255, 0.25)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem" }}>
            Pas envie de tout taper ?
          </p>
          <p
            className="text-meta mt-1"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Le cerveau IA peut te suggérer 3 personas distincts à partir de ta
            promesse. Tu édites ensuite.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onSuggest}
          loading={suggesting}
          disabled={suggesting}
        >
          {suggesting ? "Génération..." : "Suggérer 3 personas"}
        </Button>
      </div>

      <div className="space-y-3">
        {payload.personas.length === 0 && (
          <div
            className="rounded-xl p-6 text-center"
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px dashed rgba(255, 255, 255, 0.15)",
              color: "rgba(255, 255, 255, 0.55)",
            }}
          >
            Aucun persona pour l'instant. Ajoute-en un manuellement ou laisse
            le cerveau IA te suggérer.
          </div>
        )}
        {payload.personas.map((p, idx) => (
          <PersonaCard
            key={idx}
            idx={idx}
            persona={p}
            expanded={expanded === idx}
            onToggle={() => setExpanded(expanded === idx ? null : idx)}
            onChange={(patch) => patchPersona(idx, patch)}
            onRemove={() => removePersona(idx)}
          />
        ))}
      </div>

      <Button type="button" variant="ghost" onClick={addPersona}>
        + Ajouter un persona
      </Button>
    </div>
  );
}

function PersonaCard({
  idx,
  persona,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  idx: number;
  persona: GuidedPersonaInput;
  expanded: boolean;
  onToggle: () => void;
  onChange: (p: Partial<GuidedPersonaInput>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.10)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
      >
        <span
          style={{
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "0.95rem",
          }}
        >
          Persona {String(idx + 1).padStart(2, "0")}
          {persona.label && (
            <span
              style={{
                color: "var(--color-green)",
                marginLeft: 8,
                fontWeight: 600,
              }}
            >
              · {persona.label}
            </span>
          )}
          {!persona.label && (
            <span
              style={{
                color: "rgba(255, 255, 255, 0.55)",
                marginLeft: 8,
                fontWeight: 400,
                fontSize: "0.8rem",
              }}
            >
              · à compléter
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          style={{
            color: "rgba(255, 255, 255, 0.55)",
            fontSize: "0.85rem",
          }}
        >
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
            <Input
              id={`p-${idx}-label`}
              label="Label court *"
              placeholder="Ex : Directeur Marketing PME"
              value={persona.label}
              onChange={(e) => onChange({ label: e.target.value })}
            />
            <Input
              id={`p-${idx}-role`}
              label="Rôle précis"
              placeholder="Ex : Dir Marketing SaaS B2B série A"
              value={persona.role}
              onChange={(e) => onChange({ role: e.target.value })}
            />
          </div>
          <Input
            id={`p-${idx}-company`}
            label="Type d'entreprise typique"
            placeholder="Ex : SaaS 20-50 personnes, levée série A, marché européen"
            value={persona.typical_company}
            onChange={(e) => onChange({ typical_company: e.target.value })}
          />
          <CoachTip variant="compact">
            Les douleurs qui décrochent un RDV sont{" "}
            <strong style={{ color: "#FFFFFF" }}>
              hiérarchisées par fréquence ET intensité
            </strong>
            . Si tu mets 5 pains génériques, ton commercial pitchera dans le
            vide. Cible{" "}
            <strong style={{ color: "#FFFFFF" }}>2 pains MAX</strong> qui font
            mal <em>maintenant</em>. Le test : si le prospect dit &quot;oui,
            c&apos;est exactement ça&quot; en l&apos;écoutant, t&apos;as gagné.
            Sinon c&apos;est du remplissage.
          </CoachTip>
          <Textarea
            id={`p-${idx}-pains`}
            label="Douleurs principales (1 par ligne)"
            placeholder={"Ex :\nLeads de mauvaise qualité\nCoût d'acquisition qui explose\nDifficile à mesurer le ROI"}
            rows={4}
            value={persona.key_pains}
            onChange={(e) => onChange({ key_pains: e.target.value })}
          />
          <Textarea
            id={`p-${idx}-kpis`}
            label="KPIs qu'il surveille (1 par ligne)"
            placeholder={"Ex :\nCAC\nMQL/SQL ratio\nPipeline généré"}
            rows={3}
            value={persona.key_kpis}
            onChange={(e) => onChange({ key_kpis: e.target.value })}
          />
          <Textarea
            id={`p-${idx}-motivations`}
            label="Motivations / Priorités (1 par ligne)"
            placeholder={"Ex :\nProuver le ROI marketing au board\nDémontrer la croissance pour la série B"}
            rows={3}
            value={persona.motivations}
            onChange={(e) => onChange({ motivations: e.target.value })}
          />
          <CoachTip variant="compact" accent="green">
            Les vrais triggers que je traque chez Noxias :{" "}
            <strong style={{ color: "#FFFFFF" }}>levée de fonds récente</strong>{" "}
            (budget actif sous 90 jours),{" "}
            <strong style={{ color: "#FFFFFF" }}>
              recrutement sur poste lié
            </strong>{" "}
            (création de fonction = pain documenté),{" "}
            <strong style={{ color: "#FFFFFF" }}>changement de leadership</strong>{" "}
            (le nouveau cherche à laisser sa marque dans les 100 premiers jours),
            expansion géo/produit. Sans trigger, ton appel arrive au mauvais
            moment.
          </CoachTip>
          <Textarea
            id={`p-${idx}-triggers`}
            label="Événements déclencheurs d'achat (1 par ligne)"
            placeholder={"Ex :\nNouvelle levée de fonds\nChangement de direction marketing\nDémarrage d'une expansion internationale"}
            rows={3}
            value={persona.triggers}
            onChange={(e) => onChange({ triggers: e.target.value })}
          />
          <Textarea
            id={`p-${idx}-signals`}
            label="Ce qui le fait dire OUI à un RDV (1 phrase)"
            placeholder="Ex : Une promesse chiffrée + une référence client similaire à la sienne."
            rows={2}
            value={persona.decision_signals}
            onChange={(e) => onChange({ decision_signals: e.target.value })}
          />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onRemove}
              className="text-meta"
              style={{
                color: "#FFB4B4",
                background: "rgba(233, 75, 75, 0.10)",
                border: "1px solid rgba(233, 75, 75, 0.25)",
                padding: "6px 12px",
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              Supprimer ce persona
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepObjections({
  payload,
  patch,
  toggleCommon,
  onSuggest,
  suggesting,
}: {
  payload: GuidedWizardPayload;
  patch: (p: Partial<GuidedWizardPayload>) => void;
  toggleCommon: (o: string) => void;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  const specificCount = payload.specific_objections
    .split(/\r?\n/)
    .filter((l) => l.trim()).length;
  const total = payload.selected_common_objections.length + specificCount;

  return (
    <div className="space-y-5">
      <StepIntro
        title="Les objections que tes prospects sortent"
        subtitle="Coche les objections universelles que tu entends + ajoute les spécifiques à ta proposition."
      />
      <CoachTip>
        À retenir :{" "}
        <strong style={{ color: "#FFFFFF" }}>
          50% des objections en cold call sont des brush-offs réflexes
        </strong>
        , pas de vraies objections. &quot;Pas le temps&quot;, &quot;envoyez un
        mail&quot;, &quot;pas intéressé&quot; dans les 10 premières secondes =
        mécanisme défensif, pas avis raisonné. Un cold call qui décroche traite
        en moyenne <strong>3 à 4 objections</strong>. La question n&apos;est pas
        de les éviter, c&apos;est de les <em>creuser</em>.
      </CoachTip>

      <div>
        <div
          className="flex items-center justify-between gap-3 mb-3"
          style={{ flexWrap: "wrap" }}
        >
          <p
            className="text-small"
            style={{ color: "rgba(255, 255, 255, 0.75)", fontWeight: 600 }}
          >
            Objections universelles ({payload.selected_common_objections.length}{" "}
            sélectionnée{payload.selected_common_objections.length > 1 ? "s" : ""})
          </p>
          <span
            className="text-meta"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Recommandé : coche au moins 5
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {COMMON_OBJECTIONS.map((o) => {
            const selected = payload.selected_common_objections.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggleCommon(o)}
                className="text-left rounded-lg px-3 py-2.5 transition-all"
                style={{
                  background: selected
                    ? "rgba(60, 200, 121, 0.12)"
                    : "rgba(255, 255, 255, 0.04)",
                  border: `1px solid ${
                    selected ? "rgba(60, 200, 121, 0.45)" : "rgba(255, 255, 255, 0.08)"
                  }`,
                  color: selected ? "#FFFFFF" : "rgba(255, 255, 255, 0.85)",
                  fontSize: "0.85rem",
                  fontWeight: selected ? 600 : 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: selected ? "var(--color-green)" : "transparent",
                    border: selected
                      ? "1px solid var(--color-green)"
                      : "1px solid rgba(255, 255, 255, 0.25)",
                    color: "#0A1F12",
                    fontWeight: 800,
                    fontSize: "0.7rem",
                    flexShrink: 0,
                  }}
                >
                  {selected ? "✓" : ""}
                </span>
                <span style={{ lineHeight: 1.3 }}>{o}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CoachTip variant="compact">
        Framework de base : LAER (Listen-Acknowledge-Explore-Respond). Version
        pro que j&apos;utilise :{" "}
        <strong style={{ color: "#FFFFFF" }}>mirroring + labeling</strong> de
        Chris Voss. Tu répètes les 3 derniers mots du prospect (&quot;déjà un
        prestataire ?&quot;) ou tu nommes l&apos;émotion (&quot;on dirait que ce
        sujet vous fatigue&quot;). Ça pousse à élaborer : c&apos;est là que tu
        trouves la vraie objection cachée derrière la phrase réflexe.
      </CoachTip>

      <CoachTip variant="compact" accent="green">
        Pour récolter les objections spécifiques de ton offre :{" "}
        <strong style={{ color: "#FFFFFF" }}>
          relis tes 10 derniers deals perdus
        </strong>{" "}
        et les comptes-rendus. Les objections génériques (budget, timing), tu
        les connais déjà. Cherche les phrases EXACTES que tes prospects
        sortaient (&quot;on a essayé X y&apos;a 2 ans et ça a foiré&quot;,
        &quot;mon DAF refuse les abonnements SaaS&quot;). C&apos;est l&apos;or,
        ce qui distingue tes commerciaux d&apos;un commercial random.
      </CoachTip>

      <div
        className="flex items-center justify-between gap-3 flex-wrap rounded-xl p-4"
        style={{
          background: "rgba(157, 107, 255, 0.08)",
          border: "1px solid rgba(157, 107, 255, 0.25)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem" }}>
            Objections spécifiques à ton offre
          </p>
          <p
            className="text-meta mt-1"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Celles qui sont propres à ce que tu vends. Le cerveau IA peut
            t&apos;en suggérer 15 ciblées à partir de ta promesse.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onSuggest}
          loading={suggesting}
          disabled={suggesting}
        >
          {suggesting ? "Génération..." : "Suggérer 15 objections"}
        </Button>
      </div>

      <Textarea
        id="specific_objections"
        label={`Objections spécifiques (1 par ligne) · ${specificCount} ajoutée${specificCount > 1 ? "s" : ""}`}
        placeholder={"Ex :\nOn fait ça en interne avec notre équipe tech\nOn a déjà investi dans un autre outil l'an dernier\nNotre CIO ne valide pas les nouveaux SaaS"}
        rows={8}
        value={payload.specific_objections}
        onChange={(e) => patch({ specific_objections: e.target.value })}
      />

      <p
        className="text-meta"
        style={{ color: "rgba(255, 255, 255, 0.55)" }}
      >
        Total : <strong style={{ color: "#FFFFFF" }}>{total} objection{total > 1 ? "s" : ""}</strong>
        . Le cerveau IA les répartira intelligemment entre tes personas à la création.
      </p>
    </div>
  );
}

function StepHook({
  payload,
  patch,
  onSuggest,
  suggesting,
}: {
  payload: GuidedWizardPayload;
  patch: (p: Partial<GuidedWizardPayload>) => void;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  return (
    <div className="space-y-5">
      <StepIntro
        title="L'accroche et les arguments massue"
        subtitle="La porte d'entrée d'un appel et les phrases qui font mouche. Optionnel mais ça enrichit l'entraînement."
      />
      <CoachTip>
        Un opener ≠ un pitch. L&apos;opener c&apos;est les{" "}
        <strong style={{ color: "#FFFFFF" }}>10-15 premières secondes</strong>{" "}
        pour passer le réflexe de raccrochage. Le pitch vient APRÈS. Data Gong
        sur 300M de calls :{" "}
        <strong style={{ color: "#FFFFFF" }}>
          &quot;Comment ça va depuis la dernière fois ?&quot; = 10% de succès
        </strong>{" "}
        (vs baseline industrie 1,5%). Pattern interrupt : le cerveau croit
        reconnaître un familier. À l&apos;inverse :{" "}
        <strong style={{ color: "#FFFFFF" }}>
          &quot;Did I catch you at a bad time&quot; = −40% de RDV
        </strong>
        , c&apos;est grillé. Trop répandu.
      </CoachTip>

      <div
        className="flex items-center justify-between gap-3 flex-wrap rounded-xl p-4"
        style={{
          background: "rgba(157, 107, 255, 0.08)",
          border: "1px solid rgba(157, 107, 255, 0.25)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem" }}>
            Pas inspiré ?
          </p>
          <p
            className="text-meta mt-1"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Le cerveau IA peut te générer un brise-glace + 5-7 arguments
            massue à partir de ta promesse. Tu édites ensuite.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onSuggest}
          loading={suggesting}
          disabled={suggesting}
        >
          {suggesting ? "Génération..." : "Suggérer le brise-glace"}
        </Button>
      </div>

      <CoachTip variant="compact">
        L&apos;opener qui décroche le mieux selon Gong :{" "}
        <strong style={{ color: "#FFFFFF" }}>demande 27 secondes</strong>{" "}
        d&apos;attention upfront. Pas une permission floue (&quot;vous avez 5
        min ?&quot; = −40%), un CONTRAT de temps précis. Phrase testée : « Je
        sais que je tombe à l&apos;improviste, vous m&apos;accordez 27 secondes
        pour vous dire pourquoi je vous appelle, et après vous décidez ? ».
        Ensuite{" "}
        <strong style={{ color: "#FFFFFF" }}>
          &quot;la raison de mon appel&quot;
        </strong>{" "}
        (×2,1 de RDV).
      </CoachTip>
      <Textarea
        id="hook"
        label="Accroche d'ouverture"
        placeholder="Ex : 'Bonjour, je vous appelle parce que beaucoup de PME industrielles ont aujourd'hui un site qui sous-valorise leur vrai savoir-faire. Est-ce que c'est un sujet que vous avez en tête en ce moment ?'"
        hint="La phrase qu'un commercial doit pouvoir caser dans les 15 premières secondes."
        rows={4}
        value={payload.hook}
        onChange={(e) => patch({ hook: e.target.value })}
      />
      <CoachTip variant="compact" accent="green">
        Mes 3 armes en closing d&apos;objection, signature Chris Voss :{" "}
        <strong style={{ color: "#FFFFFF" }}>mirroring</strong> (répéter les 3
        derniers mots avec curiosité, fait élaborer),{" "}
        <strong style={{ color: "#FFFFFF" }}>labeling</strong> (&quot;on dirait
        que...&quot; désamorce l&apos;émotion),{" "}
        <strong style={{ color: "#FFFFFF" }}>inversion du oui</strong>{" "}
        (&quot;est-ce une mauvaise idée qu&apos;on se voie 15 min ?&quot; : le
        NON est plus sécurisant que le OUI pour un prospect). Liste ici les
        phrases concrètes que tu sors quand tu sens que ça casse.
      </CoachTip>
      <Textarea
        id="killer_arguments"
        label="Arguments massue (1 par ligne)"
        placeholder={"Ex :\nVotre site ne doit pas seulement exister, il doit prouver votre sérieux.\nDans un océan de sites IA standardisés, le vôtre doit être celui qu'on retient.\nVotre bouche-à-oreille a bâti une réputation, votre site doit la confirmer."}
        hint="Les phrases choc qui retournent une objection ou ferment un closing."
        rows={6}
        value={payload.killer_arguments}
        onChange={(e) => patch({ killer_arguments: e.target.value })}
      />
    </div>
  );
}

// Modal d'entrée du wizard quand un brouillon localStorage existe. Donne le
// choix explicite à l'utilisateur : reprendre la config en cours ou repartir
// de zéro. Bloque l'UI derrière jusqu'à la décision.
function RestoreDraftModal({
  draftPayload,
  savedAt,
  onResume,
  onFresh,
}: {
  draftPayload: GuidedWizardPayload;
  savedAt?: number;
  onResume: () => void;
  onFresh: () => void;
}) {
  const offerName = draftPayload.name?.trim() || "ton offre";
  const completedSteps = stepsCompletedFromPayload(draftPayload);
  const relativeTime = savedAt ? formatRelativeTime(savedAt) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reprendre la configuration"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(10, 6, 20, 0.72)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-6 sm:p-7"
        style={{
          background:
            "linear-gradient(140deg, rgba(60, 200, 121, 0.10) 0%, rgba(34, 25, 50, 0.95) 100%)",
          border: "1px solid rgba(60, 200, 121, 0.32)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          className="text-meta uppercase mb-2"
          style={{
            color: "var(--color-green)",
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}
        >
          Configuration en cours
        </div>
        <h3
          className="text-h3"
          style={{ color: "#FFFFFF", marginBottom: 12, lineHeight: 1.2 }}
        >
          Tu reprends la configuration de {offerName} ?
        </h3>
        <p
          className="text-small"
          style={{ color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.5 }}
        >
          {completedSteps > 0
            ? `Tu avais déjà rempli ${completedSteps} étape${completedSteps > 1 ? "s" : ""} sur 5`
            : "Tu avais commencé à remplir le formulaire"}
          {relativeTime ? ` ${relativeTime}` : ""}. Tu peux continuer là où tu en
          étais, ou démarrer une nouvelle configuration depuis zéro.
        </p>
        <div
          className="flex flex-col sm:flex-row gap-3 mt-6"
          style={{ flexDirection: "row-reverse" }}
        >
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-lg px-4 py-3 transition-all"
            style={{
              background:
                "linear-gradient(135deg, var(--color-green), rgba(60, 200, 121, 0.85))",
              color: "#0A1F12",
              fontWeight: 700,
              fontSize: "0.95rem",
              border: "1px solid var(--color-green)",
              cursor: "pointer",
            }}
          >
            Reprendre la configuration
          </button>
          <button
            type="button"
            onClick={onFresh}
            className="flex-1 rounded-lg px-4 py-3 transition-all"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              color: "rgba(255, 255, 255, 0.85)",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              cursor: "pointer",
            }}
          >
            Démarrer une nouvelle offre
          </button>
        </div>
      </div>
    </div>
  );
}

function stepsCompletedFromPayload(p: GuidedWizardPayload): number {
  let n = 0;
  if (p.name.trim() && p.value_prop_one_liner.trim()) n += 1;
  if (p.product_pitch.trim() || p.tangible_value.trim()) n += 1;
  if (p.personas.length > 0) n += 1;
  if (
    p.selected_common_objections.length > 0 ||
    p.specific_objections.trim()
  ) {
    n += 1;
  }
  if (p.hook.trim() || p.killer_arguments.trim()) n += 1;
  return n;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  return `il y a ${weeks} semaine${weeks > 1 ? "s" : ""}`;
}
