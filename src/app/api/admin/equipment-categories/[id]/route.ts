import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "equipements")) return null;
  return session;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { label, emoji, order } = body as { label?: string; emoji?: string; order?: number };

  if (!label?.trim()) return NextResponse.json({ error: "Nom de catégorie requis." }, { status: 400 });

  const category = await prisma.equipmentCategory.update({
    where: { id: params.id },
    data: { label: label.trim(), emoji: emoji || "📦", ...(order !== undefined ? { order } : {}) },
  });

  return NextResponse.json(category);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const category = await prisma.equipmentCategory.findUnique({ where: { id: params.id } });
  if (!category) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });

  const count = await prisma.equipment.count({ where: { category: category.key } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer : ${count} équipement(s) utilisent cette catégorie.` },
      { status: 409 }
    );
  }

  await prisma.equipmentCategory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
