export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const registrations = await prisma.eventRegistration.findMany({
    include: {
      user: { select: { id: true, firstName: true, name: true, email: true } },
      event: { select: { id: true, title: true, startsAt: true, activityType: true } },
    },
    orderBy: { event: { startsAt: "desc" } },
  });

  // Group by user
  const byUser = new Map<string, {
    userId: string;
    firstName: string;
    name: string;
    email: string;
    registrations: {
      id: string;
      eventId: string;
      eventTitle: string;
      eventStartsAt: string;
      activityType: string;
      status: string;
      wantsMeal: boolean;
      isTrialDay: boolean;
      isPaid: boolean;
      createdAt: string;
    }[];
  }>();

  for (const r of registrations) {
    const uid = r.user.id;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        userId: uid,
        firstName: r.user.firstName,
        name: r.user.name,
        email: r.user.email,
        registrations: [],
      });
    }
    byUser.get(uid)!.registrations.push({
      id: r.id,
      eventId: r.event.id,
      eventTitle: r.event.title,
      eventStartsAt: r.event.startsAt.toISOString(),
      activityType: r.event.activityType,
      status: r.status,
      wantsMeal: r.wantsMeal,
      isTrialDay: r.isTrialDay,
      isPaid: r.isPaid,
      createdAt: r.createdAt.toISOString(),
    });
  }

  const result = [...byUser.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr") || a.firstName.localeCompare(b.firstName, "fr")
  );

  return NextResponse.json(result);
}
