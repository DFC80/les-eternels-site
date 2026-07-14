import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  { key: "REPLIQUE", label: "Répliques", emoji: "🔫", order: 0 },
  { key: "EQUIPEMENT", label: "Équipements", emoji: "🎒", order: 1 },
];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "equipements"))) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  let categories = await prisma.equipmentCategory.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });

  if (categories.length === 0) {
    await prisma.equipmentCategory.createMany({ data: DEFAULT_CATEGORIES });
    categories = await prisma.equipmentCategory.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  }

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { label, emoji, order } = body as { label?: string; emoji?: string; order?: number };

  if (!label?.trim()) return NextResponse.json({ error: "Nom de catégorie requis." }, { status: 400 });

  const key = label.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

  if (!key) return NextResponse.json({ error: "Nom invalide." }, { status: 400 });

  const existing = await prisma.equipmentCategory.findUnique({ where: { key } });
  if (existing) return NextResponse.json({ error: "Une catégorie avec ce nom existe déjà." }, { status: 409 });

  const count = await prisma.equipmentCategory.count();
  const category = await prisma.equipmentCategory.create({
    data: { key, label: label.trim(), emoji: emoji || "📦", order: order ?? count },
  });

  return NextResponse.json(category, { status: 201 });
}
