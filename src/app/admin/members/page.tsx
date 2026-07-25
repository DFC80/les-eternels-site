"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessSection, isFullAdmin } from "@/lib/permissions";

type ActivityDef = { key: string; label: string; emoji: string; isCore: boolean };

type Membership = {
  year: number;
  wantsBoardGames: boolean;
  wantsRolePlay: boolean;
  wantsAirsoft: boolean;
  amount: number;
  isPaid: boolean;
  paidAmount: number;
  expired: boolean;
  extraActivities: { activityKey: string }[];
} | null;

type Member = {
  id: string;
  firstName: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  isPending: boolean;
  createdAt: string;
  _count: { registrations: number };
  membership: Membership;
  bureauRoles: { id: string; label: string; order: number }[];
};

type MemberDetail = {
  firstName: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  airsoftTrialDay: boolean;
  createdAt: string;
  dateOfBirth: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressPostalCode: string | null;
  gender: string | null;
  emergencyContactFirstName: string | null;
  emergencyContactLastName: string | null;
  emergencyContactPhone: string | null;
  bureauRoles: { id: string; label: string; order: number }[];
  membership: {
    year: number;
    wantsBoardGames: boolean;
    wantsRolePlay: boolean;
    wantsAirsoft: boolean;
    amount: number;
    isPaid: boolean;
    extraActivities: { activityKey: string }[];
  } | null;
};

const GENDER_LABELS: Record<string, string> = { HOMME: "Homme", FEMME: "Femme", AUTRE: "Autre" };

const CORE_ACTIVITY_KEYS: Record<string, string> = {
  JEUX_DE_PLATEAU: "wantsBoardGames",
  JEUX_DE_ROLE: "wantsRolePlay",
  AIRSOFT: "wantsAirsoft",
};

function computeAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

type BureauRole = { id: string; label: string; order: number };

export default function AdminMembersPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = canAccessSection(role, "members");
  const [members, setMembers] = useState<Member[]>([]);
  const [bureauRoles, setBureauRoles] = useState<BureauRole[]>([]);
  const [activities, setActivities] = useState<ActivityDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [emailFor, setEmailFor] = useState<{ id: string; firstName: string; name: string; email: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [groupEmailOpen, setGroupEmailOpen] = useState(false);
  const [groupActivityKey, setGroupActivityKey] = useState("");
  const [groupSubject, setGroupSubject] = useState("");
  const [groupBody, setGroupBody] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const [groupResult, setGroupResult] = useState<{ sent: number; recipients: string[] } | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  async function load() {
    const [membersRes, rolesRes, actsRes] = await Promise.all([
      fetch("/api/admin/members"),
      fetch("/api/admin/bureau-roles"),
      fetch("/api/activities"),
    ]);
    if (membersRes.ok) setMembers(await membersRes.json());
    if (rolesRes.ok) setBureauRoles(await rolesRes.json());
    if (actsRes.ok) setActivities(await actsRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function updateMember(id: string, data: Partial<Pick<Member, "role" | "isActive">>) {
    setError(null);
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la mise à jour.");
      return;
    }
    await load();
  }

  async function toggleMembershipPaid(id: string, isPaid: boolean) {
    setError(null);
    const res = await fetch(`/api/admin/members/${id}/membership`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la mise à jour de la cotisation.");
      return;
    }
    await load();
  }

  async function validateSupplement(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/members/${id}/membership`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validateSupplement: true }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la validation du supplément.");
      return;
    }
    await load();
  }

  async function validateMember(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPending: false }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la validation.");
      return;
    }
    await load();
  }

  async function removeMember(id: string) {
    if (!confirm("Supprimer ce membre ?")) return;
    const res = await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la suppression.");
      return;
    }
    await load();
  }

  async function openDetail(id: string) {
    setDetail(null);
    setDetailMemberId(id);
    setDetailLoading(true);
    const res = await fetch(`/api/admin/members/${id}`);
    setDetailLoading(false);
    if (res.ok) setDetail(await res.json());
  }

  async function toggleTrialDay(val: boolean) {
    if (!detailMemberId) return;
    const res = await fetch(`/api/admin/members/${detailMemberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ airsoftTrialDay: val }),
    });
    if (res.ok) {
      setDetail((d) => d ? { ...d, airsoftTrialDay: val } : d);
      await load();
    }
  }

  function openEmail(m: Member) {
    setEmailFor({ id: m.id, firstName: m.firstName, name: m.name, email: m.email });
    setEmailSubject("");
    setEmailBody("");
    setEmailSuccess(false);
    setEmailError(null);
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailFor) return;
    setEmailSending(true);
    setEmailError(null);
    const res = await fetch(`/api/admin/members/${emailFor.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: emailSubject, message: emailBody }),
    });
    setEmailSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEmailError(body.error ?? "Erreur lors de l'envoi.");
      return;
    }
    setEmailSuccess(true);
  }

  function openGroupEmail() {
    setGroupActivityKey(activities.find((a) => a.isActive)?.key ?? "");
    setGroupSubject("");
    setGroupBody("");
    setGroupResult(null);
    setGroupError(null);
    setGroupEmailOpen(true);
  }

  async function sendGroupEmail(e: React.FormEvent) {
    e.preventDefault();
    setGroupSending(true);
    setGroupError(null);
    const res = await fetch("/api/admin/members/email-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityKey: groupActivityKey, subject: groupSubject, message: groupBody }),
    });
    setGroupSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setGroupError(body.error ?? "Erreur lors de l'envoi.");
      return;
    }
    const data = await res.json();
    setGroupResult({ sent: data.sent, recipients: data.recipients ?? [] });
  }

  if (session && !canAccessSection(role, "members")) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-slate-400">Accès non autorisé.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-silver-100">Membres</h1>
          <p className="mt-2 text-sm text-slate-400">
            Cliquez sur le nom d'un membre pour consulter sa fiche (lecture seule).
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openGroupEmail}
            className="rounded-md border border-primary-700 px-4 py-2 text-sm font-medium text-primary-300 hover:bg-primary-800/60"
          >
            📧 Message groupé
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-primary-800 bg-primary-900/40">
        <table className="w-full text-sm">
          <thead className="bg-primary-950/60 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Bureau</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Cotisation</th>
              {canEdit && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-primary-800 text-slate-200">
                <td
                  onClick={() => openDetail(m.id)}
                  className="cursor-pointer px-4 py-3 font-medium hover:text-primary-300 hover:underline"
                >
                  <span>{m.firstName} {m.name}</span>
                  {m.isPending && (
                    <span className="ml-2 rounded bg-amber-950 px-1.5 py-0.5 text-xs font-medium text-amber-300">
                      En attente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{m.email}</td>
                <td className="px-4 py-3">
                  {m.role === "ADMIN" ? (
                    <span className="rounded border border-primary-600 bg-primary-900 px-2 py-1 text-xs font-semibold text-primary-300">
                      Admin
                    </span>
                  ) : canEdit ? (
                    <select
                      value={m.role}
                      onChange={(e) => updateMember(m.id, { role: e.target.value as "ADMIN" | "MEMBER" })}
                      className="rounded border border-primary-700 bg-primary-950 px-2 py-1 text-slate-200"
                    >
                      <option value="MEMBER">Membre</option>
                      {bureauRoles.length > 0 && (
                        <optgroup label="── Bureau ──">
                          {[...bureauRoles].sort((a, b) => a.order - b.order).map((r) => (
                            <option key={r.id} value={r.label}>{r.label}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  ) : (
                    <span className="text-slate-300">{m.role === "MEMBER" ? "Membre" : m.role}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.bureauRoles && m.bureauRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {[...m.bureauRoles].sort((a, b) => a.order - b.order).map((r) => (
                        <span key={r.id} className="rounded bg-primary-800 px-2 py-0.5 text-xs font-medium text-primary-200">
                          {r.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.isPending && canEdit ? (
                    <button
                      onClick={() => validateMember(m.id)}
                      className="rounded bg-amber-950 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-900"
                    >
                      Valider
                    </button>
                  ) : canEdit ? (
                    <button
                      onClick={() => updateMember(m.id, { isActive: !m.isActive })}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        m.isActive ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"
                      }`}
                    >
                      {m.isActive ? "Actif" : "Désactivé"}
                    </button>
                  ) : (
                    <span className={`rounded px-2 py-1 text-xs font-medium ${
                      m.isActive ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"
                    }`}>
                      {m.isPending ? "En attente" : m.isActive ? "Actif" : "Désactivé"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {m.membership ? (
                    m.membership.expired ? (
                      <span className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-slate-400">
                        Expirée ({m.membership.year})
                      </span>
                    ) : (() => {
                      const ms = m.membership!;
                      const supplement = ms.isPaid ? ms.amount - ms.paidAmount : 0;
                      return (
                        <div className="flex flex-col gap-1">
                          {canEdit ? (
                            <button
                              onClick={() => toggleMembershipPaid(m.id, !ms.isPaid)}
                              className={`rounded px-2 py-1 text-xs font-medium ${
                                ms.isPaid ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"
                              }`}
                            >
                              {ms.year} — {ms.isPaid ? `${ms.paidAmount}€ réglé ✓` : `${ms.amount}€ en attente`}
                            </button>
                          ) : (
                            <span className={`rounded px-2 py-1 text-xs font-medium ${
                              ms.isPaid ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"
                            }`}>
                              {ms.year} — {ms.isPaid ? `${ms.paidAmount}€ réglé ✓` : `${ms.amount}€ en attente`}
                            </span>
                          )}
                          {supplement > 0 && (
                            canEdit ? (
                              <button
                                onClick={() => validateSupplement(m.id)}
                                className="rounded bg-amber-900 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-800"
                                title="Cliquer pour valider l'encaissement du supplément"
                              >
                                +{supplement}€ à encaisser
                              </button>
                            ) : (
                              <span className="rounded bg-amber-900/60 px-2 py-1 text-xs font-medium text-amber-300">
                                +{supplement}€ à encaisser
                              </span>
                            )
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-slate-500">Pas d'adhésion</span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEmail(m)}
                        className="text-primary-300 hover:underline"
                      >
                        ✉️ Écrire
                      </button>
                      {m.email !== "admin@les-eternels.fr" && (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="text-red-400 hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {groupEmailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setGroupEmailOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-primary-700 bg-primary-950 p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-silver-100">📧 Message groupé</h3>
            <p className="mt-1 text-sm text-slate-400">
              Envoie un email à tous les membres ayant l'activité sélectionnée dans leur cotisation.
            </p>

            {groupResult ? (
              <div className="mt-6">
                <p className="text-emerald-400 font-medium">
                  {groupResult.sent === 0
                    ? "Aucun membre concerné pour cette activité."
                    : `${groupResult.sent} email${groupResult.sent > 1 ? "s" : ""} envoyé${groupResult.sent > 1 ? "s" : ""} avec succès !`}
                </p>
                {groupResult.recipients.length > 0 && (
                  <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-primary-700 bg-primary-900/40 p-3 space-y-1">
                    {groupResult.recipients.map((email) => (
                      <li key={email} className="text-sm text-slate-300">{email}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setGroupEmailOpen(false)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={sendGroupEmail} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Activité</label>
                  <select
                    required
                    value={groupActivityKey}
                    onChange={(e) => setGroupActivityKey(e.target.value)}
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 focus:border-primary-400 focus:outline-none"
                  >
                    {activities.filter((a) => a.isActive).map((a) => (
                      <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Sujet</label>
                  <input
                    required
                    value={groupSubject}
                    onChange={(e) => setGroupSubject(e.target.value)}
                    placeholder="Ex: Information importante"
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Message</label>
                  <textarea
                    required
                    rows={6}
                    value={groupBody}
                    onChange={(e) => setGroupBody(e.target.value)}
                    placeholder="Votre message…"
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                  />
                </div>
                {groupError && <p className="text-sm text-red-400">{groupError}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setGroupEmailOpen(false)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={groupSending}
                    className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                  >
                    {groupSending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {emailFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEmailFor(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-primary-700 bg-primary-950 p-6 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-silver-100">
              ✉️ Message à {emailFor.firstName} {emailFor.name}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{emailFor.email}</p>

            {emailSuccess ? (
              <div className="mt-6 text-center">
                <p className="text-emerald-400 font-medium">Email envoyé avec succès !</p>
                <button
                  onClick={() => setEmailFor(null)}
                  className="mt-4 rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={sendEmail} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Sujet</label>
                  <input
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Ex: Information importante"
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Message</label>
                  <textarea
                    required
                    rows={6}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Votre message…"
                    className="mt-1 w-full rounded-md border border-primary-700 bg-primary-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
                  />
                </div>
                {emailError && <p className="text-sm text-red-400">{emailError}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEmailFor(null)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={emailSending}
                    className="rounded-md bg-primary-400 px-4 py-2 text-sm font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
                  >
                    {emailSending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-primary-700 bg-primary-950 p-4 shadow-2xl shadow-black/60 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading && !detail ? (
              <p className="text-slate-400">Chargement...</p>
            ) : detail ? (
              <>
                <h3 className="font-display text-xl text-silver-100">
                  {detail.firstName} {detail.name}
                </h3>
                <p className="text-sm text-slate-400">{detail.email}</p>

                <div className="mt-4 space-y-2 text-sm text-slate-200">
                  <p>
                    <span className="text-slate-400">Rôle :</span>{" "}
                    {detail.role === "ADMIN" ? "Administrateur" : detail.role === "MEMBER" ? "Membre" : detail.role}
                    {detail.bureauRoles && detail.bureauRoles.length > 0 && detail.bureauRoles.map((r) => (
                      <span key={r.id} className="ml-1 rounded bg-primary-800 px-2 py-0.5 text-xs text-primary-200">
                        {r.label}
                      </span>
                    ))}
                  </p>
                  <p>
                    <span className="text-slate-400">Statut :</span>{" "}
                    {detail.isActive ? "Actif" : "Désactivé"}
                  </p>
                  <p>
                    <span className="text-slate-400">Membre depuis :</span>{" "}
                    {new Date(detail.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                  <p>
                    <span className="text-slate-400">Date de naissance :</span>{" "}
                    {detail.dateOfBirth
                      ? `${new Date(detail.dateOfBirth).toLocaleDateString("fr-FR")} (${computeAge(detail.dateOfBirth)} ans)`
                      : "Non renseignée"}
                  </p>
                  <p>
                    <span className="text-slate-400">Genre :</span>{" "}
                    {detail.gender ? GENDER_LABELS[detail.gender] ?? detail.gender : "Non renseigné"}
                  </p>
                  <p>
                    <span className="text-slate-400">Téléphone :</span> {detail.phone || "Non renseigné"}
                  </p>
                  <p>
                    <span className="text-slate-400">Adresse :</span>{" "}
                    {detail.addressStreet || detail.addressCity || detail.addressPostalCode
                      ? `${detail.addressStreet ?? ""}, ${detail.addressPostalCode ?? ""} ${detail.addressCity ?? ""}`
                      : "Non renseignée"}
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-primary-700 bg-primary-900/40 p-3">
                  <p className="text-sm font-medium text-silver-100">🚨 Contact d'urgence</p>
                  {detail.emergencyContactFirstName || detail.emergencyContactLastName ? (
                    <p className="mt-1 text-sm text-slate-300">
                      {detail.emergencyContactFirstName} {detail.emergencyContactLastName}
                      {detail.emergencyContactPhone && ` — ${detail.emergencyContactPhone}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Non renseigné</p>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-primary-700 bg-primary-900/40 p-3">
                  <p className="text-sm font-medium text-silver-100">Adhésion</p>
                  {detail.membership ? (() => {
                    const ms = detail.membership!;
                    const allKeys: string[] = [];
                    if (ms.wantsBoardGames) allKeys.push("JEUX_DE_PLATEAU");
                    if (ms.wantsRolePlay) allKeys.push("JEUX_DE_ROLE");
                    if (ms.wantsAirsoft) allKeys.push("AIRSOFT");
                    for (const ea of ms.extraActivities ?? []) allKeys.push(ea.activityKey);
                    return (
                      <>
                        <p className="mt-1 text-sm text-slate-300">
                          {ms.year} — {ms.amount}€ — {ms.isPaid ? "Payée" : "En attente"}
                        </p>
                        {allKeys.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {allKeys.map((key) => {
                              const act = activities.find((a) => a.key === key);
                              return (
                                <span key={key} className="rounded bg-primary-800 px-2 py-0.5 text-xs text-slate-200">
                                  {act ? `${act.emoji} ${act.label}` : key}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">Aucune activité</p>
                        )}
                      </>
                    );
                  })() : (
                    <p className="mt-1 text-sm text-slate-500">Aucune adhésion enregistrée</p>
                  )}
                </div>

                {canEdit && (
                  <div className="mt-4 rounded-lg border border-primary-700 bg-primary-900/40 p-3">
                    <p className="text-sm font-medium text-silver-100">🎯 Airsoft — Journée d'essai</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Permet de s'inscrire à un événement airsoft sans cotisation et sans frais de participation.
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-sm font-medium ${detail.airsoftTrialDay ? "text-emerald-400" : "text-slate-400"}`}>
                        {detail.airsoftTrialDay ? "Journée d'essai activée" : "Pas de journée d'essai"}
                      </span>
                      <button
                        onClick={() => toggleTrialDay(!detail.airsoftTrialDay)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                          detail.airsoftTrialDay
                            ? "bg-red-900/60 text-red-300 hover:bg-red-800"
                            : "bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800"
                        }`}
                      >
                        {detail.airsoftTrialDay ? "Retirer" : "Activer"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setDetail(null)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-primary-900"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
