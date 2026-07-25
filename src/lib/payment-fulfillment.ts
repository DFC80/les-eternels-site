import { prisma } from "@/lib/prisma";
import {
  sendMembershipPaymentConfirmation,
  sendBalanceTopUpConfirmation,
  sendEventPaymentConfirmation,
} from "@/lib/mail";

// Applique les effets d'un paiement Stripe confirmé (appelé par le webhook ET par la
// page de succès en secours). Idempotent : le passage PENDING → PAID sert de verrou,
// les effets ne sont appliqués qu'une seule fois même en cas d'appels concurrents.
export async function fulfillPayment(stripeSessionId: string) {
  const payment = await prisma.payment.findUnique({ where: { stripeSessionId } });
  if (!payment) return null;
  if (payment.status === "PAID") return payment;

  const now = new Date();

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: now },
  });
  if (claimed.count === 0) return payment;

  if (payment.type === "MEMBERSHIP") {
    const membership = await prisma.membership.findUnique({ where: { userId: payment.userId } });
    if (membership) {
      // paidAmount = montant total réglé (couvre aussi le paiement d'un supplément)
      await prisma.membership.update({
        where: { userId: payment.userId },
        data: { isPaid: true, paidAt: now, paidAmount: membership.amount },
      });
      const user = await prisma.user.findUnique({ where: { id: payment.userId } });
      if (user) {
        await sendMembershipPaymentConfirmation({
          to: user.email,
          firstName: user.firstName,
          year: membership.year,
          amount: membership.amount,
        }).catch(() => {});
      }
    }
  } else if (payment.type === "BALANCE_TOPUP") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: payment.userId },
        data: { balance: { increment: payment.amount } },
      }),
      prisma.balanceTopUp.create({
        data: { userId: payment.userId, amount: payment.amount },
      }),
    ]);
    const user = await prisma.user.findUnique({ where: { id: payment.userId } });
    if (user) {
      await sendBalanceTopUpConfirmation({
        to: user.email,
        firstName: user.firstName,
        amountCents: payment.amount,
      }).catch(() => {});
    }
  } else if (payment.type === "EVENT" && payment.registrationId) {
    await prisma.eventRegistration.updateMany({
      where: { id: payment.registrationId },
      data: { isPaid: true, paidAt: now },
    });
    const reg = await prisma.eventRegistration.findUnique({
      where: { id: payment.registrationId },
      include: { user: true, event: { select: { title: true } } },
    });
    if (reg) {
      await sendEventPaymentConfirmation({
        to: reg.user.email,
        firstName: reg.user.firstName,
        eventTitle: reg.event.title,
        amountCents: payment.amount,
      }).catch(() => {});
    }
  }

  return prisma.payment.findUnique({ where: { stripeSessionId } });
}

// Montant restant à payer en ligne pour une inscription (en centimes).
// Seules les locations VALIDÉES par l'admin sont comptées (les gratuites sont exclues).
export async function computeRegistrationDueCents(registrationId: string): Promise<number> {
  const reg = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      event: true,
      rentals: { where: { status: "APPROVED", isFree: false }, include: { equipment: true } },
    },
  });
  if (!reg || reg.isPaid) return 0;

  const mealCents = reg.event.hasMeal && reg.wantsMeal ? reg.event.mealPrice * 100 : 0;
  const rentalsCents = reg.rentals.reduce(
    (sum, r) => sum + r.equipment.rentalCost * (r.quantity ?? 1) * 100,
    0
  );
  return mealCents + reg.participationFee + rentalsCents;
}
