import Link from "next/link";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { HeaderNav } from "./HeaderNav";
import { Avatar } from "./ui/Avatar";
import type { UserRole } from "@/lib/supabase/types";

interface HeaderProps {
  user: {
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
    role?: UserRole;
  } | null;
}

export function Header({ user }: HeaderProps) {
  const isManager = user?.role === "manager";
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        background: "rgba(34, 25, 50, 0.92)",
        borderColor: "rgba(255, 255, 255, 0.06)",
      }}
    >
      <div className="container-noxias flex h-16 items-center justify-between gap-4">
        <Link href={user ? "/dashboard" : "/login"} className="flex items-center shrink-0">
          <Logo variant="dark" size={36} />
        </Link>

        {user && (
          <>
            <HeaderNav isManager={isManager} />
            <div className="flex items-center gap-3 pl-4 border-l border-white/10 shrink-0">
              <Link
                href="/profile"
                className="flex items-center gap-3 hover:opacity-90 transition"
                title="Mon profil"
              >
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-meta text-white/85 leading-tight flex items-center gap-2">
                    {user.full_name ?? "Commercial"}
                    {isManager && (
                      <span
                        className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--color-green)",
                          color: "var(--color-dark)",
                          fontWeight: 700,
                        }}
                      >
                        Manager
                      </span>
                    )}
                  </span>
                  {user.email && (
                    <span className="text-meta text-white/45 leading-tight">
                      {user.email}
                    </span>
                  )}
                </div>
                <Avatar src={user.avatar_url} name={user.full_name ?? user.email} size={36} />
              </Link>
              <SignOutButton />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
