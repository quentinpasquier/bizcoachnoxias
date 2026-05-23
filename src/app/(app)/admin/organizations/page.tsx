import { PageHeader } from "@/components/PageHeader";
import { createServiceClient } from "@/lib/supabase/service";
import { hasServiceRoleKey } from "@/lib/supabase/env";
import { OrganizationsBoard } from "./OrganizationsBoard";

interface OrgWithStats {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  users_count: number;
  clients_count: number;
  sessions_count: number;
}

export default async function AdminOrganizationsPage() {
  if (!hasServiceRoleKey()) {
    return (
      <div className="container-noxias py-12 space-y-4">
        <PageHeader
          title="Organisations"
          subtitle="Back-office indisponible"
        />
        <div
          className="ui-card ui-card-padded"
          style={{ border: "1px solid rgba(244, 180, 0, 0.4)" }}
        >
          <p className="text-body">
            La variable d&apos;environnement <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            n&apos;est pas configurée. Elle est indispensable pour gérer les
            organisations et créer des utilisateurs. Ajoute-la dans Vercel +{" "}
            <code>.env.local</code> et redéploie.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, active, created_at")
    .order("created_at", { ascending: false });

  const list = (orgs ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created_at: string;
  }>;

  const enriched: OrgWithStats[] = await Promise.all(
    list.map(async (o) => {
      const [{ count: u }, { count: c }, { count: s }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", o.id),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", o.id),
        supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", o.id),
      ]);
      return {
        ...o,
        users_count: u ?? 0,
        clients_count: c ?? 0,
        sessions_count: s ?? 0,
      };
    }),
  );

  return (
    <div className="container-noxias py-12 space-y-8">
      <PageHeader
        title="Organisations"
        subtitle={`${enriched.length} organisation${enriched.length > 1 ? "s" : ""} · Noxias + clients`}
      />
      <OrganizationsBoard initialOrgs={enriched} />
    </div>
  );
}
