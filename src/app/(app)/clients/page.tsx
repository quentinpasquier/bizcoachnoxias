import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Client } from "@/lib/supabase/types";

export default async function ClientsPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let clients: Client[] = [];
  let errorMessage: string | null = null;

  if (configured) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });

    clients = (data ?? []) as Client[];
    if (error) errorMessage = error.message;
  }

  return (
    <div className="container-noxias py-10 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="divider-green block mb-3" />
          <h1 className="text-h2">Clients</h1>
          <p className="text-body mt-1" style={{ color: "var(--color-gray)" }}>
            Les comptes pour qui Noxias prospecte. Chaque session est rattachée à un client.
          </p>
        </div>
        <Link href="/clients/new" className="btn btn-primary">
          + Ajouter un client
        </Link>
      </div>

      {errorMessage && (
        <div
          className="rounded-md px-4 py-3 text-small"
          style={{
            background: "rgba(233, 75, 75, 0.08)",
            color: "var(--color-error)",
            border: "1px solid rgba(233, 75, 75, 0.24)",
          }}
        >
          Erreur de chargement : {errorMessage}
        </div>
      )}

      {clients.length === 0 ? (
        <Card variant="lavender" className="text-center py-12">
          <h3 className="text-h3 mb-2">Aucun client pour l'instant.</h3>
          <p className="text-body mb-6" style={{ color: "var(--color-gray)" }}>
            {configured
              ? "Ajoute un premier client pour démarrer les sessions de prospection."
              : "Mode démo : connecte Supabase pour voir tes clients réels."}
          </p>
          <Link href="/clients/new" className="btn btn-primary inline-flex">
            Ajouter le premier client
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-h4">{c.name}</h3>
                  {!c.active && <Badge tone="neutral">Inactif</Badge>}
                </div>
                {c.sector && (
                  <p
                    className="text-meta uppercase tracking-widest mb-3"
                    style={{ color: "var(--color-gray)" }}
                  >
                    {c.sector}
                  </p>
                )}
                {c.value_proposition && (
                  <p
                    className="text-small flex-1"
                    style={{ color: "var(--color-dark)" }}
                  >
                    {c.value_proposition}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-[rgba(139,127,163,0.16)] flex items-center justify-between">
                  <span
                    className="text-meta"
                    style={{ color: "var(--color-gray)" }}
                  >
                    {c.ideal_targets ? c.ideal_targets.split(",")[0] : "Tous prospects"}
                  </span>
                  <span
                    className="text-small font-medium"
                    style={{ color: "var(--color-purple)" }}
                  >
                    Voir →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
