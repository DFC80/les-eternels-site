import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import {
  sendShopOrderStatusChangeToMember,
  sendShopOrderStatusChangeToAdmin,
} from "@/lib/mail";

const VALID_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "DELIVERED", "PAID"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const orders = await prisma.shopOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, firstName: true, name: true, email: true } },
      items: { include: { shopItem: { select: { id: true, title: true } } } },
    },
  });

  return NextResponse.json(orders);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "id et status requis." }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const order = await prisma.shopOrder.findUnique({
    where: { id },
    include: {
      items: true,
      user: { select: { firstName: true, name: true, email: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  // Restore stock when cancelling (only if not already cancelled)
  if (status === "CANCELLED" && order.status !== "CANCELLED") {
    for (const item of order.items) {
      if (item.shopItemId) {
        await prisma.shopItem.update({
          where: { id: item.shopItemId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  }

  // Create accounting entry when marking as paid (only if not already paid)
  if (status === "PAID" && order.status !== "PAID") {
    const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const memberName = `${order.user.firstName ?? ""} ${order.user.name ?? ""}`.trim();
    const articleList = order.items.map((i) => i.name).join(", ");
    await prisma.generalCredit.create({
      data: {
        label: `Boutique — ${memberName} (${articleList})`,
        amount: total / 100,
        date: new Date(),
      },
    });
  }

  const updatedOrder = await prisma.shopOrder.update({ where: { id }, data: { status } });

  // Notify member and admin (fire-and-forget)
  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const memberName = `${order.user.firstName ?? ""} ${order.user.name ?? ""}`.trim();
  const emailItems = order.items.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    customText: i.customText,
  }));

  sendShopOrderStatusChangeToMember({
    to: order.user.email,
    firstName: order.user.firstName ?? "",
    orderId: order.id,
    newStatus: status,
    items: emailItems,
    total,
    notes: order.notes,
  }).catch(() => {});

  sendShopOrderStatusChangeToAdmin({
    memberName,
    memberEmail: order.user.email,
    orderId: order.id,
    newStatus: status,
    items: emailItems,
    total,
    notes: order.notes,
  }).catch(() => {});

  return NextResponse.json(updatedOrder);
}
