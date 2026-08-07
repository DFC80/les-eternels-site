export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { status } = body as { status?: string };

  if (!status || !["DISPONIBLE", "INDISPONIBLE"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const game = await prisma.boardGame.update({ where: { id: params.id }, data: { status } });

  return NextResponse.json(game);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.boardGame.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
