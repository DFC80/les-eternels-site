import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendMembershipPaymentConfirmation } from "@/lib/mail";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { isPaid, validateSupplement } = body as { isPaid?: boolean; validateSupplement?: boolean };

  const membership = await prisma.membership.findUnique({ where: { userId: params.id } });
  if (!membership) {
    return NextResponse.json({ error: "Aucune adhésion trouvée pour ce membre." }, { status: 404 });
  }

  const updateData: Record<string, unknown> = validateSupplement
    ? { paidAmount: membership.amount }
    : {
        isPaid: !!isPaid,
        paidAt: isPaid ? new Date() : null,
        paidAmount: isPaid ? membership.amount : 0,
      };

  const updated = await prisma.membership.update({
    where: { userId: params.id },
    data: updateData,
  });

  if (isPaid) {
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (user) {
      await sendMembershipPaymentConfirmation({
        to: user.email,
        firstName: user.firstName,
        year: updated.year,
        amount: updated.amount,
      });
    }
  }

  return NextResponse.json(updated);
}
