"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { sessionHasWriteAccess } from "@/lib/permissions";

type BoardGame = {
  id: string;
  name: string;
  photoUrl: string | null;
  minPlayers: number;
  maxPlayers: number;
  durationMinutes: number | null;
  status: "DISPONIBLE" | "INDISPONIBLE";
  activityKey: string | null;
  mechanics: string[];
  themes: string[];
  owner: { firstName: string; name: string };
};

type Activity = { key: string; label: string; emoji: string };

export default function AdminJeuxPage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; allowedSections?: string[] | null } | undefined;
  const canWrite = sessionHasWriteAccess(sessionUser, "jeux");
  const [games, setGames] = useState<BoardGame[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filterKey, setFilterKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/board-games");
    if (res.ok) setGames(await res.json());
  }

  useEffect(() => {
    load();
    fetch("/api/activities")
      .then((r) => r.json())
      .then((list: Activity[]) => setActivities(list.filter((a) => a.key)));
  }, []);

  async function updateActivity(id: string, activityKey: string | null) {
    setError(null);
    const res = await fetch(`/api/admin/board-games/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityKey }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la mise à jour.");
      return;
    }
    await load();
  }

  async function toggleStatus(id: string, status: "DISPONIBLE" | "INDISPONIBLE") {
    setError(null);
    const res = await fetch(`/api/admin/board-games/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors de la mise à jour.");
      return;
    }
    await load();
  }

  async function removeGame(id: string) {
    if (!confirm("Supprimer ce jeu du stock de l'association ?")) return;
    const res = await fetch(`/api/admin/board-games/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const usedActivityKeys = new Set(games.map((g) => g.activityKey).filter(Boolean));
  const tabActivities = activities.filter((a) => usedActivityKeys.has(a.key));
  const hasUnassigned = games.some((g) => !g.activityKey);

  const filteredGames =
    filterKey === "__none__"
      ? games.filter((g) => !g.activityKey)
      : filterKey
      ? games.filter((g) => g.activityKey === filterKey)
      : games;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Jeux</h1>
      <p className="mt-2 text-slate-400">
        Stock des jeux prêtés par les membres. Marquez un jeu indisponible s'il ne peut
        plus être emprunté pour le moment (en réparation, prêté ailleurs...).
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {(tabActivities.length > 0 || hasUnassigned) && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterKey("")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filterKey === ""
                ? "bg-primary-400 text-primary-950"
                : "border border-primary-800 text-slate-400 hover:border-primary-600 hover:text-slate-200"
            }`}
          >
            Tous ({games.length})
          </button>
          {tabActivities.map((a) => {
            const count = games.filter((g) => g.activityKey === a.key).length;
            return (
              <button
                key={a.key}
                onClick={() => setFilterKey(a.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  filterKey === a.key
                    ? "bg-primary-400 text-primary-950"
                    : "border border-primary-800 text-slate-400 hover:border-primary-600 hover:text-slate-200"
                }`}
              >
                {a.emoji} {a.label} ({count})
              </button>
            );
          })}
          {hasUnassigned && (
            <button
              onClick={() => setFilterKey("__none__")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filterKey === "__none__"
                  ? "bg-primary-400 text-primary-950"
                  : "border border-primary-800 text-slate-400 hover:border-primary-600 hover:text-slate-200"
              }`}
            >
              Sans activité ({games.filter((g) => !g.activityKey).length})
            </button>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {filteredGames.length === 0 && <p className="text-sm text-slate-400">Aucun jeu enregistré.</p>}
        {filteredGames.map((game) => (
          <div key={game.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
            <div className="flex gap-4">
              {game.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.photoUrl} alt={game.name} className="h-20 w-20 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-100">{game.name}</p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      game.status === "DISPONIBLE" ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"
                    }`}
                  >
                    {game.status === "DISPONIBLE" ? "Disponible" : "Indisponible"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers} joueur(s)`
                    : `${game.minPlayers} à ${game.maxPlayers} joueurs`}{" "}
                  {game.durationMinutes != null && ` · ${game.durationMinutes} min`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Prêté par {game.owner.firstName} {game.owner.name}
                </p>
                {(game.mechanics.length > 0 || game.themes.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {game.mechanics.map((m) => (
                      <span key={m} className="rounded-full border border-primary-800 bg-primary-900/80 px-2 py-0.5 text-xs text-primary-300">
                        {m}
                      </span>
                    ))}
                    {game.themes.map((t) => (
                      <span key={t} className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {canWrite && activities.length > 0 && (
                  <div className="mt-2">
                    <select
                      value={game.activityKey ?? ""}
                      onChange={(e) => updateActivity(game.id, e.target.value || null)}
                      className="rounded border border-primary-700 bg-primary-950 px-2 py-1 text-xs text-slate-300 focus:border-primary-400 focus:outline-none"
                    >
                      <option value="">— Aucune activité —</option>
                      {activities.map((a) => (
                        <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {canWrite && (
                  <div className="mt-2 flex gap-3 text-sm">
                    <button
                      onClick={() =>
                        toggleStatus(game.id, game.status === "DISPONIBLE" ? "INDISPONIBLE" : "DISPONIBLE")
                      }
                      className="text-primary-300 hover:text-silver-200 hover:underline"
                    >
                      {game.status === "DISPONIBLE" ? "Marquer indisponible" : "Marquer disponible"}
                    </button>
                    <button onClick={() => removeGame(game.id)} className="text-red-400 hover:underline">
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
