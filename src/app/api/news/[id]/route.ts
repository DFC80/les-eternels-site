export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const article = await prisma.newsArticle.findUnique({
    where: { id: params.id, published: true },
    include: {
      comments: {
        include: { user: { select: { firstName: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!article) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json(article);
}
