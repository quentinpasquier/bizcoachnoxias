// Centralise la lecture des variables Supabase et nettoie un éventuel
// slash final qui ferait planter le SDK avec « Invalid path ».

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Vérifie .env.local ou les Env Vars Vercel.`,
    );
  }
  return value.trim().replace(/\/$/, "");
}

export function getSupabaseUrl(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
