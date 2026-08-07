export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { token } = await request.json() as { token?: string };

  if (!token) {
    return NextResponse.json({ error: "Token manquant." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { verificationToken: token } });

  if (!user) {
    return NextResponse.json({ error: "Lien invalide ou déjà utilisé." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isPending: false, verificationToken: null },
  });

  return NextResponse.json({ ok: true, firstName: user.firstName });
}
