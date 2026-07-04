export const BASE_MEMBERSHIP_FEE = 5;

export function computeMembershipAmount(activityPrices: number[]): number {
  if (activityPrices.length === 0) return 0;
  return BASE_MEMBERSHIP_FEE + activityPrices.reduce((sum, p) => sum + p, 0);
}
