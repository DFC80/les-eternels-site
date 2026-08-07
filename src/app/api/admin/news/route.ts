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

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const articles = await prisma.newsArticle.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { comments: true } } },
  });

  return NextResponse.json(articles);
}

export async function POST(request: Request) {
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

  const article = await prisma.newsArticle.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      photos: photos || null,
      date: date ? new Date(date) : new Date(),
      published: !!published,
    },
  });

  return NextResponse.json(article, { status: 201 });
}
