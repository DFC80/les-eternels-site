"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasAccess, sessionHasWriteAccess } from "@/lib/permissions";
import DateInput from "@/components/DateInput";

type Meeting = {
  id: string;
  type: "BUREAU" | "ASSEMBLEE_GENERALE";
  date: string;
  location: string;
  agenda: string | null;
  notes: string | null;
  isPublished: boolean;
  linkedEventId: string | null;
  createdAt: string;
};

const EMPTY_FORM = {
  id: "",
  type: "BUREAU" as "BUREAU" | "ASSEMBLEE_GENERALE",
  date: "",
  location: "",
  agenda: "",
  notes: "",
  isPublished: false,
};

const TYPE_LABELS: Record<string, string> = {
  BUREAU: "Réunion de bureau",
  ASSEMBLEE_GENERALE: "Assemblée générale",
};

const TYPE_COLORS: Record<string, string> = {
  BUREAU: "bg-primary-950 text-primary-300 border border-primary-700",
  ASSEMBLEE_GENERALE: "bg-amber-950 text-amber-300 border border-amber-800",
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

function toInputDate(iso: string) {
  return iso ? iso.slice(0, 16) : "";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReunionsPage() {
  const { data: session } = useSession();
  const user = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(user, "reunions");

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [notifyResult, setNotifyResult] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/admin/meetings");
    if (res.ok) setMeetings(await res.json());
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  function editMeeting(m: Meeting) {
    setForm({
      id: m.id,
      type: m.type,
      date: toInputDate(m.date),
      location: m.location,
      agenda: m.agenda ?? "",
      notes: m.notes ?? "",
      isPublished: m.isPublished,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      type: form.type,
      date: form.date,
      location: form.location,
      agenda: form.agenda || null,
      notes: form.notes || null,
      isPublished: form.isPublished,
    };

    const res = await fetch(form.id ? `/api/admin/meetings/${form.id}` : "/api/admin/meetings", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    resetForm();
    await load();
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Supprimer la ${label} ?`)) return;
    const res = await fetch(`/api/admin/meetings/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function sendReminder(id: string) {
    setNotifying(id);
    setNotifyResult((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/admin/meetings/${id}/notify`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setNotifyResult((prev) => ({
      ...prev,
      [id]: res.ok ? `Rappel envoyé à ${body.sent} membre(s).` : body.error ?? "Erreur d'envoi.",
    }));
    setNotifying(null);
  }

  async function togglePublished(m: Meeting) {
    await fetch(`/api/admin/meetings/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, isPublished: !m.isPublished }),
    });
    await load();
  }

  if (session && !sessionHasAccess(user, "reunions")) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  const bureauMeetings = meetings.filter((m) => m.type === "BUREAU");
  const agMeetings = meetings.filter((m) => m.type === "ASSEMBLEE_GENERALE");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Réunions &amp; Assemblées</h1>
      <p className="mt-2 text-slate-400">
        Gérez les réunions de bureau et les assemblées générales de l'association.
      </p>

      {/* Formulaire */}
      {canWrite && <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-xl border border-primary-800 bg-primary-900/40 p-6 space-y-4"
      >
        <h2 className="font-display text-lg text-silver-100">
          {form.id ? "Modifier la réunion" : "Nouvelle réunion"}
        </h2>

        {!form.id && form.type === "BUREAU" && (
          <p className="rounded-md border border-primary-700 bg-primary-900/60 px-3 py-2 text-sm text-slate-400">
            📧 Un email sera automatiquement envoyé à tous les membres du bureau.
          </p>
        )}
        {!form.id && form.type === "ASSEMBLEE_GENERALE" && (
          <p className="rounded-md border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-400">
            📅 L'assemblée sera automatiquement ajoutée au calendrier des événements.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "BUREAU" | "ASSEMBLEE_GENERALE" })}
              className={inputClass}
              required
            >
              <option value="BUREAU">Réunion de bureau</option>
              <option value="ASSEMBLEE_GENERALE">Assemblée générale</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Date et heure</label>
            <DateInput
              type="datetime-local"
              required
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">Lieu</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Local de l'association, salle polyvalente…"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">Ordre du jour</label>
            <textarea
              value={form.agenda}
              onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              rows={4}
              placeholder="Points à aborder lors de cette réunion…"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">Compte-rendu</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={6}
              placeholder="Résumé des décisions, votes, discussions…"
              className={inputClass}
            />
          </div>

          {form.type === "ASSEMBLEE_GENERALE" && (
            <div className="sm:col-span-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="isPublished"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="h-4 w-4 rounded border-primary-600 bg-primary-950 accent-primary-400"
              />
              <label htmlFor="isPublished" className="text-sm text-slate-300 cursor-pointer">
                Afficher le résumé sur la page d'accueil
              </label>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary-400 px-5 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : form.id ? "Mettre à jour" : "Créer"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-primary-700 px-5 py-2 text-sm text-slate-300 hover:bg-primary-800/60"
            >
              Annuler
            </button>
          )}
        </div>
      </form>}

      {/* Liste des assemblées générales */}
      <MeetingSection
        title="Assemblées générales"
        emoji="🏛️"
        meetings={agMeetings}
        canWrite={canWrite}
        onEdit={editMeeting}
        onDelete={(m) => handleDelete(m.id, "assemblée générale")}
        onTogglePublished={togglePublished}
        expandedId={expandedId}
        onExpand={setExpandedId}
        notifying={notifying}
        notifyResult={notifyResult}
        onSendReminder={sendReminder}
      />

      <MeetingSection
        title="Réunions de bureau"
        emoji="📋"
        meetings={bureauMeetings}
        canWrite={canWrite}
        onEdit={editMeeting}
        onDelete={(m) => handleDelete(m.id, "réunion de bureau")}
        onTogglePublished={togglePublished}
        expandedId={expandedId}
        onExpand={setExpandedId}
        notifying={notifying}
        notifyResult={notifyResult}
        onSendReminder={sendReminder}
      />
    </div>
  );
}

function MeetingSection({
  title,
  emoji,
  meetings,
  canWrite,
  onEdit,
  onDelete,
  onTogglePublished,
  expandedId,
  onExpand,
  notifying,
  notifyResult,
  onSendReminder,
}: {
  title: string;
  emoji: string;
  meetings: Meeting[];
  canWrite: boolean;
  onEdit: (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
  onTogglePublished: (m: Meeting) => void;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  notifying: string | null;
  notifyResult: Record<string, string>;
  onSendReminder: (id: string) => void;
}) {
  return (
    <div className="mt-10">
      <h2 className="font-display text-xl text-silver-100">
        {emoji} {title} ({meetings.length})
      </h2>

      {meetings.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">Aucune entrée pour le moment.</p>
      )}

      <div className="mt-4 space-y-3">
        {meetings.map((m) => {
          const isExpanded = expandedId === m.id;
          return (
            <div key={m.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[m.type]}`}>
                      {TYPE_LABELS[m.type]}
                    </span>
                    {m.type === "ASSEMBLEE_GENERALE" && (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          m.isPublished
                            ? "bg-emerald-950 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {m.isPublished ? "Affiché accueil" : "Non affiché"}
                      </span>
                    )}
                    {m.linkedEventId && (
                      <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-950 text-blue-300">
                        📅 Sur le calendrier
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-medium text-slate-100">{formatDate(m.date)}</p>
                  {m.location && (
                    <p className="mt-0.5 text-sm text-slate-400">📍 {m.location}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-sm shrink-0">
                  <button
                    onClick={() => onExpand(isExpanded ? null : m.id)}
                    className="text-primary-300 hover:underline"
                  >
                    {isExpanded ? "Réduire" : "Voir détails"}
                  </button>
                  {canWrite && (
                    <>
                      <button onClick={() => onEdit(m)} className="text-primary-300 hover:underline">
                        Modifier
                      </button>
                      {m.type === "ASSEMBLEE_GENERALE" && (
                        <button
                          onClick={() => onTogglePublished(m)}
                          className={m.isPublished ? "text-amber-400 hover:underline" : "text-emerald-400 hover:underline"}
                        >
                          {m.isPublished ? "Retirer de l'accueil" : "Afficher sur l'accueil"}
                        </button>
                      )}
                      {m.type === "BUREAU" && (
                        <button
                          onClick={() => onSendReminder(m.id)}
                          disabled={notifying === m.id}
                          className="text-sky-400 hover:underline disabled:opacity-50"
                        >
                          {notifying === m.id ? "Envoi…" : "Envoyer un rappel"}
                        </button>
                      )}
                      <button onClick={() => onDelete(m)} className="text-red-400 hover:underline">
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>

              {notifyResult[m.id] && (
                <p className={`mt-2 text-xs ${notifyResult[m.id].startsWith("Rappel") ? "text-emerald-400" : "text-red-400"}`}>
                  {notifyResult[m.id]}
                </p>
              )}

              {isExpanded && (
                <div className="mt-4 space-y-4 border-t border-primary-700 pt-4">
                  {m.agenda ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordre du jour</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{m.agenda}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Aucun ordre du jour renseigné.</p>
                  )}
                  {m.notes ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compte-rendu</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{m.notes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Aucun compte-rendu renseigné.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
