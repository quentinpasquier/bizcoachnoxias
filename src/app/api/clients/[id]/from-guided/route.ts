import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractClientFields } from "@/lib/client-extractor";
import {
  serializeGuidedPayload,
  type GuidedWizardPayload,
} from "@/lib/guided-serializer";

export const maxDuration = 90;
export const runtime = "nodejs";

// Met à jour un client existant à partir du wizard guidé. Le payload remplace
// l'ancien guided_payload, est sérialisé en blob structuré, puis re-passé à
// extractClientFields() pour régénérer persona_profiles, typical_objections,
// etc. La RLS Supabase gère qui peut modifier quel client.
export async function PUT(
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

  let payload: GuidedWizardPayload;
  try {
    payload = (await request.json()) as GuidedWizardPayload;
  } catch (err) {
    return NextResponse.json(
      { error: `JSON invalide : ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!payload.name?.trim()) {
    return NextResponse.json(
      { error: "Le nom de l'offre est obligatoire." },
      { status: 400 },
    );
  }
  if (!payload.value_prop_one_liner?.trim() && !payload.product_pitch?.trim()) {
    return NextResponse.json(
      { error: "Renseigne au moins une promesse ou un pitch produit." },
      { status: 400 },
    );
  }
  if (!Array.isArray(payload.personas) || payload.personas.length === 0) {
    return NextResponse.json(
      { error: "Ajoute au moins un persona cible." },
      { status: 400 },
    );
  }

  const synthetic = serializeGuidedPayload(payload);

  let extracted;
  try {
    extracted = await extractClientFields(synthetic);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Le cerveau IA n'a pas pu extraire le profil : ${(err as Error).message}`,
      },
      { status: 500 },
    );
  }

  const clientName =
    extracted.name && extracted.name !== "Client sans nom"
      ? extracted.name
      : payload.name.trim();

  const { data, error } = await supabase
    .from("clients")
    .update({
      name: clientName,
      sector: extracted.sector ?? payload.sector?.trim() ?? null,
      description: extracted.description,
      value_proposition:
        extracted.value_proposition ?? payload.value_prop_one_liner?.trim() ?? null,
      product_pitch: extracted.product_pitch,
      ideal_targets: extracted.ideal_targets ?? payload.ideal_targets?.trim() ?? null,
      typical_objections: extracted.typical_objections,
      target_personas: extracted.target_personas,
      persona_profiles: extracted.persona_profiles,
      synced_content: synthetic,
      synced_at: new Date().toISOString(),
      guided_payload: payload,
    })
    .eq("id", id)
    .select("id, name")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Mise à jour impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: (data as { id: string }).id,
    name: (data as { name: string }).name,
    contentLength: synthetic.length,
    extracted: {
      target_personas: extracted.target_personas,
      persona_count: extracted.persona_profiles.length,
      objections_count: extracted.typical_objections.length,
    },
  });
}
