export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRegistrationModificationToAdmin } from "@/lib/mail";

const GENERIC_MEAL_KEY = "__generic__";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id }, include: { menus: true } });
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, name: true, email: true },
  });

  if (user) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
    let detailsHtml: string;
    if (!wantsMeal) {
      detailsHtml = `<p style="color:#888;">Le membre ne souhaite plus de repas.</p>`;
    } else {
      const lines: string[] = [`<li>Repas : oui (${event.mealPrice}€)</li>`];
      for (const order of mealOrders) {
        const menu = event.menus.find((m) => m.id === order.menuId);
        const label = menu ? menu.label : "Sans menu précisé";
        const qty = order.quantity > 1 ? `${order.quantity}× ` : "";
        lines.push(`<li>${qty}${label}</li>`);
      }
      if (mealNotes) lines.push(`<li>Notes : ${mealNotes}</li>`);
      detailsHtml = `<ul style="margin:8px 0;padding-left:20px;">${lines.join("")}</ul>`;
    }

    await sendRegistrationModificationToAdmin({
      memberName: `${user.firstName} ${user.name}`,
      memberEmail: user.email,
      eventTitle: event.title,
      startsAt: event.startsAt,
      location: event.location,
      modificationType: "repas",
      detailsHtml,
      eventUrl: `${baseUrl}/calendar?event=${event.id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
