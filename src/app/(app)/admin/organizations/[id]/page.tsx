import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createServiceClient } from "@/lib/supabase/service";
import { hasServiceRoleKey } from "@/lib/supabase/env";
import { NOXIAS_ORG_ID } from "@/lib/supabase/types";
import { OrgUsersBoard, type AdminUserRow } from "./OrgUsersBoard";
import { OrgSettings } from "./OrgSettings";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!hasServiceRoleKey()) {
    return (
      <div className="container-noxias py-12">
        <p
          className="text-body"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          <code>SUPABASE_SERVICE_ROLE_KEY</code> manquante.
        </p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, active, created_at, updated_at")
    .eq("id", id)
    .single();
  if (!org) notFound();
  const o = org as {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    created_at: string;
    updated_at: string;
  };

  const [
    { data: profiles },
    { data: clients },
    { data: sessions },
    { data: authUsers },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, avatar_url, role, organization_id, created_at",
      )
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name, active, created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("sessions")
      .select(
        "id, user_id, client_name_snapshot, persona_label, difficulty, status, score, started_at",
      )
      .eq("organization_id", id)
      .order("started_at", { ascending: false })
      .limit(15),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map<string, string | null>();
  authUsers?.users?.forEach((u) => {
    emailById.set(u.id, u.email ?? null);
  });

  const users: AdminUserRow[] = (profiles ?? []).map((p) => {
    const row = p as {
      id: string;
      full_name: string | null;
      role: string;
      avatar_url: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      full_name: row.full_name,
      role: row.role as AdminUserRow["role"],
      avatar_url: row.avatar_url,
      email: emailById.get(row.id) ?? null,
      created_at: row.created_at,
    };
  });

  const nameById = new Map<string, string | null>();
  users.forEach((u) => nameById.set(u.id, u.full_name));

  const clientsList = (clients ?? []) as Array<{
    id: string;
    name: string;
    active: boolean;
    created_at: string;
  }>;
  const sessionsList = (sessions ?? []) as Array<{
    id: string;
    user_id: string;
    client_name_snapshot: string | null;
    persona_label: string;
    difficulty: string;
    status: string;
    score: number | null;
    started_at: string;
  }>;

  const isNoxias = o.id === NOXIAS_ORG_ID;

  return (
    <div className="container-noxias py-12 space-y-8">
      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            {o.name}
            {isNoxias && <Badge tone="success">Noxias</Badge>}
            {!o.active && <Badge tone="neutral">Désactivée</Badge>}
          </span>
        }
        subtitle={
          <span>
            slug : <code>{o.slug}</code> · créée le{" "}
            {new Date(o.created_at).toLocaleDateString("fr-FR")}
          </span>
        }
        action={
          <Link href="/admin/organizations" className="btn btn-ghost">
            ← Toutes les orgs
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Utilisateurs" value={users.length} />
        <StatCard label="Clients" value={clientsList.length >= 20 ? "20+" : clientsList.length} />
        <StatCard
          label="Sessions"
          value={sessionsList.length >= 15 ? "15+" : sessionsList.length}
        />
      </div>

      <OrgSettings org={o} canDelete={!isNoxias} />

      <Card>
        <h3 className="text-h3 mb-4">Utilisateurs ({users.length})</h3>
        <OrgUsersBoard
          orgId={o.id}
          orgName={o.name}
          initialUsers={users}
          allowAddUser
        />
      </Card>

      <Card>
        <h3 className="text-h3 mb-4">Clients récents</h3>
        {clientsList.length === 0 ? (
          <p
            className="text-body"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Aucun client. Les utilisateurs de cette org en créeront depuis leur
            espace.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {clientsList.map((c) => (
              <li
                key={c.id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <span className="text-body">{c.name}</span>
                <span className="flex items-center gap-3 text-meta">
                  {!c.active && <Badge tone="neutral">Désactivé</Badge>}
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-h3 mb-4">Dernières sessions</h3>
        {sessionsList.length === 0 ? (
          <p
            className="text-body"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Aucune session pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-meta">
              <thead>
                <tr
                  className="text-left uppercase tracking-widest text-[10px]"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Persona</th>
                  <th className="py-2 pr-3">Niveau</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sessionsList.map((s) => (
                  <tr key={s.id} className="text-body">
                    <td className="py-2 pr-3">
                      {new Date(s.started_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-2 pr-3">
                      {nameById.get(s.user_id) ?? "·"}
                    </td>
                    <td className="py-2 pr-3">
                      {s.client_name_snapshot ?? "·"}
                    </td>
                    <td className="py-2 pr-3">{s.persona_label}</td>
                    <td className="py-2 pr-3">{s.difficulty}</td>
                    <td className="py-2 pr-3">{s.status}</td>
                    <td className="py-2">
                      {s.score === null ? "·" : `${s.score}/100`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <div
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {label}
      </div>
      <div className="text-h1 mt-2">{value}</div>
    </Card>
  );
}
