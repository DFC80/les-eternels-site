export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseEurosToCents } from "@/lib/money";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "produits")) return null;
  return session;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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

  if (category && !["SNACK", "DRINK"].includes(category)) {
    return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  }

  let priceCents: number | undefined;
  if (price != null) {
    priceCents = parseEurosToCents(price);
    if (Number.isNaN(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
    }
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...(category ? { category } : {}),
      ...(name ? { name } : {}),
      photoUrl: photoUrl || null,
      ...(priceCents != null ? { price: priceCents } : {}),
      ...(stock != null ? { stock: Math.round(Number(stock)) } : {}),
      ...(activityKeys !== undefined && {
        activities: {
          deleteMany: {},
          create: activityKeys.map((key) => ({ activityKey: key })),
        },
      }),
    },
    include: { activities: true },
  });

  return NextResponse.json(product);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await prisma.product.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}