export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarContent: true, avatarMime: true },
  });

  if (!user?.avatarContent) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(user.avatarContent, {
    headers: {
      "Content-Type": user.avatarMime ?? "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté. Utilisez JPEG, PNG, GIF ou WebP." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "L'image ne doit pas dépasser 2 Mo." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarContent: buffer, avatarMime: file.type },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarContent: null, avatarMime: null },
  });

  return NextResponse.json({ ok: true });
}
