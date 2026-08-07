export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const article = await prisma.newsArticle.findUnique({ where: { id: params.id, published: true } });
  if (!article) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });

  const body = await request.json();
  const content = (body.content ?? "").toString().trim();
  if (!content) return NextResponse.json({ error: "Le commentaire ne peut pas être vide." }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ error: "Commentaire trop long (max 1000 caractères)." }, { status: 400 });

  const comment = await prisma.newsComment.create({
    data: { articleId: params.id, userId: session.user.id, content },
    include: { user: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await request.json();
  const { commentId } = body as { commentId?: string };
  if (!commentId) return NextResponse.json({ error: "commentId requis." }, { status: 400 });

  const comment = await prisma.newsComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.articleId !== params.id) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const isOwner = comment.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "MODERATOR";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await prisma.newsComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
