"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { update } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rafraîchit le rôle depuis la DB à chaque visite d'une page admin,
    // puis recharge les composants serveur pour appliquer les nouvelles permissions.
    // Nécessaire quand un rôle bureau a été assigné après la connexion.
    // Sans argument, update() envoie un GET et ne déclenche pas le callback jwt.
    // Avec un argument, il envoie un POST → trigger === "update" → re-fetch du rôle depuis la DB.
    update({ refreshRole: true }).then(() => router.refresh());
  }, []);

  const isHome = pathname === "/admin";

  return (
    <>
      {!isHome && (
        <div className="border-b border-primary-800 bg-primary-950/95 print:hidden">
          <div className="mx-auto flex max-w-6xl items-center px-4 py-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-100"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Administration
            </Link>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
