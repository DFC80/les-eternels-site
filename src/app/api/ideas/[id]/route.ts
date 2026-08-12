export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const idea = await prisma.idea.findUnique({ where: { id: params.id } });
  if (!idea) return NextResponse.json({ error: "Idée introuvable." }, { status: 404 });

  const userId = (session.user as { id: string }).id;
  if (idea.userId !== userId) {
    return NextResponse.json({ error: "Vous ne pouvez modifier que vos propres idées." }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, category, urgency } = body as {
    title?: string;
    description?: string;
    category?: string;
    urgency?: string;
  };

  if (!title?.trim() || !description?.trim() || !category?.trim()) {
    return NextResponse.json({ error: "Titre, description et catégorie sont requis." }, { status: 400 });
  }

  if (!["HAUTE", "MOYENNE", "BASSE"].includes(urgency ?? "")) {
    return NextResponse.json({ error: "Urgence invalide." }, { status: 400 });
  }

  const updated = await prisma.idea.update({
    where: { id: params.id },
    data: { title: title.trim(), description: description.trim(), category: category.trim(), urgency: urgency! },
    include: { user: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(updated);
}

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
