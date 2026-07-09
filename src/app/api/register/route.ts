import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail, sendNewMemberNotification } from "@/lib/mail";

export async function POST(request: Request) {
  const body = await request.json();
  const { firstName, name, email, password } = body as {
    firstName?: string;
    name?: string;
    email?: string;
    password?: string;
  };

  if (!firstName || !name || !email || !password) {
    return NextResponse.json({ error: "Tous les champs sont requis." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const verificationToken = crypto.randomBytes(32).toString("hex");

  const user = await prisma.user.create({
    data: { firstName, name, email, passwordHash, isPending: true, verificationToken },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`;

  await Promise.all([
    sendWelcomeEmail({ to: user.email, firstName: user.firstName, verificationLink }),
    sendNewMemberNotification({ firstName: user.firstName, lastName: user.name, email: user.email }),
  ]);

  return NextResponse.json(
    { id: user.id, firstName: user.firstName, name: user.name, email: user.email },
    { status: 201 }
  );
}
