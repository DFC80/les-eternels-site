export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CORE_ACTIVITIES } from "@/lib/activity-colors";

async function ensureDefaults() {
  for (const a of CORE_ACTIVITIES) {
    await prisma.activity.upsert({
      where: { key: a.key },
      update: {},
      create: a,
    });
    // seed price if still 0 (first run after migration)
    await prisma.activity.updateMany({
      where: { key: a.key, price: 0 },
      data: { price: a.price },
    });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await ensureDefaults();
  const activities = await prisma.activity.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(activities);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { label, emoji, color, membershipRequired, price } = await request.json();
  if (!label || typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Nom d'activité requis." }, { status: 400 });
  }

  const key = label.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");

  const existing = await prisma.activity.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json({ error: "Une activité avec ce nom existe déjà." }, { status: 409 });
  }

  const max = await prisma.activity.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? 0) + 1;

  const activity = await prisma.activity.create({
    data: {
      key,
      label: label.trim(),
      emoji: emoji || "🎯",
      color: color || "slate",
      membershipRequired: !!membershipRequired,
      price: typeof price === "number" && price >= 0 ? Math.round(price) : 0,
      order,
      isCore: false,
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
