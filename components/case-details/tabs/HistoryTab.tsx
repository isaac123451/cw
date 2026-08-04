const events = [
  {
    user: "Carlos Isaac",
    action: "Criou o caso",
    time: "09:20",
  },
  {
    user: "Equipe Fiscal",
    action: "Assumiu o atendimento",
    time: "09:40",
  },
  {
    user: "Carlos Isaac",
    action: "Alterou o status para Em Atendimento",
    time: "10:05",
  },
];

export default function HistoryTab() {
  return (
    <div className="space-y-4">

      {events.map((event, index) => (
        <div
          key={index}
          className="rounded-xl border p-5"
        >
          <strong>{event.user}</strong>

          <p className="mt-2">
            {event.action}
          </p>

          <span className="text-sm text-zinc-500">
            {event.time}
          </span>
        </div>
      ))}

    </div>
  );
}