export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendNewPollNotification, sendPollResultsToAdmin, sendPollResultsToVoters } from "@/lib/mail";

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

  // Find eligible users
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

async function maybeSendResultNotification(pollId: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { include: { _count: { select: { votes: true } } } },
    },
  });
  if (!poll || !poll.published || poll.resultNotificationSentAt) return;
  if (!poll.closedAt || new Date(poll.closedAt) > new Date()) return;

  // Marquer immédiatement pour éviter les doublons si appelée en parallèle
  await prisma.poll.update({ where: { id: pollId }, data: { resultNotificationSentAt: new Date() } });

  let activityLabel: string | undefined;
  if (poll.activityKey) {
    const act = await prisma.activity.findUnique({ where: { key: poll.activityKey } });
    activityLabel = act?.label;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const options = poll.options.map((o) => ({ label: o.label, voteCount: o._count.votes }));
  const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
  const resultParams = { question: poll.question, activityLabel, totalVotes, options, closedAt: poll.closedAt, pollUrl: `${baseUrl}/sondages` };

  const voterRows = await prisma.pollVote.findMany({
    where: { pollId },
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
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const polls = await prisma.poll.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      options: { orderBy: { order: "asc" } },
      _count: { select: { votes: true } },
    },
  });

  // Envoyer les résultats des sondages nouvellement clôturés (lazy check)
  const newlyClosed = polls.filter(
    (p) => p.published && p.closedAt && new Date(p.closedAt) < new Date() && !p.resultNotificationSentAt
  );
  for (const p of newlyClosed) {
    maybeSendResultNotification(p.id).catch(console.error);
  }

  return NextResponse.json(polls);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const body = await request.json();
  const { question, allowMultiple, published, activityKey, options } = body as {
    question?: string;
    allowMultiple?: boolean;
    published?: boolean;
    activityKey?: string | null;
    options?: ({ label: string; order: number } | string)[];
  };

  if (!question?.trim()) return NextResponse.json({ error: "La question est requise." }, { status: 400 });
  const opts = (options ?? [])
    .map((o) => (typeof o === "string" ? { label: o.trim(), order: 0 } : { label: o.label.trim(), order: o.order }))
    .filter((o) => o.label);
  if (opts.length < 2) return NextResponse.json({ error: "Au moins 2 options requises." }, { status: 400 });

  const poll = await prisma.poll.create({
    data: {
      question: question.trim(),
      allowMultiple: !!allowMultiple,
      published: !!published,
      activityKey: activityKey || null,
      options: {
        create: opts.map((o, i) => ({ label: o.label, order: o.order ?? i })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  if (published) {
    sendPollNotifications(poll.id, poll.question, poll.activityKey).catch(console.error);
  }

  return NextResponse.json(poll, { status: 201 });
}
