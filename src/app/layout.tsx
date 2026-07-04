import type { Metadata } from "next";
import { Inter, Cinzel, Pinyon_Script } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const pinyon = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-brand" });

export const metadata: Metadata = {
  title: "Les Éternels — Association de jeux de plateau, jeux de rôle et airsoft",
  description:
    "Association à but non lucratif dédiée aux jeux de plateau, jeux de rôle et airsoft.",
  icons: {
    icon: "/logo.jpg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ["nomAssociation", "logoVersion"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const nomAssociation = map.nomAssociation ?? "Les Éternels";
  const logoSrc = `/logo.jpg${map.logoVersion ? `?v=${map.logoVersion}` : ""}`;

  return (
    <html lang="fr" className={`${inter.variable} ${cinzel.variable} ${pinyon.variable}`}>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="flex min-h-screen flex-col bg-primary-950 font-sans text-slate-100">
        <Providers>
          <Navbar nomAssociation={nomAssociation} logoSrc={logoSrc} />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
