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
  | "jeux"
  | "content"
  | "sondages"
  | "reunions"
  | "documents"
  | "notes";

// Permissions par défaut (avant toute configuration en DB)
export const HARDCODED_SECTION_MAP: Record<string, AdminSection[]> = {
  Secrétaire: ["members", "reunions"],
  Trésorier: ["members", "comptabilite"],
  Comptoir: ["kiosque"],
  Airsoft: ["events", "equipements", "galerie"],
  "Jeux de rôle": ["events", "galerie"],
  "Jeux de société": ["events", "galerie"],
  "Jeux de figurine": ["events", "galerie"],
};

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
    "Jeux de société": ["JEUX_DE_PLATEAU"],
    "Jeux de figurine": ["JEUX_DE_FIGURINE"],
  };
  return map[role] ?? null;
}

// Vérifie si un rôle peut accéder à une section (fallback hardcodé)
export function canAccessSection(role: string, section: AdminSection): boolean {
  if (isFullAdmin(role)) return true;
  return (HARDCODED_SECTION_MAP[role] ?? []).includes(section);
}

type SessionUser = {
  role?: string;
  allowedSections?: string[] | null;
};

// Convention JWT pour allowedSections :
//   null            → accès complet (full admin)
//   undefined       → fallback hardcodé (HARDCODED_SECTION_MAP) = écriture
//   "section"       → écriture (backward compat)
//   "section:write" → écriture (explicite)
//   "section:read"  → lecture seule

function resolveAllowedSections(user: SessionUser | null | undefined) {
  return (user as { allowedSections?: string[] | null } | null)?.allowedSections;
}

// Lecture OU écriture — remplace l'ancien sessionHasAccess (même comportement pour les GET)
export function sessionHasAccess(
  user: SessionUser | null | undefined,
  section: AdminSection
): boolean {
  const role = user?.role ?? "";
  if (isFullAdmin(role)) return true;
  const sections = resolveAllowedSections(user);
  if (sections === null) return true;
  if (sections !== undefined) {
    return sections.some(
      (s) => s === section || s === `${section}:read` || s === `${section}:write`
    );
  }
  return canAccessSection(role, section);
}

// Écriture uniquement — à utiliser sur les mutations (POST, PUT, DELETE)
export function sessionHasWriteAccess(
  user: SessionUser | null | undefined,
  section: AdminSection
): boolean {
  const role = user?.role ?? "";
  if (isFullAdmin(role)) return true;
  const sections = resolveAllowedSections(user);
  if (sections === null) return true;
  if (sections !== undefined) {
    // "section" (bare) = write pour compatibilité ascendante
    return sections.includes(`${section}:write`) || sections.includes(section);
  }
  return canAccessSection(role, section);
}
