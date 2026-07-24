import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      activityType: true,
      registrations: {
        include: { user: { select: { id: true, firstName: true, name: true, balance: true } } },
      },
    },
  });

  if (!event) return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });

  const members = event.registrations
    .map((r) => r.user)
    .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { activities: { none: {} } },
        { activities: { some: { activityKey: event.activityType } } },
      ],
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { activities: true },
  });

  return NextResponse.json({ members, products });
}
