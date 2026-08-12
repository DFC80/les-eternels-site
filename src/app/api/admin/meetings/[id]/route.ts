export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "reunions")) {
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

  const existing = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const meetingDate = new Date(date);
  let linkedEventId = existing.linkedEventId;

  const bureauTitle = `Réunion de bureau — ${meetingDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`;
  const agTitle = `Assemblée Générale ${meetingDate.getFullYear()}`;

  if (type === "ASSEMBLEE_GENERALE" && !linkedEventId) {
    const event = await prisma.event.create({
      data: {
        title: agTitle,
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
  } else if (type === "ASSEMBLEE_GENERALE" && linkedEventId) {
    await prisma.event.update({
      where: { id: linkedEventId },
      data: {
        title: agTitle,
        description: agenda || "Assemblée générale annuelle de l'association Les Éternels.",
        location: location || "",
        startsAt: meetingDate,
        endsAt: new Date(meetingDate.getTime() + 3 * 60 * 60 * 1000),
        bureauOnly: false,
      },
    });
  } else if (type === "BUREAU" && !linkedEventId) {
    const event = await prisma.event.create({
      data: {
        title: bureauTitle,
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
  } else if (type === "BUREAU" && linkedEventId) {
    await prisma.event.update({
      where: { id: linkedEventId },
      data: {
        title: bureauTitle,
        description: agenda || "Réunion interne du bureau de l'association.",
        location: location || "",
        startsAt: meetingDate,
        endsAt: new Date(meetingDate.getTime() + 3 * 60 * 60 * 1000),
        bureauOnly: true,
      },
    });
  }

  const meeting = await prisma.meeting.update({
    where: { id: params.id },
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

  return NextResponse.json(meeting);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (meeting?.linkedEventId) {
    await prisma.event.delete({ where: { id: meeting.linkedEventId } }).catch(() => null);
  }

  await prisma.meeting.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
