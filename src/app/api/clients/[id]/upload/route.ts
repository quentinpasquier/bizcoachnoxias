import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFile } from "@/lib/file-parsers";
import { extractClientFields } from "@/lib/client-extractor";
import type { Client, SyncedFile } from "@/lib/supabase/types";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (!clientData) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }
  const client = clientData as Client;

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
  const replaceMode = formData.get("replace") === "true";

  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  // 1. Parse chaque fichier
  const parsed = await Promise.all(files.map(parseFile));

  const successes = parsed.filter((p) => p.content && !p.error);
  const errors = parsed.filter((p) => p.error || !p.content);

  if (successes.length === 0) {
    return NextResponse.json(
      {
        error: "Aucun fichier n'a pu être lu.",
        details: parsed.map((p) => ({ filename: p.filename, error: p.error })),
      },
      { status: 400 },
    );
  }

  // 2. Construit le nouveau synced_content
  const newSections = successes
    .map(
      (p) =>
        `# === ${p.filename} ===\n\n${p.content.trim()}`,
    )
    .join("\n\n");

  const combined = replaceMode
    ? newSections
    : [client.synced_content?.trim(), newSections].filter(Boolean).join("\n\n");

  // 3. Met à jour la liste des fichiers synced
  const newSyncedFiles: SyncedFile[] = successes.map((p) => ({
    filename: p.filename,
    size: p.size,
    char_count: p.content.length,
    uploaded_at: new Date().toISOString(),
    kind: p.kind === "other" ? "other" : p.kind,
  }));

  const allFiles = replaceMode
    ? newSyncedFiles
    : [...(client.synced_files ?? []), ...newSyncedFiles];

  // 4. Extraction Claude (best-effort)
  let extracted: Awaited<ReturnType<typeof extractClientFields>> | null = null;
  let extractionError: string | null = null;
  try {
    extracted = await extractClientFields(combined);
  } catch (err) {
    extractionError = (err as Error).message;
  }

  const update: Record<string, unknown> = {
    synced_content: combined,
    synced_at: new Date().toISOString(),
    synced_files: allFiles,
  };

  if (extracted) {
    if (extracted.target_personas.length > 0) {
      update.target_personas = extracted.target_personas;
    }
    if (extracted.persona_profiles.length > 0) {
      update.persona_profiles = extracted.persona_profiles;
    }
    if (extracted.typical_objections.length > 0) {
      update.typical_objections = extracted.typical_objections;
    }
    if (extracted.product_pitch) {
      update.product_pitch = extracted.product_pitch;
    }
    if (extracted.value_proposition) {
      update.value_proposition = extracted.value_proposition;
    }
    if (extracted.ideal_targets) {
      update.ideal_targets = extracted.ideal_targets;
    }
    if (extracted.sector && !client.sector) {
      update.sector = extracted.sector;
    }
    if (extracted.description && !client.description) {
      update.description = extracted.description;
    }
  }

  const { error: updateErr } = await supabase
    .from("clients")
    .update(update)
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    parsed: parsed.map((p) => ({
      filename: p.filename,
      kind: p.kind,
      size: p.size,
      char_count: p.content?.length ?? 0,
      error: p.error ?? null,
    })),
    failures: errors.length,
    contentLength: combined.length,
    extracted,
    extractionError,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "filename requis" }, { status: 400 });
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("synced_content, synced_files")
    .eq("id", id)
    .single();
  if (!clientData) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const client = clientData as Pick<Client, "synced_content" | "synced_files">;
  const remainingFiles = (client.synced_files ?? []).filter(
    (f) => f.filename !== filename,
  );

  // On retire la section correspondante du synced_content si présente.
  let newContent = client.synced_content ?? "";
  const sectionRegex = new RegExp(
    `# === ${escapeRegex(filename)} ===[\\s\\S]*?(?=\\n# === |$)`,
    "g",
  );
  newContent = newContent.replace(sectionRegex, "").trim();

  const { error } = await supabase
    .from("clients")
    .update({
      synced_files: remainingFiles,
      synced_content: newContent.length > 0 ? newContent : null,
      synced_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
