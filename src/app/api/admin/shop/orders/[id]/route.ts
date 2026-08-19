import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasWriteAccess } from "@/lib/permissions";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "boutique")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const order = await prisma.shopOrder.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  // Restore stock if the order wasn't already cancelled
  if (order.status !== "CANCELLED") {
    for (const item of order.items) {
      if (item.shopItemId) {
        await prisma.shopItem.update({
          where: { id: item.shopItemId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  }

  await prisma.shopOrder.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
