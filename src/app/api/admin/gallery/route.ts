export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const photos = await prisma.galleryPhoto.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(photos);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { url, date, comment, activityType } = body as {
    url?: string;
    date?: string;
    comment?: string;
    activityType?: string;
  };

  if (!url || !date) {
    return NextResponse.json({ error: "Photo et date requises." }, { status: 400 });
  }

  if (activityType && activityType !== "AUTRE") {
    const validActivity = await prisma.activity.findUnique({ where: { key: activityType } });
    if (!validActivity) {
      return NextResponse.json({ error: "Activité invalide." }, { status: 400 });
    }
  }

  const photo = await prisma.galleryPhoto.create({
    data: {
      url,
      date: new Date(date),
      comment: comment || null,
      activityType: activityType || "AUTRE",
      visibility: "PUBLIC",
    },
  });

  return NextResponse.json(photo, { status: 201 });
}

