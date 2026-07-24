import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin, FULL_ADMIN_ROLES, HARDCODED_SECTION_MAP, type AdminSection } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const [bureauRoles, dbPerms] = await Promise.all([
    prisma.bureauRole.findMany({ orderBy: { order: "asc" } }),
    prisma.rolePermission.findMany(),
  ]);

  // Regrouper les permissions DB par rôle
  const dbByRole = new Map<string, string[]>();
  for (const p of dbPerms) {
    if (!dbByRole.has(p.roleLabel)) dbByRole.set(p.roleLabel, []);
    dbByRole.get(p.roleLabel)!.push(p.section);
  }

  // Exclure les rôles full admin (ils ont toujours accès à tout)
  const roles = bureauRoles
    .filter((r) => !FULL_ADMIN_ROLES.includes(r.label))
    .map((r) => ({
      label: r.label,
      sections: dbByRole.has(r.label)
        ? dbByRole.get(r.label)!
        : (HARDCODED_SECTION_MAP[r.label] ?? []),
      fromDb: dbByRole.has(r.label),
    }));

  return NextResponse.json({ roles });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin((session.user as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { permissions } = (await request.json()) as {
    permissions: Array<{ role: string; sections: string[] }>;
  };

  if (!Array.isArray(permissions)) {
    return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  }

  // Remplacer toutes les permissions en transaction
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({
      where: { roleLabel: { in: permissions.map((p) => p.role) } },
    }),
    prisma.rolePermission.createMany({
      data: permissions.flatMap(({ role, sections }) =>
        (sections as AdminSection[]).map((section) => ({ roleLabel: role, section }))
      ),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
