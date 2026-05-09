import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
  }

  let body: { first_name?: string; last_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalide" }, { status: 400 });
  }

  const first = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const last = typeof body.last_name === "string" ? body.last_name.trim() : "";

  if (!first) {
    return NextResponse.json({ error: "prenom_requis" }, { status: 400 });
  }

  const full_name = last ? `${first} ${last}` : first;

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: first,
      last_name: last || null,
      full_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, full_name });
}
