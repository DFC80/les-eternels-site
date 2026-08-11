import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { FULL_ADMIN_ROLES } from "@/lib/permissions";

async function fetchAllowedSections(role: string): Promise<string[] | null | undefined> {
  if (FULL_ADMIN_ROLES.includes(role)) return null; // accès complet
  const perms = await prisma.rolePermission.findMany({
    where: { roleLabel: role },
    select: { section: true },
  });
  if (perms.length === 0) return undefined; // pas encore configuré → fallback hardcodé
  return perms.map((p) => p.section);
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            bureauRoles: { include: { bureauRole: true }, orderBy: { bureauRole: { order: "asc" } } },
          },
        });
        if (!user) return null;

        if (user.isPending) {
          throw new Error("COMPTE_EN_ATTENTE");
        }

        if (!user.isActive) {
          throw new Error("COMPTE_DESACTIVE");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Si user.role est "MEMBER" mais qu'il a un rôle bureau, on utilise ce rôle.
        // On priorise les rôles admin complets pour éviter qu'un rôle secondaire (ex: "Airsoft")
        // masque un rôle plus privilégié (ex: "Vice-président") trié en second.
        const bureauLabels = user.bureauRoles.map((r) => r.bureauRole.label);
        const fullAdminBureauLabel = bureauLabels.find((l) => FULL_ADMIN_ROLES.includes(l));
        const effectiveRole =
          user.role === "MEMBER" && bureauLabels.length > 0
            ? (fullAdminBureauLabel ?? bureauLabels[0])
            : user.role;

        return {
          id: user.id,
          name: `${user.firstName} ${user.name}`,
          email: user.email,
          role: effectiveRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.allowedSections = await fetchAllowedSections(token.role as string);
      } else if (trigger === "update") {
        // Rechargement forcé du rôle et des permissions depuis la DB
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: {
            bureauRoles: { include: { bureauRole: true }, orderBy: { bureauRole: { order: "asc" } } },
          },
        });
        if (dbUser) {
          const bureauLabels = dbUser.bureauRoles.map((r) => r.bureauRole.label);
          const fullAdminBureauLabel = bureauLabels.find((l) => FULL_ADMIN_ROLES.includes(l));
          const effectiveRole =
            dbUser.role === "MEMBER" && bureauLabels.length > 0
              ? (fullAdminBureauLabel ?? bureauLabels[0])
              : dbUser.role;
          token.role = effectiveRole;
        }
        token.allowedSections = await fetchAllowedSections(token.role as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string; allowedSections?: string[] | null }).id =
          token.id as string;
        (session.user as { id?: string; role?: string; allowedSections?: string[] | null }).role =
          token.role as string;
        (
          session.user as { id?: string; role?: string; allowedSections?: string[] | null }
        ).allowedSections = token.allowedSections as string[] | null | undefined;
      }
      return session;
    },
  },
};
