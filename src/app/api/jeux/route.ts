export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function splitCsv(val: string | null | undefined): string[] {
  return val ? val.split(",").filter(Boolean) : [];
}

function photosFromGame(g: { photoUrls: string | null; photoUrl: string | null }): string[] {
  const urls = splitCsv(g.photoUrls);
  if (urls.length > 0) return urls;
  return g.photoUrl ? [g.photoUrl] : [];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const games = await prisma.boardGame.findMany({
    where: { isPublic: true, status: "DISPONIBLE" },
    orderBy: { name: "asc" },
    include: { owner: { select: { firstName: true, name: true } } },
  });

  return NextResponse.json(
    games.map((g) => ({
      ...g,
      photos: photosFromGame(g),
      mechanics: splitCsv(g.mechanics),
      themes: splitCsv(g.themes),
    }))
  );
}
