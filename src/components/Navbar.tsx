"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { canAccessAdmin } from "@/lib/permissions";

interface NavbarProps {
  nomAssociation?: string;
  logoSrc?: string;
}

export default function Navbar({ nomAssociation = "Les Éternels", logoSrc = "/logo.jpg" }: NavbarProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Accueil" },
    { href: "/activites", label: "Activités" },
    { href: "/calendar", label: "Événements" },
    { href: "/galerie", label: "Galerie" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-primary-800 bg-primary-950/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src={logoSrc} alt={`Logo ${nomAssociation}`} width={40} height={25} className="rounded" unoptimized />
          <span className="font-brand text-2xl text-silver-200">{nomAssociation}</span>
        </Link>

        <button
          className="block text-slate-200 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          ☰
        </button>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-slate-300 hover:text-white">
              {l.label}
            </Link>
          ))}

          {session && (
            <Link href="/mon-compte" className="text-sm font-medium text-slate-300 hover:text-white">
              Mon adhésion
            </Link>
          )}

          {session && (
            <Link href="/comptoir" className="text-sm font-medium text-slate-300 hover:text-white">
              🛒 Comptoir
            </Link>
          )}

          {session && (
            <Link href="/profil" className="text-sm font-medium text-slate-300 hover:text-white">
              Mon profil
            </Link>
          )}

          {session?.user?.role && canAccessAdmin(session.user.role) && (
            <Link href="/admin" className="text-sm font-medium text-slate-300 hover:text-white">
              Administration
            </Link>
          )}

          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-primary-700 bg-primary-900 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-primary-800"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-primary-900 hover:text-white"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary-400 px-3 py-1.5 text-sm font-semibold text-primary-950 hover:bg-silver-300"
              >
                Inscription
              </Link>
            </div>
          )}
        </div>
      </nav>

      {open && (
        <div className="flex flex-col gap-3 border-t border-primary-800 px-4 py-3 text-slate-200 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          {session && (
            <Link href="/mon-compte" onClick={() => setOpen(false)}>
              Mon adhésion
            </Link>
          )}
          {session && (
            <Link href="/comptoir" onClick={() => setOpen(false)}>
              🛒 Comptoir
            </Link>
          )}
          {session && (
            <Link href="/profil" onClick={() => setOpen(false)}>
              Mon profil
            </Link>
          )}
          {session?.user?.role && canAccessAdmin(session.user.role) && (
            <Link href="/admin" onClick={() => setOpen(false)}>
              Administration
            </Link>
          )}
          {session ? (
            <button onClick={() => signOut({ callbackUrl: "/" })} className="text-left">
              Déconnexion
            </button>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)}>
                Connexion
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                Inscription
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
