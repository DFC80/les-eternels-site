export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "jeux")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { status, activityKey } = body as { status?: string; activityKey?: string | null };

  const data: Record<string, unknown> = {};

  if (status !== undefined) {
    if (!["DISPONIBLE", "INDISPONIBLE"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }
    data.status = status;
  }

  if (activityKey !== undefined) {
    data.activityKey = activityKey || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const game = await prisma.boardGame.update({ where: { id: params.id }, data });

  return NextResponse.json(game);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "jeux")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.boardGame.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
