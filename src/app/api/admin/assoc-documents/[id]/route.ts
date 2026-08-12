export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireWriteAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user as never, "documents")) return null;
  return session;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await requireWriteAccess();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { name, description, visibility, category } = await request.json() as {
    name?: string;
    description?: string;
    visibility?: string;
    category?: string;
  };

  if (!name?.trim()) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });
  if (visibility && !["PUBLIC", "PRIVATE"].includes(visibility)) {
    return NextResponse.json({ error: "Visibilité invalide." }, { status: 400 });
  }

  const doc = await prisma.assocDocument.update({
    where: { id: params.id },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      visibility: visibility ?? "PUBLIC",
      category: category?.trim() || null,
    },
    select: { id: true, name: true, description: true, mime: true, size: true, visibility: true, category: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireWriteAccess();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await prisma.assocDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
