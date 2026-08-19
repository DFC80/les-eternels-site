"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";

type BoardGame = {
  id: string;
  name: string;
  photoUrl: string | null;
  minPlayers: number;
  maxPlayers: number;
  durationMinutes: number | null;
  status: "DISPONIBLE" | "INDISPONIBLE";
  isPublic: boolean;
};

const EMPTY_FORM = {
  id: "",
  name: "",
  photoUrl: "",
  minPlayers: "",
  maxPlayers: "",
  durationMinutes: "",
  isPublic: true,
};

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

export default function MesJeuxPage() {
  const [games, setGames] = useState<BoardGame[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/board-games");
    if (res.ok) setGames(await res.json());
  }

  useEffect(() => { load(); }, []);

  function resetForm() { setForm(EMPTY_FORM); }

  function editGame(game: BoardGame) {
    setForm({
      id: game.id,
      name: game.name,
      photoUrl: game.photoUrl ?? "",
      minPlayers: String(game.minPlayers),
      maxPlayers: String(game.maxPlayers),
      durationMinutes: String(game.durationMinutes),
      isPublic: game.isPublic,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name,
      photoUrl: form.photoUrl,
      minPlayers: form.minPlayers,
      maxPlayers: form.maxPlayers,
      durationMinutes: form.durationMinutes,
      isPublic: form.isPublic,
    };
    const res = await fetch(form.id ? `/api/board-games/${form.id}` : "/api/board-games", {
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

  async function togglePublic(game: BoardGame) {
    setToggling(game.id);
    await fetch(`/api/board-games/${game.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: game.name,
        photoUrl: game.photoUrl,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        durationMinutes: game.durationMinutes,
        isPublic: !game.isPublic,
      }),
    });
    setToggling(null);
    await load();
  }

  async function removeGame(id: string) {
    if (!confirm("Supprimer ce jeu de votre liste ?")) return;
    const res = await fetch(`/api/board-games/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Mon profil</h1>

      <div className="mt-6 flex gap-2 border-b border-primary-800">
        <Link href="/profil" className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white">
          Profil
        </Link>
        <span className="border-b-2 border-primary-400 px-4 py-2 text-sm font-medium text-silver-100">
          🎲 Mes jeux
        </span>
      </div>

      <p className="mt-6 text-slate-400">
        Prêtez vos jeux de société à l'association pour les soirées jeux. Activez la visibilité pour
        qu'ils puissent être sélectionnés par les organisateurs lors de la création d'un événement.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6 sm:grid-cols-2">
        <h2 className="col-span-full font-display text-lg text-silver-100">
          {form.id ? "Modifier le jeu" : "Ajouter un jeu"}
        </h2>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300">Nom du jeu</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Catan"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Joueurs min.</label>
          <input type="number" min={1} required value={form.minPlayers}
            onChange={(e) => setForm({ ...form, minPlayers: e.target.value })}
            placeholder="2" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Joueurs max.</label>
          <input type="number" min={1} required value={form.maxPlayers}
            onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })}
            placeholder="4" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">Durée d'une partie (min) <span className="text-slate-500 font-normal">— optionnel</span></label>
          <input type="number" min={1} value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            placeholder="40" className={inputClass} />
        </div>

        <div>
          <ImageUpload
            label="Photo (optionnel)"
            value={form.photoUrl}
            onChange={(url) => setForm({ ...form, photoUrl: url })}
          />
        </div>

        <div className="col-span-full">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-primary-400"
            />
            <span className="text-sm text-slate-300">
              <span className="font-medium text-slate-100">Visible pour les organisateurs</span>
              <br />
              <span className="text-slate-400">
                Les administrateurs et responsables Jeux de société pourront sélectionner ce jeu lors de la création d'un événement.
              </span>
            </span>
          </label>
        </div>

        {error && <p className="col-span-full text-sm text-red-400">{error}</p>}

        <div className="col-span-full flex gap-3">
          <button type="submit" disabled={saving}
            className="rounded-md bg-primary-400 px-5 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60">
            {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Ajouter"}
          </button>
          {form.id && (
            <button type="button" onClick={resetForm}
              className="rounded-md px-5 py-2 font-medium text-slate-300 hover:bg-primary-900">
              Annuler
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-10 font-display text-xl text-silver-100">Mes jeux prêtés ({games.length})</h2>
      <div className="mt-4 space-y-3">
        {games.length === 0 && <p className="text-sm text-slate-400">Vous n'avez pas encore ajouté de jeu.</p>}
        {games.map((game) => (
          <div key={game.id} className="rounded-xl border border-primary-800 bg-primary-900/40 p-4">
            <div className="flex gap-4">
              {game.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.photoUrl} alt={game.name} className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-100">{game.name}</p>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                    game.status === "DISPONIBLE" ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"
                  }`}>
                    {game.status === "DISPONIBLE" ? "Disponible" : "Indisponible"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers} joueur(s)`
                    : `${game.minPlayers} à ${game.maxPlayers} joueurs`}
                  {game.durationMinutes != null && ` · ${game.durationMinutes} min`}
                </p>

                {/* Visibilité toggle */}
                <button
                  onClick={() => togglePublic(game)}
                  disabled={toggling === game.id}
                  className={`mt-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    game.isPublic
                      ? "bg-primary-900 text-primary-300 hover:bg-primary-800"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  } disabled:opacity-50`}
                >
                  {toggling === game.id ? (
                    "…"
                  ) : game.isPublic ? (
                    <>👁 Visible par les organisateurs</>
                  ) : (
                    <>🔒 Privé — cliquer pour rendre visible</>
                  )}
                </button>

                <div className="mt-2 flex gap-3 text-sm">
                  <button onClick={() => editGame(game)} className="text-primary-300 hover:text-silver-200 hover:underline">
                    Modifier
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
