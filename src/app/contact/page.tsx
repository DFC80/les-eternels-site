import type { Metadata } from "next";
import Link from "next/link";
import { DiscordIcon, FacebookIcon } from "@/components/SocialIcons";

export const metadata: Metadata = { title: "Contact — Les Éternels" };

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl text-silver-100">Nous contacter</h1>
      <p className="mt-3 text-slate-400">
        Une question, une demande d'information ou envie de nous rejoindre ? N'hésitez pas à nous
        contacter par l'un des moyens ci-dessous.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-6">
          <h2 className="font-display text-lg text-silver-200">📍 Adresse</h2>
          <p className="mt-3 text-slate-300 leading-relaxed">
            Les Éternels<br />
            63 Rue Chanzy<br />
            80420 Flixecourt
          </p>
          <a
            href="https://maps.google.com/?q=63+Rue+Chanzy+80420+Flixecourt"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-primary-300 hover:text-primary-200 hover:underline"
          >
            Voir sur Google Maps →
          </a>
        </div>

        <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-6">
          <h2 className="font-display text-lg text-silver-200">📬 Coordonnées</h2>
          <ul className="mt-3 space-y-3 text-slate-300">
            <li>
              <span className="text-slate-500 text-xs uppercase tracking-wide">E-mail</span><br />
              <a
                href="mailto:les.eternels@gmail.com"
                className="text-primary-300 hover:text-primary-200 hover:underline"
              >
                les.eternels@gmail.com
              </a>
            </li>
            <li>
              <span className="text-slate-500 text-xs uppercase tracking-wide">Téléphone</span><br />
              <a
                href="tel:+33687504738"
                className="text-primary-300 hover:text-primary-200 hover:underline"
              >
                06 87 50 47 38
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-primary-800 bg-primary-900/50 p-6">
        <h2 className="font-display text-lg text-silver-200">💬 Réseaux sociaux</h2>
        <p className="mt-2 text-sm text-slate-400">Rejoignez-nous sur nos espaces communautaires pour suivre l'actualité de l'association.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="https://discord.gg/eb696fuek"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-primary-700 bg-primary-900 px-4 py-2.5 text-sm font-medium text-silver-200 transition hover:bg-[#5865F2] hover:border-[#5865F2] hover:text-white"
          >
            <DiscordIcon className="h-4 w-4" />
            Discord
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=100009370253696"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-primary-700 bg-primary-900 px-4 py-2.5 text-sm font-medium text-silver-200 transition hover:bg-[#1877F2] hover:border-[#1877F2] hover:text-white"
          >
            <FacebookIcon className="h-4 w-4" />
            Facebook
          </a>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-primary-800/60 bg-primary-900/30 p-5 text-sm text-slate-400">
        <p>
          Vous souhaitez adhérer ?{" "}
          <Link href="/register" className="text-primary-300 hover:underline">
            Créez votre compte
          </Link>{" "}
          et complétez votre inscription en ligne. Pour toute question sur les adhésions ou les
          activités, écrivez-nous directement par e-mail.
        </p>
      </div>
    </main>
  );
}
