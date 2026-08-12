export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendEventFeesRecapEmail } from "@/lib/mail";
import { getSiteUrl } from "@/lib/stripe";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { status, isFree } = body as { status?: string; isFree?: boolean };

  if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const rental = await prisma.equipmentRental.update({
    where: { id: params.id },
    data: {
      ...(status ? { status } : {}),
      ...(isFree !== undefined ? { isFree } : {}),
    },
  });

  // Quand la dernière location en attente vient d'être traitée, envoyer au membre
  // le récapitulatif définitif des frais avec le lien de paiement.
  if (status && status !== "PENDING") {
    const registration = await prisma.eventRegistration.findUnique({
      where: { id: rental.registrationId },
      include: {
        user: { select: { firstName: true, email: true } },
        event: { select: { title: true, startsAt: true, location: true, mealPrice: true, hasMeal: true } },
        rentals: { include: { equipment: { select: { name: true, rentalCost: true } } } },
      },
    });

    const allDecided = registration && !registration.rentals.some((r) => r.status === "PENDING");
    if (registration && allDecided && registration.status !== "REJECTED" && !registration.isPaid) {
      const approvedEquipment = registration.rentals
        .filter((r) => r.status === "APPROVED")
        .map((r) => ({
          name: r.equipment.name,
          rentalCost: r.equipment.rentalCost,
          quantity: r.quantity ?? 1,
          isFree: r.isFree,
        }));

      await sendEventFeesRecapEmail({
        to: registration.user.email,
        firstName: registration.user.firstName,
        eventTitle: registration.event.title,
        startsAt: registration.event.startsAt,
        location: registration.event.location,
        wantsMeal: registration.event.hasMeal && registration.wantsMeal,
        mealPrice: registration.event.mealPrice,
        participationFee: registration.participationFee,
        equipment: approvedEquipment,
        eventUrl: `${getSiteUrl()}/calendar`,
      }).catch(() => {});
    }
  }

  return NextResponse.json(rental);
}
