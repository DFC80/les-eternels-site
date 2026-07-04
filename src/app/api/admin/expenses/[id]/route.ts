import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "comptabilite"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.generalExpense.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}