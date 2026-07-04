// Rôles avec accès administrateur complet
export const FULL_ADMIN_ROLES = ["ADMIN", "Président", "Vice-président"];

// Sections du panel admin
export type AdminSection =
  | "events"
  | "members"
  | "comptabilite"
  | "equipements"
  | "galerie"
  | "produits"
  | "kiosque"
  | "parametres"
  | "activites"
  | "bureau"
  | "jeux";

export function isFullAdmin(role: string): boolean {
  return FULL_ADMIN_ROLES.includes(role);
}

// Tout rôle autre que MEMBER peut accéder à /admin (les pages gèrent les droits fins)
export function canAccessAdmin(role: string): boolean {
  return role !== "MEMBER" && Boolean(role);
}

// Retourne les activityType autorisés pour events/galerie ; null = tous
export function getAllowedActivityTypes(role: string): string[] | null {
  if (isFullAdmin(role)) return null;
  const map: Record<string, string[]> = {
    Airsoft: ["AIRSOFT"],
    "Jeux de rôle": ["JEUX_DE_ROLE"],
    "Jeux de plateau": ["JEUX_DE_PLATEAU"],
    "Jeux de figurine": ["JEUX_DE_FIGURINE"],
  };
  return map[role] ?? null;
}

// Vérifie si un rôle peut accéder à une section
export function canAccessSection(role: string, section: AdminSection): boolean {
  if (isFullAdmin(role)) return true;
  const map: Record<string, AdminSection[]> = {
    Secrétaire: ["members"],
    Trésorier: ["members", "comptabilite"],
    Airsoft: ["events", "equipements", "galerie"],
    "Jeux de rôle": ["events", "galerie"],
    "Jeux de plateau": ["events", "galerie"],
    "Jeux de figurine": ["events", "galerie"],
  };
  return (map[role] ?? []).includes(section);
}
