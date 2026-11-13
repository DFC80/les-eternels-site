export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MEAL_PRICE } from "@/lib/meals";

type MenuInput = { id?: string; label: string; maxPerPerson?: number | string | null; showQuantity?: boolean; extraPrice?: number | string | null; stock?: number | string | null; catalogId?: string | null };
type DrinkInput = { id?: string; label: string; maxPerPerson?: number | string | null; stock?: number | string | null; catalogId?: string | null };

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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

  const cleanedMenus = (menus ?? [])
    .map((m) => ({
      id: m.id || undefined,
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
      id: d.id || undefined,
      label: d.label.trim(),
      maxPerPerson: d.maxPerPerson ? Number(d.maxPerPerson) : null,
      stock: d.stock != null && d.stock !== "" ? Number(d.stock) : null,
      catalogId: d.catalogId ?? null,
    }))
    .filter((d) => d.label);

  if (hasMeal) {
    // Only delete menus that were removed; keep existing ones so MealOrderItem.menuId stays intact.
    const keptIds = cleanedMenus.filter((m) => m.id).map((m) => m.id as string);
    await prisma.mealMenu.deleteMany({
      where: { eventId: params.id, id: { notIn: keptIds } },
    });
    for (const m of cleanedMenus) {
      if (m.id) {
        await prisma.mealMenu.update({
          where: { id: m.id },
          data: { label: m.label, maxPerPerson: m.maxPerPerson, showQuantity: m.showQuantity, extraPrice: m.extraPrice, stock: m.stock, catalogId: m.catalogId },
        });
      } else {
        await prisma.mealMenu.create({
          data: { eventId: params.id, label: m.label, maxPerPerson: m.maxPerPerson, showQuantity: m.showQuantity, extraPrice: m.extraPrice, stock: m.stock, catalogId: m.catalogId },
        });
      }
    }
  } else {
    await prisma.mealMenu.deleteMany({ where: { eventId: params.id } });
  }

  if (hasDrinks) {
    const keptDrinkIds = cleanedDrinks.filter((d) => d.id).map((d) => d.id as string);
    await prisma.eventDrink.deleteMany({
      where: { eventId: params.id, id: { notIn: keptDrinkIds } },
    });
    for (const d of cleanedDrinks) {
      if (d.id) {
        await prisma.eventDrink.update({
          where: { id: d.id },
          data: { label: d.label, maxPerPerson: d.maxPerPerson, stock: d.stock, catalogId: d.catalogId },
        });
      } else {
        await prisma.eventDrink.create({
          data: { eventId: params.id, label: d.label, maxPerPerson: d.maxPerPerson, stock: d.stock, catalogId: d.catalogId },
        });
      }
    }
  } else {
    await prisma.eventDrink.deleteMany({ where: { eventId: params.id } });
  }

  const event = await prisma.event.update({
    where: { id: params.id },
    data: {
      title,
      description,
      activityType,
      location,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      capacity: capacity ? Number(capacity) : null,
      hasMeal: !!hasMeal,
      mealInfo: hasMeal ? mealInfo || null : null,
      mealExtras: hasMeal && Array.isArray(mealExtras) ? mealExtras.join(",") : "",
      mealPrice: mealPrice ? Number(mealPrice) : MEAL_PRICE,
      hasDrinks: !!hasDrinks,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      boardGames: {
        set: activityType === "JEUX_DE_PLATEAU" && Array.isArray(boardGameIds) ? boardGameIds.map((id) => ({ id })) : [],
      },
    },
    include: { menus: true, drinks: true, boardGames: true },
  });

  return NextResponse.json(event);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = (await request.json()) as { showOnHome?: boolean; showOnCalendar?: boolean };
  const data: { showOnHome?: boolean; showOnCalendar?: boolean } = {};
  if ("showOnHome" in body) data.showOnHome = !!body.showOnHome;
  if ("showOnCalendar" in body) data.showOnCalendar = !!body.showOnCalendar;
  const event = await prisma.event.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(event);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.event.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
