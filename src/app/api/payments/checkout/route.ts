export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, getSiteUrl, isStripeConfigured, computeStripeFee } from "@/lib/stripe";
import { computeRegistrationDueCents } from "@/lib/payment-fulfillment";
import { parseEurosToCents } from "@/lib/money";

const MIN_TOPUP_CENTS = 100; // 1€ (minimum Stripe ≈ 0,50€)
const MAX_TOPUP_CENTS = 20000; // 200€

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Le paiement en ligne n'est pas encore configuré. Merci de régler sur place." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type as string;

  let amountCents = 0;
  let label = "";
  let registrationId: string | null = null;
  let cancelPath = "/";

  if (type === "MEMBERSHIP") {
    const membership = await prisma.membership.findUnique({ where: { userId: session.user.id } });
    const currentYear = new Date().getFullYear();
    if (!membership || membership.year !== currentYear) {
      return NextResponse.json(
        { error: "Aucune cotisation en cours. Choisissez d'abord vos activités." },
        { status: 400 }
      );
    }
    const dueEuros = membership.amount - (membership.isPaid ? membership.paidAmount : 0);
    if (dueEuros <= 0) {
      return NextResponse.json({ error: "Votre cotisation est déjà réglée." }, { status: 400 });
    }
    amountCents = dueEuros * 100;
    label =
      membership.isPaid && membership.paidAmount > 0
        ? `Supplément cotisation ${membership.year} — Les Éternels`
        : `Cotisation ${membership.year} — Les Éternels`;
    cancelPath = "/mon-compte";
  } else if (type === "EVENT") {
    registrationId = body.registrationId as string;
    if (!registrationId) {
      return NextResponse.json({ error: "Inscription manquante." }, { status: 400 });
    }
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: {
        event: { select: { title: true } },
        rentals: { select: { status: true } },
      },
    });
    if (!reg || reg.userId !== session.user.id) {
      return NextResponse.json({ error: "Inscription introuvable." }, { status: 404 });
    }
    if (reg.isPaid) {
      return NextResponse.json({ error: "Ces frais sont déjà réglés." }, { status: 400 });
    }
    if (reg.rentals.some((r) => r.status === "PENDING")) {
      return NextResponse.json(
        { error: "Vos locations d'équipement doivent d'abord être validées par un administrateur." },
        { status: 400 }
      );
    }
    amountCents = await computeRegistrationDueCents(registrationId);
    if (amountCents <= 0) {
      return NextResponse.json({ error: "Aucun frais à régler pour cette inscription." }, { status: 400 });
    }
    label = `Frais événement « ${reg.event.title} » — Les Éternels`;
    cancelPath = "/calendar";
  } else if (type === "BALANCE_TOPUP") {
    amountCents = parseEurosToCents(body.amount);
    if (Number.isNaN(amountCents) || amountCents < MIN_TOPUP_CENTS || amountCents > MAX_TOPUP_CENTS) {
      return NextResponse.json(
        { error: `Montant invalide (entre ${MIN_TOPUP_CENTS / 100}€ et ${MAX_TOPUP_CENTS / 100}€).` },
        { status: 400 }
      );
    }
    label = "Recharge solde comptoir — Les Éternels";
    cancelPath = "/profil";
  } else {
    return NextResponse.json({ error: "Type de paiement inconnu." }, { status: 400 });
  }

  const site = getSiteUrl();
  const stripe = getStripe();
  const feeCents = computeStripeFee(amountCents);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: label },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "eur",
          product_data: { name: "Frais de traitement (Stripe)" },
          unit_amount: feeCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${site}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${cancelPath}`,
    metadata: { userId: session.user.id, type },
  });

  await prisma.payment.create({
    data: {
      userId: session.user.id,
      type,
      amount: amountCents,
      stripeFeesCents: feeCents,
      stripeSessionId: checkoutSession.id,
      registrationId,
      label,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
