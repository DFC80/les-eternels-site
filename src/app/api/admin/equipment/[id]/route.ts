import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const VALID_CATEGORIES = ["REPLIQUE", "EQUIPEMENT"];
const VALID_STATUSES = ["DISPONIBLE", "HORS_SERVICE", "INDISPONIBLE"];

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "equipements"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { category, name, photos, status, rentalCost, magazineCount, info } = body as {
    category?: string;
    name?: string;
    photos?: string;
    status?: string;
    rentalCost?: string | number;
    magazineCount?: string | number | null;
    info?: string;
  };

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  }
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
      magazineCount: category === "REPLIQUE" && magazineCount ? Number(magazineCount) : null,
      info: info || null,
    },
  });

  return NextResponse.json(equipment);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "equipements"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.equipment.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}