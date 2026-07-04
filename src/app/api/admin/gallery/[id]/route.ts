import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, canAccessSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "galerie"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.galleryPhoto.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (!isFullAdmin(session.user.role) && !canAccessSection(session.user.role, "galerie"))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { visibility } = await request.json();
  if (visibility !== "PUBLIC" && visibility !== "MEMBERS_ONLY") {
    return NextResponse.json({ error: "Visibilité invalide." }, { status: 400 });
  }

  const photo = await prisma.galleryPhoto.update({
    where: { id: params.id },
    data: { visibility },
  });

  return NextResponse.json(photo);
}