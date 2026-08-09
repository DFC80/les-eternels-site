export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse(null, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { avatarContent: true, avatarMime: true },
  });

  if (!user?.avatarContent) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(user.avatarContent, {
    headers: {
      "Content-Type": user.avatarMime ?? "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
