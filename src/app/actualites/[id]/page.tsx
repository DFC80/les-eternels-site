"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { firstName: string; name: string };
};

type Article = {
  id: string;
  title: string;
  content: string;
  photos: string | null;
  date: string;
  comments: Comment[];
};

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();

  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    const res = await fetch(`/api/news/${id}`);
    if (res.status === 404) { setNotFound(true); return; }
    if (res.ok) setArticle(await res.json());
  }

  useEffect(() => { load(); }, [id]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/news/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) {
        const d = await res.json();
        setCommentError(d.error ?? "Erreur.");
      } else {
        setCommentText("");
        load();
      }
    } finally {
      setPosting(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-400">Article introuvable ou non publié.</p>
        <Link href="/actualites" className="mt-4 inline-block text-primary-300 hover:underline">← Retour aux actualités</Link>
      </div>
    );
  }

  if (!article) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-400">Chargement…</div>;
  }

  const photos = (article.photos ?? "").split("\n").map((u) => u.trim()).filter(Boolean);
  const dateLabel = new Date(article.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/actualites" className="text-sm text-primary-300 hover:underline">← Actualités</Link>

      <h1 className="mt-4 font-display text-2xl text-silver-100 sm:text-3xl">{article.title}</h1>
      <p className="mt-2 text-sm text-slate-400">{dateLabel}</p>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className={`mt-6 grid gap-3 ${photos.length === 1 ? "" : "grid-cols-2 sm:grid-cols-3"}`}>
          {photos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" onClick={() => setSelectedPhoto(url)}
              className={`cursor-pointer rounded-xl border border-primary-700 object-cover transition hover:opacity-90 ${
                photos.length === 1 ? "max-h-96 w-full" : "h-40 w-full"
              }`} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedPhoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedPhoto} alt="" className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setSelectedPhoto(null)}
            className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-white hover:bg-black/80">✕</button>
        </div>
      )}

      {/* Content */}
      <div className="mt-8 whitespace-pre-wrap text-slate-200 leading-relaxed">{article.content}</div>

      {/* Comments */}
      <section className="mt-12 border-t border-primary-800 pt-8">
        <h2 className="font-display text-xl text-silver-100">
          Commentaires ({article.comments.length})
        </h2>

        {article.comments.length === 0 && (
          <p className="mt-4 text-slate-400">Aucun commentaire. Soyez le premier !</p>
        )}

        <div className="mt-4 space-y-4">
          {article.comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-silver-200">{c.user.firstName} {c.user.name}</span>
                <span className="text-xs text-slate-500">
                  {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{c.content}</p>
            </div>
          ))}
        </div>

        {session ? (
          <form onSubmit={postComment} className="mt-6 space-y-3">
            <textarea ref={textareaRef} rows={4} value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Votre commentaire…"
              className="w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none" />
            {commentError && <p className="text-sm text-red-400">{commentError}</p>}
            <button type="submit" disabled={posting || !commentText.trim()}
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
              {posting ? "Envoi…" : "Publier le commentaire"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-slate-400">
            <Link href="/login" className="text-primary-300 hover:underline">Connectez-vous</Link> pour laisser un commentaire.
          </p>
        )}
      </section>
    </div>
  );
}
