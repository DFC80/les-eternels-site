export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MEAL_PRICE } from "@/lib/meals";

type MenuInput = { label: string; maxPerPerson?: number | string | null; extraPrice?: number | string | null };

export async function GET() {
  const session = await getServerSession(authOptions);

  let isBureau = false;
  if (session?.user?.id) {
    const { isFullAdmin } = await import("@/lib/permissions");
    const role = (session.user as { role?: string }).role ?? "";
    if (isFullAdmin(role)) {
      isBureau = true;
    } else {
      const bureauRole = await prisma.userBureauRole.findFirst({ where: { userId: session.user.id } });
      isBureau = !!bureauRole;
    }
  }

  const events = await prisma.event.findMany({
    where: isBureau ? undefined : { bureauOnly: false, showOnCalendar: true },
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
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
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
      extraPrice: m.extraPrice != null && m.extraPrice !== "" ? Math.round(Number(m.extraPrice)) : null,
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

  return NextResponse.json(event, { status: 201 });
}
