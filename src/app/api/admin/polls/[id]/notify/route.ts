import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendNewPollNotification } from "@/lib/mail";

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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const poll = await prisma.poll.findUnique({ where: { id: params.id } });
  if (!poll) return NextResponse.json({ error: "Sondage introuvable." }, { status: 404 });
  if (!poll.published) return NextResponse.json({ error: "Le sondage doit être publié pour notifier." }, { status: 400 });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const pollUrl = `${baseUrl}/sondages`;

  let activityLabel: string | undefined;
  if (poll.activityKey) {
    const act = await prisma.activity.findUnique({ where: { key: poll.activityKey } });
    activityLabel = act?.label;
  }

  let users: { email: string; firstName: string }[] = [];

  if (!poll.activityKey) {
    users = await prisma.user.findMany({
      where: { isActive: true, isPending: false },
      select: { email: true, firstName: true },
    });
  } else {
    const boolField = CORE_BOOL_FIELDS[poll.activityKey];
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
          membership: { extraActivities: { some: { activityKey: poll.activityKey } } },
        },
        select: { email: true, firstName: true },
      });
    }
  }

  await Promise.allSettled(
    users.map((u) =>
      sendNewPollNotification({ to: u.email, firstName: u.firstName, question: poll.question, pollUrl, activityLabel })
    )
  );

  await prisma.poll.update({ where: { id: params.id }, data: { publishNotificationSentAt: new Date() } });

  return NextResponse.json({ ok: true, sent: users.length });
}
