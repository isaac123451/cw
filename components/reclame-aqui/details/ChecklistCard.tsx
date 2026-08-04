export default function ChecklistCard() {
  const items = [
    "Validar reclamação",
    "Analisar histórico",
    "Definir responsável",
    "Responder cliente",
    "Encerrar caso",
  ];

  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-5 text-lg font-semibold">
        Checklist
      </h2>

      <div className="space-y-3">

        {items.map((item) => (
          <label
            key={item}
            className="flex items-center gap-3"
          >
            <input type="checkbox" />

            {item}
          </label>
        ))}

      </div>

    </div>
  );
}