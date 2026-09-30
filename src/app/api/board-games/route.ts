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
  const { name, photoUrl, minPlayers, maxPlayers, durationMinutes, activityKey, mechanics, themes } = body as {
    name?: string;
    photoUrl?: string | null;
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

  const game = await prisma.boardGame.create({
    data: {
      ownerId: session.user.id,
      name,
      photoUrl: photoUrl || null,
      minPlayers: min,
      maxPlayers: max,
      durationMinutes: duration,
      activityKey: activityKey || null,
      mechanics: joinCsv(mechanics),
      themes: joinCsv(themes),
    },
  });

  return NextResponse.json(
    { ...game, mechanics: splitCsv(game.mechanics), themes: splitCsv(game.themes) },
    { status: 201 }
  );
}
