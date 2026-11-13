export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MEAL_PRICE } from "@/lib/meals";

type MenuInput = { label: string; maxPerPerson?: number | string | null; showQuantity?: boolean; extraPrice?: number | string | null; stock?: number | string | null; catalogId?: string | null };
type DrinkInput = { label: string; maxPerPerson?: number | string | null; stock?: number | string | null; catalogId?: string | null };

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
      drinks: true,
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
    hasDrinks,
    drinks,
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
    hasDrinks?: boolean;
    drinks?: DrinkInput[];
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
      showQuantity: m.showQuantity !== false,
      extraPrice: m.extraPrice != null && m.extraPrice !== "" ? Math.round(Number(m.extraPrice)) : null,
      stock: m.stock != null && m.stock !== "" ? Number(m.stock) : null,
      catalogId: m.catalogId ?? null,
    }))
    .filter((m) => m.label);

  const cleanedDrinks = (drinks ?? [])
    .map((d) => ({
      label: d.label.trim(),
      maxPerPerson: d.maxPerPerson ? Number(d.maxPerPerson) : null,
      stock: d.stock != null && d.stock !== "" ? Number(d.stock) : null,
      catalogId: d.catalogId ?? null,
    }))
    .filter((d) => d.label);

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
      hasDrinks: !!hasDrinks,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      menus: hasMeal && cleanedMenus.length > 0 ? { create: cleanedMenus } : undefined,
      drinks: hasDrinks && cleanedDrinks.length > 0 ? { create: cleanedDrinks } : undefined,
      boardGames:
        activityType === "JEUX_DE_PLATEAU" && Array.isArray(boardGameIds) && boardGameIds.length > 0
          ? { connect: boardGameIds.map((id) => ({ id })) }
          : undefined,
    },
    include: { menus: true, drinks: true, boardGames: true },
  });

  return NextResponse.json(event, { status: 201 });
}
