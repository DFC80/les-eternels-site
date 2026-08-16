"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { isFullAdmin } from "@/lib/permissions";

function StarRating({
  ideaId,
  myRating,
  avgRating,
  ratingCount,
  onRate,
}: {
  ideaId: string;
  myRating: number | null;
  avgRating: number | null;
  ratingCount: number;
  onRate: (ideaId: string, star: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? myRating ?? 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onRate(ideaId, star)}
            className="px-0.5 text-xl leading-none transition-transform hover:scale-125 focus:outline-none"
            title={`${star} étoile${star > 1 ? "s" : ""}`}
          >
            <span className={star <= active ? "text-amber-400" : "text-primary-700"}>★</span>
          </button>
        ))}
      </div>
      <span className="text-xs text-slate-400">
        {ratingCount > 0
          ? `${avgRating!.toFixed(1)} (${ratingCount} vote${ratingCount > 1 ? "s" : ""})`
          : "Pas encore noté"}
      </span>
    </div>
  );
}

type IdeaUser = { firstName: string; name: string };

type Idea = {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: "HAUTE" | "MOYENNE" | "BASSE";
  showOnHome: boolean;
  createdAt: string;
  userId: string;
  user: IdeaUser;
  ratingCount: number;
  avgRating: number | null;
  myRating: number | null;
  commentCount: number;
};

type IdeaComment = {
  id: string;
  content: string;
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

type IdeaForm = { title: string; description: string; category: string; urgency: "HAUTE" | "MOYENNE" | "BASSE" };
const EMPTY_FORM: IdeaForm = { title: "", description: "", category: "", urgency: "MOYENNE" };

export default function IdeesPage() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canDeleteAny = isFullAdmin(role);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterUrgency, setFilterUrgency] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Comments state
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsCache, setCommentsCache] = useState<Record<string, IdeaComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});

  async function load() {
    const res = await fetch("/api/ideas");
    if (res.ok) {
      const data: { ideas: Idea[]; categories: string[] } = await res.json();
      setIdeas(data.ideas);
      setCategories(data.categories);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(idea: Idea) {
    setEditingId(idea.id);
    setForm({ title: idea.title, description: idea.description, category: idea.category, urgency: idea.urgency });
    setError(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function toggleShowOnHome(idea: Idea) {
    const res = await fetch(`/api/ideas/${idea.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnHome: !idea.showOnHome }),
    });
    if (res.ok) await load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(editingId ? `/api/ideas/${editingId}` : "/api/ideas", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'envoi.");
      return;
    }

    setEditingId(null);
    setForm(EMPTY_FORM);
    await load();
  }

  async function deleteIdea(id: string) {
    if (!confirm("Supprimer cette idée ?")) return;
    const res = await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function toggleComments(ideaId: string) {
    const isOpen = openComments[ideaId];
    setOpenComments((prev) => ({ ...prev, [ideaId]: !isOpen }));
    if (!isOpen && !commentsCache[ideaId]) {
      const res = await fetch(`/api/ideas/${ideaId}/comments`);
      if (res.ok) {
        const data: IdeaComment[] = await res.json();
        setCommentsCache((prev) => ({ ...prev, [ideaId]: data }));
      }
    }
  }

  async function postComment(ideaId: string) {
    const text = commentText[ideaId]?.trim();
    if (!text) return;
    setPostingComment((prev) => ({ ...prev, [ideaId]: true }));
    const res = await fetch(`/api/ideas/${ideaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setPostingComment((prev) => ({ ...prev, [ideaId]: false }));
    if (res.ok) {
      const newComment: IdeaComment = await res.json();
      setCommentsCache((prev) => ({ ...prev, [ideaId]: [...(prev[ideaId] ?? []), newComment] }));
      setCommentText((prev) => ({ ...prev, [ideaId]: "" }));
      // Update comment count in ideas list
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, commentCount: i.commentCount + 1 } : i));
    }
  }

  async function deleteComment(ideaId: string, commentId: string) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    const res = await fetch(`/api/ideas/${ideaId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (res.ok) {
      setCommentsCache((prev) => ({ ...prev, [ideaId]: (prev[ideaId] ?? []).filter((c) => c.id !== commentId) }));
      setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, commentCount: Math.max(0, i.commentCount - 1) } : i));
    }
  }

  async function rateIdea(ideaId: string, star: number) {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;
    if (idea.myRating === star) {
      await fetch(`/api/ideas/${ideaId}/rating`, { method: "DELETE" });
    } else {
      await fetch(`/api/ideas/${ideaId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: star }),
      });
    }
    await load();
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
        ref={formRef}
        onSubmit={handleSubmit}
        className="mt-8 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2"
      >
        <h2 className="col-span-full font-display text-lg text-silver-100">
          {editingId ? "Modifier l'idée" : "Proposer une idée"}
        </h2>

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

        <div className="col-span-full flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-400 px-6 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Envoi…" : editingId ? "Mettre à jour" : "Proposer l'idée"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-400 hover:border-primary-500 hover:text-slate-200"
            >
              Annuler
            </button>
          )}
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
              <div className="flex shrink-0 items-center gap-3">
                {canDeleteAny && (
                  <button
                    type="button"
                    onClick={() => toggleShowOnHome(idea)}
                    className={`text-xs transition ${
                      idea.showOnHome
                        ? "text-primary-400 hover:text-primary-300"
                        : "text-slate-500 hover:text-primary-400"
                    }`}
                    title={idea.showOnHome ? "Retirer de l'accueil" : "Publier sur l'accueil"}
                  >
                    {idea.showOnHome ? "🏠 Accueil" : "Publier accueil"}
                  </button>
                )}
                {idea.userId === userId && (
                  <button
                    type="button"
                    onClick={() => startEdit(idea)}
                    className="text-xs text-slate-500 hover:text-primary-300"
                  >
                    Modifier
                  </button>
                )}
                {(idea.userId === userId || canDeleteAny) && (
                  <button
                    type="button"
                    onClick={() => deleteIdea(idea.id)}
                    className="text-xs text-slate-500 hover:text-red-400"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{idea.description}</p>
            <div className="mt-3">
              <StarRating
                ideaId={idea.id}
                myRating={idea.myRating}
                avgRating={idea.avgRating}
                ratingCount={idea.ratingCount}
                onRate={rateIdea}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Proposée par{" "}
              <span className="text-slate-400">
                {idea.user.firstName} {idea.user.name}
              </span>{" "}
              · {new Date(idea.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            {/* Comments toggle */}
            <div className="mt-3 border-t border-primary-800 pt-3">
              <button
                type="button"
                onClick={() => toggleComments(idea.id)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary-300 transition"
              >
                <span>{openComments[idea.id] ? "▾" : "▸"}</span>
                <span>
                  {idea.commentCount > 0
                    ? `${idea.commentCount} commentaire${idea.commentCount > 1 ? "s" : ""}`
                    : "Ajouter un commentaire"}
                </span>
              </button>

              {openComments[idea.id] && (
                <div className="mt-3 space-y-3">
                  {/* Existing comments */}
                  {(commentsCache[idea.id] ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun commentaire pour l'instant.</p>
                  ) : (
                    (commentsCache[idea.id] ?? []).map((c) => (
                      <div key={c.id} className="rounded-lg border border-primary-800 bg-primary-950/60 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-slate-300">
                            {c.user.firstName} {c.user.name}
                            <span className="ml-2 font-normal text-slate-500">
                              · {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </p>
                          {(c.userId === userId || canDeleteAny) && (
                            <button
                              type="button"
                              onClick={() => deleteComment(idea.id, c.id)}
                              className="shrink-0 text-xs text-slate-600 hover:text-red-400 transition"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{c.content}</p>
                      </div>
                    ))
                  )}

                  {/* Add comment form */}
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={commentText[idea.id] ?? ""}
                      onChange={(e) => setCommentText((prev) => ({ ...prev, [idea.id]: e.target.value }))}
                      placeholder="Votre commentaire…"
                      maxLength={1000}
                      className="flex-1 resize-none rounded-lg border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!commentText[idea.id]?.trim() || postingComment[idea.id]}
                      onClick={() => postComment(idea.id)}
                      className="self-end rounded-md bg-primary-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-primary-600 disabled:opacity-40 transition"
                    >
                      {postingComment[idea.id] ? "…" : "Envoyer"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
