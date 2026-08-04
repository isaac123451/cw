const events = [
  {
    date: "Hoje",
    text: "Nova reclamação criada.",
  },
  {
    date: "Ontem",
    text: "Fiscal respondeu o cliente.",
  },
  {
    date: "05/07",
    text: "Solicitação de desconto aprovada.",
  },
];

export default function CompanyTimeline() {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-6 text-xl font-semibold">
        Timeline
      </h2>

      <div className="space-y-5">

        {events.map((event, index) => (

          <div
            key={index}
            className="border-l-4 border-violet-600 pl-4"
          >
            <strong>

              {event.date}

            </strong>

            <p>

              {event.text}

            </p>

          </div>

        ))}

      </div>

    </div>
  );
}