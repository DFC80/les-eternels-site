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

const CATEGORIES = ["REPLIQUE", "PROTECTION", "TENUE", "ACCESSOIRE", "AUTRE"];
const CATEGORY_LABELS: Record<string, string> = {
  REPLIQUE:   "Réplique",
  PROTECTION: "Protection",
  TENUE:      "Tenue",
  ACCESSOIRE: "Accessoire",
  AUTRE:      "Autre",
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Disponible",
  VENDU:  "Vendu / Échangé",
  CLOS:   "Annonce close",
};

type FormState = {
  type: string;
  title: string;
  description: string;
  price: string;
  category: string;
  photos: string;
};

const EMPTY_FORM: FormState = {
  type: "VENTE",
  title: "",
  description: "",
  price: "",
  category: "",
  photos: "",
};

function ListingForm({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-slate-400">Type d&apos;annonce</label>
        <div className="flex flex-wrap gap-2">
          {(["VENTE", "ECHANGE", "RECHERCHE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...form, type: t })}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                form.type === t
                  ? "border-primary-400 bg-primary-900 text-silver-100"
                  : "border-primary-800 bg-primary-950/40 text-slate-400 hover:border-primary-600"
              }`}
            >
              {TYPE_INFO[t].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400">Titre *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          placeholder="Ex : Réplique M4 AEG, gilet tactique…"
          className="w-full rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-primary-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400">Description *</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="État, caractéristiques, conditions de vente…"
          className="w-full rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-primary-500 focus:outline-none"
        />
      </div>

      {form.type === "VENTE" && (
        <div>
          <label className="mb-1 block text-xs text-slate-400">Prix (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => onChange({ ...form, price: e.target.value })}
            placeholder="0.00"
            className="w-32 rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-primary-500 focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-slate-400">Catégorie</label>
        <select
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          className="rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
        >
          <option value="">— Non spécifiée —</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400">Liens photos (un par ligne)</label>
        <textarea
          rows={2}
          value={form.photos}
          onChange={(e) => onChange({ ...form, photos: e.target.value })}
          placeholder="https://…"
          className="w-full rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-primary-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  currentUserId,
  onChanged,
}: {
  listing: Listing;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const isOwner = currentUserId === listing.user.id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setForm({
      type: listing.type,
      title: listing.title,
      description: listing.description,
      price: listing.price != null ? String(listing.price / 100) : "",
      category: listing.category ?? "",
      photos: listing.photos ?? "",
    });
    setError(null);
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/${listing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
          price:
            form.type === "VENTE" && form.price
              ? Math.round(parseFloat(form.price) * 100)
              : null,
          category: form.category || null,
          photos: form.photos || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Erreur.");
        return;
      }
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    await fetch(`/api/marketplace/${listing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChanged();
  }

  async function deleteListing() {
    if (!confirm("Supprimer cette annonce ?")) return;
    await fetch(`/api/marketplace/${listing.id}`, { method: "DELETE" });
    onChanged();
  }

  const typeInfo = TYPE_INFO[listing.type] ?? TYPE_INFO.VENTE;
  const photos = listing.photos ? listing.photos.split("\n").filter(Boolean) : [];

  if (editing) {
    return (
      <div className="rounded-xl border border-primary-600 bg-primary-900/70 p-4 sm:p-5">
        <p className="mb-3 font-display text-sm text-primary-300">Modifier l&apos;annonce</p>
        <ListingForm form={form} onChange={setForm} />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={saveEdit}
            disabled={saving}
            className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-primary-900/50 p-4 sm:p-5 ${
        listing.status !== "ACTIVE"
          ? "border-primary-800 opacity-60"
          : "border-primary-700"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                typeInfo.bg
              } ${typeInfo.color}`}
            >
              {typeInfo.label}
            </span>
            {listing.category && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                {CATEGORY_LABELS[listing.category] ?? listing.category}
              </span>
            )}
            {listing.status !== "ACTIVE" && (
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                {STATUS_LABELS[listing.status]}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-lg text-silver-100">{listing.title}</h3>
        </div>
        {listing.type === "VENTE" && listing.price != null && (
          <span className="text-lg font-bold text-emerald-300">
            {formatCentsToEuros(listing.price)}
          </span>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
        {listing.description}
      </p>

      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-400 underline hover:text-primary-300"
            >
              Photo {i + 1}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {listing.user.firstName} {listing.user.name} &middot;{" "}
          {new Date(listing.createdAt).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        {isOwner && listing.status === "ACTIVE" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={startEdit}
              className="rounded border border-primary-700 px-2 py-1 text-xs text-primary-300 hover:bg-primary-800"
            >
              Modifier
            </button>
            <button
              onClick={() => updateStatus("VENDU")}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
            >
              Marquer vendu
            </button>
            <button
              onClick={() => updateStatus("CLOS")}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
            >
              Clore
            </button>
            <button
              onClick={deleteListing}
              className="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
            >
              Supprimer
            </button>
          </div>
        )}

        {isOwner && listing.status !== "ACTIVE" && (
          <div className="flex gap-2">
            <button
              onClick={() => updateStatus("ACTIVE")}
              className="rounded border border-primary-700 px-2 py-1 text-xs text-primary-300 hover:bg-primary-800"
            >
              Réactiver
            </button>
            <button
              onClick={deleteListing}
              className="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarchePage() {
  const { data: session, status } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "VENTE" | "ECHANGE" | "RECHERCHE">("ALL");
  const [showClosed, setShowClosed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/marketplace");
    if (res.ok) setListings((await res.json()) as Listing[]);
    setLoading(false);
  }

  useEffect(() => {
    if (session) {
      load().catch(console.error);
    } else if (status !== "loading") {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
          price:
            form.type === "VENTE" && form.price
              ? Math.round(parseFloat(form.price) * 100)
              : null,
          category: form.category || null,
          photos: form.photos || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setFormError(d.error ?? "Erreur.");
        return;
      }
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-slate-400">Chargement…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl text-silver-100">Brocante airsoft</h1>
        <p className="mt-4 text-slate-400">
          <Link href="/login" className="text-primary-300 hover:underline">
            Connectez-vous
          </Link>{" "}
          pour accéder à la brocante réservée aux membres.
        </p>
      </div>
    );
  }

  const userId = (session.user as { id?: string } | null)?.id;
  const myListings = listings.filter((l) => l.user.id === userId);
  const myActiveListings = myListings.filter((l) => l.status === "ACTIVE");
  const myClosedListings = myListings.filter((l) => l.status !== "ACTIVE");
  const otherListings = listings.filter((l) => l.user.id !== userId);
  const filtered =
    filter === "ALL" ? otherListings : otherListings.filter((l) => l.type === filter);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-silver-100">Brocante airsoft</h1>
          <p className="mt-1 text-sm text-slate-400">
            Espace réservé aux membres — vente, échange et recherche d&apos;équipements.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm((o) => !o);
            setFormError(null);
            setForm({ ...EMPTY_FORM });
          }}
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400"
        >
          {showForm ? "Annuler" : "+ Déposer une annonce"}
        </button>
      </div>

      {showForm && (
        <div className="mt-6 rounded-xl border border-primary-600 bg-primary-900/60 p-4 sm:p-6">
          <h2 className="mb-4 font-display text-lg text-silver-100">Nouvelle annonce</h2>
          <ListingForm form={form} onChange={setForm} />
          {formError && <p className="mt-2 text-sm text-red-400">{formError}</p>}
          <button
            onClick={submit}
            disabled={submitting}
            className="mt-4 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50"
          >
            {submitting ? "Publication…" : "Publier l&apos;annonce"}
          </button>
        </div>
      )}

      {myActiveListings.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 font-display text-xl text-silver-100">Mes annonces</h2>
          <div className="space-y-4">
            {myActiveListings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                currentUserId={userId}
                onChanged={load}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-silver-100">
            Annonces des membres
            {filtered.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({filtered.length})
              </span>
            )}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "VENTE", "ECHANGE", "RECHERCHE"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f
                    ? "bg-primary-500 text-primary-950"
                    : "border border-primary-800 text-slate-400 hover:border-primary-600 hover:text-slate-200"
                }`}
              >
                {f === "ALL" ? "Tout" : TYPE_INFO[f].label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-slate-400">
            {filter === "ALL"
              ? "Aucune annonce pour le moment."
              : `Aucune annonce de type « ${TYPE_INFO[filter].label} » pour le moment.`}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {filtered.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                currentUserId={userId}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </div>

      {myClosedListings.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowClosed((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-primary-800 bg-primary-900/40 px-4 py-3 text-left transition hover:bg-primary-800/60"
          >
            <span className="font-display text-base text-silver-100">
              Mes annonces closes / vendues
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({myClosedListings.length})
              </span>
            </span>
            <span
              className="text-slate-400 transition-transform duration-200"
              style={{
                display: "inline-block",
                transform: showClosed ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▾
            </span>
          </button>
          {showClosed && (
            <div className="mt-3 space-y-4">
              {myClosedListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  currentUserId={userId}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
