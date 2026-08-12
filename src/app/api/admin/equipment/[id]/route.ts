export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["DISPONIBLE", "HORS_SERVICE", "INDISPONIBLE"];

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "equipements")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { category, name, photos, status, rentalCost, stock, fps, bbWeight, propulsion, info, magazineCapacity } = body as {
    category?: string;
    name?: string;
    photos?: string;
    status?: string;
    rentalCost?: string | number;
    stock?: string | number;
    fps?: string | number | null;
    bbWeight?: string | number | null;
    propulsion?: string | null;
    info?: string;
    magazineCapacity?: string | number | null;
  };

  if (!category) return NextResponse.json({ error: "Catégorie requise." }, { status: 400 });
  const validCat = await prisma.equipmentCategory.findUnique({ where: { key: category } });
  if (!validCat) return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  if (!name || rentalCost === undefined || rentalCost === null || rentalCost === "") {
    return NextResponse.json({ error: "Nom et coût de location requis." }, { status: 400 });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const equipment = await prisma.equipment.update({
    where: { id: params.id },
    data: {
      category,
      name,
      photos: photos || null,
      status: status || "DISPONIBLE",
      rentalCost: Math.round(Number(rentalCost)),
      stock: stock ? Math.max(1, Math.round(Number(stock))) : 1,
      fps: fps ? Math.round(Number(fps)) : null,
      bbWeight: bbWeight ? Number(bbWeight) : null,
      propulsion: propulsion || null,
      info: info || null,
      magazineCapacity: magazineCapacity ? Math.round(Number(magazineCapacity)) : null,
    },
  });

  return NextResponse.json(equipment);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "equipements")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.equipment.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}