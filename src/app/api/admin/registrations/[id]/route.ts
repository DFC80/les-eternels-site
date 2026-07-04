import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendEventRegistrationApproved, sendEventRegistrationRejected } from "@/lib/mail";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "events"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { status } = body as { status: "APPROVED" | "REJECTED" };

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const registration = await prisma.eventRegistration.update({
    where: { id: params.id },
    data: { status },
    include: {
      user: { select: { firstName: true, email: true } },
      event: { select: { title: true, startsAt: true, location: true } },
    },
  });

  if (status === "APPROVED") {
    await sendEventRegistrationApproved({
      to: registration.user.email,
      firstName: registration.user.firstName,
      eventTitle: registration.event.title,
      startsAt: registration.event.startsAt,
      location: registration.event.location,
    });
  } else {
    await sendEventRegistrationRejected({
      to: registration.user.email,
      firstName: registration.user.firstName,
      eventTitle: registration.event.title,
    });
  }

  return NextResponse.json(registration);
}