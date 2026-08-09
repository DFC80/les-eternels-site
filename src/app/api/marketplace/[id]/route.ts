export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFullAdmin } from "@/lib/permissions";

type SessionUser = { id: string; role?: string };

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const { id: userId, role } = session.user as SessionUser;

  const listing = await prisma.marketListing.findUnique({ where: { id: params.id } });
  if (!listing) {
    return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  }
  if (listing.userId !== userId && !isFullAdmin(role ?? "")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json() as {
    title?: string;
    description?: string;
    price?: number | null;
    photos?: string | null;
    category?: string | null;
    activityKey?: string | null;
    visibility?: string;
    status?: string;
  };

  const { title, description, price, photos, category, activityKey, visibility, status } = body;

  const resolvedVisibility =
    visibility === "ACTIVITY" && activityKey ? "ACTIVITY" : visibility === "ALL" ? "ALL" : undefined;

  const updated = await prisma.marketListing.update({
    where: { id: params.id },
    data: {
      ...(title?.trim() ? { title: title.trim() } : {}),
      ...(description?.trim() ? { description: description.trim() } : {}),
      ...(price !== undefined ? { price: price != null ? Math.round(Number(price)) : null } : {}),
      ...(photos !== undefined ? { photos: photos || null } : {}),
      ...(category !== undefined ? { category: category || null } : {}),
      ...(activityKey !== undefined ? { activityKey: activityKey || null } : {}),
      ...(resolvedVisibility !== undefined ? { visibility: resolvedVisibility } : {}),
      ...(status && ["ACTIVE", "VENDU", "CLOS"].includes(status) ? { status } : {}),
    },
    include: { user: { select: { id: true, firstName: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const { id: userId, role } = session.user as SessionUser;

  const listing = await prisma.marketListing.findUnique({ where: { id: params.id } });
  if (!listing) {
    return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  }
  if (listing.userId !== userId && !isFullAdmin(role ?? "")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  await prisma.marketListing.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
