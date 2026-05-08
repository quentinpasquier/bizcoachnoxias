import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-dark)" }}>
      <header className="container-noxias flex h-16 items-center justify-between">
        <Logo variant="dark" size={28} />
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-small text-white/80 hover:text-white transition-colors"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="btn btn-primary text-small px-5 py-2"
          >
            Démarrer
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center">
        <div className="container-noxias grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-20">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2">
              <span
                className="w-12 h-0.5 rounded-pill"
                style={{ background: "var(--color-green)" }}
              />
              <span
                className="text-meta uppercase tracking-widest"
                style={{ color: "var(--color-green)" }}
              >
                Noxias Coach · v1
              </span>
            </div>

            <h1
              className="font-display text-white"
              style={{
                fontSize: "clamp(3rem, 6vw, 6rem)",
                lineHeight: "1.05",
                letterSpacing: "0.01em",
              }}
            >
              ENTRAÎNEZ VOS COMMERCIAUX
              <br />
              <span style={{ color: "var(--color-green)" }}>FACE AUX VRAIS PROSPECTS.</span>
            </h1>

            <p className="text-body-l text-white/80 max-w-xl">
              Un coach IA qui joue le prospect non sollicité. Objections
              réalistes, niveau de difficulté ajustable, restitution chiffrée.
              Vos commerciaux sortent prêts pour le terrain.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup" className="btn btn-primary text-body-l px-7 py-4">
                Démarrer une session
              </Link>
              <Link href="/login" className="btn text-body-l px-7 py-4 text-white border border-white/20 hover:bg-white/5">
                Déjà un compte
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 pt-6 border-t border-white/10">
              <Stat number="4" label="Niveaux de difficulté" />
              <Stat number="5" label="Axes notés sur 100" />
              <Stat number="∞" label="Sessions, sans limite" />
            </div>
          </div>

          <div className="hidden lg:block">
            <div
              className="rounded-xl p-8 shadow-xl"
              style={{
                background: "var(--color-purple)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-pill animate-pulse-soft"
                    style={{ background: "var(--color-green)" }}
                  />
                  <span className="text-meta text-white/60">EN COURS · Niveau Avancé</span>
                </div>

                <ChatPreview
                  who="Prospect"
                  text="Marc Lefèvre, j'écoute."
                  tone="prospect"
                />
                <ChatPreview
                  who="Vous"
                  text="Bonjour Marc, j'ai vu que vous aviez repris l'usine en 2022. Je vous appelle 30 secondes au sujet de la marge par client."
                  tone="user"
                />
                <ChatPreview
                  who="Prospect"
                  text="Hm. Vous me vendez quoi exactement ?"
                  tone="prospect"
                />
                <div className="flex gap-2 pt-2">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section className="border-t border-white/10">
        <div className="container-noxias py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Feature
            number="01"
            title="Choisissez votre prospect"
            text="DG, DAF, DRH, Directeur Marketing — chaque persona a son contexte, ses douleurs, son langage."
          />
          <Feature
            number="02"
            title="Calibrez la difficulté"
            text="Du Débutant qui ouvre la porte à l'Expert qui raccroche en 30 secondes. Vous montez les marches une par une."
          />
          <Feature
            number="03"
            title="Lisez la restitution"
            text="5 axes notés (accroche, découverte, objections, valeur, closing), forces, axes de progrès, prochaine action."
          />
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="container-noxias py-6 flex items-center justify-between">
          <span className="text-meta text-white/60">
            © {new Date().getFullYear()} Noxias — Coach commercial.
          </span>
          <span className="text-meta text-white/60">
            Direct. Concret. Dirigeant à dirigeant.
          </span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div
        className="font-display text-white"
        style={{ fontSize: "2.5rem", lineHeight: "1" }}
      >
        {number}
      </div>
      <div className="text-meta text-white/60 mt-1">{label}</div>
    </div>
  );
}

function ChatPreview({
  who,
  text,
  tone,
}: {
  who: string;
  text: string;
  tone: "user" | "prospect";
}) {
  return (
    <div
      className={`rounded-md p-4 max-w-md ${
        tone === "user" ? "ml-auto" : ""
      }`}
      style={{
        background:
          tone === "user" ? "var(--color-green)" : "rgba(255,255,255,0.06)",
        color: tone === "user" ? "var(--color-dark)" : "rgba(255,255,255,0.92)",
      }}
    >
      <div
        className="text-meta uppercase tracking-wider mb-1"
        style={{ opacity: 0.7 }}
      >
        {who}
      </div>
      <div className="text-small">{text}</div>
    </div>
  );
}

function Feature({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <div
        className="font-display"
        style={{
          color: "var(--color-green)",
          fontSize: "4.5rem",
          lineHeight: "1",
        }}
      >
        {number}
      </div>
      <h3 className="text-h4 text-white mt-3 mb-2">{title}</h3>
      <p className="text-body text-white/70">{text}</p>
    </div>
  );
}
