"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { isFullAdmin } from "@/lib/permissions";

type Activity = { key: string; label: string; emoji: string; isActive: boolean };
type PollOption = { id: string; label: string; order: number; voteCount?: number };
type PollVoterOption = { id: string; label: string; voters: { id: string; firstName: string; name: string }[] };
type Poll = {
  id: string;
  question: string;
  allowMultiple: boolean;
  published: boolean;
  activityKey: string | null;
  closedAt: string | null;
  publishNotificationSentAt: string | null;
  resultNotificationSentAt: string | null;
  _count: { votes: number };
  options: PollOption[];
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

const EMPTY_FORM = {
  id: "",
  question: "",
  allowMultiple: false,
  published: false,
  activityKey: "",
  closedAt: "",
  options: ["", ""],
};

export default function AdminSondagesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";

  const [polls, setPolls] = useState<Poll[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [notifyResult, setNotifyResult] = useState<Record<string, string>>({});
  const [votersOpen, setVotersOpen] = useState<string | null>(null);
  const [votersData, setVotersData] = useState<Record<string, PollVoterOption[]>>({});
  const [votersLoading, setVotersLoading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [pollsRes, actsRes] = await Promise.all([
      fetch("/api/admin/polls"),
      fetch("/api/activities"),
    ]);
    if (pollsRes.ok) setPolls(await pollsRes.json());
    if (actsRes.ok) {
      const all: Activity[] = await actsRes.json();
      setActivities(all.filter((a: Activity & { isActive: boolean }) => a.isActive));
    }
  }

  useEffect(() => { load(); }, []);

  if (!isFullAdmin(role)) {
    return <p className="p-8 text-slate-400">Accès réservé aux administrateurs.</p>;
  }

  function editPoll(p: Poll) {
    setForm({
      id: p.id,
      question: p.question,
      allowMultiple: p.allowMultiple,
      published: p.published,
      activityKey: p.activityKey ?? "",
      closedAt: p.closedAt ? p.closedAt.slice(0, 16) : "",
      options: p.options.map((o) => o.label),
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  function setOption(i: number, val: string) {
    const opts = [...form.options];
    opts[i] = val;
    setForm({ ...form, options: opts });
  }

  function addOption() {
    setForm({ ...form, options: [...form.options, ""] });
  }

  function removeOption(i: number) {
    if (form.options.length <= 2) return;
    setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        question: form.question,
        allowMultiple: form.allowMultiple,
        published: form.published,
        activityKey: form.activityKey || null,
        closedAt: form.closedAt || null,
        options: form.options.map((label, i) => ({ label, order: i })),
      };
      const isEdit = !!form.id;
      const url = isEdit ? `/api/admin/polls/${form.id}` : "/api/admin/polls";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async function togglePublish(p: Poll) {
    await fetch(`/api/admin/polls/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: p.question,
        allowMultiple: p.allowMultiple,
        published: !p.published,
        activityKey: p.activityKey,
        closedAt: p.closedAt,
        options: p.options.map((o, i) => ({ label: o.label, order: i })),
      }),
    });
    load();
  }

  async function deletePoll(id: string) {
    if (!confirm("Supprimer ce sondage et tous ses votes ?")) return;
    await fetch(`/api/admin/polls/${id}`, { method: "DELETE" });
    load();
  }

  async function closeNow(p: Poll) {
    if (!confirm("Clôturer ce sondage maintenant ? L'admin recevra un email avec les résultats.")) return;
    await fetch(`/api/admin/polls/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: p.question,
        allowMultiple: p.allowMultiple,
        published: p.published,
        activityKey: p.activityKey,
        closedAt: new Date().toISOString(),
        options: p.options.map((o, i) => ({ label: o.label, order: i })),
      }),
    });
    load();
  }

  async function toggleVoters(pollId: string) {
    if (votersOpen === pollId) { setVotersOpen(null); return; }
    setVotersOpen(pollId);
    if (votersData[pollId]) return;
    setVotersLoading(true);
    try {
      const res = await fetch(`/api/admin/polls/${pollId}/voters`);
      if (res.ok) {
        const data = await res.json();
        setVotersData((prev) => ({ ...prev, [pollId]: data }));
      }
    } finally {
      setVotersLoading(false);
    }
  }

  async function renotify(p: Poll) {
    if (!confirm(`Renvoyer l'email du sondage à ${p.activityKey ? "tous les membres concernés" : "tous les utilisateurs"} ?\n\nLes votes déjà effectués seront conservés.`)) return;
    setNotifying(p.id);
    setNotifyResult((prev) => ({ ...prev, [p.id]: "" }));
    try {
      const res = await fetch(`/api/admin/polls/${p.id}/notify`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setNotifyResult((prev) => ({ ...prev, [p.id]: `✓ Email envoyé à ${d.sent} utilisateur${d.sent !== 1 ? "s" : ""}` }));
        load();
      } else {
        setNotifyResult((prev) => ({ ...prev, [p.id]: `Erreur : ${d.error}` }));
      }
    } finally {
      setNotifying(null);
    }
  }

  const isEditing = !!form.id;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="font-display text-2xl text-silver-100">Gestion des sondages</h1>

      {/* Form */}
      <div ref={formRef} className="rounded-xl border border-primary-700 bg-primary-900/60 p-6">
        <h2 className="mb-4 font-display text-lg text-silver-100">
          {isEditing ? "Modifier le sondage" : "Nouveau sondage"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300">Question *</label>
            <input className={inputClass} value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="Votre question…" required />
          </div>

          <div>
            <label className="text-sm text-slate-300">Activité liée (optionnelle)</label>
            <select
              className={inputClass}
              value={form.activityKey}
              onChange={(e) => setForm({ ...form, activityKey: e.target.value })}
            >
              <option value="">Tous les membres</option>
              {activities.map((a) => (
                <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
              ))}
            </select>
            {form.activityKey && (
              <p className="mt-1 text-xs text-amber-400">
                Seuls les membres adhérents à cette activité pourront voter. Un email sera envoyé aux membres concernés lors de la publication.
              </p>
            )}
            {!form.activityKey && (
              <p className="mt-1 text-xs text-slate-500">
                Sans activité liée, tous les membres avec une adhésion payée peuvent voter.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Options *</label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                    value={opt} onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`} />
                  <button type="button" onClick={() => removeOption(i)}
                    disabled={form.options.length <= 2}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-primary-700 text-slate-400 hover:border-red-700 hover:text-red-400 disabled:opacity-30">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addOption}
              className="mt-2 flex items-center gap-1 text-sm text-primary-300 hover:text-silver-200">
              ＋ Ajouter une option
            </button>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.allowMultiple}
                onChange={(e) => setForm({ ...form, allowMultiple: e.target.checked })}
                className="h-4 w-4 accent-primary-400" />
              Choix multiple
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="h-4 w-4 accent-primary-400" />
              Publier (envoi email aux membres)
            </label>
          </div>

          <div>
            <label className="text-sm text-slate-300">Date de clôture (optionnelle)</label>
            <input type="datetime-local" className={inputClass} value={form.closedAt}
              onChange={(e) => setForm({ ...form, closedAt: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-primary-400 disabled:opacity-50">
              {saving ? "Enregistrement…" : isEditing ? "Mettre à jour" : "Créer le sondage"}
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

      {/* Poll list */}
      <div className="space-y-3">
        <h2 className="font-display text-lg text-silver-100">Sondages ({polls.length})</h2>
        {polls.length === 0 && <p className="text-slate-400">Aucun sondage.</p>}
        {polls.map((p) => {
          const totalVotes = p._count.votes;
          const isClosed = p.closedAt && new Date(p.closedAt) < new Date();
          const actLabel = activities.find((a) => a.key === p.activityKey);
          return (
            <div key={p.id} className="rounded-xl border border-primary-700 bg-primary-900/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-silver-100">{p.question}</span>
                {p.published ? (
                  isClosed ? (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Clôturé</span>
                  ) : (
                    <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">Publié</span>
                  )
                ) : (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Brouillon</span>
                )}
                {p.allowMultiple && (
                  <span className="rounded-full bg-primary-900 px-2 py-0.5 text-xs text-primary-300">Choix multiple</span>
                )}
                {actLabel && (
                  <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">
                    {actLabel.emoji} {actLabel.label}
                  </span>
                )}
                {p.publishNotificationSentAt && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500" title={`Email envoyé le ${new Date(p.publishNotificationSentAt).toLocaleString("fr-FR")}`}>
                    📧 Notifié
                  </span>
                )}
                {p.resultNotificationSentAt && (
                  <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-400" title={`Résultats envoyés le ${new Date(p.resultNotificationSentAt).toLocaleString("fr-FR")}`}>
                    📊 Résultats envoyés
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {p.options.length} options · {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                {!p.activityKey && " · Ouvert à tous"}
                {p.closedAt && (
                  <> · {isClosed ? "Clôturé le" : "Clôture le"}{" "}
                    <span className={isClosed ? "text-slate-500" : "text-amber-400"}>
                      {new Date(p.closedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.options.map((o) => (
                  <span key={o.id} className="rounded-md bg-primary-950 px-2 py-0.5 text-xs text-slate-400">
                    {o.label}
                  </span>
                ))}
              </div>
              {votersOpen === p.id && (
                <div className="mt-3 rounded-lg border border-primary-800 bg-primary-950/50 p-3">
                  {votersLoading && !votersData[p.id] ? (
                    <p className="text-xs text-slate-400">Chargement…</p>
                  ) : (votersData[p.id] ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun vote enregistré.</p>
                  ) : (
                    <div className="space-y-2">
                      {(votersData[p.id] ?? []).map((opt) => (
                        <div key={opt.id}>
                          <p className="text-xs font-semibold text-slate-300">
                            {opt.label}{" "}
                            <span className="font-normal text-slate-500">({opt.voters.length})</span>
                          </p>
                          {opt.voters.length === 0 ? (
                            <p className="text-xs text-slate-600">—</p>
                          ) : (
                            <p className="text-xs text-slate-400">
                              {opt.voters.map((v) => `${v.firstName} ${v.name}`).join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-primary-800 pt-3">
                <button onClick={() => toggleVoters(p.id)}
                  className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800">
                  {votersOpen === p.id ? "Masquer les votants" : `👥 Votants (${totalVotes})`}
                </button>
                <button onClick={() => !isClosed && togglePublish(p)} disabled={!!isClosed}
                  className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-40">
                  {p.published ? "Dépublier" : "Publier"}
                </button>
                {p.published && !isClosed && (
                  <button onClick={() => closeNow(p)}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800">
                    ⏹ Clôturer
                  </button>
                )}
                {p.published && (
                  <button onClick={() => !isClosed && renotify(p)} disabled={!!isClosed || notifying === p.id}
                    className="rounded-md border border-primary-600 px-3 py-1.5 text-xs text-primary-300 hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-40">
                    {notifying === p.id ? "Envoi…" : "📧 Renotifier"}
                  </button>
                )}
                <button onClick={() => !isClosed && editPoll(p)} disabled={!!isClosed}
                  className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-40">
                  Modifier
                </button>
                <button onClick={() => deletePoll(p.id)}
                  className="rounded-md border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950">
                  Supprimer
                </button>
              </div>
              {notifyResult[p.id] && (
                <p className={`mt-2 text-xs ${notifyResult[p.id].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                  {notifyResult[p.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
