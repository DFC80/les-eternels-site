export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const idea = await prisma.idea.findUnique({ where: { id: params.id } });
  if (!idea) return NextResponse.json({ error: "Idée introuvable." }, { status: 404 });

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role ?? "";

  if (idea.userId !== userId && !isFullAdmin(role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.idea.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
