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
  { key: "documents", label: "Documents" },
  { key: "notes", label: "Notes admin" },
  { key: "boutique", label: "Boutique" },
  { key: "lieux", label: "Lieux de jeu" },
] as const;

type Level = "none" | "read" | "write";

type RoleRow = {
  label: string;
  permissions: Record<string, string>;
  fromDb: boolean;
};

const LEVEL_CYCLE: Level[] = ["none", "read", "write"];

function nextLevel(current: Level): Level {
  const idx = LEVEL_CYCLE.indexOf(current);
  return LEVEL_CYCLE[(idx + 1) % LEVEL_CYCLE.length];
}

function LevelBadge({ level, onClick }: { level: Level; onClick: () => void }) {
  if (level === "write") {
    return (
      <button
        onClick={onClick}
        title="Écriture — cliquer pour retirer"
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800/60 transition"
      >
        ✏️ Écriture
      </button>
    );
  }
  if (level === "read") {
    return (
      <button
        onClick={onClick}
        title="Lecture — cliquer pour écriture"
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-sky-900/60 text-sky-300 hover:bg-sky-800/60 transition"
      >
        👁 Lecture
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title="Aucun accès — cliquer pour lecture"
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-primary-900/40 text-slate-600 hover:bg-primary-800/60 hover:text-slate-400 transition"
    >
      —
    </button>
  );
}

export default function PermissionsPage() {
  const { update } = useSession();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [levels, setLevels] = useState<Record<string, Record<string, Level>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/permissions")
      .then((r) => r.json())
      .then((data: { roles: RoleRow[] }) => {
        setRoles(data.roles);
        const initial: Record<string, Record<string, Level>> = {};
        for (const role of data.roles) {
          initial[role.label] = {};
          for (const s of ALL_SECTIONS) {
            const dbLevel = role.permissions[s.key];
            initial[role.label][s.key] = dbLevel === "read" ? "read" : dbLevel === "write" ? "write" : "none";
          }
        }
        setLevels(initial);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (roleLabel: string, section: string) => {
    setLevels((prev) => {
      const current: Level = prev[roleLabel]?.[section] ?? "none";
      return {
        ...prev,
        [roleLabel]: { ...prev[roleLabel], [section]: nextLevel(current) },
      };
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const permissions = roles.map((r) => ({
        role: r.label,
        entries: ALL_SECTIONS
          .filter((s) => (levels[r.label]?.[s.key] ?? "none") !== "none")
          .map((s) => ({ section: s.key, level: levels[r.label][s.key] })),
      }));
      const res = await fetch("/api/admin/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Erreur lors de l'enregistrement.");
      setSaved(true);
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
        Définissez le niveau d'accès de chaque rôle de bureau aux sections du panel admin.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Les rôles <span className="text-slate-400">Président</span>,{" "}
        <span className="text-slate-400">Vice-président</span> et{" "}
        <span className="text-slate-400">ADMIN</span> ont toujours tous les droits.{" "}
        Les modifications prennent effet à la prochaine connexion des utilisateurs concernés.
      </p>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-primary-900/40 text-slate-600">— Aucun accès</span>
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-sky-900/60 text-sky-300">👁 Lecture seule</span>
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-emerald-900/60 text-emerald-300">✏️ Écriture</span>
        <span className="text-slate-600">Cliquez sur une cellule pour changer son niveau.</span>
      </div>

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
          <div className="mt-6 overflow-x-auto rounded-xl border border-primary-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-800 bg-primary-900/60">
                  <th className="sticky left-0 z-10 bg-primary-900/95 px-4 py-3 text-left font-medium text-slate-300 whitespace-nowrap">
                    Rôle
                  </th>
                  {ALL_SECTIONS.map((s) => (
                    <th
                      key={s.key}
                      className="px-2 py-3 text-center font-medium text-slate-300 whitespace-nowrap text-xs"
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
                      <td key={s.key} className="px-2 py-2 text-center">
                        <LevelBadge
                          level={levels[role.label]?.[s.key] ?? "none"}
                          onClick={() => toggle(role.label, s.key)}
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
