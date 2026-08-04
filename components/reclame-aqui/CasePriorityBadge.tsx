interface Props {
  priority: string;
}

const colors = {
  Baixa: "bg-green-100 text-green-700",

  Média: "bg-yellow-100 text-yellow-700",

  Alta: "bg-orange-100 text-orange-700",

  Crítica: "bg-red-100 text-red-700",
};

export default function CasePriorityBadge({
  priority,
}: Props) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        colors[priority as keyof typeof colors]
      }`}
    >
      {priority}
    </span>
  );
}