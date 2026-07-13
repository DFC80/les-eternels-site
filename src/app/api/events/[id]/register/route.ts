import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEventRegistrationConfirmation, sendNewEventRegistrationToAdmin } from "@/lib/mail";

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

  // Vérification de l'adhésion selon le type d'activité
  if (event.activityType !== "AUTRE") {
    const activityDef = await prisma.activity.findUnique({ where: { key: event.activityType } });
    const membershipRequired = activityDef?.membershipRequired ?? false;

    if (membershipRequired) {
      const currentYear = new Date().getFullYear();
      const membership = await prisma.membership.findUnique({
        where: { userId: session.user.id },
        include: { extraActivities: true },
      });
      const validMembership = membership && membership.year === currentYear;
      let covered = false;
      if (validMembership) {
        if (event.activityType === "JEUX_DE_PLATEAU") covered = membership.wantsBoardGames;
        else if (event.activityType === "JEUX_DE_ROLE") covered = membership.wantsRolePlay;
        else if (event.activityType === "AIRSOFT") covered = membership.wantsAirsoft;
        else covered = membership.extraActivities.some((a) => a.activityKey === event.activityType);
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
  }

  const body = await request.json().catch(() => ({}));
  const participationFee: number = event.activityType === "AIRSOFT" && body.participationFee === 500 ? 500 : 0;
  const wantsMeal = !!body.wantsMeal && event.hasMeal;
  const mealNotes = wantsMeal ? body.mealNotes || null : null;
  const mealOrders: MealOrderInput[] = wantsMeal && Array.isArray(body.mealOrders) ? body.mealOrders : [];
  const equipmentIds: string[] = event.activityType === "AIRSOFT" && Array.isArray(body.equipmentIds) ? body.equipmentIds : [];

  const registration = await prisma.eventRegistration.create({
    data: {
      userId: session.user.id,
      eventId: event.id,
      wantsMeal,
      mealNotes,
      participationFee,
      mealOrders: mealOrders.length > 0
        ? {
            create: mealOrders
              .filter((o) => o.quantity > 0)
              .map((o) => ({ menuId: o.menuId || null, quantity: o.quantity })),
          }
        : undefined,
      rentals: equipmentIds.length > 0
        ? { create: equipmentIds.map((equipmentId) => ({ equipmentId })) }
        : undefined,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user) {
    await Promise.all([
      sendEventRegistrationConfirmation({
        to: user.email,
        firstName: user.firstName,
        eventTitle: event.title,
        startsAt: event.startsAt,
        location: event.location,
      }),
      sendNewEventRegistrationToAdmin({
        memberName: `${user.firstName} ${user.name}`,
        memberEmail: user.email,
        eventTitle: event.title,
        startsAt: event.startsAt,
        location: event.location,
        wantsMeal,
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
