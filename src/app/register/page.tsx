"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();
  const [firstName, setFirstName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/mon-compte");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-xl border border-primary-700 bg-primary-900/40 p-8">
          <p className="text-4xl">✅</p>
          <h2 className="mt-4 font-display text-xl text-silver-100">Demande envoyée !</h2>
          <p className="mt-3 text-sm text-slate-300">
            Pour valider votre inscription, merci de cliquer sur le lien reçu à votre adresse email d'inscription.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary-300 hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl text-silver-100">Devenir membre</h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">Prénom</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Nom</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Mot de passe</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 pr-10 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200"
              tabIndex={-1}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {password && (() => {
            const score = [
              password.length >= 8,
              password.length >= 12,
              /[A-Z]/.test(password),
              /[a-z]/.test(password),
              /[0-9]/.test(password),
              /[^A-Za-z0-9]/.test(password),
            ].filter(Boolean).length;
            const levels = [
              { min: 0, label: "", bars: 0, color: "" },
              { min: 1, label: "Très faible", bars: 1, color: "bg-red-500" },
              { min: 2, label: "Faible",      bars: 2, color: "bg-orange-500" },
              { min: 3, label: "Moyen",       bars: 3, color: "bg-amber-400" },
              { min: 5, label: "Fort",        bars: 4, color: "bg-emerald-500" },
              { min: 6, label: "Très fort",   bars: 4, color: "bg-emerald-400" },
            ];
            const level = [...levels].reverse().find((l) => score >= l.min) ?? levels[0];
            if (!level.bars) return null;
            return (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${i <= level.bars ? level.color : "bg-primary-800"}`}
                    />
                  ))}
                </div>
                <p className={`mt-1 text-xs ${level.bars <= 2 ? "text-red-400" : level.bars === 3 ? "text-amber-400" : "text-emerald-400"}`}>
                  {level.label}
                </p>
              </div>
            );
          })()}
          {!password && <p className="mt-1 text-xs text-slate-500">8 caractères minimum.</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Confirmer le mot de passe</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`w-full rounded-md border bg-primary-950 px-3 py-2 pr-10 text-slate-100 placeholder:text-slate-500 focus:outline-none ${
                confirm && confirm !== password
                  ? "border-red-500 focus:border-red-400"
                  : "border-primary-700 focus:border-primary-400"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200"
              tabIndex={-1}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {confirm && confirm !== password && (
            <p className="mt-1 text-xs text-red-400">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-400">
        Déjà membre ?{" "}
        <Link href="/login" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
          Connectez-vous
        </Link>
      </p>
    </div>
  );
}
