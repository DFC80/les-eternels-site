"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isFullAdmin } from "@/lib/permissions";

type IdeaUser = { firstName: string; name: string };

type Idea = {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: "HAUTE" | "MOYENNE" | "BASSE";
  createdAt: string;
  userId: string;
  user: IdeaUser;
};

const URGENCY_LABELS: Record<string, string> = {
  HAUTE: "🔴 Haute",
  MOYENNE: "🟡 Moyenne",
  BASSE: "🟢 Basse",
};

const URGENCY_CLASSES: Record<string, string> = {
  HAUTE: "bg-red-950/60 text-red-300",
  MOYENNE: "bg-amber-950/60 text-amber-300",
  BASSE: "bg-emerald-950/60 text-emerald-300",
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

const EMPTY_FORM = { title: "", description: "", category: "", urgency: "MOYENNE" as const };

export default function IdeesPage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canDeleteAny = isFullAdmin(role);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterUrgency, setFilterUrgency] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/ideas");
    if (res.ok) {
      const data: { ideas: Idea[]; categories: string[] } = await res.json();
      setIdeas(data.ideas);
      setCategories(data.categories);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'envoi.");
      return;
    }

    setForm(EMPTY_FORM);
    await load();
  }

  async function deleteIdea(id: string) {
    if (!confirm("Supprimer cette idée ?")) return;
    const res = await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const visibleIdeas = ideas.filter((i) => {
    if (filterUrgency && i.urgency !== filterUrgency) return false;
    if (filterCategory && i.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">💡 Boite à idées</h1>
      <p className="mt-2 text-slate-400">
        Partagez vos idées pour améliorer la vie de l'association. Toutes les idées sont visibles par l'ensemble des membres.
      </p>

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2"
      >
        <h2 className="col-span-full font-display text-lg text-silver-100">Proposer une idée</h2>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Titre</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Organiser une soirée thématique"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Description</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Décrivez votre idée en détail…"
            className={inputClass + " resize-none"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Catégorie
          </label>
          <input
            required
            list="categories-list"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Ex: Événements, Matériel, Local…"
            className={inputClass}
          />
          <datalist id="categories-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Urgence</label>
          <select
            value={form.urgency}
            onChange={(e) => setForm({ ...form, urgency: e.target.value as typeof form.urgency })}
            className={inputClass}
          >
            <option value="HAUTE">🔴 Haute</option>
            <option value="MOYENNE">🟡 Moyenne</option>
            <option value="BASSE">🟢 Basse</option>
          </select>
        </div>

        {error && <p className="col-span-full text-sm text-red-400">{error}</p>}

        <div className="col-span-full">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-400 px-6 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Envoi…" : "Proposer l'idée"}
          </button>
        </div>
      </form>

      {/* Filtres */}
      {ideas.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">Filtrer :</span>
          {(["HAUTE", "MOYENNE", "BASSE"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setFilterUrgency(filterUrgency === u ? null : u)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filterUrgency === u
                  ? URGENCY_CLASSES[u]
                  : "border border-primary-700 text-slate-400 hover:border-primary-500"
              }`}
            >
              {URGENCY_LABELS[u]}
            </button>
          ))}
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategory(filterCategory === c ? null : c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filterCategory === c
                  ? "bg-primary-700 text-slate-100"
                  : "border border-primary-700 text-slate-400 hover:border-primary-500"
              }`}
            >
              {c}
            </button>
          ))}
          {(filterUrgency || filterCategory) && (
            <button
              type="button"
              onClick={() => { setFilterUrgency(null); setFilterCategory(null); }}
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* Liste des idées */}
      <div className="mt-6 space-y-4">
        {ideas.length === 0 && (
          <p className="text-slate-400">Aucune idée proposée pour l'instant. Soyez le premier !</p>
        )}
        {visibleIdeas.length === 0 && ideas.length > 0 && (
          <p className="text-sm text-slate-400">Aucune idée ne correspond à ces filtres.</p>
        )}
        {visibleIdeas.map((idea) => (
          <div
            key={idea.id}
            className="rounded-xl border border-primary-800 bg-primary-900/40 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg text-silver-100">{idea.title}</h3>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${URGENCY_CLASSES[idea.urgency]}`}>
                  {URGENCY_LABELS[idea.urgency]}
                </span>
                <span className="rounded bg-primary-800/60 px-2 py-0.5 text-xs text-slate-400">
                  {idea.category}
                </span>
              </div>
              {(idea.userId === userId || canDeleteAny) && (
                <button
                  type="button"
                  onClick={() => deleteIdea(idea.id)}
                  className="shrink-0 text-xs text-slate-500 hover:text-red-400"
                >
                  Supprimer
                </button>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{idea.description}</p>
            <p className="mt-3 text-xs text-slate-500">
              Proposée par{" "}
              <span className="text-slate-400">
                {idea.user.firstName} {idea.user.name}
              </span>{" "}
              · {new Date(idea.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
