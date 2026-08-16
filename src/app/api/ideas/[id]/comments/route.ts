export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const comments = await prisma.ideaComment.findMany({
    where: { ideaId: params.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(comments);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const { content } = (await request.json()) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "Le commentaire ne peut pas être vide." }, { status: 400 });
  }
  if (content.trim().length > 1000) {
    return NextResponse.json({ error: "Le commentaire ne doit pas dépasser 1000 caractères." }, { status: 400 });
  }

  const idea = await prisma.idea.findUnique({ where: { id: params.id } });
  if (!idea) return NextResponse.json({ error: "Idée introuvable." }, { status: 404 });

  const comment = await prisma.ideaComment.create({
    data: {
      ideaId: params.id,
      userId: (session.user as { id: string }).id,
      content: content.trim(),
    },
    include: { user: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const { commentId } = (await request.json()) as { commentId?: string };
  if (!commentId) return NextResponse.json({ error: "commentId requis." }, { status: 400 });

  const comment = await prisma.ideaComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.ideaId !== params.id) {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
  }

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role ?? "";
  if (comment.userId !== userId && !isFullAdmin(role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.ideaComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
