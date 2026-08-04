interface Props {
  status: string;
}

const colors = {
  Novo: "bg-blue-100 text-blue-700",

  "Em Atendimento": "bg-yellow-100 text-yellow-700",

  "Aguardando Cliente": "bg-orange-100 text-orange-700",

  "Aguardando Interno": "bg-red-100 text-red-700",

  Resolvido: "bg-green-100 text-green-700",
};

export default function CaseStatusBadge({
  status,
}: Props) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        colors[status as keyof typeof colors]
      }`}
    >
      {status}
    </span>
  );
}