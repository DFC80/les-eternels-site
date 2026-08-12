export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "activity-docs");

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const activityKey = searchParams.get("activityKey");

  const docs = await prisma.activityDocument.findMany({
    where: activityKey ? { activityKey } : undefined,
    orderBy: { createdAt: "asc" },
    select: { id: true, activityKey: true, name: true, filename: true, showInEvents: true, createdAt: true },
  });

  return NextResponse.json(docs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const formData = await request.formData();
  const activityKey = formData.get("activityKey") as string | null;
  const name = (formData.get("name") as string | null)?.trim();
  const file = formData.get("file") as File | null;

  if (!activityKey || !name || !file || file.size === 0) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés." }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Le fichier ne doit pas dépasser 10 Mo." }, { status: 400 });
  }

  const filename = `${randomUUID()}.pdf`;
  const bytes = await file.arrayBuffer();
  const content = Buffer.from(bytes);

  // Also write to disk as fallback, but primary storage is DB
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), content);
  } catch { /* non-fatal — DB content is the authoritative source */ }

  const doc = await prisma.activityDocument.create({
    data: { activityKey, name, filename, content },
  });

  return NextResponse.json(doc, { status: 201 });
}
