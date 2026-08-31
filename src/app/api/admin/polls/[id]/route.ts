export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendPollResultsToAdmin, sendPollResultsToVoters } from "@/lib/mail";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) return null;
  return session;
}

const CORE_BOOL_FIELDS: Record<string, "wantsBoardGames" | "wantsRolePlay" | "wantsAirsoft"> = {
  JEUX_DE_PLATEAU: "wantsBoardGames",
  JEUX_DE_ROLE: "wantsRolePlay",
  AIRSOFT: "wantsAirsoft",
};

async function sendPollNotifications(pollId: string, question: string, activityKey: string | null) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const pollUrl = `${baseUrl}/sondages`;

  let activityLabel: string | undefined;
  if (activityKey) {
    const act = await prisma.activity.findUnique({ where: { key: activityKey } });
    activityLabel = act?.label;
  }

  let users: { email: string; firstName: string }[] = [];

  if (!activityKey) {
    users = await prisma.user.findMany({
      where: { isActive: true, isPending: false },
      select: { email: true, firstName: true },
    });
  } else {
    const boolField = CORE_BOOL_FIELDS[activityKey];
    if (boolField) {
      users = await prisma.user.findMany({
        where: { isActive: true, isPending: false, membership: { [boolField]: true } },
        select: { email: true, firstName: true },
      });
    } else {
      users = await prisma.user.findMany({
        where: {
          isActive: true,
          isPending: false,
          membership: { extraActivities: { some: { activityKey } } },
        },
        select: { email: true, firstName: true },
      });
    }
  }

  await Promise.allSettled(
    users.map((u) => sendNewPollNotification({ to: u.email, firstName: u.firstName, question, pollUrl, activityLabel }))
  );

  await prisma.poll.update({ where: { id: pollId }, data: { publishNotificationSentAt: new Date() } });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { question, allowMultiple, published, closedAt, activityKey, options } = body as {
    question?: string;
    allowMultiple?: boolean;
    published?: boolean;
    closedAt?: string | null;
    activityKey?: string | null;
    options?: { id?: string; label: string; order: number }[];
  };

  if (!question?.trim()) return NextResponse.json({ error: "La question est requise." }, { status: 400 });

  const existing = await prisma.poll.findUnique({
    where: { id: params.id },
    include: { options: { orderBy: { order: "asc" } } },
  });

  // Only rebuild options if they actually changed (avoids cascade-deleting votes)
  const newOpts = (options ?? [])
    .map((o) => ({ label: o.label.trim(), order: o.order }))
    .filter((o) => o.label);

  const existingLabels = (existing?.options ?? []).map((o) => o.label).join("|");
  const newLabels = newOpts.map((o) => o.label).join("|");
  const optionsChanged = existingLabels !== newLabels;

  if (optionsChanged) {
    await prisma.pollOption.deleteMany({ where: { pollId: params.id } });
  }

  const poll = await prisma.poll.update({
    where: { id: params.id },
    data: {
      question: question.trim(),
      allowMultiple: !!allowMultiple,
      published: !!published,
      activityKey: activityKey !== undefined ? (activityKey || null) : existing?.activityKey ?? null,
      closedAt: closedAt ? new Date(closedAt) : null,
      ...(optionsChanged && {
        options: {
          create: newOpts.map((o) => ({ label: o.label, order: o.order })),
        },
      }),
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  // Envoyer les résultats si le sondage vient d'être clôturé manuellement
  const justClosed =
    poll.published &&
    poll.closedAt &&
    new Date(poll.closedAt) <= new Date() &&
    !poll.resultNotificationSentAt &&
    (!existing?.closedAt || new Date(existing.closedAt) > new Date());

  if (justClosed) {
    (async () => {
      let activityLabel: string | undefined;
      if (poll.activityKey) {
        const act = await prisma.activity.findUnique({ where: { key: poll.activityKey } });
        activityLabel = act?.label;
      }
      const opts = await prisma.pollOption.findMany({
        where: { pollId: poll.id },
        include: { _count: { select: { votes: true } } },
      });
      const options = opts.map((o) => ({ label: o.label, voteCount: o._count.votes }));
      const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
      const pollUrl = `${baseUrl}/sondages`;
      const resultParams = { question: poll.question, activityLabel, totalVotes, options, closedAt: poll.closedAt!, pollUrl };

      // Récupérer les votants distincts
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

      await Promise.allSettled([
        sendPollResultsToAdmin(resultParams),
        sendPollResultsToVoters(resultParams, voters),
      ]);
      await prisma.poll.update({ where: { id: poll.id }, data: { resultNotificationSentAt: new Date() } });
    })().catch(console.error);
  }

  return NextResponse.json(poll);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await prisma.poll.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
