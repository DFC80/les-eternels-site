"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setFirstName(data.firstName ?? "");
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="rounded-xl border border-primary-700 bg-primary-900/40 p-8">
        {status === "loading" && (
          <p className="text-slate-400">Vérification en cours...</p>
        )}

        {status === "success" && (
          <>
            <p className="text-4xl">✅</p>
            <h2 className="mt-4 font-display text-xl text-silver-100">
              {firstName ? `Bienvenue ${firstName} !` : "Compte activé !"}
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Votre adresse email a été confirmée. Vous pouvez maintenant vous connecter.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-primary-400 px-6 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300"
            >
              Se connecter
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-4xl">❌</p>
            <h2 className="mt-4 font-display text-xl text-silver-100">Lien invalide</h2>
            <p className="mt-3 text-sm text-slate-300">
              Ce lien de confirmation est invalide ou a déjà été utilisé.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-sm font-medium text-primary-300 hover:underline"
            >
              Retour à l'accueil
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
