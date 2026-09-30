export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  if (!sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const games = await prisma.boardGame.findMany({
    where: { isPublic: true },
    orderBy: { name: "asc" },
    include: { owner: { select: { firstName: true, name: true } } },
  });

  const activityKeys = [...new Set(games.map((g) => g.activityKey).filter(Boolean))] as string[];
  const activities = activityKeys.length
    ? await prisma.activity.findMany({ where: { key: { in: activityKeys } }, select: { key: true, label: true, emoji: true } })
    : [];
  const activityMap = Object.fromEntries(activities.map((a) => [a.key, { label: a.label, emoji: a.emoji }]));

  return NextResponse.json(
    games.map((g) => ({
      ...g,
      mechanics: g.mechanics ? g.mechanics.split(",").filter(Boolean) : [],
      themes: g.themes ? g.themes.split(",").filter(Boolean) : [],
      activityLabel: g.activityKey ? (activityMap[g.activityKey]?.label ?? null) : null,
      activityEmoji: g.activityKey ? (activityMap[g.activityKey]?.emoji ?? null) : null,
    }))
  );
}
