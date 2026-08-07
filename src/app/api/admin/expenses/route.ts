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

  const expenses = await prisma.generalExpense.findMany({ orderBy: { date: "desc" } });

  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "comptabilite")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { label, amount, date } = body as { label?: string; amount?: string | number; date?: string };

  if (!label || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Libellé et montant requis." }, { status: 400 });
  }

  const expense = await prisma.generalExpense.create({
    data: {
      label,
      amount: Math.round(Number(amount)),
      date: date ? new Date(date) : new Date(),
    },
  });

  return NextResponse.json(expense, { status: 201 });
}

