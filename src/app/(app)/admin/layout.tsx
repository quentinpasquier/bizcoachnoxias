import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth-helpers";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-noxias py-12">
        <p className="text-body" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
          Mode démo · back-office indisponible (Supabase non configuré).
        </p>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!isPlatformAdmin(user.profile.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <div
        className="border-b"
        style={{
          background: "rgba(244, 180, 0, 0.08)",
          borderColor: "rgba(244, 180, 0, 0.25)",
        }}
      >
        <div className="container-noxias flex h-10 items-center gap-4 text-meta">
          <span
            className="uppercase tracking-widest text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--color-warning, #F4B400)",
              color: "var(--color-dark)",
              fontWeight: 700,
            }}
          >
            Back-office Noxias
          </span>
          <Link
            href="/admin/organizations"
            className="text-white/75 hover:text-white"
          >
            Organisations
          </Link>
          <Link href="/dashboard" className="ml-auto text-white/60 hover:text-white">
            ← Retour à l&apos;app
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
