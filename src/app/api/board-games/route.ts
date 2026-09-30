export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function splitCsv(val: string | null | undefined): string[] {
  return val ? val.split(",").filter(Boolean) : [];
}

function joinCsv(arr: string[] | null | undefined): string | null {
  return arr && arr.length > 0 ? arr.join(",") : null;
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
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = await request.json();
  const { name, version, photos, minPlayers, maxPlayers, durationMinutes, activityKey, mechanics, themes } = body as {
    name?: string;
    version?: string | null;
    photos?: string[];
    minPlayers?: string | number;
    maxPlayers?: string | number;
    durationMinutes?: string | number;
    activityKey?: string | null;
    mechanics?: string[];
    themes?: string[];
  };

  if (!name || minPlayers == null || maxPlayers == null) {
    return NextResponse.json(
      { error: "Nom et nombre de joueurs sont requis." },
      { status: 400 }
    );
  }

  const min = Math.round(Number(minPlayers));
  const max = Math.round(Number(maxPlayers));
  const duration = durationMinutes != null && durationMinutes !== "" ? Math.round(Number(durationMinutes)) : null;

  if (Number.isNaN(min) || Number.isNaN(max) || min <= 0 || max < min || (duration !== null && duration <= 0)) {
    return NextResponse.json({ error: "Valeurs invalides." }, { status: 400 });
  }

  const photoList = photos ?? [];

  const game = await prisma.boardGame.create({
    data: {
      ownerId: session.user.id,
      name,
      version: version || null,
      photoUrl: photoList[0] || null,
      photoUrls: joinCsv(photoList),
      minPlayers: min,
      maxPlayers: max,
      durationMinutes: duration,
      activityKey: activityKey || null,
      mechanics: joinCsv(mechanics),
      themes: joinCsv(themes),
    },
  });

  return NextResponse.json(
    { ...game, photos: photosFromGame(game), mechanics: splitCsv(game.mechanics), themes: splitCsv(game.themes) },
    { status: 201 }
  );
}
