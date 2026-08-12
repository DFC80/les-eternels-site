export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function requireAdmin() {
  return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return requireAdmin();

  const { title, description, isActive } = (await request.json()) as {
    title?: string;
    description?: string;
    isActive?: boolean;
  };

  const note = await prisma.adminNote.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(note);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return requireAdmin();

  await prisma.adminNote.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
