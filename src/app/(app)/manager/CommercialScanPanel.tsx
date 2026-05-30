"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CoachScanResult } from "@/lib/coach-scan";

// Panneau scan IA pour un commercial donné, intégré dans sa carte
// /manager. Au montage, vérifie via GET s'il existe un scan récent
// (< 24h) à afficher. Sinon affiche un bouton "Scanner les 5 dernières
// sessions" qui lance le POST. Pendant le scan : loading + progression.
//
// Le composant gère lui-même 3 états :
//   - idle : aucun scan en cache, bouton dispo
//   - cached : scan en cache, affiché avec un "Refaire le scan" possible
//   - loading : scan en cours, animation
//   - error : message d'erreur + retry possible

interface ScanResponse {
  scanned_at: string;
  sessions_analyzed: number;
  analysis: CoachScanResult;
}

interface Props {
  userId: string;
  fullName: string;
  /** Stat sessions complétées total, pour activer/désactiver le bouton. */
  totalCompletedSessions: number;
}

const BLOCK_LABEL: Record<string, string> = {
  brise_glace: "Brise-glace",
  decouverte: "Découverte",
  pitch: "Pitch & valeur",
  objections: "Levée d'objections",
  closing: "Closing",
};

const MODE_LABEL: Record<string, string> = {
  full: "Appel complet",
  block: "Coaching ciblé",
  embedded: "Coaching embarqué",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  expert: "Expert",
};

export function CommercialScanPanel({
  userId,
  fullName,
  totalCompletedSessions,
}: Props) {
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Vérification cache au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/manager/scan/${userId}`);
        if (!res.ok) throw new Error("Lecture cache échouée");
        const data = (await res.json()) as { scan: ScanResponse | null };
        if (!cancelled) setScan(data.scan);
      } catch {
        // Pas grave, on affichera juste le bouton "Scanner".
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Timer pendant le scan (15-45s typique)
  useEffect(() => {
    if (!scanning) {
      setElapsed(0);
      return;
    }
    const start = performance.now();
    const id = setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [scanning]);

  async function launchScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/manager/scan/${userId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      const data = (await res.json()) as { scan: ScanResponse };
      setScan(data.scan);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  const cantScan = totalCompletedSessions === 0;

  return (
    <div className="scan-panel">
      {loading ? (
        <div className="scan-panel-loading-cache" aria-label="Chargement…">
          <span className="scan-panel-spinner" aria-hidden="true" />
          <span>Lecture des données…</span>
        </div>
      ) : scanning ? (
        <ScanRunningView fullName={fullName} elapsed={elapsed} />
      ) : scan ? (
        <ScanResultView scan={scan} onRefresh={launchScan} />
      ) : (
        <div className="scan-panel-cta-wrap">
          {error && (
            <div className="scan-panel-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={launchScan}
            disabled={cantScan}
            className="scan-panel-cta"
          >
            <span aria-hidden="true">🔍</span>
            {cantScan
              ? "Pas encore de sessions à analyser"
              : "Scanner les 5 dernières sessions"}
          </button>
          {!cantScan && (
            <p className="scan-panel-cta-hint">
              Le scan IA prend 15 à 45 secondes. Analyse les transcripts, les
              évaluations et les défauts récurrents pour proposer un plan
              d&apos;entraînement précis.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ScanRunningView({
  fullName,
  elapsed,
}: {
  fullName: string;
  elapsed: number;
}) {
  return (
    <div className="scan-running">
      <div className="scan-running-spinner" aria-hidden="true">
        <span className="scan-running-spinner-ring" />
      </div>
      <div className="scan-running-text">
        <div className="scan-running-title">
          L&apos;IA analyse les 5 sessions de {fullName}
        </div>
        <div className="scan-running-sub">
          Lecture des transcripts · agrégation des défauts récurrents ·
          formulation des axes prioritaires
        </div>
        <div className="scan-running-elapsed">{elapsed.toFixed(1)} s</div>
      </div>
    </div>
  );
}

function ScanResultView({
  scan,
  onRefresh,
}: {
  scan: ScanResponse;
  onRefresh: () => void;
}) {
  const { analysis, scanned_at, sessions_analyzed } = scan;
  return (
    <div className="scan-result">
      <div className="scan-result-header">
        <div>
          <div className="scan-result-eyebrow">
            Scan IA · {sessions_analyzed} session
            {sessions_analyzed > 1 ? "s" : ""} analysée
            {sessions_analyzed > 1 ? "s" : ""}
          </div>
          <div className="scan-result-time">
            Lancé {formatRelativeShort(scanned_at)}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="scan-result-refresh"
        >
          Refaire le scan
        </button>
      </div>

      {/* 1. Diagnostic général */}
      <div className="scan-section">
        <div className="scan-section-eyebrow">Diagnostic</div>
        <p className="scan-section-text">{analysis.overall_diagnosis}</p>
      </div>

      {/* 2. Défauts récurrents */}
      {analysis.recurring_defects.length > 0 && (
        <div className="scan-section">
          <div className="scan-section-eyebrow">
            Défauts récurrents observés
          </div>
          <ul className="scan-defects">
            {analysis.recurring_defects.map((d, i) => (
              <li key={i} className="scan-defect">
                <div className="scan-defect-header">
                  <span className="scan-defect-name">{d.name}</span>
                  <span className="scan-defect-occ">
                    {d.occurrences}{" "}
                    {d.occurrences > 1 ? "occurrences" : "occurrence"}
                  </span>
                </div>
                {d.evidence_quote && (
                  <blockquote className="scan-defect-quote">
                    « {d.evidence_quote} »
                  </blockquote>
                )}
                <p className="scan-defect-why">{d.why_it_matters}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Axes de travail */}
      {analysis.action_axes.length > 0 && (
        <div className="scan-section">
          <div className="scan-section-eyebrow">Axes de travail prioritaires</div>
          <ol className="scan-axes">
            {analysis.action_axes.map((a, i) => (
              <li key={i} className="scan-axis">
                <div className="scan-axis-header">
                  <span className="scan-axis-num">{i + 1}</span>
                  <span className="scan-axis-title">{a.title}</span>
                </div>
                <p className="scan-axis-desc">{a.description}</p>
                {a.example_phrase && (
                  <div className="scan-axis-example">
                    <span className="scan-axis-example-label">
                      Phrase à tester :
                    </span>{" "}
                    <span className="scan-axis-example-text">
                      « {a.example_phrase} »
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 4. Recommandation pour les 3 prochaines sessions */}
      <div className="scan-recommendation-box">
        <div className="scan-recommendation-eyebrow">
          Plan pour les 3 prochaines sessions
        </div>
        <div className="scan-recommendation-headline">
          {MODE_LABEL[analysis.recommendation.mode] ??
            analysis.recommendation.mode}
          {analysis.recommendation.blockTarget &&
            ` · ${BLOCK_LABEL[analysis.recommendation.blockTarget] ?? analysis.recommendation.blockTarget}`}
          {" · "}
          Niveau{" "}
          {DIFFICULTY_LABEL[analysis.recommendation.difficulty] ??
            analysis.recommendation.difficulty}
        </div>
        <p className="scan-recommendation-text">
          {analysis.recommendation.next_3_sessions}
        </p>
        <Link
          href={`/sessions/new?mode=${analysis.recommendation.mode}`}
          className="scan-recommendation-cta"
        >
          <span>Lancer l&apos;entraînement recommandé</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* 5. Encouragement de clôture */}
      {analysis.encouragement && (
        <div className="scan-encouragement">{analysis.encouragement}</div>
      )}
    </div>
  );
}

function formatRelativeShort(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}
