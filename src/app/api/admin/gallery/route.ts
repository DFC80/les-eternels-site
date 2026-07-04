import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const VALID_ACTIVITIES = ["JEUX_DE_PLATEAU", "JEUX_DE_ROLE", "AIRSOFT", "AUTRE"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "galerie"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const photos = await prisma.galleryPhoto.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(photos);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "galerie"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { url, date, comment, activityType, visibility } = body as {
    url?: string;
    date?: string;
    comment?: string;
    activityType?: string;
    visibility?: string;
  };

  if (!url || !date) {
    return NextResponse.json({ error: "Photo et date requises." }, { status: 400 });
  }

  if (activityType && !VALID_ACTIVITIES.includes(activityType)) {
    return NextResponse.json({ error: "Activité invalide." }, { status: 400 });
  }

  const photo = await prisma.galleryPhoto.create({
    data: {
      url,
      date: new Date(date),
      comment: comment || null,
      activityType: activityType || "AUTRE",
      visibility: visibility === "MEMBERS_ONLY" ? "MEMBERS_ONLY" : "PUBLIC",
    },
  });

  return NextResponse.json(photo, { status: 201 });
}

