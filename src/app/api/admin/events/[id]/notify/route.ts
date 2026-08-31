export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendNewEventNotification } from "@/lib/mail";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  }

  const allUsers = await prisma.user.findMany({
    where: { isActive: true, isPending: false },
    select: { firstName: true, email: true },
  });

  await Promise.all(
    allUsers.map((user) =>
      sendNewEventNotification({
        to: user.email,
        firstName: user.firstName,
        eventTitle: event.title,
        description: event.description,
        startsAt: event.startsAt,
        location: event.location,
      })
    )
  );

  return NextResponse.json({ sent: allUsers.length });
}
