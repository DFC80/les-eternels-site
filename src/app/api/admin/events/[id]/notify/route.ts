export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendNewEventNotification } from "@/lib/mail";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasWriteAccess(session.user, "events")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ error: "Événement introuvable." }, { status: 404 });
  }

  const [allUsers, activity] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, isPending: false },
      select: { firstName: true, email: true },
    }),
    event.activityType
      ? prisma.activity.findUnique({ where: { key: event.activityType }, select: { coverImage: true } })
      : Promise.resolve(null),
  ]);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const eventUrl = `${baseUrl}/calendar?event=${event.id}`;

  await Promise.allSettled(
    allUsers.map((user) =>
      sendNewEventNotification({
        to: user.email,
        firstName: user.firstName,
        eventTitle: event.title,
        description: event.description,
        startsAt: event.startsAt,
        location: event.location,
        coverImage: activity?.coverImage ?? null,
        eventUrl,
      })
    )
  );

  await prisma.event.update({ where: { id: params.id }, data: { notificationSentAt: new Date() } });

  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  if (discordWebhook) {
    const dateStr = event.startsAt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    await fetch(discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📅 Nouvel événement : **${event.title}** — ${dateStr}${event.location ? `\n📍 ${event.location}` : ""}\n${eventUrl}`,
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ sent: allUsers.length });
}
