"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type PollOption = { id: string; label: string; order: number; voteCount: number };
type Poll = {
  id: string;
  question: string;
  allowMultiple: boolean;
  closedAt: string | null;
  activityKey: string | null;
  activityLabel: string | null;
  userCanVote: boolean;
  userHasChangedVote: boolean;
  totalVotes: number;
  userVotedOptionIds: string[];
  options: PollOption[];
  votersByOption?: Record<string, { name: string; email: string }[]>;
};

export default function HomePollWidget() {
  const { data: session } = useSession();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/polls");
    if (!res.ok) return;
    const polls: Poll[] = await res.json();
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Priorité : sondage ouvert, puis sondage clos depuis moins de 24h
    const visible = polls.filter(
      (p) => !p.closedAt || new Date(p.closedAt) >= cutoff24h
    );
    const active = visible.find((p) => !p.closedAt || new Date(p.closedAt) >= now) ?? visible[0] ?? null;
    setPoll(active ?? null);
    setSelected([]);
    setEditing(false);
  }

  useEffect(() => { load(); }, []);

  if (!poll) return null;

  const hasVoted = poll.userVotedOptionIds.length > 0;
  const isClosed = poll.closedAt && new Date(poll.closedAt) < new Date();
  const showResults = (!editing && hasVoted) || isClosed || !poll.userCanVote;
  const canChange = hasVoted && !poll.userHasChangedVote && !isClosed && poll.userCanVote;

  function toggleOption(id: string) {
    if (poll!.allowMultiple) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setSelected([id]);
    }
  }

  function startEdit() {
    setSelected(poll!.userVotedOptionIds);
    setError(null);
    setEditing(true);
  }

  async function submit() {
    if (!selected.length || !poll) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/${poll.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: selected }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur.");
      } else {
        load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteVote() {
    if (!poll) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/${poll.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur.");
      } else {
        load();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 pt-2">
      <h2 className="font-display text-2xl text-silver-100">Sondage</h2>
      <div className="mt-4 rounded-xl border border-primary-800 bg-primary-900/50 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium text-silver-100">{poll.question}</p>
          {poll.activityLabel && (
            <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">
              {poll.activityLabel}
            </span>
          )}
        </div>
        {editing && (
          <p className="mt-1 text-xs text-amber-400">Modification — une seule modification autorisée.</p>
        )}

        <div className="mt-4 space-y-2">
          {poll.options.map((opt) => {
            const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
            const isUserVote = poll.userVotedOptionIds.includes(opt.id);
            const isChosen = selected.includes(opt.id);

            if (showResults) {
              const optionVoters = poll.votersByOption?.[opt.id] ?? [];
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`min-w-0 mr-2 truncate ${isUserVote ? "font-semibold text-primary-300" : "text-slate-300"}`}>
                      {isUserVote && "✓ "}{opt.label}
                    </span>
                    <span className="flex-shrink-0 text-slate-400">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-primary-950">
                    <div className={`h-full rounded-full transition-all duration-500 ${isUserVote ? "bg-primary-400" : "bg-primary-700"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {optionVoters.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {optionVoters.map((v) => (
                        <span key={v.email} title={v.email}
                          className="rounded-full bg-primary-900 px-2 py-0.5 text-xs text-primary-200">
                          {v.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button key={opt.id} type="button" onClick={() => toggleOption(opt.id)}
                className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                  isChosen
                    ? "border-primary-400 bg-primary-900 text-silver-100"
                    : "border-primary-800 bg-primary-950/40 text-slate-300 hover:border-primary-600 hover:bg-primary-900/60"
                }`}>
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-slate-500">
            {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
            {isClosed && " · Clôturé"}
          </p>
          <Link href="/sondages" className="flex-shrink-0 text-xs text-primary-300 hover:underline">
            Tous les sondages →
          </Link>
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {!isClosed && session && poll.userCanVote && (
          <>
            {!hasVoted && (
              <div className="mt-4">
                <button onClick={submit} disabled={submitting || !selected.length}
                  className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
                  {submitting ? "Envoi…" : "Voter"}
                </button>
              </div>
            )}

            {hasVoted && canChange && !editing && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={startEdit}
                  className="rounded-md border border-primary-600 px-3 py-1.5 text-xs text-primary-300 hover:bg-primary-900">
                  ✏️ Modifier
                </button>
                <button onClick={deleteVote} disabled={deleting}
                  className="rounded-md border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950 disabled:opacity-50">
                  {deleting ? "…" : "🗑️ Supprimer"}
                </button>
              </div>
            )}

            {editing && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={submit} disabled={submitting || !selected.length}
                  className="rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
                  {submitting ? "Envoi…" : "Confirmer"}
                </button>
                <button onClick={() => { setEditing(false); setSelected([]); }}
                  className="rounded-md border border-primary-700 px-3 py-2 text-sm text-slate-300 hover:bg-primary-800">
                  Annuler
                </button>
              </div>
            )}

            {hasVoted && poll.userHasChangedVote && (
              <p className="mt-2 text-xs text-slate-500">Vote modifié · droit de modification épuisé</p>
            )}
          </>
        )}

        {!isClosed && session && !poll.userCanVote && (
          <p className="mt-3 text-sm text-amber-300">
            Réservé aux membres <strong>{poll.activityLabel}</strong>.{" "}
            <Link href="/mon-compte" className="font-medium text-primary-300 hover:underline">Adhérer →</Link>
          </p>
        )}

        {!session && !isClosed && (
          <p className="mt-4 text-sm text-slate-400">
            <Link href="/login" className="text-primary-300 hover:underline">Connectez-vous</Link> pour voter.
          </p>
        )}
      </div>
    </section>
  );
}
