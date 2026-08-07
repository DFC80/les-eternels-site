export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseEurosToCents } from "@/lib/money";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "kiosque")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { userId, amount } = body as { userId?: string; amount?: string | number };

  if (!userId || amount == null) {
    return NextResponse.json({ error: "Membre et montant requis." }, { status: 400 });
  }

  const amountCents = parseEurosToCents(amount);
  if (Number.isNaN(amountCents) || amountCents === 0) {
    return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amountCents } },
    }),
    prisma.balanceTopUp.create({
      data: { userId, amount: amountCents },
    }),
  ]);

  return NextResponse.json({ id: user.id, balance: user.balance });
}