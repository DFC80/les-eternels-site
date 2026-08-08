export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeMembershipAmount, currentSeasonYear } from "@/lib/membership";
import { sendMembershipRequestRecap } from "@/lib/mail";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId: session.user.id },
    include: { extraActivities: true },
  });

  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { airsoftTrialDay: true },
  });
  const airsoftTrialDay = userRecord?.airsoftTrialDay ?? false;

  if (!membership) return NextResponse.json({ airsoftTrialDay });

  const currentYear = currentSeasonYear();
  return NextResponse.json({
    ...membership,
    expired: membership.year !== currentYear,
    extraActivityKeys: membership.extraActivities.map((a) => a.activityKey),
    airsoftTrialDay,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (
    !user?.dateOfBirth ||
    !user?.addressStreet ||
    !user?.addressCity ||
    !user?.addressPostalCode ||
    !user?.gender
  ) {
    return NextResponse.json(
      { error: "Veuillez compléter votre profil (date de naissance, adresse, genre) avant d'adhérer." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const wantsBoardGames = !!body.wantsBoardGames;
  const wantsRolePlay = !!body.wantsRolePlay;
  const wantsAirsoft = !!body.wantsAirsoft;
  const extraActivityKeys: string[] = Array.isArray(body.extraActivityKeys) ? body.extraActivityKeys : [];

  // Charger les prix de toutes les activités sélectionnées depuis la base
  const coreKeys: string[] = [];
  if (wantsBoardGames) coreKeys.push("JEUX_DE_PLATEAU");
  if (wantsRolePlay) coreKeys.push("JEUX_DE_ROLE");
  if (wantsAirsoft) coreKeys.push("AIRSOFT");

  const allSelectedKeys = [...coreKeys, ...extraActivityKeys];

  if (allSelectedKeys.length === 0) {
    return NextResponse.json({ error: "Sélectionnez au moins une activité." }, { status: 400 });
  }

  const activityRecords = await prisma.activity.findMany({
    where: { key: { in: allSelectedKeys } },
  });

  const priceMap = Object.fromEntries(activityRecords.map((a) => [a.key, a.price]));
  const amount = computeMembershipAmount(allSelectedKeys.map((k) => priceMap[k] ?? 0));

  const currentYear = currentSeasonYear();

  const existing = await prisma.membership.findUnique({
    where: { userId: session.user.id },
    include: { extraActivities: true },
  });
  const isAlreadyPaid = !!(existing?.isPaid && existing?.year === currentYear);

  // Quand la cotisation est déjà réglée, interdire la suppression d'activités validées
  if (isAlreadyPaid) {
    const removedCore =
      (existing!.wantsBoardGames && !wantsBoardGames) ||
      (existing!.wantsRolePlay && !wantsRolePlay) ||
      (existing!.wantsAirsoft && !wantsAirsoft);
    const existingExtraKeys = existing!.extraActivities.map((a) => a.activityKey);
    const removedExtra = existingExtraKeys.some((k) => !extraActivityKeys.includes(k));
    if (removedCore || removedExtra) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas retirer une activité déjà validée au paiement." },
        { status: 400 }
      );
    }
  }

  const membership = await prisma.membership.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, year: currentYear, wantsBoardGames, wantsRolePlay, wantsAirsoft, amount },
    update: {
      year: currentYear,
      wantsBoardGames,
      wantsRolePlay,
      wantsAirsoft,
      amount,
      ...(isAlreadyPaid ? {} : { isPaid: false, paidAt: null }),
    },
  });

  // Remplacer les activités supplémentaires
  await prisma.membershipActivity.deleteMany({ where: { membershipId: membership.id } });
  if (extraActivityKeys.length > 0) {
    await prisma.membershipActivity.createMany({
      data: extraActivityKeys.map((key) => ({ membershipId: membership.id, activityKey: key })),
    });
  }

  const activities = activityRecords.map((a) => `${a.label} (${a.price}€)`);

  await sendMembershipRequestRecap({ to: user.email, firstName: user.firstName, year: currentYear, activities, amount });

  return NextResponse.json({ ...membership, extraActivityKeys });
}
