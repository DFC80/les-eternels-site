import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendShopOrderNotificationToAdmin } from "@/lib/mail";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const orders = await prisma.shopOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { shopItem: { select: { id: true, title: true, photos: true } } } },
    },
  });

  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await request.json();
  const { items, notes } = body as {
    items: Array<{ shopItemId: string; quantity: number; customText?: string }>;
    notes?: string;
  };

  if (!items?.length) {
    return NextResponse.json({ error: "Panier vide." }, { status: 400 });
  }

  const shopItems = await prisma.shopItem.findMany({
    where: { id: { in: items.map((i) => i.shopItemId) }, isPublished: true },
  });

  const shopItemMap: Record<string, typeof shopItems[number]> = Object.fromEntries(shopItems.map((s) => [s.id, s]));

  for (const item of items) {
    const si = shopItemMap[item.shopItemId];
    if (!si) return NextResponse.json({ error: `Produit introuvable.` }, { status: 400 });
    if (si.stock < item.quantity) {
      return NextResponse.json({ error: `Stock insuffisant pour « ${si.title} ».` }, { status: 400 });
    }
  }

  const order = await prisma.shopOrder.create({
    data: {
      userId: session.user.id,
      notes: notes?.trim() || null,
      items: {
        create: items.map((item) => {
          const si = shopItemMap[item.shopItemId];
          return {
            shopItemId: item.shopItemId,
            name: si.title,
            unitPrice: si.price,
            quantity: item.quantity,
            customText: item.customText?.trim() || null,
          };
        }),
      },
    },
    include: { items: true },
  });

  // Decrease stock
  for (const item of items) {
    await prisma.shopItem.update({
      where: { id: item.shopItemId },
      data: { stock: { decrement: item.quantity } },
    });
  }

  // Notify admin
  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, name: true, email: true },
  });
  const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  sendShopOrderNotificationToAdmin({
    memberName: `${member?.firstName ?? ""} ${member?.name ?? ""}`.trim(),
    memberEmail: member?.email ?? session.user.email ?? "",
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      customText: i.customText,
    })),
    total,
    notes: order.notes,
  }).catch(() => {});

  return NextResponse.json(order, { status: 201 });
}
