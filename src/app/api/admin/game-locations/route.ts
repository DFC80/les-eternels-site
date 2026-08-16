import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user as never, "lieux")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const locations = await prisma.gameLocation.findMany({
    orderBy: { createdAt: "desc" },
    include: { activity: { select: { id: true, label: true, emoji: true } } },
  });

  return NextResponse.json(locations);
}

export async function POST(request: Request) {
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

  if (!title?.trim()) return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "La description est requise." }, { status: 400 });

  const location = await prisma.gameLocation.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      activityId: activityId || null,
      photos: photos ?? "",
      isPublic: !!isPublic,
      isActive: isActive !== false,
      showOnHome: !!showOnHome,
    },
    include: { activity: { select: { id: true, label: true, emoji: true } } },
  });

  return NextResponse.json(location, { status: 201 });
}
