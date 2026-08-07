export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId: params.id },
    include: {
      user: { select: { firstName: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    registrations.map((r) => ({
      id: r.id,
      status: r.status,
      wantsMeal: r.wantsMeal,
      isTrialDay: r.isTrialDay,
      isPaid: r.isPaid,
      createdAt: r.createdAt,
      memberName: `${r.user.firstName} ${r.user.name}`,
      memberEmail: r.user.email,
    }))
  );
}