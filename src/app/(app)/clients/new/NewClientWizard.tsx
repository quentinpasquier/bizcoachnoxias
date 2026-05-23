"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Loader } from "@/components/Loader";
import { CoachAvatar } from "@/components/CoachAvatar";
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
  const hydrated = useRef(false);

  // Hydratation localStorage : si on est en mode création et qu'un brouillon
  // existe, on le restaure au montage. Pas de localStorage en mode édition
  // (l'état initial vient du DB).
  useEffect(() => {
    if (isEdit) return;
    if (typeof window === "undefined") return;
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { payload: GuidedWizardPayload };
      if (parsed && typeof parsed.payload === "object") {
        setPayload(parsed.payload);
        setDraftRestored(true);
      }
    } catch {
      // ignore — brouillon corrompu
    }
  }, [isEdit]);

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
      // ignore — quota dépassé / mode privé
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
        "Remplis d'abord la promesse ou le pitch produit (étape 1-2) pour que Claude puisse suggérer.",
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
        "Remplis d'abord la promesse ou le pitch produit pour que Claude puisse suggérer.",
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
        "Remplis d'abord la promesse ou le pitch produit pour que Claude puisse suggérer.",
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
            message="Camille assemble ton coach personnalisé"
            detail="20 à 40 secondes : extraction des personas, génération des briefings, structuration des objections."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      <Textarea
        id="product_pitch"
        label="Pitch produit"
        placeholder="Ex : Refonte de site orientée image, SEO et conversion, livrée en 6 semaines, avec identité visuelle et expérience de marque sur-mesure."
        hint="2 à 3 phrases. Le pitch que tu attendrais d'un commercial qui ne connaît pas encore l'offre."
        rows={3}
        value={payload.product_pitch}
        onChange={(e) => patch({ product_pitch: e.target.value })}
      />
      <Textarea
        id="tangible_value"
        label="Valeur tangible livrée en 30-60 jours"
        placeholder="Ex : Un site en ligne, une identité visuelle complète, +30% de demandes qualifiées."
        rows={2}
        value={payload.tangible_value}
        onChange={(e) => patch({ tangible_value: e.target.value })}
      />
      <Textarea
        id="differentiation"
        label="Différenciation concurrentielle"
        placeholder="Ex : Site propriétaire (pas d'abonnement), expertise identité + SEO en un seul prestataire, références locales."
        rows={2}
        value={payload.differentiation}
        onChange={(e) => patch({ differentiation: e.target.value })}
      />
      <Textarea
        id="channels"
        label="Où trouve-t-on tes cibles ?"
        placeholder="Ex : Google Maps zones industrielles BTP, salons spécialisés, LinkedIn dirigeants PME."
        rows={2}
        value={payload.channels}
        onChange={(e) => patch({ channels: e.target.value })}
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

      <Textarea
        id="ideal_targets"
        label="Cibles idéales (libre)"
        placeholder="Ex : PME industrielles 10-50 salariés, marques premium locales, dirigeants de cabinets BtoB."
        hint="Texte libre — vue d'ensemble. Tu détailles les personas un par un en dessous."
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
            Claude peut te suggérer 3 personas distincts à partir de ta promesse.
            Tu édites ensuite.
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
            Claude te suggérer.
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
            Celles qui sont propres à ce que tu vends. Claude peut t'en suggérer
            15 ciblées à partir de ta promesse.
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
        label={`Objections spécifiques (1 par ligne) — ${specificCount} ajoutée${specificCount > 1 ? "s" : ""}`}
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
        . Claude les répartira intelligemment entre tes personas à la création.
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
            Claude peut te générer un brise-glace + 5-7 arguments massue à
            partir de ta promesse. Tu édites ensuite.
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

      <Textarea
        id="hook"
        label="Accroche d'ouverture"
        placeholder="Ex : 'Bonjour, je vous appelle parce que beaucoup de PME industrielles ont aujourd'hui un site qui sous-valorise leur vrai savoir-faire. Est-ce que c'est un sujet que vous avez en tête en ce moment ?'"
        hint="La phrase qu'un commercial doit pouvoir caser dans les 15 premières secondes."
        rows={4}
        value={payload.hook}
        onChange={(e) => patch({ hook: e.target.value })}
      />
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
