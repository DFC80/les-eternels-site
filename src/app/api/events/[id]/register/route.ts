export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEventRegistrationConfirmation, sendNewEventRegistrationToAdmin } from "@/lib/mail";
import { currentSeasonYear, nextSeasonYear } from "@/lib/membership";

type MealOrderInput = { menuId?: string | null; quantity: number };

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { registrations: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  }

  if (new Date(event.startsAt) < new Date()) {
    return NextResponse.json({ error: "Cet événement est déjà passé." }, { status: 400 });
  }

  if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) {
    return NextResponse.json({ error: "La date limite d'inscription est dépassée." }, { status: 400 });
  }

  if (event.registrations.some((r) => r.userId === session.user.id)) {
    return NextResponse.json({ error: "Vous êtes déjà inscrit à cet événement." }, { status: 400 });
  }

  if (event.capacity != null && event.registrations.length >= event.capacity) {
    return NextResponse.json({ error: "Cet événement est complet." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const participationFee: number = event.activityType === "AIRSOFT" && body.participationFee === 500 ? 500 : 0;
  const wantsMeal = !!body.wantsMeal && event.hasMeal;
  const mealNotes = wantsMeal ? body.mealNotes || null : null;
  const mealOrders: MealOrderInput[] = wantsMeal && Array.isArray(body.mealOrders) ? body.mealOrders : [];
  type EquipmentSelection = { id: string; quantity: number };
  const equipmentSelections: EquipmentSelection[] =
    event.activityType === "AIRSOFT" && Array.isArray(body.equipmentSelections)
      ? (body.equipmentSelections as EquipmentSelection[]).filter((s) => s.id && s.quantity > 0)
      : [];

  // Vérification de l'adhésion selon le type d'activité
  let isTrialDay = false;
  if (event.activityType !== "AUTRE") {
    const membership = await prisma.membership.findUnique({
      where: { userId: session.user.id },
      include: { extraActivities: true },
    });
    const isNextSeason = membership?.year === nextSeasonYear();
    if (isNextSeason) {
      const nextSeasonStart = new Date(nextSeasonYear(), 8, 1); // 1er septembre
      const daysUntil = (nextSeasonStart.getTime() - new Date(event.startsAt).getTime()) / 86400000;
      if (daysUntil > 70) {
        const earliest = new Date(nextSeasonStart.getTime() - 70 * 86400000);
        const fmt = earliest.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        return NextResponse.json(
          { error: `Votre adhésion ${nextSeasonYear()}-${nextSeasonYear() + 1} ne sera utilisable que pour les événements à partir du ${fmt}.` },
          { status: 403 }
        );
      }
    }
    const validMembership = membership && (membership.year === currentSeasonYear() || isNextSeason);
    let covered = false;
    if (validMembership) {
      if (event.activityType === "JEUX_DE_PLATEAU") covered = membership.wantsBoardGames;
      else if (event.activityType === "JEUX_DE_ROLE") covered = membership.wantsRolePlay;
      else if (event.activityType === "AIRSOFT") covered = membership.wantsAirsoft;
      else covered = membership.extraActivities.some((a) => a.activityKey === event.activityType);
    }

    // Airsoft : journée d'essai (gratuit, pas de cotisation requise)
    if (!covered && event.activityType === "AIRSOFT") {
      const userRecord = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { airsoftTrialDay: true },
      });
      if (userRecord?.airsoftTrialDay) {
        covered = true;
        isTrialDay = true;
      }
    }

    // Airsoft : participation invité (5€) acceptée en remplacement de la cotisation
    if (!covered && event.activityType === "AIRSOFT" && participationFee === 500) {
      covered = true;
    }

    if (!covered) {
      return NextResponse.json(
        { error: "Vous devez avoir une cotisation en cours pour cette activité afin de vous inscrire." },
        { status: 403 }
      );
    }
  }

  // Expand equipment selections to include associated items automatically
  let allRentals: { equipmentId: string; quantity: number }[] = [];
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
    allRentals = Array.from(rentalMap.entries()).map(([equipmentId, quantity]) => ({ equipmentId, quantity }));
  }

  const registration = await prisma.eventRegistration.create({
    data: {
      userId: session.user.id,
      eventId: event.id,
      wantsMeal,
      mealNotes,
      participationFee,
      isTrialDay,
      status: "APPROVED",
      mealOrders: mealOrders.length > 0
        ? {
            create: mealOrders
              .filter((o) => o.quantity > 0)
              .map((o) => ({ menuId: o.menuId || null, quantity: o.quantity })),
          }
        : undefined,
      rentals: allRentals.length > 0
        ? { create: allRentals }
        : undefined,
    },
  });

  const allRentalIds = allRentals.map((r) => r.equipmentId);
  const [user, equipmentRecords] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    allRentalIds.length > 0
      ? prisma.equipment.findMany({ where: { id: { in: allRentalIds } }, select: { id: true, name: true, rentalCost: true } })
      : Promise.resolve([]),
  ]);

  // Récap email : tous les équipements loués (sélectionnés + associés automatiques)
  const equipmentList = equipmentRecords.map((eq) => ({
    name: eq.name,
    rentalCost: eq.rentalCost,
    quantity: allRentals.find((r) => r.equipmentId === eq.id)?.quantity ?? 1,
  }));

  if (user) {
    await Promise.all([
      sendEventRegistrationConfirmation({
        to: user.email,
        firstName: user.firstName,
        eventTitle: event.title,
        startsAt: event.startsAt,
        location: event.location,
        wantsMeal,
        mealPrice: event.mealPrice,
        participationFee,
        equipment: equipmentList,
      }),
      sendNewEventRegistrationToAdmin({
        memberName: `${user.firstName} ${user.name}`,
        memberEmail: user.email,
        eventTitle: event.title,
        startsAt: event.startsAt,
        location: event.location,
        wantsMeal,
        mealPrice: event.mealPrice,
        participationFee,
        equipment: equipmentList,
      }),
    ]);
  }

  return NextResponse.json(registration, { status: 201 });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  await prisma.eventRegistration.deleteMany({
    where: { eventId: params.id, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
