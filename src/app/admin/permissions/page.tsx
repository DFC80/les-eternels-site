"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const ALL_SECTIONS = [
  { key: "events", label: "Événements" },
  { key: "members", label: "Membres" },
  { key: "comptabilite", label: "Comptabilité" },
  { key: "equipements", label: "Équipements" },
  { key: "galerie", label: "Galerie" },
  { key: "produits", label: "Produits" },
  { key: "kiosque", label: "Comptoir" },
  { key: "parametres", label: "Paramètres" },
  { key: "activites", label: "Activités" },
  { key: "bureau", label: "Bureau" },
  { key: "jeux", label: "Jeux" },
  { key: "content", label: "Actualités" },
  { key: "sondages", label: "Sondages" },
  { key: "reunions", label: "Réunions & AG" },
] as const;

type RoleRow = {
  label: string;
  sections: string[];
  fromDb: boolean;
};

export default function PermissionsPage() {
  const { update } = useSession();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [checked, setChecked] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/permissions")
      .then((r) => r.json())
      .then((data: { roles: RoleRow[] }) => {
        setRoles(data.roles);
        const initial: Record<string, Set<string>> = {};
        for (const role of data.roles) {
          initial[role.label] = new Set(role.sections);
        }
        setChecked(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (roleLabel: string, section: string) => {
    setChecked((prev) => {
      const next = { ...prev };
      const s = new Set(next[roleLabel]);
      if (s.has(section)) s.delete(section);
      else s.add(section);
      next[roleLabel] = s;
      return next;
    });
    setSaved(false);
  };

  const toggleAll = (section: string) => {
    const allChecked = roles.every((r) => checked[r.label]?.has(section));
    setChecked((prev) => {
      const next = { ...prev };
      for (const role of roles) {
        const s = new Set(next[role.label]);
        if (allChecked) s.delete(section);
        else s.add(section);
        next[role.label] = s;
      }
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const permissions = roles.map((r) => ({
        role: r.label,
        sections: Array.from(checked[r.label] ?? []),
      }));
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'enregistrement.");
      setSaved(true);
      // Rafraîchir la session de l'admin courant
      await update();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <p className="text-slate-400">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Permissions des rôles</h1>
      <p className="mt-2 text-slate-400">
        Définissez les sections du panel admin accessibles pour chaque rôle de bureau.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Les rôles <span className="text-slate-400">Président</span>,{" "}
        <span className="text-slate-400">Vice-président</span> et{" "}
        <span className="text-slate-400">ADMIN</span> ont toujours accès à toutes les sections.
        Les modifications prennent effet à la prochaine connexion des utilisateurs concernés.
      </p>

      {roles.length === 0 ? (
        <p className="mt-8 text-slate-400">
          Aucun rôle de bureau configuré. Créez des rôles dans la section{" "}
          <a href="/admin/bureau" className="text-primary-400 hover:underline">
            Bureau
          </a>
          .
        </p>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto rounded-xl border border-primary-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-800 bg-primary-900/60">
                  <th className="sticky left-0 z-10 bg-primary-900/95 px-4 py-3 text-left font-medium text-slate-300 whitespace-nowrap">
                    Rôle
                  </th>
                  {ALL_SECTIONS.map((s) => (
                    <th
                      key={s.key}
                      className="px-2 py-3 text-center font-medium text-slate-300 whitespace-nowrap cursor-pointer hover:text-silver-100"
                      title={`Tout cocher / décocher pour "${s.label}"`}
                      onClick={() => toggleAll(s.key)}
                    >
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role, i) => (
                  <tr
                    key={role.label}
                    className={
                      "border-b border-primary-800/40 " +
                      (i % 2 === 0 ? "bg-primary-900/10" : "bg-primary-900/30")
                    }
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-silver-100 whitespace-nowrap">
                      {role.label}
                      {!role.fromDb && (
                        <span className="ml-2 text-xs text-slate-500">(défaut)</span>
                      )}
                    </td>
                    {ALL_SECTIONS.map((s) => (
                      <td key={s.key} className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked[role.label]?.has(s.key) ?? false}
                          onChange={() => toggle(role.label, s.key)}
                          className="h-4 w-4 accent-primary-400 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-primary-600 px-6 py-2 font-medium text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer les permissions"}
            </button>
            {saved && (
              <span className="text-emerald-400">
                Permissions enregistrées. Les utilisateurs verront les changements à leur prochaine connexion.
              </span>
            )}
            {error && <span className="text-red-400">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
