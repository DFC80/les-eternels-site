export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendBureauMeetingNotification } from "@/lib/mail";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "reunions")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!meeting) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (meeting.type !== "BUREAU") {
    return NextResponse.json({ error: "Uniquement pour les réunions de bureau." }, { status: 400 });
  }

  const bureauUsers = await prisma.user.findMany({
    where: { bureauRoles: { some: {} }, isActive: true },
    select: { email: true, firstName: true },
  });

  if (bureauUsers.length === 0) {
    return NextResponse.json({ error: "Aucun membre du bureau trouvé." }, { status: 404 });
  }

  await sendBureauMeetingNotification({
    recipients: bureauUsers,
    date: meeting.date,
    location: meeting.location,
    agenda: meeting.agenda,
  });

  return NextResponse.json({ sent: bureauUsers.length });
}
