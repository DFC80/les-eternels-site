export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "comptabilite")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const credits = await prisma.eventCredit.findMany({
    where: { eventId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(credits);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "comptabilite")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { label, amount } = body as { label?: string; amount?: string | number };

  if (!label || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Libellé et montant requis." }, { status: 400 });
  }

  const credit = await prisma.eventCredit.create({
    data: {
      eventId: params.id,
      label,
      amount: parseFloat(Number(amount).toFixed(2)),
    },
  });

  return NextResponse.json(credit, { status: 201 });
}
