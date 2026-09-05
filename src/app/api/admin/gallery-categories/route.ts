export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const activityKey = searchParams.get("activityKey");

  const categories = await prisma.galleryCategory.findMany({
    where: activityKey ? { activityKey } : undefined,
    orderBy: [{ activityKey: "asc" }, { order: "asc" }, { label: "asc" }],
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { activityKey, label } = body as { activityKey?: string; label?: string };

  if (!activityKey || !label?.trim()) {
    return NextResponse.json({ error: "Activité et libellé requis." }, { status: 400 });
  }

  const existing = await prisma.galleryCategory.count({
    where: { activityKey, label: label.trim() },
  });
  if (existing > 0) {
    return NextResponse.json({ error: "Cette catégorie existe déjà." }, { status: 409 });
  }

  const maxOrder = await prisma.galleryCategory.aggregate({
    where: { activityKey },
    _max: { order: true },
  });

  const category = await prisma.galleryCategory.create({
    data: {
      activityKey,
      label: label.trim(),
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
