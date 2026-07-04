"use client";

import { useEffect, useState } from "react";

type BoardGame = {
  id: string;
  name: string;
  photoUrl: string | null;
  minPlayers: number;
  maxPlayers: number;
  durationMinutes: number;
  status: "DISPONIBLE" | "INDISPONIBLE";
  owner: { firstName: string; name: string };
};

export default function AdminJeuxPage() {
  const [games, setGames] = useState<BoardGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/board-games");
    if (res.ok) setGames(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Jeux de société</h1>
      <p className="mt-2 text-slate-400">
        Stock des jeux de société prêtés par les membres. Marquez un jeu indisponible s'il ne peut
        plus être emprunté pour le moment (en réparation, prêté ailleurs...).
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {games.length === 0 && <p className="text-sm text-slate-400">Aucun jeu enregistré.</p>}
        {games.map((game) => (
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
                  · {game.durationMinutes} min
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Prêté par {game.owner.firstName} {game.owner.name}
                </p>
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
