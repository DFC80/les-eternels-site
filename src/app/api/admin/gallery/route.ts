export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const photos = await prisma.galleryPhoto.findMany({
    orderBy: { date: "desc" },
    include: { activities: true },
  });
  return NextResponse.json(photos);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { url, date, comment, activityKeys } = body as {
    url?: string;
    date?: string;
    comment?: string;
    activityKeys?: string[];
  };

  if (!url || !date) {
    return NextResponse.json({ error: "Photo et date requises." }, { status: 400 });
  }

  const keys = Array.isArray(activityKeys) ? activityKeys : [];

  // Validate that all provided keys exist (excluding AUTRE sentinel)
  for (const key of keys.filter((k) => k !== "AUTRE")) {
    const valid = await prisma.activity.findUnique({ where: { key } });
    if (!valid) return NextResponse.json({ error: `Activité invalide : ${key}` }, { status: 400 });
  }

  const photo = await prisma.galleryPhoto.create({
    data: {
      url,
      date: new Date(date),
      comment: comment || null,
      visibility: "PUBLIC",
      activities: keys.length > 0 ? { create: keys.map((key) => ({ activityKey: key })) } : undefined,
    },
    include: { activities: true },
  });

  return NextResponse.json(photo, { status: 201 });
}
