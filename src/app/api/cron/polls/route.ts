import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPollResultsToAdmin, sendPollResultsToVoters } from "@/lib/mail";

// Sécurisé par un secret partagé dans CRON_SECRET (variable d'environnement)
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  const now = new Date();
  const autoClosedPolls = await prisma.poll.findMany({
    where: { published: true, closedAt: { lte: now }, resultNotificationSentAt: null },
    include: { options: { include: { _count: { select: { votes: true } } } } },
  });

  if (autoClosedPolls.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  let processed = 0;

  for (const poll of autoClosedPolls) {
    // Marquer immédiatement pour éviter les doublons
    await prisma.poll.update({ where: { id: poll.id }, data: { resultNotificationSentAt: now } });

    let activityLabel: string | undefined;
    if (poll.activityKey) {
      const act = await prisma.activity.findUnique({ where: { key: poll.activityKey } });
      activityLabel = act?.label;
    }

    const options = poll.options.map((o) => ({ label: o.label, voteCount: o._count.votes }));
    const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
    const resultParams = {
      question: poll.question,
      activityLabel,
      totalVotes,
      options,
      closedAt: poll.closedAt!,
      pollUrl: `${baseUrl}/sondages`,
    };

    const voterRows = await prisma.pollVote.findMany({
      where: { pollId: poll.id },
      distinct: ["userId"],
      select: { userId: true },
    });
    const voterUsers = await prisma.user.findMany({
      where: { id: { in: voterRows.map((v) => v.userId) } },
      select: { email: true, firstName: true },
    });

    await Promise.allSettled([
      sendPollResultsToAdmin(resultParams),
      sendPollResultsToVoters(resultParams, voterUsers),
    ]);

    processed++;
  }

  return NextResponse.json({ processed });
}
