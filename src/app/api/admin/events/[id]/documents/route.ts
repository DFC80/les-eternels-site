export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const docs = await prisma.eventDocument.findMany({
    where: { eventId: params.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json(docs);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!event) {
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim();
  const file = formData.get("file") as File | null;

  if (!name || !file || file.size === 0) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés." }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Le fichier ne doit pas dépasser 10 Mo." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const content = Buffer.from(bytes);

  const doc = await prisma.eventDocument.create({
    data: { eventId: params.id, name, content },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json(doc, { status: 201 });
}
