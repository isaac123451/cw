const metrics = [
  {
    title: "Casos Abertos",
    value: 18,
    color: "bg-violet-600",
  },
  {
    title: "Críticos",
    value: 4,
    color: "bg-red-500",
  },
  {
    title: "Aguardando Cliente",
    value: 6,
    color: "bg-orange-500",
  },
  {
    title: "Resolvidos Hoje",
    value: 11,
    color: "bg-green-600",
  },
];

export default function MetricsGrid() {
  return (
    <div className="grid gap-5 lg:grid-cols-4">
      {metrics.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div className={`mb-4 h-2 w-20 rounded-full ${item.color}`} />

          <p className="text-sm text-zinc-500">
            {item.title}
          </p>

          <h2 className="mt-3 text-4xl font-bold">
            {item.value}
          </h2>
        </div>
      ))}
    </div>
  );
}