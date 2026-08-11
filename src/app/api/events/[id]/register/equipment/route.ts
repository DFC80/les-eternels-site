export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  if (new Date(event.startsAt) < new Date()) {
    return NextResponse.json({ error: "Cet événement est déjà passé." }, { status: 400 });
  }
  if (event.activityType !== "AIRSOFT") {
    return NextResponse.json({ error: "Modification de matériel uniquement pour les événements airsoft." }, { status: 400 });
  }

  const registration = await prisma.eventRegistration.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId: params.id } },
  });
  if (!registration) {
    return NextResponse.json({ error: "Vous n'êtes pas inscrit à cet événement." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  type EquipmentSelection = { id: string; quantity: number };
  const equipmentSelections: EquipmentSelection[] = Array.isArray(body.equipmentSelections)
    ? (body.equipmentSelections as EquipmentSelection[]).filter((s) => s.id && s.quantity > 0)
    : [];

  // Expand to include auto-added associated items
  let allRentals: { equipmentId: string; quantity: number; isFree: boolean; status: string }[] = [];
  if (equipmentSelections.length > 0) {
    const selectedWithAssocs = await prisma.equipment.findMany({
      where: { id: { in: equipmentSelections.map((s) => s.id) } },
      include: { associations: true },
    });

    const rentalMap = new Map<string, number>();
    for (const sel of equipmentSelections) {
      const qty = Math.max(1, Number(sel.quantity));
      rentalMap.set(sel.id, (rentalMap.get(sel.id) ?? 0) + qty);
      const equip = selectedWithAssocs.find((e) => e.id === sel.id);
      if (equip) {
        for (const assoc of equip.associations) {
          rentalMap.set(assoc.itemId, (rentalMap.get(assoc.itemId) ?? 0) + assoc.quantity * qty);
        }
      }
    }
    const selectedIds = new Set(equipmentSelections.map((s) => s.id));
    allRentals = Array.from(rentalMap.entries()).map(([equipmentId, quantity]) => ({
      equipmentId,
      quantity,
      isFree: !selectedIds.has(equipmentId),
      status: "PENDING",
    }));
  }

  // Validate stock — exclude the current user's own rentals from the taken count
  if (allRentals.length > 0) {
    const itemIds = allRentals.map((r) => r.equipmentId);
    const [equipmentStocks, rentedByOthers] = await Promise.all([
      prisma.equipment.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true, stock: true } }),
      prisma.equipmentRental.groupBy({
        by: ["equipmentId"],
        where: {
          equipmentId: { in: itemIds },
          status: { not: "REJECTED" },
          registration: { eventId: params.id },
          registrationId: { not: registration.id },
        },
        _sum: { quantity: true },
      }),
    ]);
    const rentedMap = new Map(rentedByOthers.map((r) => [r.equipmentId, r._sum.quantity ?? 0]));
    for (const rental of allRentals) {
      const eq = equipmentStocks.find((e) => e.id === rental.equipmentId);
      if (!eq) continue;
      const available = Math.max(0, (eq.stock ?? 1) - (rentedMap.get(rental.equipmentId) ?? 0));
      if (rental.quantity > available) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${eq.name}" (disponible : ${available}, demandé : ${rental.quantity}).` },
          { status: 409 }
        );
      }
    }
  }

  // Replace all rentals
  await prisma.equipmentRental.deleteMany({ where: { registrationId: registration.id } });
  if (allRentals.length > 0) {
    await prisma.equipmentRental.createMany({
      data: allRentals.map((r) => ({ ...r, registrationId: registration.id })),
    });
  }

  return NextResponse.json({ ok: true });
}
