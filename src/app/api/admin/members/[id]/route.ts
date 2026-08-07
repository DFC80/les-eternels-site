export const dynamic = "force-dynamic";
﻿import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendAccountValidatedEmail, sendAirsoftTrialDayEmail, sendAirsoftTrialDayUsedEmail } from "@/lib/mail";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "members")) return null;
  return session;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "members")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const member = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      firstName: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      airsoftTrialDay: true,
      createdAt: true,
      dateOfBirth: true,
      phone: true,
      addressStreet: true,
      addressCity: true,
      addressPostalCode: true,
      gender: true,
      emergencyContactFirstName: true,
      emergencyContactLastName: true,
      emergencyContactPhone: true,
      bureauRoles: { select: { bureauRole: { select: { id: true, label: true, order: true } } } },
      membership: {
        select: {
          year: true,
          wantsBoardGames: true,
          wantsRolePlay: true,
          wantsAirsoft: true,
          amount: true,
          isPaid: true,
          extraActivities: { select: { activityKey: true } },
        },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    ...member,
    bureauRoles: member.bureauRoles.map((r) => r.bureauRole),
  });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { role, isActive, isPending, bureauRoleIds, airsoftTrialDay } = body as {
    role?: "ADMIN" | "MEMBER";
    isActive?: boolean;
    isPending?: boolean;
    bureauRoleIds?: string[];
    airsoftTrialDay?: boolean;
  };

  const updateData: Record<string, unknown> = {};
  if (role) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (isPending !== undefined) updateData.isPending = isPending;
  if (airsoftTrialDay !== undefined) updateData.airsoftTrialDay = airsoftTrialDay;

  if (bureauRoleIds !== undefined) {
    updateData.bureauRoles = {
      deleteMany: {},
      create: bureauRoleIds.map((id) => ({ bureauRoleId: id })),
    };
  }

  const before = await prisma.user.findUnique({ where: { id: params.id }, select: { isPending: true, firstName: true, email: true } });

  const member = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    include: { bureauRoles: { include: { bureauRole: true } } },
  });

  if (before?.isPending && isPending === false) {
    await sendAccountValidatedEmail({ to: member.email, firstName: member.firstName }).catch(() => {});
  }

  if (airsoftTrialDay === true) {
    await sendAirsoftTrialDayEmail({ to: member.email, firstName: member.firstName }).catch(() => {});
  }
  if (airsoftTrialDay === false) {
    await sendAirsoftTrialDayUsedEmail({ to: member.email, firstName: member.firstName }).catch(() => {});
  }

  return NextResponse.json({
    ...member,
    bureauRoles: member.bureauRoles.map((r) => r.bureauRole),
  });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } });
  if (target?.email === "admin@les-eternels.fr") {
    return NextResponse.json({ error: "Ce compte administrateur ne peut pas être supprimé." }, { status: 403 });
  }

  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
