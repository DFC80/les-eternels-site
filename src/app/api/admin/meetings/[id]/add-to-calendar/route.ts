export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!meeting) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (meeting.linkedEventId) {
    return NextResponse.json({ error: "Déjà ajouté au calendrier." }, { status: 400 });
  }

  const meetingDate = meeting.date;
  let linkedEventId: string;

  if (meeting.type === "ASSEMBLEE_GENERALE") {
    const year = meetingDate.getFullYear();
    const event = await prisma.event.create({
      data: {
        title: `Assemblée Générale ${year}`,
        description: meeting.agenda || "Assemblée générale annuelle de l'association Les Éternels.",
        activityType: "AUTRE",
        location: meeting.location,
        startsAt: meetingDate,
        endsAt: new Date(meetingDate.getTime() + 3 * 60 * 60 * 1000),
        capacity: null,
        bureauOnly: false,
      },
    });
    linkedEventId = event.id;
  } else {
    const event = await prisma.event.create({
      data: {
        title: `Réunion de bureau — ${meetingDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`,
        description: meeting.agenda || "Réunion interne du bureau de l'association.",
        activityType: "AUTRE",
        location: meeting.location,
        startsAt: meetingDate,
        endsAt: new Date(meetingDate.getTime() + 3 * 60 * 60 * 1000),
        capacity: null,
        bureauOnly: true,
      },
    });
    linkedEventId = event.id;
  }

  const updated = await prisma.meeting.update({
    where: { id: params.id },
    data: { linkedEventId },
  });

  return NextResponse.json(updated);
}
