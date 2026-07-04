import EventCalendar from "@/components/EventCalendar";

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-silver-100">Calendrier des événements</h1>
      <p className="mt-2 text-slate-400">
        Cliquez sur un événement pour voir les détails et vous inscrire.
      </p>
      <div className="mt-8">
        <EventCalendar />
      </div>
    </div>
  );
}
