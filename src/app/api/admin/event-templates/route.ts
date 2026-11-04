export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const templates = await prisma.eventTemplate.findMany({
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }
  const { title, description, activityKey, location, startTime, endTime, seasonTimes } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: "La description est requise." }, { status: 400 });
  }
  const last = await prisma.eventTemplate.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const template = await prisma.eventTemplate.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      activityKey: activityKey?.trim() || null,
      location: location?.trim() || null,
      startTime: startTime?.trim() || null,
      endTime: endTime?.trim() || null,
      seasonTimes: seasonTimes ? JSON.stringify(seasonTimes) : null,
      order: (last?.order ?? 0) + 1,
    },
  });
  return NextResponse.json(template, { status: 201 });
}
