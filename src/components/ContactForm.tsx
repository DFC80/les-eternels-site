"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const { data: session } = useSession();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  useEffect(() => {
    if (session?.user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || session.user.name || "",
        email: prev.email || session.user.email || "",
      }));
    }
  }, [session]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, _trap: "" }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Une erreur est survenue.");
        setStatus("error");
      } else {
        setStatus("sent");
        setForm({ name: "", email: "", subject: "", message: "" });
      }
    } catch {
      setErrorMsg("Impossible de joindre le serveur. Réessayez plus tard.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-6 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold text-emerald-300">Message envoyé !</p>
        <p className="mt-1 text-sm text-slate-400">
          Nous vous répondrons dans les meilleurs délais. Un accusé de réception vous a été envoyé par e-mail.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm text-primary-300 hover:underline"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-primary-700 bg-primary-900/50 px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from real users */}
      <input type="text" name="_trap" className="hidden" tabIndex={-1} aria-hidden="true" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Nom complet *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Jean Dupont"
            maxLength={100}
            required
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">E-mail *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jean@exemple.fr"
            required
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">Sujet *</label>
        <input
          type="text"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="Demande d'information, adhésion…"
          maxLength={150}
          required
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">Message *</label>
        <textarea
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="Écrivez votre message ici…"
          rows={6}
          maxLength={5000}
          required
          className={inputCls + " resize-y"}
        />
        <p className="mt-1 text-right text-xs text-slate-600">{form.message.length}/5000</p>
      </div>

      {status === "error" && (
        <p className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg bg-primary-500 px-6 py-2.5 font-semibold text-white transition hover:bg-primary-400 disabled:opacity-50 sm:w-auto"
      >
        {status === "sending" ? "Envoi en cours…" : "Envoyer le message"}
      </button>
    </form>
  );
}
