import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuizFromClient } from "@/lib/client-quiz";
import type { Client } from "@/lib/supabase/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(
  _req: Request,
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

  const { data, error } = await supabase
    .from("clients")
    .select("quiz_data, quiz_generated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "client_introuvable" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    quiz: data.quiz_data,
    generated_at: data.quiz_generated_at,
  });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
    }

    const { data: clientData, error: selectError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (selectError) {
      console.error("[quiz] Lecture client échouée :", selectError);
      const msg = selectError.message ?? "lecture_client_echouee";
      const friendly = msg.includes("quiz_data")
        ? "La migration 0008 n'est pas appliquée. Exécute supabase/migrations/0008_client_quiz.sql dans le SQL Editor Supabase."
        : msg;
      return NextResponse.json({ error: friendly }, { status: 500 });
    }
    if (!clientData) {
      return NextResponse.json({ error: "client_introuvable" }, { status: 404 });
    }
    const client = clientData as Client;

    if (!client.synced_content || client.synced_content.length < 200) {
      return NextResponse.json(
        {
          error:
            "Pas assez de contenu pour générer un quiz. Ajoute la matrice et la boîte à outils du client.",
        },
        { status: 400 },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY manquante côté serveur. Ajoute la variable dans Vercel puis redéploie.",
        },
        { status: 500 },
      );
    }

    let quiz;
    try {
      quiz = await generateQuizFromClient(client);
    } catch (err) {
      console.error("[quiz] Génération Claude échouée :", err);
      const msg = (err as Error).message ?? "Erreur Claude inconnue";
      return NextResponse.json(
        { error: `Génération Claude échouée : ${msg}` },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        quiz_data: quiz,
        quiz_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("[quiz] Sauvegarde quiz échouée :", updateError);
      const msg = updateError.message ?? "Sauvegarde échouée";
      const friendly =
        msg.includes("quiz_data") || msg.includes("does not exist")
          ? "La colonne quiz_data n'existe pas encore. Applique la migration 0008 dans Supabase (SQL Editor)."
          : msg;
      return NextResponse.json({ error: friendly }, { status: 500 });
    }

    return NextResponse.json({ ok: true, quiz });
  } catch (err) {
    console.error("[quiz] Erreur fatale :", err);
    return NextResponse.json(
      { error: `Erreur serveur : ${(err as Error).message ?? String(err)}` },
      { status: 500 },
    );
  }
}
