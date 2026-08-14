import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";

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

  const order = await prisma.shopOrder.update({ where: { id }, data: { status } });
  return NextResponse.json(order);
}
