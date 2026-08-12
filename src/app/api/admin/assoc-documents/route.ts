export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

async function requireAccess(write = false) {
  const session = await getServerSession(authOptions);
  const check = write ? sessionHasWriteAccess : sessionHasAccess;
  if (!session || !check(session.user as never, "documents")) return null;
  return session;
}

export async function GET() {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const docs = await prisma.assocDocument.findMany({
    select: { id: true, name: true, description: true, mime: true, size: true, visibility: true, category: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(docs);
}

export async function POST(request: Request) {
  const session = await requireAccess(true);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const visibility = (formData.get("visibility") as string | null) ?? "PUBLIC";
  const category = (formData.get("category") as string | null)?.trim() || null;

  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });
  if (!["PUBLIC", "PRIVATE"].includes(visibility)) return NextResponse.json({ error: "Visibilité invalide." }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: "Type de fichier non supporté." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });

  const doc = await prisma.assocDocument.create({
    data: { name, description, content: buffer, mime: file.type, size: buffer.byteLength, visibility, category },
    select: { id: true, name: true, description: true, mime: true, size: true, visibility: true, category: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(doc, { status: 201 });
}
