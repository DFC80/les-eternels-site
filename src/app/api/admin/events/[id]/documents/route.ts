export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireAccess(write = false) {
  const session = await getServerSession(authOptions);
  const check = write ? sessionHasWriteAccess : sessionHasAccess;
  if (!session || !check(session.user, "events")) return null;
  return session;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const links = await prisma.eventAssocDocument.findMany({
    where: { eventId: params.id },
    include: {
      document: {
        select: { id: true, name: true, description: true, mime: true, size: true, visibility: true },
      },
    },
    orderBy: { document: { name: "asc" } },
  });

  return NextResponse.json(links.map((l) => l.document));
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAccess(true);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { documentId } = await request.json() as { documentId?: string };
  if (!documentId) return NextResponse.json({ error: "documentId manquant." }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });

  const doc = await prisma.assocDocument.findUnique({ where: { id: documentId }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });

  await prisma.eventAssocDocument.upsert({
    where: { eventId_documentId: { eventId: params.id, documentId } },
    create: { eventId: params.id, documentId },
    update: {},
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
