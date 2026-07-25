import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) return null;
  return session;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const expenses = await prisma.eventExpense.findMany({
    where: { eventId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { label, amount } = body as { label?: string; amount?: string | number };

  if (!label || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Libellé et montant requis." }, { status: 400 });
  }

  const expense = await prisma.eventExpense.create({
    data: {
      eventId: params.id,
      label,
      amount: Math.round(Number(amount)),
    },
  });

  return NextResponse.json(expense, { status: 201 });
}