export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "comptabilite")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const events = await prisma.event.findMany({
    orderBy: { startsAt: "desc" },
    include: {
      registrations: {
        include: { rentals: { where: { status: "APPROVED" }, include: { equipment: true } } },
      },
      expenses: true,
    },
  });

  const generalExpenses = await prisma.generalExpense.findMany({ orderBy: { date: "desc" } });
  const generalCredits = await prisma.generalCredit.findMany({ orderBy: { date: "desc" } });

  const paidMemberships = await prisma.membership.findMany({
    where: { isPaid: true },
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { paidAt: "desc" },
  });

  const balanceTopUps = await prisma.balanceTopUp.findMany({
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const onlinePayments = await prisma.payment.findMany({
    where: { status: "PAID" },
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { paidAt: "desc" },
  });

  const eventSummaries = events.map((ev) => {
    const mealIncome = ev.hasMeal ? ev.registrations.filter((r) => r.wantsMeal).length * ev.mealPrice : 0;
    const equipmentIncome = ev.registrations.reduce(
      (sum, r) => sum + r.rentals.reduce((s, rental) => s + (rental.isFree ? 0 : rental.equipment.rentalCost * (rental.quantity ?? 1)), 0),
      0
    );
    // participationFee stocké en centimes (500 = 5€) → converti en euros entiers
    const participationIncome = Math.round(
      ev.registrations.reduce((sum, r) => sum + (r.participationFee ?? 0), 0) / 100
    );
    const income = mealIncome + equipmentIncome + participationIncome;
    const expensesTotal = ev.expenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      eventId: ev.id,
      title: ev.title,
      startsAt: ev.startsAt,
      mealIncome,
      equipmentIncome,
      participationIncome,
      income,
      expensesTotal,
      profit: income - expensesTotal,
      expenses: ev.expenses,
    };
  });

  const membershipSummaries = paidMemberships.map((m) => ({
    membershipId: m.id,
    memberName: `${m.user.firstName} ${m.user.name}`,
    year: m.year,
    amount: m.amount,
    paidAt: m.paidAt,
  }));

  const balanceTopUpSummaries = balanceTopUps.map((t) => ({
    id: t.id,
    memberName: `${t.user.firstName} ${t.user.name}`,
    amount: t.amount,
    createdAt: t.createdAt,
  }));

  const onlinePaymentSummaries = onlinePayments.map((p) => ({
    id: p.id,
    memberName: `${p.user.firstName} ${p.user.name}`,
    type: p.type,
    label: p.label,
    amount: p.amount,
    stripeFeesCents: p.stripeFeesCents,
    paidAt: p.paidAt,
  }));

  const totalEventIncome = eventSummaries.reduce((sum, e) => sum + e.income, 0);
  const totalEventExpenses = eventSummaries.reduce((sum, e) => sum + e.expensesTotal, 0);
  const totalGeneralExpenses = generalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalGeneralCredits = generalCredits.reduce((sum, c) => sum + c.amount, 0);
  const totalMembershipIncome = membershipSummaries.reduce((sum, m) => sum + m.amount, 0);
  // Tout en centimes pour gérer les décimales du comptoir.
  const totalBalanceTopUps = balanceTopUpSummaries.reduce((sum, t) => sum + t.amount, 0);
  // Les ventes comptoir (totalSnackIncome) ne sont PAS comptées : elles débitent le solde
  // adhérent déjà encaissé via les recharges (totalBalanceTopUps). Les compter serait un double-compte.
  const netResultCents =
    Math.round((totalMembershipIncome + totalEventIncome + totalGeneralCredits - totalEventExpenses - totalGeneralExpenses) * 100) +
    totalBalanceTopUps;

  // Total encaissé en ligne (informatif : déjà inclus dans les catégories ci-dessus —
  // cotisations, recharges, frais d'événements — donc pas ajouté au résultat net).
  const totalOnlinePaymentsCents = onlinePaymentSummaries.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({
    events: eventSummaries,
    generalExpenses,
    generalCredits,
    memberships: membershipSummaries,
    balanceTopUps: balanceTopUpSummaries,
    onlinePayments: onlinePaymentSummaries,
    totals: {
      totalMembershipIncome,
      totalEventIncome,
      totalEventExpenses,
      totalGeneralExpenses,
      totalGeneralCredits,
      totalBalanceTopUps,
      totalOnlinePaymentsCents,
      netResultCents,
    },
  });
}

