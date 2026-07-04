import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = (req.nextauth.token?.role as string) ?? "";

    // Seuls les MEMBER purs sont bloqués — tous les rôles bureau passent
    if (pathname.startsWith("/admin") && (role === "MEMBER" || !role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/mon-compte/:path*", "/profil/:path*", "/comptoir/:path*", "/comptoir"],
};
