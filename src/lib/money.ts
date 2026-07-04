// Toutes les sommes liées aux produits/commandes/solde du comptoir sont stockées en centimes (Int)
// pour permettre des prix avec décimales (ex: 0,50€) sans problème d'arrondi flottant.

export function parseEurosToCents(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);

  const normalized = input.trim().replace(",", ".");
  const value = parseFloat(normalized);
  if (Number.isNaN(value)) return NaN;
  return Math.round(value * 100);
}

export function formatCentsToEuros(cents: number): string {
  const value = (cents / 100).toFixed(2).replace(".", ",");
  return `${value}€`;
}
