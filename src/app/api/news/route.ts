export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const articles = await prisma.newsArticle.findMany({
    where: { published: true },
    orderBy: { date: "desc" },
    include: { _count: { select: { comments: true } } },
  });
  return NextResponse.json(articles);
}
