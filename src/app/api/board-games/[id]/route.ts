import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireOwner(gameId: string, userId: string) {
  const game = await prisma.boardGame.findUnique({ where: { id: gameId } });
  if (!game || game.ownerId !== userId) return null;
  return game;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const existing = await requireOwner(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Jeu introuvable." }, { status: 404 });
  }

  const body = await request.json();
  const { name, photoUrl, minPlayers, maxPlayers, durationMinutes, isPublic } = body as {
    name?: string;
    photoUrl?: string | null;
    minPlayers?: string | number;
    maxPlayers?: string | number;
    durationMinutes?: string | number;
    isPublic?: boolean;
  };

  const min = minPlayers != null ? Math.round(Number(minPlayers)) : existing.minPlayers;
  const max = maxPlayers != null ? Math.round(Number(maxPlayers)) : existing.maxPlayers;
  const duration = durationMinutes != null && durationMinutes !== "" ? Math.round(Number(durationMinutes)) : (durationMinutes === "" ? null : existing.durationMinutes);

  if (Number.isNaN(min) || Number.isNaN(max) || min <= 0 || max < min || (duration !== null && duration !== undefined && duration <= 0)) {
    return NextResponse.json({ error: "Valeurs invalides." }, { status: 400 });
  }

  const game = await prisma.boardGame.update({
    where: { id: params.id },
    data: {
      ...(name ? { name } : {}),
      photoUrl: photoUrl || null,
      minPlayers: min,
      maxPlayers: max,
      durationMinutes: duration,
      ...(isPublic !== undefined ? { isPublic } : {}),
    },
  });

  return NextResponse.json(game);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const existing = await requireOwner(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Jeu introuvable." }, { status: 404 });
  }

  await prisma.boardGame.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
