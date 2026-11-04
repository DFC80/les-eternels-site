export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { title, description, activityKey, location, order } = await request.json();
  const data: Record<string, unknown> = {};
  if (title !== undefined) {
    if (!title?.trim()) return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
    data.title = title.trim();
  }
  if (description !== undefined) {
    if (!description?.trim()) return NextResponse.json({ error: "La description est requise." }, { status: 400 });
    data.description = description.trim();
  }
  if (activityKey !== undefined) data.activityKey = activityKey?.trim() || null;
  if (location !== undefined) data.location = location?.trim() || null;
  if (order !== undefined) data.order = Number(order);

  const template = await prisma.eventTemplate.update({ where: { id: params.id }, data });
  return NextResponse.json(template);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  await prisma.eventTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
