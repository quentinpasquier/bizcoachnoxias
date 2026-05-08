import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Si Supabase redirige vers Site URL avec ?code=... après confirmation email,
  // on échange le code ici pour ouvrir la session.
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (!error) {
      redirect("/dashboard");
    }
    redirect("/login?error=auth_callback_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
  redirect("/login");
}
