export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionHasAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendCustomEmail } from "@/lib/mail";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !sessionHasAccess(session.user, "members")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { subject, message } = await request.json() as { subject?: string; message?: string };
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Sujet et message requis." }, { status: 400 });
  }

  const [user, president] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      select: { firstName: true, email: true },
    }),
    prisma.user.findFirst({
      where: { bureauRoles: { some: { bureauRole: { label: "Président" } } } },
      select: { phone: true },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });

  await sendCustomEmail({
    to: user.email,
    firstName: user.firstName,
    subject: subject.trim(),
    message: message.trim(),
    presidentPhone: president?.phone ?? null,
  });

  return NextResponse.json({ ok: true });
}
