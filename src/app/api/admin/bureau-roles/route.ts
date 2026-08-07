export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const roles = await prisma.bureauRole.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(roles);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { label } = await request.json();
  if (!label?.trim()) return NextResponse.json({ error: "Libellé requis." }, { status: 400 });

  const max = await prisma.bureauRole.aggregate({ _max: { order: true } });
  const role = await prisma.bureauRole.create({
    data: { label: label.trim(), order: (max._max.order ?? 0) + 1 },
  });
  return NextResponse.json(role, { status: 201 });
}
