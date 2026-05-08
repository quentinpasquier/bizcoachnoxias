import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFile } from "@/lib/file-parsers";
import { extractClientFields } from "@/lib/client-extractor";
import type { SyncedFile } from "@/lib/supabase/types";

export const maxDuration = 90;
export const runtime = "nodejs";

// Crée un client en partant uniquement de fichiers uploadés.
// Flow :
//   1. Parse PDF/DOCX/CSV/TXT/MD
//   2. Concatène le contenu
//   3. Claude extrait : nom, secteur, value prop, pitch, personas, etc.
//   4. Crée le client avec tous les champs auto-remplis
//   5. Renvoie l'ID pour redirection
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `FormData invalide : ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const files = formData.getAll("files").filter((v) => v instanceof File) as File[];
  const fallbackName = (formData.get("name") as string | null) ?? null;

  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  // 1. Parse chaque fichier
  const parsed = await Promise.all(files.map(parseFile));
  const successes = parsed.filter((p) => p.content && !p.error);

  if (successes.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun fichier n'a pu être lu. Formats supportés : PDF, DOCX, CSV, TXT, MD.",
        details: parsed.map((p) => ({ filename: p.filename, error: p.error })),
      },
      { status: 400 },
    );
  }

  const combined = successes
    .map((p) => `# === ${p.filename} ===\n\n${p.content.trim()}`)
    .join("\n\n");

  const syncedFiles: SyncedFile[] = successes.map((p) => ({
    filename: p.filename,
    size: p.size,
    char_count: p.content.length,
    uploaded_at: new Date().toISOString(),
    kind: p.kind === "other" ? "other" : p.kind,
  }));

  // 2. Extraction Claude — c'est elle qui paramètre tout le client
  let extracted;
  try {
    extracted = await extractClientFields(combined);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Claude n'a pas pu extraire les infos du client : ${(err as Error).message}`,
      },
      { status: 500 },
    );
  }

  const clientName =
    extracted.name && extracted.name !== "Client sans nom"
      ? extracted.name
      : fallbackName?.trim() || "Client sans nom";

  // 3. Crée le client avec tout le profil
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: clientName,
      sector: extracted.sector,
      description: extracted.description,
      value_proposition: extracted.value_proposition,
      product_pitch: extracted.product_pitch,
      ideal_targets: extracted.ideal_targets,
      typical_objections: extracted.typical_objections,
      target_personas: extracted.target_personas,
      persona_profiles: extracted.persona_profiles,
      synced_content: combined,
      synced_at: new Date().toISOString(),
      synced_files: syncedFiles,
      active: true,
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Création du client impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: (data as { id: string }).id,
    name: (data as { name: string }).name,
    parsed: parsed.map((p) => ({
      filename: p.filename,
      kind: p.kind,
      size: p.size,
      char_count: p.content?.length ?? 0,
      error: p.error ?? null,
    })),
    contentLength: combined.length,
    extracted: {
      target_personas: extracted.target_personas,
      persona_count: extracted.persona_profiles.length,
      objections_count: extracted.typical_objections.length,
    },
  });
}
