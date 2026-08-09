"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BalanceTopUpCard from "@/components/BalanceTopUpCard";
import DateInput from "@/components/DateInput";

const inputClass =
  "mt-1 w-full rounded-md border border-primary-700 bg-primary-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none";

function computeAge(dateOfBirth: string): number | null {
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

export default function ProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContactFirstName, setEmergencyContactFirstName] = useState("");
  const [emergencyContactLastName, setEmergencyContactLastName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [airsoftHasOwnEquipment, setAirsoftHasOwnEquipment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!data) return;
        setFirstName(data.firstName ?? "");
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setDateOfBirth(data.dateOfBirth ?? "");
        setPhone(data.phone ?? "");
        setAddressStreet(data.addressStreet ?? "");
        setAddressCity(data.addressCity ?? "");
        setAddressPostalCode(data.addressPostalCode ?? "");
        setGender(data.gender ?? "");
        setEmergencyContactFirstName(data.emergencyContactFirstName ?? "");
        setEmergencyContactLastName(data.emergencyContactLastName ?? "");
        setEmergencyContactPhone(data.emergencyContactPhone ?? "");
        setAirsoftHasOwnEquipment(!!data.airsoftHasOwnEquipment);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        name,
        dateOfBirth,
        phone,
        addressStreet,
        addressCity,
        addressPostalCode,
        gender,
        emergencyContactFirstName,
        emergencyContactLastName,
        emergencyContactPhone,
        airsoftHasOwnEquipment,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Mon profil</h1>

      <div className="mt-6 flex gap-2 border-b border-primary-800">
        <span className="border-b-2 border-primary-400 px-4 py-2 text-sm font-medium text-silver-100">
          Profil
        </span>
        <Link
          href="/profil/jeux"
          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
        >
          🎲 Mes jeux de société
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Les champs marqués <span className="text-red-400 font-semibold">*</span> sont obligatoires pour adhérer à l'association.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-primary-800 bg-primary-900/40 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Prénom <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Nom <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Email</label>
          <input value={email} disabled className={`${inputClass} opacity-60`} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Date de naissance{" "}
            <span className="text-xs font-normal text-slate-500">(optionnel)</span>
          </label>
          <div className="flex items-center gap-3">
            <DateInput
              value={dateOfBirth}
              onChange={setDateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
            {computeAge(dateOfBirth) !== null && (
              <span className="whitespace-nowrap text-sm text-slate-400">
                {computeAge(dateOfBirth)} ans
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Numéro de téléphone{" "}
            <span className="text-xs font-normal text-slate-500">(optionnel)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 12 34 56 78"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Rue <span className="text-red-400">*</span>
          </label>
          <input
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
            placeholder="12 rue des Éternels"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-slate-300">
              Code postal <span className="text-red-400">*</span>
            </label>
            <input
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
              placeholder="75000"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">
              Ville <span className="text-red-400">*</span>
            </label>
            <input
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder="Paris"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Genre <span className="text-red-400">*</span>
          </label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
            <option value="">Sélectionner...</option>
            <option value="HOMME">Homme</option>
            <option value="FEMME">Femme</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>

        <div className="rounded-lg border border-primary-700 bg-primary-950/60 p-4">
          <p className="text-sm font-medium text-slate-200">🚨 Personne à contacter en cas d'urgence</p>
          <p className="mt-1 text-xs text-slate-500">
            Optionnel — non requis pour adhérer, mais recommandé en cas d'accident.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">Prénom</label>
              <input
                value={emergencyContactFirstName}
                onChange={(e) => setEmergencyContactFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Nom</label>
              <input
                value={emergencyContactLastName}
                onChange={(e) => setEmergencyContactLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300">Numéro de téléphone</label>
            <input
              type="tel"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className={inputClass}
            />
          </div>
        </div>

        <div className="rounded-lg border border-primary-700 bg-primary-950/60 p-4">
          <p className="text-sm font-medium text-slate-200">🔫 Airsoft</p>
          <p className="mt-1 text-xs text-slate-500">
            Ces informations peuvent être utilisées par les organisateurs d'événements airsoft.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={airsoftHasOwnEquipment}
              onChange={(e) => setAirsoftHasOwnEquipment(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary-400"
            />
            <span className="text-sm text-slate-300">
              Je possède ma propre réplique et mon équipement de protection airsoft
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Profil mis à jour.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-primary-400 px-4 py-2 font-semibold text-primary-950 hover:bg-silver-300 disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>

      <BalanceTopUpCard />

      <p className="mt-6 text-sm text-slate-400">
        <Link href="/mon-compte" className="font-medium text-primary-300 hover:text-silver-200 hover:underline">
          ← Retour à mon adhésion
        </Link>
      </p>
    </div>
  );
}
