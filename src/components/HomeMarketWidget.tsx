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
  activityKey: string | null;
  visibility: string;
  status: "ACTIVE" | "VENDU" | "CLOS";
  createdAt: string;
  user: ListingUser;
};

const TYPE_INFO: Record<string, { label: string; color: string; bg: string }> = {
  VENTE:     { label: "Vente",     color: "text-emerald-300", bg: "bg-emerald-900/60" },
  ECHANGE:   { label: "Échange",   color: "text-blue-300",    bg: "bg-blue-900/60" },
  RECHERCHE: { label: "Recherche", color: "text-amber-300",   bg: "bg-amber-900/60" },
};

const ACTIVITIES = [
  { key: "JEUX_DE_PLATEAU", label: "🎲 Jeux de société" },
  { key: "JEUX_DE_ROLE",    label: "🐉 Jeux de rôle" },
  { key: "AIRSOFT",         label: "🎯 Airsoft" },
];

type FormState = {
  type: string;
  title: string;
  description: string;
  price: string;
  category: string;
  activityKey: string;
  visibility: string;
};

const EMPTY_FORM: FormState = {
  type: "VENTE", title: "", description: "", price: "",
  category: "", activityKey: "", visibility: "ALL",
};

type VisibilityEdit = { activityKey: string; visibility: string };

function VisibilityPanel({
  listing,
  onSaved,
  onClose,
}: {
  listing: Listing;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [activityKey, setActivityKey] = useState(listing.activityKey ?? "");
  const [visibility, setVisibility] = useState(listing.visibility ?? "ALL");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/marketplace/${listing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityKey: activityKey || null,
        visibility: activityKey ? visibility : "ALL",
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div
      className="mt-2 space-y-2 rounded-lg border border-primary-700 bg-primary-950 p-3"
      onClick={(e) => e.preventDefault()}
    >
      <p className="text-xs font-semibold text-slate-400">Visibilité de l&apos;annonce</p>

      <select
        value={activityKey}
        onChange={(e) => {
          const k = e.target.value;
          setActivityKey(k);
          if (!k) setVisibility("ALL");
        }}
        className="w-full rounded border border-primary-800 bg-primary-900 px-2 py-1.5 text-xs text-slate-200 focus:border-primary-500 focus:outline-none"
      >
        <option value="">Toutes les activités</option>
        {ACTIVITIES.map((a) => (
          <option key={a.key} value={a.key}>{a.label}</option>
        ))}
      </select>

      {activityKey && (
        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="radio"
              name={`vis-${listing.id}`}
              value="ALL"
              checked={visibility === "ALL"}
              onChange={() => setVisibility("ALL")}
              className="accent-primary-400"
            />
            Visible par tous les membres
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="radio"
              name={`vis-${listing.id}`}
              value="ACTIVITY"
              checked={visibility === "ACTIVITY"}
              onChange={() => setVisibility("ACTIVITY")}
              className="accent-primary-400"
            />
            Membres de l&apos;activité uniquement
          </label>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary-500 px-3 py-1 text-xs font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
        <button
          onClick={onClose}
          className="rounded border border-primary-800 px-3 py-1 text-xs text-slate-400 hover:bg-primary-900"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function HomeMarketWidget() {
  const { data: session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingVisibilityId, setEditingVisibilityId] = useState<string | null>(null);

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

  const currentUserId = (session.user as { id?: string })?.id;

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
        activityKey: form.activityKey || null,
        visibility: form.activityKey ? form.visibility : "ALL",
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
        <h2 className="font-display text-2xl text-silver-100">🛒 Brocante</h2>
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
          {/* Type */}
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
            <select
              value={form.activityKey}
              onChange={(e) => {
                const key = e.target.value;
                setForm((f) => ({ ...f, activityKey: key, visibility: key ? f.visibility : "ALL" }));
              }}
              className="rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-sm text-slate-300 focus:border-primary-500 focus:outline-none"
            >
              <option value="">Toutes activités</option>
              {ACTIVITIES.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>

          {form.activityKey && (
            <div className="flex items-center gap-3 rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2">
              <span className="text-xs text-slate-400">Visibilité :</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="radio"
                  name="visibility"
                  value="ALL"
                  checked={form.visibility === "ALL"}
                  onChange={() => setForm((f) => ({ ...f, visibility: "ALL" }))}
                  className="accent-primary-400"
                />
                Tous les membres
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="radio"
                  name="visibility"
                  value="ACTIVITY"
                  checked={form.visibility === "ACTIVITY"}
                  onChange={() => setForm((f) => ({ ...f, visibility: "ACTIVITY" }))}
                  className="accent-primary-400"
                />
                Membres de l&apos;activité uniquement
              </label>
            </div>
          )}

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
            const activity = ACTIVITIES.find((a) => a.key === l.activityKey);
            const isOwner = l.user.id === currentUserId;
            const isEditingVisibility = editingVisibilityId === l.id;

            return (
              <div key={l.id} className="rounded-xl border border-primary-800 bg-primary-900/50 p-3 transition hover:border-primary-600 hover:bg-primary-800/60">
                <Link href="/marche" className="block">
                  {firstPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firstPhoto}
                      alt=""
                      className="mb-2 h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="flex flex-wrap gap-1">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${t.bg} ${t.color}`}>
                      {t.label}
                    </span>
                    {activity && (
                      <span className="inline-block rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                        {activity.label}
                      </span>
                    )}
                    {l.visibility === "ACTIVITY" && (
                      <span className="inline-block rounded-full border border-primary-800 bg-primary-950 px-2 py-0.5 text-xs text-primary-400">
                        🔒
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 font-display text-sm text-silver-100 line-clamp-2">{l.title}</h3>
                  {l.price != null && (
                    <p className="mt-0.5 text-sm font-semibold text-primary-300">{formatCentsToEuros(l.price)}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {l.user.firstName} · {new Date(l.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </Link>

                {isOwner && (
                  <div className="mt-2 border-t border-primary-800 pt-2">
                    {!isEditingVisibility ? (
                      <button
                        onClick={() => setEditingVisibilityId(l.id)}
                        className="text-xs text-slate-500 hover:text-primary-300"
                      >
                        ✏ Visibilité :{" "}
                        <span className="text-slate-400">
                          {l.visibility === "ACTIVITY"
                            ? `🔒 ${activity?.label ?? "Activité"}`
                            : "🌐 Tous les membres"}
                        </span>
                      </button>
                    ) : (
                      <VisibilityPanel
                        listing={l}
                        onSaved={load}
                        onClose={() => setEditingVisibilityId(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
