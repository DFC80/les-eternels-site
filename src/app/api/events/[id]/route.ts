export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { MEAL_PRICE } from "@/lib/meals";

type MenuInput = { id?: string; label: string; maxPerPerson?: number | string | null; extraPrice?: number | string | null };

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

  const cleanedMenus = (menus ?? [])
    .map((m) => ({
      id: m.id || undefined,
      label: m.label.trim(),
      maxPerPerson: m.maxPerPerson ? Number(m.maxPerPerson) : null,
      extraPrice: m.extraPrice != null && m.extraPrice !== "" ? Math.round(Number(m.extraPrice)) : null,
    }))
    .filter((m) => m.label);

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
          data: { label: m.label, maxPerPerson: m.maxPerPerson, extraPrice: m.extraPrice },
        });
      } else {
        await prisma.mealMenu.create({
          data: { eventId: params.id, label: m.label, maxPerPerson: m.maxPerPerson, extraPrice: m.extraPrice },
        });
      }
    }
  } else {
    await prisma.mealMenu.deleteMany({ where: { eventId: params.id } });
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
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      boardGames: {
        set: activityType === "JEUX_DE_PLATEAU" && Array.isArray(boardGameIds) ? boardGameIds.map((id) => ({ id })) : [],
      },
    },
    include: { menus: true, boardGames: true },
  });

  return NextResponse.json(event);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { showOnHome } = (await request.json()) as { showOnHome?: boolean };
  const event = await prisma.event.update({
    where: { id: params.id },
    data: { showOnHome: !!showOnHome },
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
