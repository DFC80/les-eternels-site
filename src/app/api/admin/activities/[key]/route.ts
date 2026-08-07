export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const exists = await prisma.activity.findUnique({ where: { key: params.key } });
  if (!exists) {
    return NextResponse.json({ error: "Activité introuvable." }, { status: 404 });
  }

  const { content } = await request.json();
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Le contenu ne peut pas être vide." }, { status: 400 });
  }

  const row = await prisma.activityContent.upsert({
    where: { key: params.key },
    create: { key: params.key, content: content.trim() },
    update: { content: content.trim() },
  });

  return NextResponse.json(row);
}
