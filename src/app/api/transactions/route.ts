export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SHOP_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  DELIVERED: "Livrée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const userId = session.user.id as string;

  const [membership, history, topUps, snackOrders, shopOrders] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId },
      select: { year: true, amount: true, isPaid: true, paidAt: true, paidAmount: true },
    }),
    prisma.membershipHistory.findMany({
      where: { userId, isPaid: true },
      orderBy: { paidAt: "desc" },
      select: { id: true, year: true, amount: true, paidAmount: true, paidAt: true, archivedAt: true },
    }),
    prisma.balanceTopUp.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, createdAt: true },
    }),
    prisma.snackOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
        items: { select: { id: true, name: true, unitPrice: true, quantity: true } },
      },
    }),
    prisma.shopOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        items: { select: { id: true, name: true, unitPrice: true, quantity: true, customText: true } },
      },
    }),
  ]);

  type TxItem = { id: string; name: string; unitPrice: number; quantity: number; customText?: string | null };
  type Transaction = {
    id: string;
    type: "cotisation" | "recharge" | "comptoir" | "boutique";
    date: string;
    label: string;
    amountCents: number;
    status?: string;
    statusLabel?: string;
    items?: TxItem[];
  };

  const txns: Transaction[] = [];

  if (membership?.isPaid && membership.paidAt) {
    txns.push({
      id: "membership-current",
      type: "cotisation",
      date: membership.paidAt.toISOString(),
      label: `Cotisation ${membership.year}–${membership.year + 1}`,
      amountCents: (membership.paidAmount || membership.amount) * 100,
    });
  }

  for (const h of history) {
    txns.push({
      id: `membership-${h.id}`,
      type: "cotisation",
      date: (h.paidAt ?? h.archivedAt).toISOString(),
      label: `Cotisation ${h.year}–${h.year + 1}`,
      amountCents: (h.paidAmount || h.amount) * 100,
    });
  }

  for (const t of topUps) {
    txns.push({
      id: `topup-${t.id}`,
      type: "recharge",
      date: t.createdAt.toISOString(),
      label: "Recharge solde comptoir",
      amountCents: t.amount,
    });
  }

  for (const o of snackOrders) {
    txns.push({
      id: `snack-${o.id}`,
      type: "comptoir",
      date: o.createdAt.toISOString(),
      label: "Achat au comptoir",
      amountCents: o.totalAmount,
      items: o.items,
    });
  }

  for (const o of shopOrders) {
    const total = o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    txns.push({
      id: `shop-${o.id}`,
      type: "boutique",
      date: o.createdAt.toISOString(),
      label: "Commande boutique",
      amountCents: o.status === "CANCELLED" ? 0 : total,
      status: o.status,
      statusLabel: SHOP_STATUS_LABELS[o.status] ?? o.status,
      items: o.items,
    });
  }

  txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(txns);
}
