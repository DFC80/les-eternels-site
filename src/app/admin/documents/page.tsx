"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasAccess } from "@/lib/permissions";

type Doc = {
  id: string;
  name: string;
  description: string | null;
  mime: string;
  size: number;
  visibility: "PUBLIC" | "PRIVATE";
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

function mimeIcon(mime: string) {
  if (mime === "application/pdf") return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.includes("word")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("presentation")) return "📽️";
  return "📁";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function AdminDocumentsPage() {
  const { data: session } = useSession();
  const user = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canAccess = sessionHasAccess(user, "documents");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [uploadCategory, setUploadCategory] = useState("");

  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVisibility, setEditVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [editCategory, setEditCategory] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/assoc-documents");
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadError(null);
    setUploading(true);
    const form = new FormData();
    form.append("file", uploadFile);
    form.append("name", uploadName || uploadFile.name);
    form.append("description", uploadDesc);
    form.append("visibility", uploadVisibility);
    form.append("category", uploadCategory);
    const res = await fetch("/api/admin/assoc-documents", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data.error ?? "Erreur lors de l'envoi.");
      return;
    }
    setUploadOpen(false);
    setUploadFile(null);
    setUploadName("");
    setUploadDesc("");
    setUploadVisibility("PUBLIC");
    setUploadCategory("");
    await load();
  }

  function openEdit(doc: Doc) {
    setEditDoc(doc);
    setEditName(doc.name);
    setEditDesc(doc.description ?? "");
    setEditVisibility(doc.visibility);
    setEditCategory(doc.category ?? "");
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editDoc) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/admin/assoc-documents/${editDoc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc, visibility: editVisibility, category: editCategory }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Erreur lors de la mise à jour.");
      return;
    }
    setEditDoc(null);
    await load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer « ${name} » ?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/assoc-documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de la suppression.");
      return;
    }
    await load();
  }

  if (session && !canAccess) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  const categories = Array.from(new Set(docs.map((d) => d.category).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-silver-100">📁 Documents</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gérez les documents de l'association. Les documents publics sont visibles par tous les membres ; les documents privés sont réservés aux administrateurs.
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300"
        >
          + Ajouter un document
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-8 text-slate-400">Chargement...</p>
      ) : docs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-8 text-center text-slate-400">
          Aucun document pour le moment.
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {/* Group by category */}
          {(categories.length > 0 ? [...categories, null] : [null]).map((cat) => {
            const group = docs.filter((d) => (cat === null ? !d.category : d.category === cat));
            if (group.length === 0) return null;
            return (
              <div key={cat ?? "__none__"}>
                {cat && (
                  <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{cat}</p>
                )}
                {!cat && categories.length > 0 && (
                  <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Sans catégorie</p>
                )}
                <div className="rounded-xl border border-primary-800 bg-primary-900/40 divide-y divide-primary-800">
                  {group.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xl">{mimeIcon(doc.mime)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/api/assoc-documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-slate-100 hover:text-primary-300 hover:underline"
                          >
                            {doc.name}
                          </a>
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            doc.visibility === "PRIVATE"
                              ? "bg-red-950 text-red-300"
                              : "bg-emerald-950 text-emerald-300"
                          }`}>
                            {doc.visibility === "PRIVATE" ? "🔒 Privé" : "🌐 Public"}
                          </span>
                        </div>
                        {doc.description && (
                          <p className="mt-0.5 text-xs text-slate-400 truncate">{doc.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-600">
                          {formatSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          onClick={() => openEdit(doc)}
                          className="text-sm text-primary-300 hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.name)}
                          className="text-sm text-red-400 hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setUploadOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-primary-700 bg-primary-950 p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-silver-100">Ajouter un document</h3>
            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Fichier</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx,.pptx,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUploadFile(f);
                    if (f && !uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ""));
                  }}
                  className="mt-1 w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-primary-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-200 hover:file:bg-primary-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Nom</label>
                <input
                  required
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Nom du document"
                  className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Description <span className="text-xs font-normal text-slate-500">(optionnel)</span></label>
                <textarea
                  rows={2}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Brève description..."
                  className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Visibilité</label>
                  <select
                    value={uploadVisibility}
                    onChange={(e) => setUploadVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 focus:border-primary-400 focus:outline-none"
                  >
                    <option value="PUBLIC">🌐 Public</option>
                    <option value="PRIVATE">🔒 Privé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Catégorie <span className="text-xs font-normal text-slate-500">(optionnel)</span></label>
                  <input
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    placeholder="Ex: Statuts, AG..."
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                  />
                </div>
              </div>
              {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setUploadOpen(false)} className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900">
                  Annuler
                </button>
                <button type="submit" disabled={uploading} className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60">
                  {uploading ? "Envoi..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditDoc(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-primary-700 bg-primary-950 p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-silver-100">Modifier le document</h3>
            <form onSubmit={handleEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Nom</label>
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 focus:border-primary-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 focus:border-primary-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Visibilité</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 focus:border-primary-400 focus:outline-none"
                  >
                    <option value="PUBLIC">🌐 Public</option>
                    <option value="PRIVATE">🔒 Privé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Catégorie</label>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 focus:border-primary-400 focus:outline-none"
                  />
                </div>
              </div>
              {editError && <p className="text-sm text-red-400">{editError}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditDoc(null)} className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900">
                  Annuler
                </button>
                <button type="submit" disabled={editSaving} className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60">
                  {editSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
