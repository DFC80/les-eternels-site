"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import ProfileGuard from "./ProfileGuard";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ProfileGuard />
      {children}
    </SessionProvider>
  );
}
