import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// L'ancien classement est remplacé par "Ma progression".
// Pour les managers, l'historique équipe (/history) fait office de classement.
export default function LeaderboardRedirect() {
  redirect("/progress");
}
