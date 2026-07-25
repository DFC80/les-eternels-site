import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendCustomEmail } from "@/lib/mail";

const CORE_BOOL_FIELDS: Record<string, "wantsBoardGames" | "wantsRolePlay" | "wantsAirsoft"> = {
  JEUX_DE_PLATEAU: "wantsBoardGames",
  JEUX_DE_ROLE: "wantsRolePlay",
  AIRSOFT: "wantsAirsoft",
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "members")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { activityKey, subject, message } = await request.json() as {
    activityKey?: string;
    subject?: string;
    message?: string;
  };

  if (!activityKey || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Activité, sujet et message requis." }, { status: 400 });
  }

  const currentYear = new Date().getFullYear();
  const coreField = CORE_BOOL_FIELDS[activityKey];

  const users = coreField
    ? await prisma.user.findMany({
        where: { membership: { year: currentYear, [coreField]: true } },
        select: { firstName: true, email: true },
      })
    : await prisma.user.findMany({
        where: {
          membership: {
            year: currentYear,
            extraActivities: { some: { activityKey } },
          },
        },
        select: { firstName: true, email: true },
      });

  const president = await prisma.user.findFirst({
    where: { bureauRoles: { some: { bureauRole: { label: "Président" } } } },
    select: { phone: true },
  });

  await Promise.all(
    users.map((u) =>
      sendCustomEmail({
        to: u.email,
        firstName: u.firstName,
        subject: subject.trim(),
        message: message.trim(),
        presidentPhone: president?.phone ?? null,
      })
    )
  );

  return NextResponse.json({ ok: true, sent: users.length, recipients: users.map((u) => u.email) });
}
