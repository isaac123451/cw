const history = [
  "Caso criado",
  "Responsável definido",
  "Cliente respondeu",
  "Em atendimento",
];

export default function Timeline() {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-5 text-lg font-semibold">
        Histórico
      </h2>

      <div className="space-y-4">

        {history.map((item) => (
          <div
            key={item}
            className="border-l-2 border-violet-600 pl-4"
          >
            {item}
          </div>
        ))}

      </div>

    </div>
  );
}