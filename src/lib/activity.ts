type MembershipFlags = {
  wantsBoardGames: boolean;
  wantsRolePlay: boolean;
  wantsAirsoft: boolean;
};

/**
 * AUTRE n'est rattaché à aucune activité d'adhésion : pas de restriction.
 */
export function isActivityCoveredByMembership(
  activityType: string,
  membership: MembershipFlags | null
): boolean {
  if (activityType === "AUTRE") return true;
  if (!membership) return false;

  switch (activityType) {
    case "JEUX_DE_PLATEAU":
      return membership.wantsBoardGames;
    case "JEUX_DE_ROLE":
      return membership.wantsRolePlay;
    case "AIRSOFT":
      return membership.wantsAirsoft;
    default:
      return false;
  }
}
