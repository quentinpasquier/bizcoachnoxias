import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CamilleMascot } from "@/components/CamilleMascot";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden="true" />
      <div className="login-blob login-blob-purple" aria-hidden="true" />
      <div className="login-blob login-blob-green" aria-hidden="true" />
      <div className="login-blob login-blob-violet" aria-hidden="true" />

      <header className="container-noxias h-16 flex items-center relative z-10">
        <Link href="/login" className="inline-flex items-center">
          <Logo variant="dark" size={42} />
        </Link>
      </header>

      <main className="flex-1 container-noxias relative z-10 grid lg:grid-cols-[1.05fr_minmax(0,440px)] items-center gap-10 lg:gap-16 pt-2 pb-16 lg:py-0">
        <section className="login-hero">
          <div
            className="relative inline-block"
            style={{ width: 120, height: 120 }}
          >
            <span className="login-halo login-halo-1" aria-hidden="true" />
            <span className="login-halo login-halo-2" aria-hidden="true" />
            <span className="login-halo login-halo-3" aria-hidden="true" />
            <CamilleMascot state="happy" size={120} />
          </div>

          <div className="login-hero-text">
            <span className="login-eyebrow">Camille · Coach commerciale</span>
            <h1 className="login-headline">
              <span className="login-headline-light">Salut.</span>
              <span className="login-headline-green">
                Prêt pour ta session&nbsp;?
              </span>
            </h1>
            <p className="login-tagline">
              Deviens un expert du cold call et fais exploser{" "}
              <span className="login-tagline-accent">tes primes</span>.
            </p>
            <p className="login-subtitle">
              Scoring sur 20 critères, classement équipe en direct, badges
              déblocables. Reprends l&apos;entraînement là où tu t&apos;es
              arrêté.
            </p>
          </div>

          <ul className="login-pills">
            <li className="login-pill">
              <span className="login-pill-icon">
                <PillIconTarget />
              </span>
              <div>
                <strong>20 critères</strong>
                <span>évalués par appel</span>
              </div>
            </li>
            <li className="login-pill">
              <span className="login-pill-icon">
                <PillIconTrophy />
              </span>
              <div>
                <strong>Classement</strong>
                <span>équipe en direct</span>
              </div>
            </li>
            <li className="login-pill">
              <span className="login-pill-icon">
                <PillIconMic />
              </span>
              <div>
                <strong>Voix IA</strong>
                <span>prospect réaliste</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="login-form-stage">
          <div className="login-form-card">
            <div className="login-form-head">
              <h2 className="login-form-title">Reconnecte-toi</h2>
              <p className="login-form-sub">
                Ton coach virtuel t&apos;attend. 5 minutes, débrief immédiat.
              </p>
            </div>
            <div className="login-form-inner">
              <LoginForm next={params.next} initialError={params.error} />
            </div>
            <p className="login-form-foot">
              <span className="login-foot-dot" aria-hidden="true" />
              Accès réservé aux commerciaux Noxias
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function PillIconTarget() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function PillIconTrophy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3" />
      <path d="M9 17h6" />
      <path d="M12 14v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function PillIconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
