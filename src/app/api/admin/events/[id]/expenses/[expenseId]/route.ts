export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string; expenseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.eventExpense.delete({ where: { id: params.expenseId } });

  return NextResponse.json({ ok: true });
}