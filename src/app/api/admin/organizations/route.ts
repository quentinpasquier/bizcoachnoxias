import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/service";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET() {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ organizations: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requirePlatformAdmin();
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Nom obligatoire" }, { status: 400 });
  }

  const name = body.name.trim();
  const slug =
    typeof body.slug === "string" && body.slug.trim().length > 0
      ? slugify(body.slug)
      : slugify(name);

  if (slug.length === 0) {
    return NextResponse.json(
      { error: "Slug invalide (lettres/chiffres requis)" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug, active: true })
    .select("id, name, slug, active, created_at, updated_at")
    .single();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json(
        { error: `Le slug "${slug}" est déjà utilisé.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error?.message ?? "Création impossible" },
      { status: 500 },
    );
  }

  return NextResponse.json({ organization: data });
}
