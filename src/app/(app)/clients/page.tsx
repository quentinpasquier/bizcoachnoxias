import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import { ClientsBoard } from "./ClientsBoard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getClientVocab } from "@/lib/vocabulary";
import type { Client, SessionRow } from "@/lib/supabase/types";

interface ClientWithStats {
  id: string;
  name: string;
  sector: string | null;
  active: boolean;
  value_proposition: string | null;
  product_pitch: string;
  persona_count: number;
  total_sessions: number;
  completed_sessions: number;
  rdv_secured: number;
  avg_score: number | null;
  has_docs: boolean;
}

export default async function ClientsPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let clients: ClientWithStats[] = [];
  let organizationId: string | null = null;

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      organizationId = (profile as { organization_id: string } | null)
        ?.organization_id ?? null;
    }

    const [{ data: clientsData }, { data: sessionsData }] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .order("active", { ascending: false })
        .order("name", { ascending: true }),
      supabase.from("sessions").select("client_id, status, score, appointment_secured"),
    ]);

    const cs = (clientsData ?? []) as Client[];
    const ss = (sessionsData ?? []) as Pick<
      SessionRow,
      "client_id" | "status" | "score" | "appointment_secured"
    >[];

    clients = cs.map((c) => {
      const sessions = ss.filter((s) => s.client_id === c.id);
      const completed = sessions.filter((s) => s.status === "completed");
      const rdv = completed.filter((s) => s.appointment_secured).length;
      const scored = completed.filter((s) => typeof s.score === "number");
      const avg =
        scored.length > 0
          ? Math.round(
              scored.reduce((acc, s) => acc + (s.score ?? 0), 0) / scored.length,
            )
          : null;

      return {
        id: c.id,
        name: c.name,
        sector: c.sector,
        active: c.active,
        value_proposition: c.value_proposition,
        product_pitch: c.product_pitch,
        persona_count: (c.persona_profiles ?? []).length,
        total_sessions: sessions.length,
        completed_sessions: completed.length,
        rdv_secured: rdv,
        avg_score: avg,
        has_docs: Boolean(c.synced_content),
      };
    });
  }

  const vocab = getClientVocab(organizationId);

  return (
    <div className="container-noxias py-12 space-y-8">
      <PageHeader
        title={vocab.pluralCap}
        subtitle={
          clients.length > 0
            ? `${clients.length} ${clients.length > 1 ? vocab.plural : vocab.singular} ${
                clients.length > 1 ? "configurés" : "configurée"
              }`
            : vocab.emptyTitle
        }
        action={
          <Link href="/clients/new" className="btn btn-dark">
            + {vocab.newItem}
          </Link>
        }
      />

      {clients.length === 0 ? (
        <Card variant="lavender" className="text-center py-16">
          <h3 className="text-h3 mb-2">{vocab.emptyTitle}</h3>
          <p
            className="text-body mb-6"
            style={{ color: "rgba(255, 255, 255, 0.65)" }}
          >
            {configured
              ? vocab.emptyBody
              : `Mode démo. Connecte Supabase pour voir tes ${vocab.plural}.`}
          </p>
          <Link href="/clients/new" className="btn btn-primary inline-flex">
            {vocab.newItem}
          </Link>
        </Card>
      ) : (
        <ClientsBoard clients={clients} vocab={vocab} />
      )}
    </div>
  );
}

export type { ClientWithStats };
