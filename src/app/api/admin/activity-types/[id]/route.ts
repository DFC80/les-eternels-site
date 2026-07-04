import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { label, emoji, color, membershipRequired, price, order, isActive } = await request.json();

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      ...(label !== undefined && { label }),
      ...(emoji !== undefined && { emoji }),
      ...(color !== undefined && { color }),
      ...(membershipRequired !== undefined && { membershipRequired }),
      ...(price !== undefined && typeof price === "number" && { price: Math.round(price) }),
      ...(order !== undefined && { order }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(activity);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const activity = await prisma.activity.findUnique({ where: { id: params.id } });
  if (!activity) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (activity.isCore) {
    return NextResponse.json({ error: "Les activités principales ne peuvent pas être supprimées." }, { status: 403 });
  }

  await prisma.activity.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
