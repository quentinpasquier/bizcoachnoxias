// Centralise la lecture des variables Supabase et nettoie un éventuel
// slash final qui ferait planter le SDK avec « Invalid path ».

export function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
}

export function getSupabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

export function getSupabaseServiceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function hasServiceRoleKey(): boolean {
  return getSupabaseServiceRoleKey().length > 0;
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return (
    url.length > 0 &&
    key.length > 0 &&
    /^https?:\/\//.test(url)
  );
}

// Valeur de remplissage pour que Supabase JS ne plante pas à l'instanciation
// quand les vars sont manquantes (mode démo). Les requêtes échoueront mais
// proprement, et `isSupabaseConfigured()` permet de les éviter en amont.
const PLACEHOLDER_URL = "https://demo.supabase.co";
const PLACEHOLDER_KEY = "demo-anon-key";

export function getSupabaseUrlOrPlaceholder(): string {
  const url = getSupabaseUrl();
  return url.length > 0 ? url : PLACEHOLDER_URL;
}

export function getSupabaseAnonKeyOrPlaceholder(): string {
  const key = getSupabaseAnonKey();
  return key.length > 0 ? key : PLACEHOLDER_KEY;
}
