import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MEAL_PRICE } from "@/lib/meals";
import { sendNewEventNotification } from "@/lib/mail";

type MenuInput = { label: string; maxPerPerson?: number | string | null };

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: {
      registrations: { include: { mealOrders: true, rentals: { include: { equipment: true } } } },
      menus: true,
      boardGames: true,
    },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "events"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description,
    activityType,
    location,
    startsAt,
    endsAt,
    capacity,
    hasMeal,
    mealInfo,
    mealExtras,
    mealPrice,
    menus,
    registrationDeadline,
    boardGameIds,
  } = body as {
    title?: string;
    description?: string;
    activityType?: string;
    location?: string;
    startsAt?: string;
    endsAt?: string;
    capacity?: string | number | null;
    hasMeal?: boolean;
    mealInfo?: string;
    mealExtras?: string[];
    mealPrice?: string | number | null;
    menus?: MenuInput[];
    registrationDeadline?: string | null;
    boardGameIds?: string[];
  };

  if (!title || !description || !location || !startsAt || !endsAt) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const cleanedMenus = (menus ?? [])
    .map((m) => ({
      label: m.label.trim(),
      maxPerPerson: m.maxPerPerson ? Number(m.maxPerPerson) : null,
    }))
    .filter((m) => m.label);

  const event = await prisma.event.create({
    data: {
      title,
      description,
      activityType: activityType ?? "AUTRE",
      location,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      capacity: capacity ? Number(capacity) : null,
      hasMeal: !!hasMeal,
      mealInfo: hasMeal ? mealInfo || null : null,
      mealExtras: hasMeal && Array.isArray(mealExtras) ? mealExtras.join(",") : "",
      mealPrice: mealPrice ? Number(mealPrice) : MEAL_PRICE,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      menus: hasMeal && cleanedMenus.length > 0 ? { create: cleanedMenus } : undefined,
      boardGames:
        activityType === "JEUX_DE_PLATEAU" && Array.isArray(boardGameIds) && boardGameIds.length > 0
          ? { connect: boardGameIds.map((id) => ({ id })) }
          : undefined,
    },
    include: { menus: true, boardGames: true },
  });

  if (event.activityType !== "AUTRE") {
    const activityField =
      event.activityType === "JEUX_DE_PLATEAU"
        ? "wantsBoardGames"
        : event.activityType === "JEUX_DE_ROLE"
          ? "wantsRolePlay"
          : "wantsAirsoft";

    const currentYear = new Date().getFullYear();
    const interestedMembers = await prisma.user.findMany({
      where: { membership: { year: currentYear, [activityField]: true } },
      select: { firstName: true, email: true },
    });

    await Promise.all(
      interestedMembers.map((member) =>
        sendNewEventNotification({
          to: member.email,
          firstName: member.firstName,
          eventTitle: event.title,
          description: event.description,
          startsAt: event.startsAt,
          location: event.location,
        })
      )
    );
  }

  return NextResponse.json(event, { status: 201 });
}
