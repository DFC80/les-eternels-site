export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "activites")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const doc = await prisma.eventDocument.findUnique({ where: { id: params.docId } });
  if (!doc || doc.eventId !== params.id) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  await prisma.eventDocument.delete({ where: { id: params.docId } });

  return NextResponse.json({ ok: true });
}
