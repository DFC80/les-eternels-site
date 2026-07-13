"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
        <p className="text-red-400">Lien invalide ou manquant.</p>
        <Link href="/forgot-password" className="mt-4 block text-sm font-medium text-primary-300 hover:underline">
          Faire une nouvelle demande
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Une erreur est survenue.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
        <p className="text-emerald-400 font-medium">Mot de passe modifié avec succès !</p>
        <p className="mt-2 text-sm text-slate-400">Vous allez être redirigé vers la connexion…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
      <div>
        <label className="block text-sm font-medium text-slate-300">Nouveau mot de passe</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
          placeholder="8 caractères minimum"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300">Confirmer le mot de passe</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
      >
        {loading ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl text-silver-100">Nouveau mot de passe</h1>
      <p className="mt-2 text-slate-400">Choisissez un nouveau mot de passe pour votre compte.</p>
      <Suspense fallback={<div className="mt-8 text-slate-400">Chargement…</div>}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-6 text-sm text-slate-400">
        <Link href="/login" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
