"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { canAccessAdmin } from "@/lib/permissions";
import { formatCentsToEuros } from "@/lib/money";

interface NavbarProps {
  nomAssociation?: string;
  logoSrc?: string;
}

export default function Navbar({ nomAssociation = "Les Éternels", logoSrc = "/logo.jpg" }: NavbarProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [hasMembership, setHasMembership] = useState(false);

  useEffect(() => {
    if (!session) { setBalance(null); setHasMembership(false); return; }
    const fetchBalance = () =>
      fetch("/api/balance").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setBalance(d.balance); });
    fetchBalance();
    const id = setInterval(fetchBalance, 10000);
    fetch("/api/membership").then((r) => r.ok ? r.json() : null).then((d) => setHasMembership(!!(d?.id)));
    return () => clearInterval(id);
  }, [session]);

  const links = [
    { href: "/actualites", label: "Actualités" },
    ...(session && hasMembership
      ? [
          { href: "/sondages", label: "Sondages" },
          { href: "/marche", label: "Brocante" },
        ]
      : []),
    { href: "/activites", label: "Activités" },
    { href: "/calendar", label: "Événements" },
    { href: "/galerie", label: "Galerie" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-primary-800 bg-primary-950/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex flex-shrink-0 items-center gap-2">
          <Image src={logoSrc} alt={`Logo ${nomAssociation}`} width={40} height={25} className="rounded" unoptimized />
          <span className="whitespace-nowrap font-brand text-xl text-silver-200 xl:text-2xl">{nomAssociation}</span>
        </Link>

        <button
          className="flex h-10 w-10 items-center justify-center text-xl text-slate-200 lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          ☰
        </button>

        <div className="hidden items-center gap-3 lg:flex">
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
            <Link href="/profil" className="text-sm font-medium text-slate-300 hover:text-white">
              Mon profil
            </Link>
          )}

          {session?.user?.role && canAccessAdmin(session.user.role) && (
            <Link href="/admin" className="text-sm font-medium text-slate-300 hover:text-white">
              Admin
            </Link>
          )}

          {session ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-primary-700 bg-primary-900 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-primary-800"
              >
                Déconnexion
              </button>
              {balance !== null && (
                <div className="relative group">
                  <Link
                    href="/profil"
                    className="rounded-md border border-primary-700 bg-primary-900/60 px-3 py-1.5 text-sm font-medium text-primary-300 hover:bg-primary-800 hover:text-primary-200 transition-colors"
                  >
                    💳 {formatCentsToEuros(balance)}
                  </Link>
                  <div className="pointer-events-none absolute right-0 top-full mt-2 w-56 rounded-lg border border-primary-700 bg-primary-950 px-3 py-2.5 text-xs text-slate-300 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    <p className="font-semibold text-silver-100 mb-1">Solde comptoir</p>
                    <p>Crédit disponible pour régler vos consommations au comptoir lors des événements.</p>
                    <p className="mt-1.5 text-primary-400">Cliquez pour recharger →</p>
                  </div>
                </div>
              )}
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
        <div className="flex flex-col border-t border-primary-800 px-4 py-2 text-slate-200 lg:hidden">
          <Link href="/" onClick={() => setOpen(false)} className="block py-2.5 text-sm">Accueil</Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm">
              {l.label}
            </Link>
          ))}
          {session && (
            <Link href="/mon-compte" onClick={() => setOpen(false)} className="block py-2.5 text-sm">
              Mon adhésion
            </Link>
          )}
          {session && (
            <Link href="/profil" onClick={() => setOpen(false)} className="block py-2.5 text-sm">
              Mon profil
            </Link>
          )}
          {session?.user?.role && canAccessAdmin(session.user.role) && (
            <Link href="/admin" onClick={() => setOpen(false)} className="block py-2.5 text-sm">
              Administration
            </Link>
          )}
          {session ? (
            <>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="py-2.5 text-left text-sm">
                Déconnexion
              </button>
              {balance !== null && (
                <Link href="/profil" onClick={() => setOpen(false)} className="py-1.5 text-sm font-medium text-primary-300">
                  💳 {formatCentsToEuros(balance)}
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="block py-2.5 text-sm">
                Connexion
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="block py-2.5 text-sm">
                Inscription
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
