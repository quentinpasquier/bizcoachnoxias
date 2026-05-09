import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { QuizAttemptAnswer, QuizData } from "@/lib/supabase/types";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
  }

  let body: {
    answers?: { question_id: string; selected_index: number }[];
    started_at?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalide" }, { status: 400 });
  }

  const submitted = Array.isArray(body.answers) ? body.answers : [];
  if (submitted.length === 0) {
    return NextResponse.json({ error: "aucune_reponse" }, { status: 400 });
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("quiz_data")
    .eq("id", id)
    .single();
  const quiz = (clientData as { quiz_data: QuizData | null } | null)?.quiz_data;
  if (!quiz?.questions?.length) {
    return NextResponse.json({ error: "quiz_introuvable" }, { status: 404 });
  }

  const correctById = new Map(
    quiz.questions.map((q) => [q.id, q.correct_index]),
  );
  const answers: QuizAttemptAnswer[] = submitted.map((a) => ({
    question_id: String(a.question_id),
    selected_index: Number(a.selected_index),
    correct: correctById.get(String(a.question_id)) === Number(a.selected_index),
  }));

  const correctAnswers = answers.filter((a) => a.correct).length;
  const totalQuestions = quiz.questions.length;
  const score = Math.round((correctAnswers / totalQuestions) * 100);

  const startedAt =
    typeof body.started_at === "string"
      ? body.started_at
      : new Date().toISOString();

  const { error } = await supabase.from("quiz_attempts").insert({
    client_id: id,
    user_id: user.id,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    score,
    answers,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    score,
    correct_answers: correctAnswers,
    total_questions: totalQuestions,
  });
}
