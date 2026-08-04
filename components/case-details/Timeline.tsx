export default function Timeline() {
  return (
    <div className="rounded-2xl border bg-white p-8">

      <h2 className="mb-6 text-xl font-bold">
        Timeline
      </h2>

      <div className="space-y-5">

        <Event
          title="Caso criado"
          date="Hoje • 09:20"
        />

        <Event
          title="Encaminhado ao Fiscal"
          date="Hoje • 09:45"
        />

        <Event
          title="Cliente respondeu"
          date="Hoje • 10:12"
        />

      </div>

    </div>
  );
}

function Event({
  title,
  date,
}: {
  title: string;
  date: string;
}) {
  return (
    <div className="border-l-2 border-violet-500 pl-4">

      <h4 className="font-semibold">
        {title}
      </h4>

      <p className="text-sm text-zinc-500">
        {date}
      </p>

    </div>
  );
}