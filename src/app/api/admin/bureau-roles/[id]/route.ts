import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return null;
  return session;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { label, order } = await request.json();
  const role = await prisma.bureauRole.update({
    where: { id: params.id },
    data: {
      ...(label !== undefined && { label }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(role);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  // La cascade onDelete supprime automatiquement les UserBureauRole associés
  await prisma.bureauRole.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
