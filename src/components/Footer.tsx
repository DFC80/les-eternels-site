import Image from "next/image";
import { DiscordIcon, FacebookIcon } from "@/components/SocialIcons";
import { prisma } from "@/lib/prisma";

const socialLinks = [
  {
    label: "Discord",
    href: "https://discord.gg/eb696fuek",
    Icon: DiscordIcon,
    hoverClass: "hover:bg-[#5865F2] hover:text-white hover:border-[#5865F2]",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=100009370253696",
    Icon: FacebookIcon,
    hoverClass: "hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]",
  },
];

export default async function Footer() {
  const [activities, nomSetting, anneeSetting, logoSetting] = await Promise.all([
    prisma.activity.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { label: true },
    }),
    prisma.siteSetting.findUnique({ where: { key: "nomAssociation" } }),
    prisma.siteSetting.findUnique({ where: { key: "anneeCopyright" } }),
    prisma.siteSetting.findUnique({ where: { key: "logoVersion" } }),
  ]).catch(() => [[], null, null, null] as const);

  const nomAssociation = nomSetting?.value ?? "Les Éternels";
  const anneeCopyright = anneeSetting?.value ?? String(new Date().getFullYear());
  const logoSrc = `/logo.jpg${logoSetting?.value ? `?v=${logoSetting.value}` : ""}`;
  const activityLine = activities.length > 0
    ? activities.map((a) => a.label).join(" · ")
    : null;

  return (
    <footer className="border-t border-primary-800 bg-primary-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center text-sm text-slate-400">
        <Image src={logoSrc} alt={`Logo ${nomAssociation}`} width={64} height={41} className="rounded opacity-90" unoptimized />
        <p className="font-brand text-xl text-silver-200">{nomAssociation}</p>

        <div className="flex gap-4">
          {socialLinks.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              title={s.label}
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-primary-700 bg-primary-900 text-silver-200 transition ${s.hoverClass}`}
            >
              <s.Icon className="h-5 w-5" />
            </a>
          ))}
        </div>

        <p>© {anneeCopyright} {nomAssociation} — Association loi 1901.</p>
        {activityLine && <p>{activityLine}</p>}
        <div className="flex gap-4">
          <a
            href="/contact"
            className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
          >
            Contact
          </a>
          <a
            href="/mentions-legales"
            className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
          >
            Mentions légales
          </a>
        </div>
      </div>
    </footer>
  );
}
