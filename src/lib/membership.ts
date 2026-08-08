export const BASE_MEMBERSHIP_FEE = 5;

export function computeMembershipAmount(activityPrices: number[]): number {
  if (activityPrices.length === 0) return 0;
  return BASE_MEMBERSHIP_FEE + activityPrices.reduce((sum, p) => sum + p, 0);
}

/** Retourne l'année de début de la saison en cours (1er sept → 31 août). */
export function currentSeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Retourne l'année de début de la saison suivante. */
export function nextSeasonYear(): number {
  return currentSeasonYear() + 1;
}

/** Retourne le libellé de la saison, ex. "2025-2026". */
export function currentSeasonLabel(): string {
  const y = currentSeasonYear();
  return `${y}-${y + 1}`;
}

/** Retourne le libellé de la saison suivante, ex. "2026-2027". */
export function nextSeasonLabel(): string {
  const y = nextSeasonYear();
  return `${y}-${y + 1}`;
}

/** Retourne le libellé d'une saison quelconque à partir de son année de début. */
export function seasonLabel(year: number): string {
  return `${year}-${year + 1}`;
}
