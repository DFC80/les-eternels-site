export const dynamic = "force-dynamic";
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

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const article = await prisma.newsArticle.findUnique({
    where: { id: params.id },
    include: { comments: { include: { user: { select: { firstName: true, name: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!article) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json(article);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { title, content, photos, date, published } = body as {
    title?: string;
    content?: string;
    photos?: string;
    date?: string;
    published?: boolean;
  };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Titre et contenu requis." }, { status: 400 });
  }

  const article = await prisma.newsArticle.update({
    where: { id: params.id },
    data: {
      title: title.trim(),
      content: content.trim(),
      photos: photos || null,
      date: date ? new Date(date) : undefined,
      published: !!published,
    },
  });

  return NextResponse.json(article);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await prisma.newsArticle.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
