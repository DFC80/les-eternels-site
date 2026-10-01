export const dynamic = "force-dynamic";
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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  if (!adminEmail) return NextResponse.json({ error: "Email admin non configuré." }, { status: 500 });

  const poll = await prisma.poll.findUnique({ where: { id: params.id } });
  if (!poll) return NextResponse.json({ error: "Sondage introuvable." }, { status: 404 });
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const pollUrl = `${baseUrl}/sondages`;

  let activityLabel: string | undefined;
  let coverImage: string | null = null;
  if (poll.activityKey) {
    const act = await prisma.activity.findUnique({ where: { key: poll.activityKey }, select: { label: true, coverImage: true } });
    activityLabel = act?.label;
    coverImage = act?.coverImage ?? null;
  }

  await sendNewPollNotification({
    to: adminEmail,
    firstName: "Admin",
    question: poll.question,
    pollUrl,
    activityLabel,
    coverImage,
  });

  return NextResponse.json({ ok: true, sent: 1 });
}
