"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

function isProfileComplete(data: {
  firstName?: string | null;
  name?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressPostalCode?: string | null;
  gender?: string | null;
}) {
  return !!(
    data.firstName?.trim() &&
    data.name?.trim() &&
    data.addressStreet?.trim() &&
    data.addressCity?.trim() &&
    data.addressPostalCode?.trim() &&
    data.gender
  );
}

export default function ProfileGuard() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const checked = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || checked.current) return;
    if (pathname.startsWith("/profil") || pathname.startsWith("/auth")) return;

    checked.current = true;

    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || isProfileComplete(data)) return;
        router.push("/profil?incomplete=1");
      })
      .catch(() => {});
  }, [status, pathname, router]);

  return null;
}
