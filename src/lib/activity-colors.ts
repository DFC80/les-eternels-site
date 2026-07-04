export type ColorKey = "emerald" | "violet" | "amber" | "blue" | "rose" | "cyan" | "fuchsia" | "slate";

export const COLOR_OPTIONS: Record<ColorKey, { label: string; border: string; bg: string; text: string; badge: string }> = {
  emerald: { label: "Vert",    border: "border-emerald-700", bg: "bg-emerald-950", text: "text-emerald-300", badge: "bg-emerald-900/60 text-emerald-300" },
  violet:  { label: "Violet",  border: "border-violet-700",  bg: "bg-violet-950",  text: "text-violet-300",  badge: "bg-violet-900/60 text-violet-300" },
  amber:   { label: "Orange",  border: "border-amber-700",   bg: "bg-amber-950",   text: "text-amber-300",   badge: "bg-amber-900/60 text-amber-300" },
  blue:    { label: "Bleu",    border: "border-blue-700",    bg: "bg-blue-950",    text: "text-blue-300",    badge: "bg-blue-900/60 text-blue-300" },
  rose:    { label: "Rose",    border: "border-rose-700",    bg: "bg-rose-950",    text: "text-rose-300",    badge: "bg-rose-900/60 text-rose-300" },
  cyan:    { label: "Cyan",    border: "border-cyan-700",    bg: "bg-cyan-950",    text: "text-cyan-300",    badge: "bg-cyan-900/60 text-cyan-300" },
  fuchsia: { label: "Fuchsia", border: "border-fuchsia-700", bg: "bg-fuchsia-950", text: "text-fuchsia-300", badge: "bg-fuchsia-900/60 text-fuchsia-300" },
  slate:   { label: "Gris",    border: "border-slate-700",   bg: "bg-slate-950",   text: "text-slate-300",   badge: "bg-slate-900/60 text-slate-300" },
};

export function getColors(color: string) {
  return COLOR_OPTIONS[color as ColorKey] ?? COLOR_OPTIONS.slate;
}

export const CORE_ACTIVITIES = [
  { key: "JEUX_DE_PLATEAU", label: "Jeux de plateau", emoji: "🎲", color: "emerald", order: 0, membershipRequired: true, isCore: true, price: 10 },
  { key: "JEUX_DE_ROLE",    label: "Jeux de rôle",    emoji: "🐉", color: "violet",  order: 1, membershipRequired: true, isCore: true, price: 10 },
  { key: "AIRSOFT",         label: "Airsoft",          emoji: "🎯", color: "amber",   order: 2, membershipRequired: true, isCore: true, price: 20 },
];
