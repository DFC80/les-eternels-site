"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function DocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canSeePrivate = sessionHasAccess(user, "documents");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status !== "authenticated") return;
    fetch("/api/assoc-documents")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setDocs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") return null;

  const categories = Array.from(new Set(docs.map((d) => d.category).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">📁 Documents</h1>
      <p className="mt-2 text-sm text-slate-400">
        Documents mis à disposition par l'association.
        {canSeePrivate && " Les documents privés sont également visibles."}
      </p>

      {loading ? (
        <p className="mt-8 text-slate-400">Chargement...</p>
      ) : docs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-8 text-center text-slate-400">
          Aucun document disponible pour le moment.
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {(categories.length > 0 ? [...categories, null] : [null]).map((cat) => {
            const group = docs.filter((d) => (cat === null ? !d.category : d.category === cat));
            if (group.length === 0) return null;
            return (
              <div key={cat ?? "__none__"}>
                {cat && (
                  <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{cat}</p>
                )}
                {!cat && categories.length > 0 && (
                  <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Autres</p>
                )}
                <div className="rounded-xl border border-primary-800 bg-primary-900/40 divide-y divide-primary-800">
                  {group.map((doc) => (
                    <a
                      key={doc.id}
                      href={`/api/assoc-documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-primary-800/40 transition-colors"
                    >
                      <span className="text-2xl">{mimeIcon(doc.mime)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-100">{doc.name}</span>
                          {canSeePrivate && doc.visibility === "PRIVATE" && (
                            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-950 text-red-300">
                              🔒 Privé
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="mt-0.5 text-sm text-slate-400">{doc.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-600">
                          {formatSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <svg className="h-4 w-4 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
