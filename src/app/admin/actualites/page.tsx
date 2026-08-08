"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessSection } from "@/lib/permissions";
import DateInput from "@/components/DateInput";

type NewsArticle = {
  id: string;
  title: string;
  content: string;
  photos: string | null;
  date: string;
  published: boolean;
  _count?: { comments: number };
};

const EMPTY_FORM = {
  id: "",
  title: "",
  content: "",
  photos: "",
  date: new Date().toISOString().slice(0, 10),
  published: false,
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

function PhotosUploadField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const urls = value.split("\n").map((u) => u.trim()).filter(Boolean);

  async function handleFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) onChange([...urls, data.url].join("\n"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-20 rounded-lg border border-primary-700 object-cover" />
              <button type="button" onClick={() => onChange(urls.filter((u) => u !== url).join("\n"))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white hover:bg-red-500">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="flex items-center gap-2 rounded-md border border-dashed border-primary-600 px-4 py-2 text-sm text-slate-400 hover:border-primary-400 hover:text-slate-200 disabled:opacity-50">
        {uploading ? "Upload…" : "＋ Ajouter une photo"}
      </button>
    </div>
  );
}

export default function AdminActualitesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/admin/news");
    if (res.ok) setArticles(await res.json());
  }

  useEffect(() => { load(); }, []);

  if (!canAccessSection(role, "content")) {
    return <p className="p-8 text-slate-400">Accès non autorisé.</p>;
  }

  function editArticle(a: NewsArticle) {
    setForm({
      id: a.id,
      title: a.title,
      content: a.content,
      photos: a.photos ?? "",
      date: a.date.slice(0, 10),
      published: a.published,
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/admin/news/${form.id}` : "/api/admin/news";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          photos: form.photos || null,
          date: form.date,
          published: form.published,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur inconnue.");
      } else {
        resetForm();
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a: NewsArticle) {
    await fetch(`/api/admin/news/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: a.title,
        content: a.content,
        photos: a.photos,
        date: a.date,
        published: !a.published,
      }),
    });
    load();
  }

  async function deleteArticle(id: string) {
    if (!confirm("Supprimer cet article définitivement ?")) return;
    await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
    load();
  }

  const isEditing = !!form.id;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <h1 className="font-display text-2xl text-silver-100">Gestion des actualités</h1>

      {/* Form */}
      <div ref={formRef} className="rounded-xl border border-primary-700 bg-primary-900/60 p-6">
        <h2 className="mb-4 font-display text-lg text-silver-100">
          {isEditing ? "Modifier l'article" : "Nouvel article"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300">Titre *</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Titre de l'article" required />
          </div>
          <div>
            <label className="text-sm text-slate-300">Date *</label>
            <DateInput required value={form.date} onChange={(v) => setForm({ ...form, date: v })} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-slate-300">Contenu *</label>
            <textarea className={inputClass} rows={8} value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Contenu de l'article…" required />
          </div>
          <div>
            <label className="text-sm text-slate-300">Photos</label>
            <PhotosUploadField value={form.photos} onChange={(v) => setForm({ ...form, photos: v })} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="published" checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
              className="h-4 w-4 accent-primary-400" />
            <label htmlFor="published" className="text-sm text-slate-300">Publier immédiatement</label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
              {saving ? "Enregistrement…" : isEditing ? "Mettre à jour" : "Créer l'article"}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm}
                className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800">
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Article list */}
      <div className="space-y-3">
        <h2 className="font-display text-lg text-silver-100">Articles ({articles.length})</h2>
        {articles.length === 0 && <p className="text-slate-400">Aucun article.</p>}
        {articles.map((a) => {
          const firstPhoto = a.photos?.split("\n").find((u) => u.trim());
          const dateLabel = new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
          return (
            <div key={a.id} className="rounded-xl border border-primary-700 bg-primary-900/40 p-4">
              <div className="flex items-center gap-3">
                {firstPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firstPhoto} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-silver-100 truncate">{a.title}</span>
                    {a.published ? (
                      <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">Publié</span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Brouillon</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {dateLabel} · {a._count?.comments ?? 0} commentaire{(a._count?.comments ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-primary-800 pt-3">
                <button onClick={() => togglePublish(a)}
                  className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800">
                  {a.published ? "Dépublier" : "Publier"}
                </button>
                <button onClick={() => editArticle(a)}
                  className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800">
                  Modifier
                </button>
                <button onClick={() => deleteArticle(a.id)}
                  className="rounded-md border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950">
                  Supprimer
                </button>
              </div>
            </div>

          );
        })}
      </div>
    </div>
  );
}
