import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_CATEGORIES = [
  { key: "REPLIQUE", label: "Répliques", emoji: "🔫", order: 0 },
  { key: "EQUIPEMENT", label: "Équipements", emoji: "🎒", order: 1 },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  let categories = await prisma.equipmentCategory.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });

  if (categories.length === 0) {
    categories = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: String(i), createdAt: new Date() })) as typeof categories;
  }

  return NextResponse.json(categories);
}
