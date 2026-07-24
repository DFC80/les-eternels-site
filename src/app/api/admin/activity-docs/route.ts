import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
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
  });

  return NextResponse.json(docs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "activites")) {
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

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.pdf`;
  const dest = path.join(UPLOAD_DIR, filename);
  const bytes = await file.arrayBuffer();
  await writeFile(dest, Buffer.from(bytes));

  const doc = await prisma.activityDocument.create({
    data: { activityKey, name, filename },
  });

  return NextResponse.json(doc, { status: 201 });
}
