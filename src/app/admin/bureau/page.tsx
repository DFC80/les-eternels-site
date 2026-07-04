"use client";

import { useEffect, useState } from "react";

type BureauRole = { id: string; label: string; order: number };
type Member = {
  id: string;
  firstName: string;
  name: string;
  email: string;
  bureauRoles: BureauRole[];
};

export default function AdminBureauPage() {
  const [roles, setRoles] = useState<BureauRole[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [editingRole, setEditingRole] = useState<{ id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMember, setSavingMember] = useState<string | null>(null);

  async function load() {
    const [rolesRes, membersRes] = await Promise.all([
      fetch("/api/admin/bureau-roles"),
      fetch("/api/admin/members"),
    ]);
    if (rolesRes.ok) setRoles(await rolesRes.json());
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(
        data.map((m: Member & { bureauRoles?: { bureauRole: BureauRole }[] | BureauRole[] }) => ({
          ...m,
          bureauRoles: Array.isArray(m.bureauRoles)
            ? m.bureauRoles.map((r: { bureauRole?: BureauRole } | BureauRole) =>
                "bureauRole" in r ? r.bureauRole : r
              )
            : [],
        }))
      );
    }
  }

  useEffect(() => { load(); }, []);

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setSaving(true);
    await fetch("/api/admin/bureau-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    setSaving(false);
    setNewLabel("");
    await load();
  }

  async function saveRoleLabel(id: string, label: string) {
    if (!label.trim()) return;
    await fetch(`/api/admin/bureau-roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim() }),
    });
    setEditingRole(null);
    await load();
  }

  async function moveRole(id: string, direction: "up" | "down") {
    const sorted = [...roles].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((r) => r.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    await Promise.all([
      fetch(`/api/admin/bureau-roles/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: b.order }),
      }),
      fetch(`/api/admin/bureau-roles/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: a.order }),
      }),
    ]);
    await load();
  }

  async function deleteRole(id: string, label: string) {
    if (!confirm(`Supprimer le rôle "${label}" ?`)) return;
    await fetch(`/api/admin/bureau-roles/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleRole(member: Member, roleId: string) {
    setSavingMember(member.id);
    const current = member.bureauRoles.map((r) => r.id);
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
    await fetch(`/api/admin/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bureauRoleIds: next }),
    });
    setSavingMember(null);
    await load();
  }

  const bureauMembers = members.filter((m) => m.bureauRoles.length > 0);
  const sortedRoles = [...roles].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Bureau de l'association</h1>
      <p className="mt-2 text-slate-400">
        Gérez les rôles du bureau et assignez-les aux membres (multi-rôle possible).
      </p>

      {/* ── Rôles ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-silver-100">Rôles du bureau</h2>
        <form onSubmit={addRole} className="mt-4 flex gap-3">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Président, Trésorier…"
            className="flex-1 rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !newLabel.trim()}
            className="rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
          >
            Ajouter
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {sortedRoles.length === 0 && <p className="text-sm text-slate-500">Aucun rôle défini.</p>}
          {sortedRoles.map((role, idx) => {
            const count = members.filter((m) => m.bureauRoles.some((r) => r.id === role.id)).length;
            return (
              <div key={role.id} className="flex items-center gap-3 rounded-lg border border-primary-800 bg-primary-900/40 px-4 py-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveRole(role.id, "up")} disabled={idx === 0} className="text-xs text-slate-500 hover:text-slate-200 disabled:opacity-20">▲</button>
                  <button onClick={() => moveRole(role.id, "down")} disabled={idx === sortedRoles.length - 1} className="text-xs text-slate-500 hover:text-slate-200 disabled:opacity-20">▼</button>
                </div>
                {editingRole?.id === role.id ? (
                  <input
                    autoFocus
                    value={editingRole.label}
                    onChange={(e) => setEditingRole({ ...editingRole, label: e.target.value })}
                    onBlur={() => saveRoleLabel(role.id, editingRole.label)}
                    onKeyDown={(e) => e.key === "Enter" && saveRoleLabel(role.id, editingRole.label)}
                    className="flex-1 rounded border border-primary-600 bg-primary-950 px-2 py-1 text-slate-100 focus:outline-none"
                  />
                ) : (
                  <span className="flex-1 text-slate-200">{role.label}</span>
                )}
                <span className="text-xs text-slate-500">{count} membre(s)</span>
                <button onClick={() => setEditingRole({ id: role.id, label: role.label })} className="text-xs text-primary-300 hover:underline">Renommer</button>
                <button onClick={() => deleteRole(role.id, role.label)} className="text-xs text-red-400 hover:underline">Supprimer</button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Membres du bureau ── */}
      {bureauMembers.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-silver-100">
            Membres du bureau ({bureauMembers.length})
          </h2>
          <div className="mt-4 space-y-2">
            {bureauMembers
              .sort((a, b) => Math.min(...a.bureauRoles.map((r) => r.order)) - Math.min(...b.bureauRoles.map((r) => r.order)))
              .map((m) => (
                <div key={m.id} className="rounded-lg border border-primary-700 bg-primary-900/40 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100">{m.firstName} {m.name}</span>
                    <span className="text-xs text-slate-400">{m.email}</span>
                    <div className="ml-auto flex flex-wrap gap-1">
                      {[...m.bureauRoles].sort((a, b) => a.order - b.order).map((r) => (
                        <span key={r.id} className="rounded bg-primary-800 px-2 py-0.5 text-xs text-primary-200">{r.label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sortedRoles.map((role) => {
                      const active = m.bureauRoles.some((r) => r.id === role.id);
                      return (
                        <button
                          key={role.id}
                          onClick={() => toggleRole(m, role.id)}
                          disabled={savingMember === m.id}
                          className={`rounded-full border px-3 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                            active
                              ? "border-primary-400 bg-primary-800 text-primary-200"
                              : "border-primary-800 bg-transparent text-slate-500 hover:border-primary-600 hover:text-slate-300"
                          }`}
                        >
                          {active ? "✓ " : "+ "}{role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── Assigner un membre ── */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-silver-100">Assigner des rôles</h2>
        <p className="mt-1 text-sm text-slate-400">
          Cliquez sur un rôle pour l'activer ou le retirer pour chaque membre.
        </p>
        <div className="mt-4 space-y-3">
          {members.map((m) => (
            <div key={m.id} className="rounded-lg border border-primary-800 bg-primary-900/20 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-200">{m.firstName} {m.name}</span>
                <span className="text-xs text-slate-500">{m.email}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {sortedRoles.length === 0 && (
                  <span className="text-xs text-slate-600">Aucun rôle défini</span>
                )}
                {sortedRoles.map((role) => {
                  const active = m.bureauRoles.some((r) => r.id === role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => toggleRole(m, role.id)}
                      disabled={savingMember === m.id}
                      className={`rounded-full border px-3 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                        active
                          ? "border-primary-400 bg-primary-800 text-primary-200"
                          : "border-primary-800 bg-transparent text-slate-500 hover:border-primary-600 hover:text-slate-300"
                      }`}
                    >
                      {active ? "✓ " : "+ "}{role.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
