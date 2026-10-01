import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { tokenHasAccess, isFullAdmin, type AdminSection } from "@/lib/permissions";

// Correspondance URL → section admin
const ADMIN_SECTION_MAP: { prefix: string; section: AdminSection; fullAdminOnly?: boolean }[] = [
  { prefix: "/admin/members",      section: "members" },
  { prefix: "/admin/events",       section: "events" },
  { prefix: "/admin/comptabilite", section: "comptabilite" },
  { prefix: "/admin/equipements",  section: "equipements" },
  { prefix: "/admin/galerie",      section: "galerie" },
  { prefix: "/admin/produits",     section: "produits" },
  { prefix: "/admin/kiosque",      section: "kiosque" },
  { prefix: "/admin/activites",    section: "activites" },
  { prefix: "/admin/bureau",       section: "bureau" },
  { prefix: "/admin/jeux",         section: "jeux" },
  { prefix: "/admin/actualites",   section: "content" },
  { prefix: "/admin/sondages",     section: "sondages" },
  { prefix: "/admin/reunions",     section: "reunions" },
  { prefix: "/admin/documents",    section: "documents" },
  { prefix: "/admin/notes",        section: "notes" },
  { prefix: "/admin/parametres",   section: "parametres" },
  { prefix: "/admin/permissions",  section: "parametres", fullAdminOnly: true },
];

// Routes qui nécessitent une session active
const AUTH_REQUIRED_PREFIXES = ["/admin", "/mon-compte", "/comptoir"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const role = (token?.role as string) ?? "";

    // Rediriger vers /profil si le profil est incomplet (sauf si déjà sur /profil)
    if (token && token.profileComplete === false && !pathname.startsWith("/profil")) {
      return NextResponse.redirect(new URL("/profil?incomplete=1", req.url));
    }

    // Bloquer les membres purs de toutes les pages admin
    if (pathname.startsWith("/admin") && (role === "MEMBER" || !role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Vérifier l'accès à la section spécifique
    const match = ADMIN_SECTION_MAP.find((m) => pathname.startsWith(m.prefix));
    if (match) {
      if (match.fullAdminOnly && !isFullAdmin(role)) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      if (!match.fullAdminOnly) {
        const allowedSections = token?.allowedSections as string[] | null | undefined;
        if (!tokenHasAccess(role, allowedSections, match.section)) {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Pages qui nécessitent une session active
        if (AUTH_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p)) || pathname === "/comptoir") {
          return !!token;
        }
        // Pour /profil et toutes les autres pages du matcher : laisser passer (auth optionnelle)
        return true;
      },
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/mon-compte/:path*",
    "/profil/:path*",
    "/comptoir/:path*",
    "/comptoir",
    "/sondages/:path*",
    "/activites/:path*",
    "/",
  ],
};
