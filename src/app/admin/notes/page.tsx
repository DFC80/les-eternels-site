"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { isFullAdmin } from "@/lib/permissions";

type NoteItem = { id: string; label: string; isChecked: boolean; position: number };

type AdminNote = {
  id: string;
  type: "NOTE" | "LIST";
  title: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: NoteItem[];
};

type FormItem = { tempId: string; label: string; isChecked: boolean };

type NoteForm = {
  type: "NOTE" | "LIST";
  title: string;
  description: string;
  isActive: boolean;
  items: FormItem[];
};

const EMPTY_FORM: NoteForm = {
  type: "NOTE",
  title: "",
  description: "",
  isActive: true,
  items: [],
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

let tempIdCounter = 0;
function newTempId() { return `tmp-${++tempIdCounter}`; }

export default function AdminNotesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";

  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NoteForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);

  async function loadNotes() {
    const res = await fetch("/api/admin/notes");
    if (res.ok) setNotes(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadNotes(); }, []);

  function startEdit(note: AdminNote) {
    setEditingId(note.id);
    setForm({
      type: note.type,
      title: note.title,
      description: note.description,
      isActive: note.isActive,
      items: note.items.map((i) => ({ tempId: i.id, label: i.label, isChecked: i.isChecked })),
    });
    setNewItemLabel("");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNewItemLabel("");
    setError(null);
  }

  function addItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    setForm((f) => ({
      ...f,
      items: [...f.items, { tempId: newTempId(), label, isChecked: false }],
    }));
    setNewItemLabel("");
    newItemRef.current?.focus();
  }

  function removeItem(tempId: string) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.tempId !== tempId) }));
  }

  function updateItemLabel(tempId: string, label: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.tempId === tempId ? { ...i, label } : i)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError("Le titre est requis."); return; }
    if (form.type === "LIST" && form.items.length === 0) {
      setError("Ajoutez au moins un élément à la liste.");
      return;
    }
    setSaving(true);

    const url = editingId ? `/api/admin/notes/${editingId}` : "/api/admin/notes";
    const method = editingId ? "PATCH" : "POST";

    const payload = {
      type: form.type,
      title: form.title,
      description: form.description,
      isActive: form.isActive,
      items: form.type === "LIST" ? form.items.map((i) => ({ label: i.label, isChecked: i.isChecked })) : [],
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }

    setEditingId(null);
    setForm(EMPTY_FORM);
    setNewItemLabel("");
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

  async function toggleItem(noteId: string, item: NoteItem) {
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? { ...n, items: n.items.map((i) => (i.id === item.id ? { ...i, isChecked: !i.isChecked } : i)) }
          : n
      )
    );
    await fetch(`/api/admin/notes/${noteId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isChecked: !item.isChecked }),
    });
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
      <p className="mt-2 text-slate-400">Espace de notes interne réservé aux administrateurs.</p>

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6 space-y-4"
      >
        <h2 className="font-display text-lg text-silver-100">
          {editingId ? "Modifier" : "Nouvelle note"}
        </h2>

        {/* Sélecteur de type */}
        <div className="flex gap-2">
          {(["NOTE", "LIST"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: t }))}
              className={`rounded-md px-4 py-2 text-sm font-medium border transition ${
                form.type === t
                  ? "border-primary-400 bg-primary-800 text-silver-100"
                  : "border-primary-700 text-slate-400 hover:border-primary-600 hover:text-slate-200"
              }`}
            >
              {t === "NOTE" ? "📝 Note classique" : "🛒 Liste de courses"}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Titre <span className="text-red-400">*</span>
          </label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={form.type === "LIST" ? "Ex : Courses soirée jeux…" : "Ex : Rappel cotisations…"}
            className={inputClass}
          />
        </div>

        {form.type === "NOTE" && (
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
        )}

        {form.type === "LIST" && (
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Éléments de la liste
            </label>

            {form.items.length > 0 && (
              <ul className="mt-2 space-y-1">
                {form.items.map((item) => (
                  <li key={item.tempId} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateItemLabel(item.tempId, e.target.value)}
                      className="flex-1 rounded-md border border-primary-700 bg-primary-950 px-3 py-1.5 text-sm text-slate-100 focus:border-primary-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.tempId)}
                      className="shrink-0 text-slate-500 hover:text-red-400 text-lg leading-none"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex gap-2">
              <input
                ref={newItemRef}
                type="text"
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                placeholder="Ajouter un élément…"
                className="flex-1 rounded-md border border-primary-700 bg-primary-950 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={addItem}
                className="rounded-md border border-primary-600 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-800/60"
              >
                + Ajouter
              </button>
            </div>
          </div>
        )}

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
            {saving ? "Enregistrement…" : editingId ? "Mettre à jour" : "Créer"}
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
          notes.map((note) => {
            const checkedCount = note.items.filter((i) => i.isChecked).length;
            return (
              <div
                key={note.id}
                className={`rounded-xl border p-5 ${
                  note.isActive
                    ? "border-primary-700 bg-primary-900/40"
                    : "border-primary-800/50 bg-primary-950/40 opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* En-tête */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {note.type === "LIST" ? "🛒" : "📝"}
                      </span>
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
                      {note.type === "LIST" && note.items.length > 0 && (
                        <span className="rounded-full bg-primary-800/60 px-2 py-0.5 text-xs text-slate-400">
                          {checkedCount}/{note.items.length}
                        </span>
                      )}
                    </div>

                    {/* Contenu : note classique */}
                    {note.type === "NOTE" && note.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                        {note.description}
                      </p>
                    )}

                    {/* Contenu : liste de courses */}
                    {note.type === "LIST" && note.items.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {note.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleItem(note.id, item)}
                              className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${
                                item.isChecked
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-primary-600 bg-primary-950 hover:border-primary-400"
                              }`}
                              title={item.isChecked ? "Marquer non acheté" : "Marquer acheté"}
                            >
                              {item.isChecked && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                                </svg>
                              )}
                            </button>
                            <span
                              className={`text-sm ${
                                item.isChecked ? "text-slate-500 line-through" : "text-slate-200"
                              }`}
                            >
                              {item.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-3 text-xs text-slate-500">
                      Créée le{" "}
                      {new Date(note.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(note)}
                        className="rounded px-2 py-1 text-xs font-medium border border-primary-700 text-slate-400 hover:bg-primary-800/60"
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
