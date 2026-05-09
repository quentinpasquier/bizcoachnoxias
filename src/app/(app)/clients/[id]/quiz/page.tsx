import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import type { Client, QuizAttemptRow } from "@/lib/supabase/types";
import { QuizRunner } from "./QuizRunner";

export const dynamic = "force-dynamic";

export default async function ClientQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: clientData },
    { data: attemptsData },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, sector, quiz_data, quiz_generated_at, synced_content, value_proposition, product_pitch, ideal_targets, typical_objections, persona_profiles",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("quiz_attempts")
      .select("*")
      .eq("client_id", id)
      .order("completed_at", { ascending: false })
      .limit(10),
    supabase.auth.getUser(),
  ]);

  if (!clientData) notFound();
  const client = clientData as Pick<
    Client,
    | "id"
    | "name"
    | "sector"
    | "quiz_data"
    | "quiz_generated_at"
    | "synced_content"
    | "value_proposition"
    | "product_pitch"
    | "ideal_targets"
    | "typical_objections"
    | "persona_profiles"
  >;
  const attempts = (attemptsData ?? []) as QuizAttemptRow[];
  const myUserId = user?.id ?? null;

  const myAttempts = attempts.filter((a) => a.user_id === myUserId);
  const myBest =
    myAttempts.length > 0
      ? myAttempts.reduce((best, a) => (a.score > best.score ? a : best))
      : null;

  const hasDocs =
    typeof client.synced_content === "string" &&
    client.synced_content.length > 200;

  return (
    <div className="container-noxias py-10 space-y-8 max-w-4xl">
      <Link
        href={`/clients/${id}`}
        className="text-small inline-flex items-center gap-1.5"
        style={{ color: "var(--color-gray)" }}
      >
        ← Retour au client
      </Link>

      <header className="space-y-3">
        <div className="eyebrow-green">Quiz de validation</div>
        <h1
          className="text-h1"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: "1.05" }}
        >
          <span style={{ color: "var(--color-dark)" }}>Tu connais </span>
          <span style={{ color: "var(--color-green)" }}>{client.name}</span>{" "}
          <span style={{ color: "var(--color-dark)" }}>?</span>
        </h1>
        <p className="text-body-l" style={{ color: "var(--color-gray)" }}>
          12 questions pour valider ta maîtrise : qui prospecter, pourquoi,
          quoi vendre, leurs douleurs, comment répondre aux objections.
        </p>
      </header>

      {myBest && (
        <Card variant="lavender">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div
                className="eyebrow"
                style={{ color: "var(--color-gray)" }}
              >
                Ton meilleur score
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className="text-h2"
                  style={{
                    color:
                      myBest.score >= 80
                        ? "var(--color-green)"
                        : myBest.score >= 60
                          ? "var(--color-purple)"
                          : "var(--color-warning)",
                    margin: 0,
                  }}
                >
                  {myBest.score}
                </span>
                <span
                  style={{ color: "var(--color-gray)", fontSize: "0.95rem" }}
                >
                  /100
                </span>
                <span
                  className="text-small ml-2"
                  style={{ color: "var(--color-gray)" }}
                >
                  · {myBest.correct_answers}/{myBest.total_questions} bonnes
                  réponses · {myAttempts.length} tentative
                  {myAttempts.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!hasDocs ? (
        <Card variant="lavender" className="text-center py-12">
          <h3 className="text-h3 mb-2">Pas encore de docs</h3>
          <p style={{ color: "var(--color-gray)" }}>
            Ajoute la matrice de prospection et la boîte à outils du client
            pour générer le quiz.
          </p>
        </Card>
      ) : (
        <QuizRunner
          clientId={id}
          initialQuiz={client.quiz_data ?? null}
        />
      )}

      {attempts.length > 1 && (
        <section className="space-y-3 mt-10">
          <h2 className="text-h3">Historique de l&apos;équipe</h2>
          <div className="space-y-2">
            {attempts.slice(0, 8).map((a) => (
              <Card key={a.id} hoverable={false} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span
                      className="text-small"
                      style={{ color: "var(--color-gray)" }}
                    >
                      {new Date(a.completed_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {a.user_id === myUserId && (
                      <span
                        className="badge ml-2"
                        style={{
                          background: "rgba(60, 200, 121, 0.10)",
                          color: "#1F6A3F",
                        }}
                      >
                        Toi
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-h4"
                      style={{
                        color:
                          a.score >= 80
                            ? "var(--color-green)"
                            : a.score >= 60
                              ? "var(--color-purple)"
                              : "var(--color-warning)",
                      }}
                    >
                      {a.score}/100
                    </span>
                    <span
                      className="text-small"
                      style={{ color: "var(--color-gray)" }}
                    >
                      ({a.correct_answers}/{a.total_questions})
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
