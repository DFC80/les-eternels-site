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

  const body = await request.json();
  const data: { visibility?: string; comment?: string | null } = {};

  if ("visibility" in body) {
    if (body.visibility !== "PUBLIC" && body.visibility !== "MEMBERS_ONLY") {
      return NextResponse.json({ error: "Visibilité invalide." }, { status: 400 });
    }
    data.visibility = body.visibility;
  }

  if ("comment" in body) {
    data.comment = body.comment ?? null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const photo = await prisma.galleryPhoto.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(photo);
}