export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendBureauMeetingNotification } from "@/lib/mail";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const meetings = await prisma.meeting.findMany({
    orderBy: { date: "desc" },
  });

  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { type, date, location, agenda, notes, isPublished } = body as {
    type?: string;
    date?: string;
    location?: string;
    agenda?: string;
    notes?: string;
    isPublished?: boolean;
  };

  if (!type || !["BUREAU", "ASSEMBLEE_GENERALE"].includes(type)) {
    return NextResponse.json({ error: "Type invalide." }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date requise." }, { status: 400 });
  }

  const meetingDate = new Date(date);

  let linkedEventId: string | null = null;

  if (type === "ASSEMBLEE_GENERALE") {
    const year = meetingDate.getFullYear();
    const event = await prisma.event.create({
      data: {
        title: `Assemblée Générale ${year}`,
        description: agenda || "Assemblée générale annuelle de l'association Les Éternels.",
        activityType: "AUTRE",
        location: location || "",
        startsAt: meetingDate,
        endsAt: new Date(meetingDate.getTime() + 3 * 60 * 60 * 1000),
        capacity: null,
        bureauOnly: false,
      },
    });
    linkedEventId = event.id;
  } else if (type === "BUREAU") {
    const event = await prisma.event.create({
      data: {
        title: `Réunion de bureau — ${meetingDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`,
        description: agenda || "Réunion interne du bureau de l'association.",
        activityType: "AUTRE",
        location: location || "",
        startsAt: meetingDate,
        endsAt: new Date(meetingDate.getTime() + 3 * 60 * 60 * 1000),
        capacity: null,
        bureauOnly: true,
      },
    });
    linkedEventId = event.id;
  }

  const meeting = await prisma.meeting.create({
    data: {
      type,
      date: meetingDate,
      location: location || "",
      agenda: agenda || null,
      notes: notes || null,
      isPublished: isPublished ?? false,
      linkedEventId,
    },
  });

  if (type === "BUREAU") {
    const bureauUsers = await prisma.user.findMany({
      where: { bureauRoles: { some: {} }, isActive: true },
      select: { email: true, firstName: true },
    });
    if (bureauUsers.length > 0) {
      sendBureauMeetingNotification({
        recipients: bureauUsers,
        date: meetingDate,
        location: location || "",
        agenda: agenda || null,
      }).catch((err) => console.error("[meeting] Erreur envoi emails bureau :", err));
    }
  }

  return NextResponse.json(meeting, { status: 201 });
}
