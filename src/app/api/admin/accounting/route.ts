import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "comptabilite"))) {
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

  const paidMemberships = await prisma.membership.findMany({
    where: { isPaid: true },
    include: { user: { select: { firstName: true, name: true } } },
    orderBy: { paidAt: "desc" },
  });

  const snackOrders = await prisma.snackOrder.findMany({
    include: { user: { select: { firstName: true, name: true } }, items: true },
    orderBy: { createdAt: "desc" },
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

  const snackSales = snackOrders.map((o) => ({
    id: o.id,
    memberName: `${o.user.firstName} ${o.user.name}`,
    createdAt: o.createdAt,
    totalAmount: o.totalAmount,
    items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
  }));

  const totalEventIncome = eventSummaries.reduce((sum, e) => sum + e.income, 0);
  const totalEventExpenses = eventSummaries.reduce((sum, e) => sum + e.expensesTotal, 0);
  const totalGeneralExpenses = generalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMembershipIncome = membershipSummaries.reduce((sum, m) => sum + m.amount, 0);
  // Le solde du comptoir (friandises/boissons) est en centimes, le reste est en euros entiers :
  // on combine tout en centimes pour le résultat net afin de gérer les décimales du comptoir.
  const totalSnackIncome = snackSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const netResultCents =
    (totalMembershipIncome + totalEventIncome - totalEventExpenses - totalGeneralExpenses) * 100 +
    totalSnackIncome;

  return NextResponse.json({
    events: eventSummaries,
    generalExpenses,
    memberships: membershipSummaries,
    snackSales,
    totals: {
      totalMembershipIncome,
      totalEventIncome,
      totalEventExpenses,
      totalGeneralExpenses,
      totalSnackIncome,
      netResultCents,
    },
  });
}

