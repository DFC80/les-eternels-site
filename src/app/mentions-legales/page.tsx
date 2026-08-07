export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export const metadata = { title: "Mentions légales" };

export default async function MentionsLegalesPage() {
  const [nomSetting, anneeSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "nomAssociation" } }),
    prisma.siteSetting.findUnique({ where: { key: "anneeCopyright" } }),
  ]);

  const nom = nomSetting?.value ?? "Les Éternels";
  const annee = anneeSetting?.value ?? String(new Date().getFullYear());

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl text-silver-100">Mentions légales</h1>

      <section className="mt-10 space-y-2">
        <h2 className="font-display text-lg text-silver-200">Éditeur du site</h2>
        <p className="text-slate-300">
          <strong>{nom}</strong> — Association loi 1901
        </p>
        <p className="text-slate-400">
          Adresse : 63 Rue Chanzy 80420 Flixecourt<br />
          Email : les.eternels@gmail.com<br />
          Téléphone : 06.87.50.47.38
        </p>
        <p className="text-slate-400">
          Directeur de la publication : le Président de l'association.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-display text-lg text-silver-200">Hébergement</h2>
        <p className="text-slate-400">
          Ce site est hébergé par :<br />
          À compléter (nom, adresse, site de l'hébergeur).
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-display text-lg text-silver-200">Propriété intellectuelle</h2>
        <p className="text-slate-400">
          L'ensemble des contenus présents sur ce site (textes, images, logos) sont la propriété
          exclusive de {nom} ou de leurs auteurs respectifs et sont protégés par les lois en
          vigueur relatives à la propriété intellectuelle. Toute reproduction, même partielle, est
          interdite sans autorisation préalable.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-display text-lg text-silver-200">Données personnelles (RGPD)</h2>
        <p className="text-slate-400">
          Dans le cadre de la gestion des adhésions et des inscriptions aux événements, {nom}{" "}
          collecte des données personnelles (nom, prénom, adresse e-mail, date de naissance,
          coordonnées). Ces données sont utilisées exclusivement à des fins de gestion associative
          et ne sont pas transmises à des tiers.
        </p>
        <p className="text-slate-400">
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
          Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, de
          suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous
          à l'adresse indiquée ci-dessus.
        </p>
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="font-display text-lg text-silver-200">Cookies</h2>
        <p className="text-slate-400">
          Ce site utilise uniquement un cookie de session nécessaire au maintien de votre
          connexion. Aucun cookie publicitaire ou de traçage tiers n'est utilisé.
        </p>
      </section>

      <p className="mt-12 text-xs text-slate-600">
        © {annee} {nom}. Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}.
      </p>
    </main>
  );
}
