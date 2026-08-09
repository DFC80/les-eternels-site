import type { Metadata } from "next";
import Link from "next/link";
import { DiscordIcon, FacebookIcon } from "@/components/SocialIcons";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact — Les Éternels" };

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-display text-3xl text-silver-100">Nous contacter</h1>
      <p className="mt-3 text-slate-400">
        Une question, une demande d'information ou envie de nous rejoindre ? Utilisez le formulaire
        ci-dessous ou contactez-nous directement.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* Formulaire */}
        <section className="rounded-xl border border-primary-800 bg-primary-900/50 p-6">
          <h2 className="mb-5 font-display text-lg text-silver-200">✉️ Formulaire de contact</h2>
          <ContactForm />
        </section>

        {/* Infos */}
        <div className="space-y-4">
          <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-5">
            <h2 className="font-display text-base text-silver-200">📍 Adresse</h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Les Éternels<br />
              63 Rue Chanzy<br />
              80420 Flixecourt
            </p>
            <a
              href="https://maps.google.com/?q=63+Rue+Chanzy+80420+Flixecourt"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-primary-300 hover:underline"
            >
              Voir sur Google Maps →
            </a>
          </div>

          <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-5">
            <h2 className="font-display text-base text-silver-200">📬 Coordonnées directes</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <span className="text-slate-500 text-xs uppercase tracking-wide">E-mail</span><br />
                <a href="mailto:les.eternels@gmail.com" className="text-primary-300 hover:underline">
                  les.eternels@gmail.com
                </a>
              </li>
              <li>
                <span className="text-slate-500 text-xs uppercase tracking-wide">Téléphone</span><br />
                <a href="tel:+33687504738" className="text-primary-300 hover:underline">
                  06 87 50 47 38
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-primary-800 bg-primary-900/50 p-5">
            <h2 className="font-display text-base text-silver-200">💬 Réseaux sociaux</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://discord.gg/eb696fuek"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-primary-700 bg-primary-900 px-3 py-2 text-sm font-medium text-silver-200 transition hover:bg-[#5865F2] hover:border-[#5865F2] hover:text-white"
              >
                <DiscordIcon className="h-4 w-4" />
                Discord
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=100009370253696"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-primary-700 bg-primary-900 px-3 py-2 text-sm font-medium text-silver-200 transition hover:bg-[#1877F2] hover:border-[#1877F2] hover:text-white"
              >
                <FacebookIcon className="h-4 w-4" />
                Facebook
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-primary-800/60 bg-primary-900/30 p-4 text-xs text-slate-400">
            Vous souhaitez adhérer ?{" "}
            <Link href="/register" className="text-primary-300 hover:underline">
              Créez votre compte
            </Link>{" "}
            et complétez votre inscription en ligne.
          </div>
        </div>
      </div>
    </main>
  );
}
