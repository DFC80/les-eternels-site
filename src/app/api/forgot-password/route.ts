import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import crypto from "crypto";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Always return 200 to avoid user enumeration
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetTokenExpiry: expiry },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, resetLink });

  return NextResponse.json({ ok: true });
}
