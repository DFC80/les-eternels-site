export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "activity-docs");

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { showInEvents } = body as { showInEvents?: boolean };
  if (typeof showInEvents !== "boolean") {
    return NextResponse.json({ error: "Paramètre invalide." }, { status: 400 });
  }

  const doc = await prisma.activityDocument.update({
    where: { id: params.id },
    data: { showInEvents },
  });

  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const doc = await prisma.activityDocument.findUnique({ where: { id: params.id } });
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  await prisma.activityDocument.delete({ where: { id: params.id } });
  await unlink(path.join(UPLOAD_DIR, doc.filename)).catch(() => {});

  return NextResponse.json({ ok: true });
}
