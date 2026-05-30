import Link from "next/link";
import type { ReactNode } from "react";

// Page d'accueil "Nouvel entraînement" : 3 grandes cartes pédagogiques
// (Pourquoi / Quoi / Comment / Bénéfices) qui orientent le commercial
// vers le bon mode selon son besoin du moment. Rendue uniquement quand
// aucun mode n'est encore choisi (pas de ?mode= dans l'URL).
//
// Au clic sur une carte, on navigue vers /sessions/new?mode=X qui
// affiche la vue de configuration du mode.

interface ModeDescriptor {
  key: "block" | "embedded" | "full";
  href: string;
  accent: "green" | "purple" | "orange";
  icon: string;
  title: string;
  tagline: string;
  visual: ReactNode;
  why: string;
  what: string;
  how: [string, string, string];
  benefits: [string, string, string];
  cta: string;
}

const MODES: ModeDescriptor[] = [
  {
    key: "block",
    href: "/sessions/new?mode=block",
    accent: "green",
    icon: "🎯",
    title: "Coaching ciblé",
    tagline: "Bosser UN bloc précis en 2 à 3 minutes",
    visual: <BlockModeVisual />,
    why: "Tu as identifié un point faible précis (ton brise-glace, la gestion des objections, ton closing...). Tu veux le travailler en boucle, sans rejouer tout l'appel à chaque fois.",
    what: "La conversation démarre directement à l'étape choisie, comme si les blocs précédents étaient déjà validés. Tu joues uniquement ce moment-là.",
    how: [
      "Choisis ton offre, ton persona et le bloc à travailler (brise-glace, découverte, pitch, objections ou closing).",
      "Le prospect ouvre directement sur ton bloc : par exemple en mode objections, il te sort une objection forte dès la première seconde.",
      "Tu reçois un débrief court, concentré sur les 3 à 5 critères du bloc, pas dilué sur tout l'appel.",
    ],
    benefits: [
      "Idéal pour répéter UN réflexe précis 10 fois d'affilée jusqu'à ce qu'il devienne automatique.",
      "Sessions courtes (2-3 min), tu peux en enchaîner 5 sur la pause déjeuner.",
      "Le scoring se concentre sur le bloc travaillé, le verdict est net.",
    ],
    cta: "Choisir le coaching ciblé",
  },
  {
    key: "embedded",
    href: "/sessions/new?mode=embedded",
    accent: "orange",
    icon: "🧑‍🏫",
    title: "Coaching embarqué",
    tagline: "Un coach IA qui te corrige en direct",
    visual: <EmbeddedModeVisual />,
    why: "Tu sais que certaines réponses sortent à côté ou en mode baratin, mais tu t'en rends compte trop tard. Tu veux qu'un coach t'arrête sur le coup et te dise quoi reformuler.",
    what: "L'appel se déroule normalement, mais chaque réponse passe d'abord par un coach IA. Si elle ne fait pas avancer la conversation, il bloque l'envoi, t'explique pourquoi à l'audio et te demande de reformuler.",
    how: [
      "Choisis ton offre, ton persona, ton niveau. L'appel démarre normalement.",
      "Quand tu réponds, le coach évalue 4 axes (précision, écoute, pertinence, professionnalisme). Si ça passe, le prospect répond. Sinon, voix coach + explication + reformulation.",
      "Après 3 tentatives ratées, le coach te joue la formulation modèle et la conversation avance. Tu sais exactement ce qu'il fallait dire.",
    ],
    benefits: [
      "Tu corriges tes réflexes en temps réel, pas en différé dans un débrief que tu ne reliras pas.",
      "Le coach est exigeant : zéro baratin toléré, vouvoiement strict, vraies questions ouvertes.",
      "Le compteur de reformulations s'affiche sur ton débrief pour mesurer ta progression session après session.",
    ],
    cta: "Choisir le coaching embarqué",
  },
  {
    key: "full",
    href: "/sessions/new?mode=full",
    accent: "purple",
    icon: "📞",
    title: "Appel complet",
    tagline: "Le cold call de bout en bout, sans filet",
    visual: <FullModeVisual />,
    why: "Tu veux te confronter à la vraie vie : un appel de prospection qui démarre par un Allô ?, qui passe par toutes les étapes, et qui finit en RDV ou en raccrochage selon ta performance.",
    what: "Une simulation complète du cold call B2B comme si tu avais composé le numéro pour de vrai. Tous les critères évalués (20 sur 5 catégories), débrief approfondi avec quote rewrites.",
    how: [
      "Choisis ton offre, ton persona, ton niveau et le genre du prospect.",
      "Le prospect décroche par un Allô ? Tu enchaînes les 5 étapes (brise-glace, présentation, ouverture, objections, action). Lui réagit en temps réel.",
      "À la fin (RDV obtenu, raccrochage ou expiration), tu reçois un débrief complet avec note sur 100, 4 à 6 reformulations concrètes et un plan d'action.",
    ],
    benefits: [
      "L'épreuve la plus proche de la réalité : pas de filet, pas de coach qui t'arrête, tu te débrouilles.",
      "Quick Launch disponible : 1 clic pour démarrer si tu veux juste tester.",
      "Score sur 100 qui compte dans tes Practis Points, et badges débloqués (Premier RDV, Closer 10, etc.).",
    ],
    cta: "Choisir l'appel complet",
  },
];

export function TrainingModeSelection() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="eyebrow-green">Choisis ton entraînement</div>
        <h1
          className="text-h1"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: "1.05",
          }}
        >
          <span>Trois manières de </span>
          <span style={{ color: "var(--color-green)" }}>progresser</span>
          <span>.</span>
        </h1>
        <p
          className="text-body-l"
          style={{ color: "rgba(255,255,255,0.7)", maxWidth: "62ch" }}
        >
          Selon ce que tu veux travailler aujourd&apos;hui : un bloc précis,
          un coach qui t&apos;arrête en direct, ou un appel complet sans
          filet. Lis ce qui correspond à ta situation, choisis et lance.
        </p>
      </header>

      <div className="training-mode-rich-grid">
        {MODES.map((m) => (
          <ModeRichCard key={m.key} mode={m} />
        ))}
      </div>
    </div>
  );
}

function ModeRichCard({ mode }: { mode: ModeDescriptor }) {
  return (
    <article className={`training-mode-rich-card training-mode-rich-card-${mode.accent}`}>
      <div className="training-mode-rich-visual">{mode.visual}</div>

      <div className="training-mode-rich-body">
        <div className="training-mode-rich-header">
          <div className="training-mode-rich-icon" aria-hidden="true">
            {mode.icon}
          </div>
          <div>
            <h2 className="training-mode-rich-title">{mode.title}</h2>
            <p className="training-mode-rich-tagline">{mode.tagline}</p>
          </div>
        </div>

        <div className="training-mode-rich-section">
          <div className="training-mode-rich-eyebrow">Pourquoi</div>
          <p className="training-mode-rich-text">{mode.why}</p>
        </div>

        <div className="training-mode-rich-section">
          <div className="training-mode-rich-eyebrow">Quoi</div>
          <p className="training-mode-rich-text">{mode.what}</p>
        </div>

        <div className="training-mode-rich-section">
          <div className="training-mode-rich-eyebrow">Comment</div>
          <ol className="training-mode-rich-steps">
            {mode.how.map((step, i) => (
              <li key={i}>
                <span className="training-mode-rich-step-num">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="training-mode-rich-section">
          <div className="training-mode-rich-eyebrow">Bénéfices</div>
          <ul className="training-mode-rich-benefits">
            {mode.benefits.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>

        <Link href={mode.href} className="training-mode-rich-cta">
          <span>{mode.cta}</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

// Visuel mockup du mode "Coaching ciblé" : 5 segments représentant les
// blocs, un seul est mis en avant (vert pulsant), les autres sont grisés
// pour montrer qu'on travaille un bloc isolé.
function BlockModeVisual() {
  const blocks = ["Brise-glace", "Découverte", "Pitch", "Objections", "Closing"];
  const focusedIdx = 2; // Pitch surligné pour l'exemple
  return (
    <div className="mode-visual-block">
      <div className="mode-visual-block-label">Bloc en cours</div>
      <div className="mode-visual-block-row">
        {blocks.map((b, i) => (
          <div
            key={b}
            className={`mode-visual-block-cell ${i === focusedIdx ? "mode-visual-block-cell-active" : ""}`}
          >
            <div className="mode-visual-block-cell-num">{i + 1}</div>
            <div className="mode-visual-block-cell-name">{b}</div>
          </div>
        ))}
      </div>
      <div className="mode-visual-block-timer">
        <span>2-3 min</span>
      </div>
    </div>
  );
}

// Visuel mockup du mode "Coaching embarqué" : un mini-dialogue stylisé
// avec une réponse commerciale interrompue par un panneau coach orange.
function EmbeddedModeVisual() {
  return (
    <div className="mode-visual-embedded">
      <div className="mode-visual-bubble mode-visual-bubble-prospect">
        <div className="mode-visual-bubble-author">Prospect</div>
        <div className="mode-visual-bubble-body">
          On a déjà un prestataire, ça nous va.
        </div>
      </div>
      <div className="mode-visual-bubble mode-visual-bubble-user">
        <div className="mode-visual-bubble-author">Vous</div>
        <div className="mode-visual-bubble-body">
          Notre solution apporte de l&apos;optimisation...
        </div>
      </div>
      <div className="mode-visual-coach-panel">
        <div className="mode-visual-coach-panel-eyebrow">Coach · Tentative 1/3</div>
        <div className="mode-visual-coach-panel-body">
          Vous utilisez « optimisation » sans le concrétiser. Reformulez.
        </div>
      </div>
    </div>
  );
}

// Visuel mockup du mode "Appel complet" : timeline des 5 étapes toutes
// actives + un compteur "Score 87/100" et un badge "RDV obtenu" pour
// évoquer le débrief de fin.
function FullModeVisual() {
  const blocks = ["Brise-glace", "Découverte", "Pitch", "Objections", "Closing"];
  return (
    <div className="mode-visual-full">
      <div className="mode-visual-full-pipeline">
        {blocks.map((b, i) => (
          <div key={b} className="mode-visual-full-step">
            <div className="mode-visual-full-step-dot">{i + 1}</div>
            <div className="mode-visual-full-step-name">{b}</div>
          </div>
        ))}
      </div>
      <div className="mode-visual-full-result">
        <div className="mode-visual-full-score">
          <span className="mode-visual-full-score-num">87</span>
          <span className="mode-visual-full-score-max">/ 100</span>
        </div>
        <div className="mode-visual-full-badge">RDV obtenu</div>
      </div>
    </div>
  );
}
