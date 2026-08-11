"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Rafraîchit le rôle depuis la DB à chaque visite d'une page admin,
    // puis recharge les composants serveur pour appliquer les nouvelles permissions.
    // Nécessaire quand un rôle bureau a été assigné après la connexion.
    update().then(() => router.refresh());
  }, []);

  return <>{children}</>;
}
