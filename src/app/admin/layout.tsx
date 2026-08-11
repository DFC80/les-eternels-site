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
    // Sans argument, update() envoie un GET et ne déclenche pas le callback jwt.
    // Avec un argument, il envoie un POST → trigger === "update" → re-fetch du rôle depuis la DB.
    update({ refreshRole: true }).then(() => router.refresh());
  }, []);

  return <>{children}</>;
}
