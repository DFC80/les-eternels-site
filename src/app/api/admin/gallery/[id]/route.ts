export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.galleryPhoto.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "galerie")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const data: { comment?: string | null; isFavorite?: boolean; date?: Date; url?: string } = {};

  if ("comment" in body) {
    data.comment = body.comment ?? null;
  }

  if ("isFavorite" in body) {
    data.isFavorite = !!body.isFavorite;
  }

  if ("date" in body && typeof body.date === "string") {
    const parsed = new Date(body.date);
    if (!isNaN(parsed.getTime())) data.date = parsed;
  }

  if ("url" in body && typeof body.url === "string" && body.url.trim()) {
    data.url = body.url.trim();
  }

  if ("activityKeys" in body && Array.isArray(body.activityKeys)) {
    const keys: string[] = body.activityKeys;
    await prisma.galleryPhotoActivity.deleteMany({ where: { photoId: params.id } });
    if (keys.length > 0) {
      await prisma.galleryPhotoActivity.createMany({
        data: keys.map((activityKey) => ({ photoId: params.id, activityKey })),
      });
    }
  }

  if ("categoryIds" in body && Array.isArray(body.categoryIds)) {
    const ids: string[] = body.categoryIds;
    await prisma.galleryPhotoCategory.deleteMany({ where: { photoId: params.id } });
    if (ids.length > 0) {
      await prisma.galleryPhotoCategory.createMany({
        data: ids.map((categoryId) => ({ photoId: params.id, categoryId })),
      });
    }
  }

  if (Object.keys(data).length === 0 && !("activityKeys" in body) && !("categoryIds" in body) && !("date" in body) && !("url" in body)) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const photo = await prisma.galleryPhoto.update({
    where: { id: params.id },
    data,
    include: {
      activities: true,
      categories: { include: { category: true } },
    },
  });

  return NextResponse.json(photo);
}
