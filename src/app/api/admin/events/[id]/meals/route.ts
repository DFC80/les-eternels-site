import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "events"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: {
      menus: true,
      registrations: {
        where: { wantsMeal: true },
        include: { user: true, mealOrders: { include: { menu: true } } },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  }

  const totalPeople = event.registrations.length;
  const totalAmount = totalPeople * event.mealPrice;

  const byMenu = event.menus.map((menu) => ({
    menuId: menu.id,
    label: menu.label,
    count: event.registrations.reduce(
      (sum, r) => sum + r.mealOrders.filter((o) => o.menuId === menu.id).reduce((s, o) => s + o.quantity, 0),
      0
    ),
  }));

  const withoutMenu = event.registrations.reduce(
    (sum, r) => sum + r.mealOrders.filter((o) => !o.menuId).reduce((s, o) => s + o.quantity, 0),
    0
  );

  const totalItems = byMenu.reduce((sum, m) => sum + m.count, 0) + withoutMenu;

  const diners = event.registrations.map((r) => ({
    name: `${r.user.firstName} ${r.user.name}`,
    items: r.mealOrders.map((o) => ({
      label: o.menu?.label ?? "Repas",
      quantity: o.quantity,
    })),
    notes: r.mealNotes,
  }));

  return NextResponse.json({
    eventTitle: event.title,
    mealPrice: event.mealPrice,
    totalPeople,
    totalItems,
    totalAmount,
    byMenu,
    withoutMenu,
    diners,
  });
}