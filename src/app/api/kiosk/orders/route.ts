import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ItemInput = { productId: string; quantity: number };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const userId = session.user.id;
  const { items } = (await request.json()) as { items?: ItemInput[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Au moins un article requis." }, { status: 400 });
  }

  const cleanedItems = items.filter((i) => i.productId && i.quantity > 0);
  if (cleanedItems.length === 0) {
    return NextResponse.json({ error: "Aucun article valide." }, { status: 400 });
  }

  const productIds = cleanedItems.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  for (const item of cleanedItems) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return NextResponse.json({ error: "Article introuvable." }, { status: 400 });
    if (product.stock < item.quantity) {
      return NextResponse.json({ error: `Stock insuffisant pour ${product.name}.` }, { status: 400 });
    }
  }

  const totalAmount = cleanedItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return sum + product.price * item.quantity;
  }, 0);

  const BALANCE_LIMIT = -2000; // -20€ en centimes
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
  if ((user?.balance ?? 0) - totalAmount < BALANCE_LIMIT) {
    return NextResponse.json({ error: "Limite de crédit atteinte (−20€)." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
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
    await tx.snackOrder.create({
      data: {
        userId,
        totalAmount,
        items: {
          create: cleanedItems.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return { productId: product.id, name: product.name, unitPrice: product.price, quantity: item.quantity };
          }),
        },
      },
    });
  });

  const updated = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
  return NextResponse.json({ balance: updated?.balance ?? 0 }, { status: 201 });
}
