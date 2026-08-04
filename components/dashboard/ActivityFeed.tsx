const activities = [
  "Carlos iniciou atendimento da CW-1001",
  "Fiscal respondeu uma reclamação",
  "Caso CW-1002 foi encerrado",
  "Novo caso recebido pelo Reclame Aqui",
];

export default function ActivityFeed() {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-6 text-xl font-bold">
        Atividade Recente
      </h2>

      <div className="space-y-4">

        {activities.map((activity) => (

          <div
            key={activity}
            className="border-l-4 border-violet-600 pl-4"
          >
            {activity}
          </div>

        ))}

      </div>

    </div>
  );
}