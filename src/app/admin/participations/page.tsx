"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasAccess } from "@/lib/permissions";
import Link from "next/link";

const ACTIVITY_LABELS: Record<string, string> = {
  AIRSOFT: "Airsoft",
  JEUX_DE_PLATEAU: "Jeux de plateau",
  JEUX_DE_ROLE: "Jeux de rôle",
  AUTRE: "Autre",
};

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-emerald-950 text-emerald-300",
  PENDING: "bg-amber-950 text-amber-300",
  REJECTED: "bg-red-950 text-red-300",
};
const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approuvé",
  PENDING: "En attente",
  REJECTED: "Refusé",
};

type Registration = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  activityType: string;
  status: string;
  wantsMeal: boolean;
  isTrialDay: boolean;
  isPaid: boolean;
  createdAt: string;
};

type UserParticipations = {
  userId: string;
  firstName: string;
  name: string;
  email: string;
  registrations: Registration[];
};

export default function AdminParticipationsPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;

  const [data, setData] = useState<UserParticipations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/admin/participations")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (session && !sessionHasAccess(sessionUser, "events")) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  const filtered = data
    .map((u) => ({
      ...u,
      registrations: filterStatus === "ALL"
        ? u.registrations
        : u.registrations.filter((r) => r.status === filterStatus),
    }))
    .filter((u) => {
      if (u.registrations.length === 0) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        u.firstName.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });

  const totalRegistrations = filtered.reduce((s, u) => s + u.registrations.length, 0);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(filtered.map((u) => u.userId)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-silver-100">Participations aux événements</h1>
          <p className="mt-2 text-sm text-slate-400">
            Liste des inscriptions par membre.
          </p>
        </div>
        <Link
          href={`/admin/participations/print${filterStatus !== "ALL" ? `?status=${filterStatus}` : ""}`}
          target="_blank"
          className="rounded-md border border-primary-700 px-4 py-2 text-sm font-medium text-primary-300 hover:bg-primary-800/60"
        >
          🖨️ Imprimer
        </Link>
      </div>

      {/* Filtres */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre…"
          className="w-64 rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-sm text-slate-100 focus:border-primary-400 focus:outline-none"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="APPROVED">Approuvé</option>
          <option value="PENDING">En attente</option>
          <option value="REJECTED">Refusé</option>
        </select>
        {!loading && (
          <span className="text-sm text-slate-400">
            {filtered.length} membre{filtered.length !== 1 ? "s" : ""} · {totalRegistrations} inscription{totalRegistrations !== 1 ? "s" : ""}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={expandAll}
            className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800"
          >
            Tout déplier
          </button>
          <button
            onClick={collapseAll}
            className="rounded-md border border-primary-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-primary-800"
          >
            Tout replier
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-slate-400">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-slate-400">Aucun résultat.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((u) => {
            const expanded = expandedIds.has(u.userId);
            const approved = u.registrations.filter((r) => r.status === "APPROVED").length;
            return (
              <div key={u.userId} className="rounded-xl border border-primary-800 bg-primary-900/40 overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => toggle(u.userId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary-900/60 transition-colors"
                >
                  <span className={`transition-transform text-slate-400 text-xs ${expanded ? "rotate-90" : ""}`}>▶</span>
                  <span className="font-medium text-slate-100">
                    {u.firstName} {u.name}
                  </span>
                  <span className="text-sm text-slate-400">{u.email}</span>
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    <span className="rounded bg-primary-800 px-2 py-0.5 text-xs font-medium text-primary-200">
                      {u.registrations.length} inscription{u.registrations.length !== 1 ? "s" : ""}
                    </span>
                    {approved > 0 && (
                      <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        {approved} approuvée{approved !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </button>

                {/* Registrations table */}
                {expanded && (
                  <div className="border-t border-primary-800 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-primary-950/60 text-left text-xs text-slate-500">
                          <th className="px-4 py-2">Événement</th>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Activité</th>
                          <th className="px-4 py-2">Statut</th>
                          <th className="px-4 py-2">Repas</th>
                          <th className="px-4 py-2">Essai</th>
                          <th className="px-4 py-2">Payé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.registrations.map((r) => (
                          <tr key={r.id} className="border-t border-primary-800/50 hover:bg-primary-900/30">
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/admin/events`}
                                className="text-primary-300 hover:underline"
                                title="Voir les événements"
                              >
                                {r.eventTitle}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                              {new Date(r.eventStartsAt).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">
                              {ACTIVITY_LABELS[r.activityType] ?? r.activityType}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-primary-800 text-slate-300"}`}>
                                {STATUS_LABELS[r.status] ?? r.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {r.wantsMeal ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {r.isTrialDay ? <span className="text-amber-400">✓</span> : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {r.isPaid ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
