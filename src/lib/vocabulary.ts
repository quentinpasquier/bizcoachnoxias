import { NOXIAS_ORG_ID } from "./supabase/types";

// Vocabulaire selon le type d'organisation :
// - Noxias prospecte POUR ses clients → on parle de "client" (la marque pour
//   laquelle on prospecte).
// - Orgs clientes vendent LEUR offre → on parle de "offre" (le service /
//   produit qu'ils veulent vendre).
//
// Le path DB et les URLs restent `/clients` partout pour ne pas casser la
// nav et les bookmarks ; seul le label visible change.

export interface ClientVocab {
  singular: string;
  singularCap: string;
  plural: string;
  pluralCap: string;
  myItems: string;
  newItem: string;
  emptyTitle: string;
  emptyBody: string;
  searchPlaceholder: string;
  noResults: string;
}

export function isNoxiasOrg(organizationId: string | null | undefined): boolean {
  // Quand l'org est inconnue (mode démo, fallback côté serveur sans profile),
  // on retombe sur le vocabulaire Noxias par sécurité. Tout user connecté a
  // forcément un organization_id (NOT NULL) : donc cette branche ne tape que
  // sur la démo et les cas dégradés.
  if (!organizationId) return true;
  return organizationId === NOXIAS_ORG_ID;
}

export function getClientVocab(
  organizationId: string | null | undefined,
): ClientVocab {
  return isNoxiasOrg(organizationId)
    ? {
        singular: "client",
        singularCap: "Client",
        plural: "clients",
        pluralCap: "Clients",
        myItems: "Mes clients",
        newItem: "Nouveau client",
        emptyTitle: "Aucun client pour l'instant.",
        emptyBody: "Crée ton premier client en uploadant ses docs.",
        searchPlaceholder: "Rechercher un client ou un secteur...",
        noResults: "Aucun client ne correspond.",
      }
    : {
        singular: "offre",
        singularCap: "Offre",
        plural: "offres",
        pluralCap: "Offres",
        myItems: "Mes offres",
        newItem: "Nouvelle offre",
        emptyTitle: "Aucune offre pour l'instant.",
        emptyBody:
          "Configure ta première offre via le builder guidé en 5 étapes.",
        searchPlaceholder: "Rechercher une offre ou un secteur...",
        noResults: "Aucune offre ne correspond.",
      };
}
