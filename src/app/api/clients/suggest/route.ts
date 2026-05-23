import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  suggestPersonas,
  suggestObjections,
  suggestHook,
  type OfferContext,
} from "@/lib/guided-suggester";

export const maxDuration = 60;
export const runtime = "nodejs";

interface RequestBody {
  type: "personas" | "objections" | "hook";
  context: OfferContext;
  count?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch (err) {
    return NextResponse.json(
      { error: `JSON invalide : ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!body.context || typeof body.context !== "object") {
    return NextResponse.json(
      { error: "Contexte de l'offre manquant." },
      { status: 400 },
    );
  }

  const hasMinimumContext =
    body.context.value_prop_one_liner?.trim() ||
    body.context.product_pitch?.trim();
  if (!hasMinimumContext) {
    return NextResponse.json(
      {
        error:
          "Renseigne d'abord la promesse ou le pitch produit pour que Claude puisse suggérer.",
      },
      { status: 400 },
    );
  }

  try {
    if (body.type === "personas") {
      const personas = await suggestPersonas(body.context, body.count ?? 3);
      return NextResponse.json({ personas });
    }
    if (body.type === "objections") {
      const objections = await suggestObjections(body.context, body.count ?? 15);
      return NextResponse.json({ objections });
    }
    if (body.type === "hook") {
      const result = await suggestHook(body.context);
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: "Type de suggestion inconnu (personas | objections | hook)." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Suggestion impossible : ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
