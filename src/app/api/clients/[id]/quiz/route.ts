import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuizFromClient } from "@/lib/client-quiz";
import type { Client } from "@/lib/supabase/types";

export const maxDuration = 60;

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
    return NextResponse.json({ error: "client_introuvable" }, { status: 404 });
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
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
  }

  const { data: clientData, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !clientData) {
    return NextResponse.json({ error: "client_introuvable" }, { status: 404 });
  }
  const client = clientData as Client;

  if (!client.synced_content || client.synced_content.length < 200) {
    return NextResponse.json(
      {
        error:
          "Le client n'a pas encore de docs assez fournis pour générer un quiz. Ajoute la matrice et la boîte à outils.",
      },
      { status: 400 },
    );
  }

  try {
    const quiz = await generateQuizFromClient(client);

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        quiz_data: quiz,
        quiz_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, quiz });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
