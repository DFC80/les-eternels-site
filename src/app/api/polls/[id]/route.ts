export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPollVoteNotificationToAdmin } from "@/lib/mail";

const CORE_BOOL_FIELDS: Record<string, "wantsBoardGames" | "wantsRolePlay" | "wantsAirsoft"> = {
  JEUX_DE_PLATEAU: "wantsBoardGames",
  JEUX_DE_ROLE: "wantsRolePlay",
  AIRSOFT: "wantsAirsoft",
};

async function userHasActivity(userId: string, activityKey: string): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { userId },
    include: { extraActivities: true },
  });
  if (!membership || !membership.isPaid) return false;
  const boolField = CORE_BOOL_FIELDS[activityKey];
  if (boolField) return membership[boolField];
  return membership.extraActivities.some((a) => a.activityKey === activityKey);
}

async function getPoll(id: string) {
  return prisma.poll.findUnique({
    where: { id, published: true },
    include: { options: true },
  });
}

// Vote ou changement de vote
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté pour voter." }, { status: 401 });

  const poll = await getPoll(params.id);
  if (!poll) return NextResponse.json({ error: "Sondage introuvable." }, { status: 404 });

  const isClosed = poll.closedAt && new Date(poll.closedAt) < new Date();
  if (isClosed) return NextResponse.json({ error: "Ce sondage est clôturé." }, { status: 400 });

  if (poll.activityKey) {
    const canVote = await userHasActivity(session.user.id, poll.activityKey);
    if (!canVote) {
      return NextResponse.json(
        { error: "Vous n'êtes pas adhérent à l'activité requise pour voter.", activityKey: poll.activityKey },
        { status: 403 }
      );
    }
  }

  const body = await request.json();
  const { optionIds } = body as { optionIds?: string[] };
  if (!optionIds?.length) return NextResponse.json({ error: "Aucune option sélectionnée." }, { status: 400 });

  const validOptionIds = poll.options.map((o) => o.id);
  const selectedIds = optionIds.filter((id) => validOptionIds.includes(id));
  if (!selectedIds.length) return NextResponse.json({ error: "Option invalide." }, { status: 400 });
  if (!poll.allowMultiple && selectedIds.length > 1) return NextResponse.json({ error: "Un seul choix autorisé." }, { status: 400 });

  const userId = session.user.id;
  const existingVotes = await prisma.pollVote.findMany({ where: { pollId: params.id, userId } });

  if (existingVotes.length > 0) {
    // Modification de vote : vérifier que le changement est encore disponible
    const alreadyChanged = await prisma.pollVoteChange.findUnique({
      where: { pollId_userId: { pollId: params.id, userId } },
    });
    if (alreadyChanged) {
      return NextResponse.json({ error: "Vous avez déjà modifié votre vote une fois." }, { status: 400 });
    }

    // Consommer le changement et remplacer les votes
    await prisma.pollVote.deleteMany({ where: { pollId: params.id, userId } });
    await prisma.pollVoteChange.create({ data: { pollId: params.id, userId } });
  }

  const isChange = existingVotes.length > 0;

  await prisma.pollVote.createMany({
    data: selectedIds.map((optionId) => ({ pollId: params.id, optionId, userId })),
  });

  const selectedLabels = poll.options.filter((o) => selectedIds.includes(o.id)).map((o) => o.label);
  sendPollVoteNotificationToAdmin({
    voterName: session.user.name ?? session.user.email ?? userId,
    voterEmail: session.user.email ?? "",
    question: poll.question,
    selectedOptions: selectedLabels,
    isChange,
  }).catch((e) => console.error("[mail] sendPollVoteNotificationToAdmin:", e));

  return NextResponse.json({ ok: true });
}

// Suppression du vote
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const poll = await getPoll(params.id);
  if (!poll) return NextResponse.json({ error: "Sondage introuvable." }, { status: 404 });

  const isClosed = poll.closedAt && new Date(poll.closedAt) < new Date();
  if (isClosed) return NextResponse.json({ error: "Ce sondage est clôturé." }, { status: 400 });

  const userId = session.user.id;
  const existingVotes = await prisma.pollVote.findMany({ where: { pollId: params.id, userId } });
  if (!existingVotes.length) return NextResponse.json({ error: "Vous n'avez pas voté." }, { status: 400 });

  const alreadyChanged = await prisma.pollVoteChange.findUnique({
    where: { pollId_userId: { pollId: params.id, userId } },
  });
  if (alreadyChanged) {
    return NextResponse.json({ error: "Vous avez déjà modifié votre vote une fois." }, { status: 400 });
  }

  await prisma.pollVote.deleteMany({ where: { pollId: params.id, userId } });
  await prisma.pollVoteChange.create({ data: { pollId: params.id, userId } });

  return NextResponse.json({ ok: true });
}
