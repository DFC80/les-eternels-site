import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "events"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const rentals = await prisma.equipmentRental.findMany({
    where: { registration: { eventId: params.id } },
    include: { equipment: true, registration: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    rentals.map((r) => ({
      id: r.id,
      status: r.status,
      isFree: r.isFree,
      memberName: `${r.registration.user.firstName} ${r.registration.user.name}`,
      equipment: { id: r.equipment.id, name: r.equipment.name, rentalCost: r.equipment.rentalCost },
    }))
  );
}