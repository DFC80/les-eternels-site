"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Une erreur est survenue.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl text-silver-100">Mot de passe oublié</h1>

      {submitted ? (
        <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
          <p className="text-slate-300">
            Si un compte existe avec cette adresse email, vous recevrez dans quelques instants un lien pour réinitialiser votre mot de passe.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Ce lien est valable 1 heure. Pensez à vérifier vos spams.
          </p>
          <Link
            href="/login"
            className="mt-6 block text-center text-sm font-medium text-primary-300 hover:text-silver-200 hover:underline"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-slate-400">
            Saisissez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6">
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

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
            >
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            <Link href="/login" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
