import Link from "next/link";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { HeaderNav } from "./HeaderNav";

interface HeaderProps {
  user: { email?: string | null; full_name?: string | null } | null;
}

export function Header({ user }: HeaderProps) {
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
          <Logo variant="dark" size={28} />
        </Link>

        {user && (
          <>
            <HeaderNav />
            <div className="flex items-center gap-3 pl-4 border-l border-white/10 shrink-0">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-meta text-white/85 leading-tight">
                  {user.full_name ?? "Commercial"}
                </span>
                {user.email && (
                  <span className="text-meta text-white/45 leading-tight">
                    {user.email}
                  </span>
                )}
              </div>
              <SignOutButton />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
