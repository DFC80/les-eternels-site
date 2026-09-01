export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPollResultsToAdmin, sendPollResultsToVoters } from "@/lib/mail";
import { isFullAdmin } from "@/lib/permissions";

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

async function sendResultsForAutoClosed() {
  const now = new Date();
  const autoClosedPolls = await prisma.poll.findMany({
    where: { published: true, closedAt: { lte: now }, resultNotificationSentAt: null },
    include: { options: { include: { _count: { select: { votes: true } } } } },
  });
  for (const poll of autoClosedPolls) {
    // Marquer immédiatement pour éviter les doublons d'envoi si la route est appelée en parallèle
    await prisma.poll.update({ where: { id: poll.id }, data: { resultNotificationSentAt: now } });
    let activityLabel: string | undefined;
    if (poll.activityKey) {
      const act = await prisma.activity.findUnique({ where: { key: poll.activityKey } });
      activityLabel = act?.label;
    }
    const options = poll.options.map((o) => ({ label: o.label, voteCount: o._count.votes }));
    const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
    const resultParams = { question: poll.question, activityLabel, totalVotes, options, closedAt: poll.closedAt!, pollUrl: `${baseUrl}/sondages` };
    const voterRows = await prisma.pollVote.findMany({
      where: { pollId: poll.id },
      distinct: ["userId"],
      select: { userId: true },
    });
    const voterUsers = await prisma.user.findMany({
      where: { id: { in: voterRows.map((v) => v.userId) } },
      select: { email: true, firstName: true },
    });
    const voters = voterUsers;
    Promise.allSettled([
      sendPollResultsToAdmin(resultParams),
      sendPollResultsToVoters(resultParams, voters),
    ]).catch(console.error);
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  // Déclenche les notifications de résultats pour les sondages clôturés automatiquement
  sendResultsForAutoClosed().catch(console.error);

  const now = new Date();
  const polls = await prisma.poll.findMany({
    where: {
      OR: [
        { published: true },
        // Sondages clôturés dont les résultats ont été envoyés (historique visible même si dépublié)
        { closedAt: { lte: now }, resultNotificationSentAt: { not: null } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
    },
  });

  // Load activity labels for polls that have an activityKey
  const activityKeys = [...new Set(polls.map((p) => p.activityKey).filter(Boolean) as string[])];
  const activities = activityKeys.length
    ? await prisma.activity.findMany({ where: { key: { in: activityKeys } } })
    : [];
  const activityMap = Object.fromEntries(activities.map((a) => [a.key, a.label]));

  const userId = session?.user?.id;
  const isAdmin = session ? isFullAdmin((session.user as { role?: string }).role ?? "") : false;

  const pollsWithVotes = await Promise.all(
    polls.map(async (poll) => {
      const userVotedOptionIds = userId
        ? (
            await prisma.pollVote.findMany({
              where: { pollId: poll.id, userId },
              select: { optionId: true },
            })
          ).map((v) => v.optionId)
        : [];

      const userCanVote =
        !poll.activityKey || !userId
          ? !!userId
          : await userHasActivity(userId, poll.activityKey);

      const userHasChangedVote = userId
        ? !!(await prisma.pollVoteChange.findUnique({ where: { pollId_userId: { pollId: poll.id, userId } } }))
        : false;

      const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);

      let votersByOption: Record<string, { name: string; email: string }[]> | undefined;
      if (isAdmin) {
        const allVotes = await prisma.pollVote.findMany({
          where: { pollId: poll.id },
          select: { optionId: true, userId: true },
        });
        const voterUserIds = [...new Set(allVotes.map((v) => v.userId))];
        const voterUsers = voterUserIds.length
          ? await prisma.user.findMany({
              where: { id: { in: voterUserIds } },
              select: { id: true, firstName: true, name: true, email: true },
            })
          : [];
        const userMap = Object.fromEntries(voterUsers.map((u) => [u.id, u]));
        votersByOption = {};
        for (const vote of allVotes) {
          if (!votersByOption[vote.optionId]) votersByOption[vote.optionId] = [];
          const u = userMap[vote.userId];
          if (u) {
            const name = u.name || u.firstName || u.email;
            votersByOption[vote.optionId].push({ name, email: u.email });
          }
        }
      }

      return {
        ...poll,
        activityLabel: poll.activityKey ? (activityMap[poll.activityKey] ?? null) : null,
        userVotedOptionIds,
        userCanVote,
        userHasChangedVote,
        totalVotes,
        options: poll.options.map((o) => ({ ...o, voteCount: o._count.votes })),
        ...(isAdmin ? { votersByOption } : {}),
      };
    })
  );

  return NextResponse.json(pollsWithVotes);
}
