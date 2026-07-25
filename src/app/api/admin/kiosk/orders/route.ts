import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ItemInput = { productId: string; quantity: number };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "kiosque")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const orders = await prisma.snackOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { firstName: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      memberName: `${o.user.firstName} ${o.user.name}`,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
    }))
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "kiosque")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { userId, items } = body as { userId?: string; items?: ItemInput[] };

  if (!userId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Personne et au moins un article requis." }, { status: 400 });
  }

  const cleanedItems = items.filter((i) => i.productId && i.quantity > 0);
  if (cleanedItems.length === 0) {
    return NextResponse.json({ error: "Aucun article valide." }, { status: 400 });
  }

  const productIds = cleanedItems.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  for (const item of cleanedItems) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return NextResponse.json({ error: "Un article n'existe plus." }, { status: 400 });
    }
    if (product.stock < item.quantity) {
      return NextResponse.json({ error: `Stock insuffisant pour ${product.name}.` }, { status: 400 });
    }
  }

  const totalAmount = cleanedItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return sum + product.price * item.quantity;
  }, 0);

  const order = await prisma.$transaction(async (tx) => {
    for (const item of cleanedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: totalAmount } },
    });

    return tx.snackOrder.create({
      data: {
        userId,
        totalAmount,
        items: {
          create: cleanedItems.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              productId: product.id,
              name: product.name,
              unitPrice: product.price,
              quantity: item.quantity,
            };
          }),
        },
      },
      include: { items: true },
    });
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });

  return NextResponse.json({ order, balance: user?.balance ?? 0 }, { status: 201 });
}