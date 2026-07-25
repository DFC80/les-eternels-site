"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (res?.error) {
      if (res.error === "COMPTE_EN_ATTENTE") {
        setError("Votre compte est en attente de validation par un administrateur. Vous recevrez un email de confirmation.");
      } else if (res.error === "COMPTE_DESACTIVE") {
        setError("Votre compte a été désactivé. Veuillez contacter l'association.");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl text-silver-100">Connexion</h1>
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
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-300">Mot de passe</label>
            <Link href="/forgot-password" className="text-xs text-primary-300 hover:text-silver-200 hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-400">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
          Inscrivez-vous
        </Link>
      </p>
    </div>
  );
}
