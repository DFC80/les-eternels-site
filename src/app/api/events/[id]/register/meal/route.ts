import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GENERIC_MEAL_KEY = "__generic__";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  }

  if (new Date(event.startsAt) < new Date()) {
    return NextResponse.json({ error: "Cet événement est déjà passé." }, { status: 400 });
  }

  const registration = await prisma.eventRegistration.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId: params.id } },
  });

  if (!registration) {
    return NextResponse.json({ error: "Vous n'êtes pas inscrit à cet événement." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const wantsMeal = !!body.wantsMeal && event.hasMeal;
  const mealNotes = wantsMeal ? (body.mealNotes as string | null) || null : null;
  const rawOrders: { menuId: string | null; quantity: number }[] =
    wantsMeal && Array.isArray(body.mealOrders) ? body.mealOrders : [];
  const mealOrders = rawOrders
    .filter((o) => o.quantity > 0)
    .map((o) => ({ menuId: o.menuId === GENERIC_MEAL_KEY ? null : o.menuId, quantity: o.quantity }));

  await prisma.mealOrderItem.deleteMany({ where: { registrationId: registration.id } });

  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: {
      wantsMeal,
      mealNotes,
      ...(mealOrders.length > 0 && { mealOrders: { create: mealOrders } }),
    },
  });

  return NextResponse.json({ ok: true });
}
