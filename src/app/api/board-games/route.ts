import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const games = await prisma.boardGame.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(games);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = await request.json();
  const { name, photoUrl, minPlayers, maxPlayers, durationMinutes } = body as {
    name?: string;
    photoUrl?: string | null;
    minPlayers?: string | number;
    maxPlayers?: string | number;
    durationMinutes?: string | number;
  };

  if (!name || minPlayers == null || maxPlayers == null || durationMinutes == null) {
    return NextResponse.json(
      { error: "Nom, nombre de joueurs et durée d'une partie sont requis." },
      { status: 400 }
    );
  }

  const min = Math.round(Number(minPlayers));
  const max = Math.round(Number(maxPlayers));
  const duration = Math.round(Number(durationMinutes));

  if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(duration) || min <= 0 || max < min || duration <= 0) {
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
    },
  });

  return NextResponse.json(game, { status: 201 });
}
