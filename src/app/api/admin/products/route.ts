import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseEurosToCents } from "@/lib/money";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "produits"))) return null;
  return session;
}

export async function GET() {
  // Le rôle kiosque peut lire les produits (pour la page comptoir tablette)
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "produits") && !canAccessSection(session.user.role, "kiosque"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { activities: true },
  });

  return NextResponse.json(products);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { category, name, photoUrl, price, stock, activityKeys } = body as {
    category?: string;
    name?: string;
    photoUrl?: string | null;
    price?: string | number;
    stock?: string | number;
    activityKeys?: string[];
  };

  if (!category || !["SNACK", "DRINK"].includes(category) || !name || price == null) {
    return NextResponse.json({ error: "Catégorie, nom et prix sont requis." }, { status: 400 });
  }

  const priceCents = parseEurosToCents(price);
  if (Number.isNaN(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      category,
      name,
      photoUrl: photoUrl || null,
      price: priceCents,
      stock: stock ? Math.round(Number(stock)) : 0,
      activities: activityKeys?.length
        ? { create: activityKeys.map((key) => ({ activityKey: key })) }
        : undefined,
    },
    include: { activities: true },
  });

  return NextResponse.json(product, { status: 201 });
}