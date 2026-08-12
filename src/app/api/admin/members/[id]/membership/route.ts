export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeMembershipAmount, currentSeasonYear, nextSeasonYear } from "@/lib/membership";
import { sendMembershipPaymentConfirmation } from "@/lib/mail";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "members")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const {
    year,
    wantsBoardGames = false,
    wantsRolePlay = false,
    wantsAirsoft = false,
    extraActivityKeys = [],
    isPaid = false,
  } = body as {
    year?: number;
    wantsBoardGames?: boolean;
    wantsRolePlay?: boolean;
    wantsAirsoft?: boolean;
    extraActivityKeys?: string[];
    isPaid?: boolean;
  };

  const currentYear = currentSeasonYear();
  const allowedYears = [currentYear, nextSeasonYear()];
  const targetYear = allowedYears.includes(Number(year)) ? Number(year) : currentYear;

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });

  const existing = await prisma.membership.findUnique({
    where: { userId: params.id },
    include: { extraActivities: true },
  });
  if (existing?.isPaid && existing.year === targetYear) {
    return NextResponse.json({ error: "Une cotisation réglée existe déjà pour cette saison." }, { status: 400 });
  }

  // Archiver la cotisation existante si on change de saison
  if (existing && existing.year !== targetYear) {
    await prisma.membershipHistory.create({
      data: {
        userId: existing.userId,
        year: existing.year,
        wantsBoardGames: existing.wantsBoardGames,
        wantsRolePlay: existing.wantsRolePlay,
        wantsAirsoft: existing.wantsAirsoft,
        amount: existing.amount,
        isPaid: existing.isPaid,
        paidAt: existing.paidAt,
        paidAmount: existing.paidAmount,
        activityKeys: JSON.stringify(existing.extraActivities.map((a) => a.activityKey)),
      },
    });
  }

  const coreKeys: string[] = [];
  if (wantsBoardGames) coreKeys.push("JEUX_DE_PLATEAU");
  if (wantsRolePlay) coreKeys.push("JEUX_DE_ROLE");
  if (wantsAirsoft) coreKeys.push("AIRSOFT");

  const allSelectedKeys = [...coreKeys, ...extraActivityKeys];
  if (allSelectedKeys.length === 0) {
    return NextResponse.json({ error: "Sélectionnez au moins une activité." }, { status: 400 });
  }

  const activityRecords = await prisma.activity.findMany({ where: { key: { in: allSelectedKeys } } });
  const priceMap = Object.fromEntries(activityRecords.map((a) => [a.key, a.price]));
  const amount = computeMembershipAmount(allSelectedKeys.map((k) => priceMap[k] ?? 0));

  const now = new Date();
  const membership = await prisma.membership.upsert({
    where: { userId: params.id },
    create: {
      userId: params.id,
      year: targetYear,
      wantsBoardGames: !!wantsBoardGames,
      wantsRolePlay: !!wantsRolePlay,
      wantsAirsoft: !!wantsAirsoft,
      amount,
      isPaid: !!isPaid,
      paidAt: isPaid ? now : null,
      paidAmount: isPaid ? amount : 0,
    },
    update: {
      year: targetYear,
      wantsBoardGames: !!wantsBoardGames,
      wantsRolePlay: !!wantsRolePlay,
      wantsAirsoft: !!wantsAirsoft,
      amount,
      isPaid: !!isPaid,
      paidAt: isPaid ? now : null,
      paidAmount: isPaid ? amount : 0,
    },
  });

  await prisma.membershipActivity.deleteMany({ where: { membershipId: membership.id } });
  if (extraActivityKeys.length > 0) {
    await prisma.membershipActivity.createMany({
      data: extraActivityKeys.map((key) => ({ membershipId: membership.id, activityKey: key })),
    });
  }

  if (isPaid) {
    await sendMembershipPaymentConfirmation({ to: user.email, firstName: user.firstName, year: targetYear, amount }).catch(() => {});
  }

  return NextResponse.json(membership);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "members")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { isPaid, validateSupplement } = body as { isPaid?: boolean; validateSupplement?: boolean };

  const membership = await prisma.membership.findUnique({ where: { userId: params.id } });
  if (!membership) {
    return NextResponse.json({ error: "Aucune adhésion trouvée pour ce membre." }, { status: 404 });
  }

  const now = new Date();
  const updateData: Record<string, unknown> = validateSupplement
    ? { paidAmount: membership.amount, paidAt: now }
    : {
        isPaid: !!isPaid,
        paidAt: isPaid ? now : null,
        paidAmount: isPaid ? membership.amount : 0,
      };

  const updated = await prisma.membership.update({
    where: { userId: params.id },
    data: updateData,
  });

  if (isPaid) {
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (user) {
      await sendMembershipPaymentConfirmation({
        to: user.email,
        firstName: user.firstName,
        year: updated.year,
        amount: updated.amount,
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "members")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const membership = await prisma.membership.findUnique({ where: { userId: params.id } });
  if (!membership) {
    return NextResponse.json({ error: "Aucune adhésion trouvée pour ce membre." }, { status: 404 });
  }

  if (membership.isPaid) {
    return NextResponse.json({ error: "Impossible de supprimer une cotisation déjà réglée." }, { status: 400 });
  }

  await prisma.membership.delete({ where: { userId: params.id } });

  return NextResponse.json({ ok: true });
}
