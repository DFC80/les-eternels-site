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
  const { name, version, photoUrl, minPlayers, maxPlayers, durationMinutes, isPublic, activityKey, mechanics, themes } = body as {
    name?: string;
    version?: string | null;
    photoUrl?: string | null;
    minPlayers?: string | number;
    maxPlayers?: string | number;
    durationMinutes?: string | number;
    isPublic?: boolean;
    activityKey?: string | null;
    mechanics?: string[];
    themes?: string[];
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
      version: version !== undefined ? (version || null) : existing.version,
      photoUrl: photoUrl !== undefined ? (photoUrl || null) : existing.photoUrl,
      minPlayers: min,
      maxPlayers: max,
      durationMinutes: duration,
      ...(isPublic !== undefined ? { isPublic } : {}),
      activityKey: activityKey !== undefined ? (activityKey || null) : existing.activityKey,
      mechanics: mechanics !== undefined ? joinCsv(mechanics) : existing.mechanics,
      themes: themes !== undefined ? joinCsv(themes) : existing.themes,
    },
  });

  return NextResponse.json({ ...game, mechanics: splitCsv(game.mechanics), themes: splitCsv(game.themes) });
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
