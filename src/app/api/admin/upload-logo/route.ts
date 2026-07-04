import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté. Utilisez JPG, PNG ou WEBP." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const dest = path.join(process.cwd(), "public", "logo.jpg");
  await writeFile(dest, buffer);

  const version = String(Date.now());
  await prisma.siteSetting.upsert({
    where: { key: "logoVersion" },
    update: { value: version },
    create: { key: "logoVersion", value: version },
  });

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, version });
}
