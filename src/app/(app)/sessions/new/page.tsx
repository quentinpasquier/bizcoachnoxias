import { NewSessionForm } from "./NewSessionForm";
import { PERSONAS, DIFFICULTY_CONFIG } from "@/lib/personas";

export default function NewSessionPage() {
  return (
    <div className="container-noxias py-10 max-w-3xl">
      <div className="mb-8">
        <span className="divider-green block mb-3" />
        <h1 className="text-h2">Nouvelle session</h1>
        <p className="text-body mt-1" style={{ color: "var(--color-gray)" }}>
          Choisis ton prospect, calibre la difficulté, lance l'appel.
        </p>
      </div>

      <NewSessionForm
        personas={PERSONAS.map((p) => ({
          key: p.key,
          label: p.label,
          role: p.role,
          company: p.company,
        }))}
        difficulties={Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => ({
          key,
          label: cfg.label,
          description: cfg.description,
        }))}
      />
    </div>
  );
}
