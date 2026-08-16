"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { canAccessAdmin } from "@/lib/permissions";
import { formatCentsToEuros } from "@/lib/money";

interface NavbarProps {
  nomAssociation?: string;
  logoSrc?: string;
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function Navbar({ nomAssociation = "Les Éternels", logoSrc = "/logo.jpg" }: NavbarProps) {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [hasMembership, setHasMembership] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) { setBalance(null); setHasMembership(false); setAvatarSrc(null); return; }
    const fetchBalance = () =>
      fetch("/api/balance").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setBalance(d.balance); });
    fetchBalance();
    const id = setInterval(fetchBalance, 10000);
    fetch("/api/membership").then((r) => r.ok ? r.json() : null).then((d) => setHasMembership(!!(d?.id)));
    fetch("/api/avatar").then((r) => r.ok ? r.blob() : null).then((b) => {
      if (b) setAvatarSrc(URL.createObjectURL(b));
    }).catch(() => {});
    return () => clearInterval(id);
  }, [session]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isAdmin = session?.user?.role && canAccessAdmin(session.user.role);

  function initials(fullName?: string | null) {
    if (!fullName) return "?";
    const parts = fullName.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }

  const associationItems = [
    { href: "/activites", label: "Activités", icon: "🎲" },
    { href: "/lieux-de-jeu", label: "Lieux de jeu", icon: "📍" },
    { href: "/galerie", label: "Galerie", icon: "🖼️" },
    { href: "/calendar", label: "Événements", icon: "📅" },
  ];

  const membreItems = session
    ? [
        { href: "/documents", label: "Documents", icon: "📁" },
        { href: "/idees", label: "Idées", icon: "💡" },
        { href: "/boutique", label: "Boutique", icon: "🛍️" },
        ...(hasMembership
          ? [
              { href: "/sondages", label: "Sondages", icon: "📊" },
              { href: "/marche", label: "Brocante", icon: "🏪" },
            ]
          : []),
      ]
    : [];

  // Flat list for mobile (identical to before)
  const mobileLinks = [
    { href: "/actualites", label: "Actualités" },
    ...(session && hasMembership
      ? [{ href: "/sondages", label: "Sondages" }, { href: "/marche", label: "Brocante" }]
      : []),
    ...(session
      ? [{ href: "/documents", label: "Documents" }, { href: "/idees", label: "Idées" }, { href: "/boutique", label: "Boutique" }]
      : []),
    { href: "/activites", label: "Activités" },
    { href: "/lieux-de-jeu", label: "Lieux de jeu" },
    { href: "/calendar", label: "Événements" },
    { href: "/galerie", label: "Galerie" },
    { href: "/contact", label: "Contact" },
  ];

  const dropdownClass =
    "absolute left-0 top-full mt-1 w-48 rounded-xl border border-primary-700 bg-primary-950 py-1 shadow-xl z-50";
  const dropdownItemClass =
    "flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-primary-900 hover:text-white";
  const navBtnClass =
    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-primary-900 hover:text-white";

  return (
    <header className="sticky top-0 z-50 border-b border-primary-800 bg-primary-950/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">

        {/* Logo */}
        <Link href="/" className="flex flex-shrink-0 items-center gap-2">
          <Image src={logoSrc} alt={`Logo ${nomAssociation}`} width={40} height={25} className="rounded" unoptimized />
          <span className="whitespace-nowrap font-brand text-xl text-silver-200 xl:text-2xl">{nomAssociation}</span>
        </Link>

        {/* Hamburger (mobile) */}
        <button
          className="flex h-10 w-10 items-center justify-center text-xl text-slate-200 lg:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>

        {/* Desktop nav */}
        <div ref={navRef} className="hidden items-center gap-1 lg:flex">

          {/* Actualités */}
          <Link href="/actualites" className={navBtnClass}>
            Actualités
          </Link>

          {/* Association dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown((o) => o === "association" ? null : "association")}
              className={`${navBtnClass} ${openDropdown === "association" ? "bg-primary-900 text-white" : ""}`}
            >
              Association <ChevronDown open={openDropdown === "association"} />
            </button>
            {openDropdown === "association" && (
              <div className={dropdownClass}>
                {associationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenDropdown(null)}
                    className={dropdownItemClass}
                  >
                    <span>{item.icon}</span> {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Espace membres dropdown */}
          {session && (
            <div className="relative">
              <button
                onClick={() => setOpenDropdown((o) => o === "membres" ? null : "membres")}
                className={`${navBtnClass} ${openDropdown === "membres" ? "bg-primary-900 text-white" : ""}`}
              >
                Espace membres <ChevronDown open={openDropdown === "membres"} />
              </button>
              {openDropdown === "membres" && (
                <div className={dropdownClass}>
                  {membreItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenDropdown(null)}
                      className={dropdownItemClass}
                    >
                      <span>{item.icon}</span> {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact */}
          <Link href="/contact" className={navBtnClass}>
            Contact
          </Link>

          {/* User section */}
          <div className="ml-2 flex items-center gap-2 border-l border-primary-800 pl-3">
            {session ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-primary-700 bg-primary-900 p-0.5 pr-2.5 text-sm font-medium text-slate-200 transition hover:bg-primary-800"
                  aria-label="Mon compte"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-800 text-xs font-semibold uppercase text-slate-300">
                    {avatarSrc
                      ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                      : initials(session.user?.name)}
                  </span>
                  <span className="hidden xl:inline">{session.user?.name?.split(" ")[0]}</span>
                  <ChevronDown open={userMenuOpen} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-primary-700 bg-primary-950 py-1 shadow-xl">
                    {balance !== null && (
                      <div className="border-b border-primary-800 px-4 py-2.5">
                        <Link
                          href="/profil"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-slate-400">Solde comptoir</span>
                          <span className="font-semibold text-primary-300">💳 {formatCentsToEuros(balance)}</span>
                        </Link>
                      </div>
                    )}
                    <Link
                      href="/profil"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-primary-900 hover:text-white"
                    >
                      <span>👤</span> Mon profil
                    </Link>
                    <Link
                      href="/mon-compte"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-primary-900 hover:text-white"
                    >
                      <span>📋</span> Mon adhésion
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-primary-900 hover:text-white"
                      >
                        <span>⚙️</span> Administration
                      </Link>
                    )}
                    <div className="mt-1 border-t border-primary-800 pt-1">
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:bg-primary-900 hover:text-red-400"
                      >
                        <span>↩</span> Déconnexion
                      </button>
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
        </div>
      </nav>

      {/* Mobile menu — flat list */}
      {mobileOpen && (
        <div className="flex flex-col border-t border-primary-800 bg-primary-950 px-4 py-2 lg:hidden">
          <Link href="/" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-slate-200">
            Accueil
          </Link>
          {mobileLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm text-slate-200"
            >
              {l.label}
            </Link>
          ))}

          {session && (
            <>
              <div className="my-2 border-t border-primary-800" />
              <Link
                href="/profil"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-700 bg-primary-800 text-sm font-semibold uppercase text-slate-300">
                  {avatarSrc
                    ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                    : initials(session.user?.name)}
                </span>
                <span className="text-sm text-slate-200">{session.user?.name}</span>
              </Link>
              <Link href="/profil" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-slate-200">
                Mon profil
              </Link>
              <Link href="/mon-compte" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-slate-200">
                Mon adhésion
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-slate-200">
                  Administration
                </Link>
              )}
              {balance !== null && (
                <Link href="/profil" onClick={() => setMobileOpen(false)} className="py-2.5 text-sm font-medium text-primary-300">
                  💳 {formatCentsToEuros(balance)}
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="py-2.5 text-left text-sm text-slate-400"
              >
                Déconnexion
              </button>
            </>
          )}

          {!session && (
            <>
              <div className="my-2 border-t border-primary-800" />
              <Link href="/login" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-slate-200">
                Connexion
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm text-slate-200">
                Inscription
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
