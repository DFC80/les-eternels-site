export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { sendMemberActionToAdmin } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const comments = await prisma.galleryPhotoComment.findMany({
    where: { photoId: params.id },
    include: { user: { select: { id: true, firstName: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });

  const photo = await prisma.galleryPhoto.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });

  const body = await request.json();
  const content = (body.content ?? "").toString().trim();
  if (!content) return NextResponse.json({ error: "Le commentaire ne peut pas être vide." }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ error: "Commentaire trop long (max 1000 caractères)." }, { status: 400 });

  const comment = await prisma.galleryPhotoComment.create({
    data: { photoId: params.id, userId: (session.user as { id: string }).id, content },
    include: { user: { select: { id: true, firstName: true, name: true } } },
  });

  const role = (session.user as { role?: string }).role ?? "";
  if (!isFullAdmin(role)) {
    const preview = content.length > 150 ? content.slice(0, 150) + "…" : content;
    sendMemberActionToAdmin({
      memberName: (session.user as { name?: string | null }).name ?? "Membre",
      memberEmail: (session.user as { email?: string | null }).email ?? "",
      action: "Commentaire sur une photo de galerie",
      details: [
        { label: "Photo", value: photo.comment ?? `Photo ${photo.id.slice(0, 8)}` },
        { label: "Commentaire", value: preview },
      ],
    }).catch(() => {});
  }

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const body = await request.json();
  const { commentId } = body as { commentId?: string };
  if (!commentId) return NextResponse.json({ error: "commentId requis." }, { status: 400 });

  const comment = await prisma.galleryPhotoComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.photoId !== params.id) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role ?? "";
  const isOwner = comment.userId === userId;
  const isModerator = role === "ADMIN" || role === "MODERATEUR";
  if (!isOwner && !isModerator) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await prisma.galleryPhotoComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
