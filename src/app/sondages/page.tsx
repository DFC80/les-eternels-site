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
};

function PollCard({ poll, onVoted }: { poll: Poll; onVoted: () => void }) {
  const { data: session } = useSession();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVoted = poll.userVotedOptionIds.length > 0;
  const isClosed = poll.closedAt && new Date(poll.closedAt) < new Date();
  const showResults = (!editing && hasVoted) || isClosed || !poll.userCanVote;
  const canChange = hasVoted && !poll.userHasChangedVote && !isClosed && poll.userCanVote;

  function toggleOption(id: string) {
    if (poll.allowMultiple) {
      setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setSelected([id]);
    }
  }

  function startEdit() {
    setSelected(poll.userVotedOptionIds);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSelected([]);
    setError(null);
  }

  async function submit() {
    if (!selected.length) return;
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
        setEditing(false);
        onVoted();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteVote() {
    if (!confirm("Supprimer votre vote ? Cette action utilisera votre droit de modification.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/${poll.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur.");
      } else {
        onVoted();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-lg text-silver-100">{poll.question}</h2>
        <div className="flex flex-wrap gap-2">
          {poll.activityLabel && (
            <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">
              {poll.activityLabel}
            </span>
          )}
          {isClosed && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Clôturé</span>
          )}
        </div>
      </div>
      {poll.allowMultiple && !showResults && (
        <p className="mt-1 text-xs text-slate-500">Plusieurs choix possibles</p>
      )}
      {editing && (
        <p className="mt-1 text-xs text-amber-400">Modification de vote — attention, une seule modification est autorisée.</p>
      )}

      <div className="mt-4 space-y-2">
        {poll.options.map((opt) => {
          const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
          const isUserVote = poll.userVotedOptionIds.includes(opt.id);
          const isChosen = selected.includes(opt.id);

          if (showResults) {
            return (
              <div key={opt.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={`min-w-0 mr-2 truncate ${isUserVote ? "font-semibold text-primary-300" : "text-slate-300"}`}>
                    {isUserVote && "✓ "}{opt.label}
                  </span>
                  <span className="flex-shrink-0 text-slate-400">{pct}% ({opt.voteCount})</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary-950">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isUserVote ? "bg-primary-400" : "bg-primary-700"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
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

      <p className="mt-3 text-xs text-slate-500">
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
        {poll.closedAt && !isClosed && (
          <> · Clôture le {new Date(poll.closedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</>
        )}
        {poll.userHasChangedVote && hasVoted && <> · Vote modifié</>}
      </p>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {!isClosed && session && poll.userCanVote && (
        <>
          {/* Pas encore voté */}
          {!hasVoted && (
            <div className="mt-4">
              <button onClick={submit} disabled={submitting || !selected.length}
                className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
                {submitting ? "Envoi…" : "Voter"}
              </button>
            </div>
          )}

          {/* Voté, changement disponible */}
          {hasVoted && canChange && !editing && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={startEdit}
                className="rounded-md border border-primary-600 px-3 py-1.5 text-sm text-primary-300 hover:bg-primary-900">
                ✏️ Modifier mon vote
              </button>
              <button onClick={deleteVote} disabled={deleting}
                className="rounded-md border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50">
                {deleting ? "Suppression…" : "🗑️ Supprimer mon vote"}
              </button>
            </div>
          )}

          {/* Mode édition */}
          {editing && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={submit} disabled={submitting || !selected.length}
                className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
                {submitting ? "Envoi…" : "Confirmer le nouveau vote"}
              </button>
              <button onClick={cancelEdit}
                className="rounded-md border border-primary-700 px-4 py-2 text-sm text-slate-300 hover:bg-primary-800">
                Annuler
              </button>
            </div>
          )}

          {/* Voté, changement épuisé */}
          {hasVoted && poll.userHasChangedVote && (
            <p className="mt-3 text-xs text-slate-500">Vous avez utilisé votre droit de modification.</p>
          )}
        </>
      )}

      {!isClosed && session && !poll.userCanVote && (
        <div className="mt-4 rounded-lg border border-amber-800/50 bg-amber-950/30 p-3">
          <p className="text-sm text-amber-300">
            Ce sondage est réservé aux membres adhérents à l&apos;activité <strong>{poll.activityLabel}</strong>.
          </p>
          <Link href="/mon-compte" className="mt-2 inline-block text-sm font-medium text-primary-300 hover:underline">
            Adhérer à cette activité →
          </Link>
        </div>
      )}

      {!session && !isClosed && (
        <p className="mt-4 text-sm text-slate-400">
          <Link href="/login" className="text-primary-300 hover:underline">Connectez-vous</Link> pour voter.
        </p>
      )}
    </div>
  );
}

export default function SondagesPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/polls");
    if (res.ok) setPolls(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const now = new Date();
  const active = polls.filter((p) => !p.closedAt || new Date(p.closedAt) >= now);
  const closed = polls.filter((p) => p.closedAt && new Date(p.closedAt) < now);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Sondages</h1>

      {loading ? (
        <p className="mt-8 text-slate-400">Chargement…</p>
      ) : (
        <>
          {active.length === 0 && (
            <p className="mt-8 text-slate-400">Aucun sondage en cours pour le moment.</p>
          )}
          {active.length > 0 && (
            <div className="mt-8 space-y-6">
              {active.map((p) => (
                <PollCard key={p.id} poll={p} onVoted={load} />
              ))}
            </div>
          )}

          {closed.length > 0 && (
            <div className="mt-10">
              <button
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-xl border border-primary-800 bg-primary-900/40 px-4 py-3 text-left transition hover:bg-primary-800/60"
              >
                <span className="font-display text-lg text-silver-100">
                  Historique <span className="ml-1 text-sm font-normal text-slate-400">({closed.length} sondage{closed.length !== 1 ? "s" : ""} clôturé{closed.length !== 1 ? "s" : ""})</span>
                </span>
                <span className="text-slate-400 transition-transform duration-200" style={{ display: "inline-block", transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  ▾
                </span>
              </button>

              {historyOpen && (
                <div className="mt-4 space-y-6">
                  {closed.map((p) => (
                    <PollCard key={p.id} poll={p} onVoted={load} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
