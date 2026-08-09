export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sendContactFormEmail } from "@/lib/mail";

export async function POST(request: Request) {
  const body = await request.json() as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
    _trap?: string;
  };

  // Honeypot: bots fill this field, humans don't
  if (body._trap) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }
  if (!subject || subject.length > 150) {
    return NextResponse.json({ error: "Sujet invalide." }, { status: 400 });
  }
  if (!message || message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: "Message invalide (10 à 5000 caractères)." }, { status: 400 });
  }

  await sendContactFormEmail({ senderName: name, senderEmail: email, subject, message });

  return NextResponse.json({ ok: true });
}
