import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseUrlOrPlaceholder,
  getSupabaseAnonKeyOrPlaceholder,
  isSupabaseConfigured,
} from "./env";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/confirm",
  "/api/debug",
];

export async function updateSession(request: NextRequest) {
  // Mode démo : si Supabase n'est pas configuré, on laisse passer toutes
  // les routes pour permettre la prévisualisation de l'UI.
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrlOrPlaceholder(),
    getSupabaseAnonKeyOrPlaceholder(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Si le compte vient d'être créé par un admin avec un mdp temporaire,
  // on force le passage par /auth/set-password avant tout accès à l'app.
  // Check en middleware (et plus seulement dans (app)/layout) car le layout
  // peut être skippé par le cache RSC de Next sur certaines navigations.
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    pathname !== "/auth/set-password" &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/api/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/set-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
