"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isFullAdmin } from "@/lib/permissions";

type AdminNote = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = { title: "", description: "", isActive: true };

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function AdminNotesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";

  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotes() {
    const res = await fetch("/api/admin/notes");
    if (res.ok) setNotes(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadNotes(); }, []);

  function startEdit(note: AdminNote) {
    setEditingId(note.id);
    setForm({ title: note.title, description: note.description, isActive: note.isActive });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError("Le titre est requis."); return; }
    setSaving(true);

    const url = editingId ? `/api/admin/notes/${editingId}` : "/api/admin/notes";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }

    setEditingId(null);
    setForm(EMPTY_FORM);
    await loadNotes();
  }

  async function toggleActive(note: AdminNote) {
    await fetch(`/api/admin/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !note.isActive }),
    });
    await loadNotes();
  }

  async function deleteNote(id: string) {
    if (!confirm("Supprimer cette note ?")) return;
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" });
    await loadNotes();
  }

  if (!isFullAdmin(role)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-slate-400">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">📝 Notes admin</h1>
      <p className="mt-2 text-slate-400">
        Espace de notes interne réservé aux administrateurs.
      </p>

      {/* Formulaire création / édition */}
      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6 space-y-4"
      >
        <h2 className="font-display text-lg text-silver-100">
          {editingId ? "Modifier la note" : "Nouvelle note"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Titre <span className="text-red-400">*</span>
          </label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ex: Rappel cotisations, Réunion prévue…"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Contenu de la note…"
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="h-4 w-4 accent-primary-400"
          />
          <span className="text-sm text-slate-300">Note active</span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Créer la note"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800/60"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* Liste des notes */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <p className="text-slate-500">Chargement…</p>
        ) : notes.length === 0 ? (
          <p className="text-slate-500">Aucune note pour l'instant.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-xl border p-5 ${
                note.isActive
                  ? "border-primary-700 bg-primary-900/40"
                  : "border-primary-800/50 bg-primary-950/40 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base text-silver-100">{note.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        note.isActive
                          ? "bg-emerald-950 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {note.isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  {note.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                      {note.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    Créée le{" "}
                    {new Date(note.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {note.updatedAt !== note.createdAt && (
                      <span>
                        {" · "}Modifiée le{" "}
                        {new Date(note.updatedAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button
                    onClick={() => toggleActive(note)}
                    className="rounded px-2 py-1 text-xs font-medium border border-primary-700 text-slate-400 hover:bg-primary-800/60"
                    title={note.isActive ? "Désactiver" : "Activer"}
                  >
                    {note.isActive ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    onClick={() => startEdit(note)}
                    className="rounded px-2 py-1 text-xs font-medium border border-primary-700 text-primary-300 hover:bg-primary-800/60"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="rounded px-2 py-1 text-xs font-medium border border-red-900 text-red-400 hover:bg-red-950/40"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
