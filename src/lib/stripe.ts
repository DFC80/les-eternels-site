import Stripe from "stripe";

// Client Stripe instancié à la demande : évite de crasher au build si la clé n'est pas définie.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquant : le paiement en ligne n'est pas configuré.");
  }
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  return url.replace(/\/$/, "");
}

// Frais Stripe pour cartes européennes : 1,4 % + 0,25 €
// Arrondis au centime supérieur pour ne jamais être en dessous des frais réels.
export function computeStripeFee(amountCents: number): number {
  return Math.ceil(amountCents * 0.014) + 25;
}
