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
  const data: { comment?: string | null; isFavorite?: boolean } = {};

  if ("comment" in body) {
    data.comment = body.comment ?? null;
  }

  if ("isFavorite" in body) {
    data.isFavorite = !!body.isFavorite;
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

  if (Object.keys(data).length === 0 && !("activityKeys" in body)) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const photo = await prisma.galleryPhoto.update({
    where: { id: params.id },
    data,
    include: { activities: true },
  });

  return NextResponse.json(photo);
}
