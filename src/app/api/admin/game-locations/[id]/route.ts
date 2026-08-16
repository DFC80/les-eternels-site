import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user as never, "lieux")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const location = await prisma.gameLocation.findUnique({
    where: { id: params.id },
    include: { activity: { select: { id: true, label: true, emoji: true } } },
  });

  if (!location) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json(location);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "lieux")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, activityId, photos, isPublic, isActive, showOnHome } = body as {
    title?: string;
    description?: string;
    activityId?: string | null;
    photos?: string;
    isPublic?: boolean;
    isActive?: boolean;
    showOnHome?: boolean;
  };

  if (title !== undefined && !title.trim()) {
    return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
  }
  if (description !== undefined && !description.trim()) {
    return NextResponse.json({ error: "La description est requise." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description.trim();
  if ("activityId" in body) data.activityId = activityId || null;
  if (photos !== undefined) data.photos = photos;
  if (typeof isPublic === "boolean") data.isPublic = isPublic;
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (typeof showOnHome === "boolean") data.showOnHome = showOnHome;

  const location = await prisma.gameLocation.update({
    where: { id: params.id },
    data,
    include: { activity: { select: { id: true, label: true, emoji: true } } },
  });

  return NextResponse.json(location);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "lieux")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.gameLocation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
