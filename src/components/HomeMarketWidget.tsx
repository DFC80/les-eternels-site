"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatCentsToEuros } from "@/lib/money";

type ListingUser = { id: string; firstName: string; name: string };
type Listing = {
  id: string;
  type: "VENTE" | "ECHANGE" | "RECHERCHE";
  title: string;
  description: string;
  price: number | null;
  photos: string | null;
  category: string | null;
  status: "ACTIVE" | "VENDU" | "CLOS";
  createdAt: string;
  user: ListingUser;
};

const TYPE_INFO: Record<string, { label: string; color: string; bg: string }> = {
  VENTE:     { label: "Vente",     color: "text-emerald-300", bg: "bg-emerald-900/60" },
  ECHANGE:   { label: "Échange",   color: "text-blue-300",    bg: "bg-blue-900/60" },
  RECHERCHE: { label: "Recherche", color: "text-amber-300",   bg: "bg-amber-900/60" },
};

type FormState = {
  type: string;
  title: string;
  description: string;
  price: string;
  category: string;
};

const EMPTY_FORM: FormState = { type: "VENTE", title: "", description: "", price: "", category: "" };

export default function HomeMarketWidget() {
  const { data: session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function load() {
    const res = await fetch("/api/marketplace");
    if (!res.ok) return;
    const all: Listing[] = await res.json();
    const active = all.filter((l) => l.status === "ACTIVE");
    setTotalActive(active.length);
    setListings(active.slice(0, 3));
  }

  useEffect(() => { load(); }, []);

  if (!session) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || null,
      };
      if (form.type === "VENTE" && form.price.trim()) {
        const val = parseFloat(form.price.replace(",", "."));
        if (!isNaN(val) && val > 0) body.price = Math.round(val * 100);
      }
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la publication.");
      } else {
        setForm(EMPTY_FORM);
        setShowForm(false);
        setSuccess(true);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-silver-100">🛒 Brocante airsoft</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowForm((v) => !v); setError(null); setSuccess(false); }}
            className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold text-primary-950 hover:bg-primary-400"
          >
            {showForm ? "Annuler" : "+ Déposer une annonce"}
          </button>
          <Link
            href="/marche"
            className="rounded-md border border-primary-700 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-900"
          >
            Voir tout{totalActive > 0 ? ` (${totalActive})` : ""} →
          </Link>
        </div>
      </div>

      {success && (
        <p className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300">
          ✓ Annonce publiée avec succès !{" "}
          <Link href="/marche" className="font-medium underline hover:text-emerald-200">
            Ajouter des photos depuis la brocante
          </Link>
        </p>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="mt-4 space-y-3 rounded-xl border border-primary-700 bg-primary-900/60 p-4"
        >
          {/* Type selector */}
          <div className="flex gap-2">
            {(["VENTE", "ECHANGE", "RECHERCHE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  form.type === t
                    ? "bg-primary-400 text-primary-950"
                    : "border border-primary-700 text-slate-300 hover:border-primary-500"
                }`}
              >
                {TYPE_INFO[t].label}
              </button>
            ))}
          </div>

          <input
            required
            placeholder="Titre *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-sm text-silver-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none"
          />

          <textarea
            required
            rows={3}
            placeholder="Description * (état, marque, accessoires inclus…)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full resize-none rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-sm text-silver-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none"
          />

          <div className="flex flex-wrap gap-2">
            {form.type === "VENTE" && (
              <input
                placeholder="Prix en € (ex: 45)"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-32 rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-sm text-silver-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none"
              />
            )}
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-sm text-slate-300 focus:border-primary-500 focus:outline-none"
            >
              <option value="">Catégorie…</option>
              <option value="REPLIQUE">Réplique</option>
              <option value="PROTECTION">Protection</option>
              <option value="TENUE">Tenue</option>
              <option value="ACCESSOIRE">Accessoire</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Les photos s&apos;ajoutent depuis la page{" "}
              <Link href="/marche" className="text-primary-400 hover:underline">
                Brocante
              </Link>
              .
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="flex-shrink-0 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
            >
              {submitting ? "Publication…" : "Publier l'annonce"}
            </button>
          </div>
        </form>
      )}

      {listings.length === 0 && !showForm && (
        <div className="mt-4 rounded-xl border border-primary-800 bg-primary-900/50 py-8 text-center">
          <p className="text-slate-400">Aucune annonce active pour le moment.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold text-primary-950 hover:bg-primary-400"
          >
            + Soyez le premier à déposer une annonce
          </button>
        </div>
      )}

      {listings.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {listings.map((l) => {
            const t = TYPE_INFO[l.type] ?? TYPE_INFO.VENTE;
            const firstPhoto = l.photos?.split("\n").find((u) => u.trim());
            return (
              <Link
                key={l.id}
                href="/marche"
                className="rounded-xl border border-primary-800 bg-primary-900/50 p-3 transition hover:border-primary-600 hover:bg-primary-800/60"
              >
                {firstPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firstPhoto}
                    alt=""
                    className="mb-2 h-28 w-full rounded-lg object-cover"
                  />
                )}
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${t.bg} ${t.color}`}>
                  {t.label}
                </span>
                <h3 className="mt-1 font-display text-sm text-silver-100 line-clamp-2">{l.title}</h3>
                {l.price != null && (
                  <p className="mt-0.5 text-sm font-semibold text-primary-300">{formatCentsToEuros(l.price)}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {l.user.firstName} · {new Date(l.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
