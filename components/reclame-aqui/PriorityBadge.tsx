import Badge from "@/components/design-system/Badge";

interface Props {
  priority:
    | "Baixa"
    | "Média"
    | "Alta"
    | "Crítica";
}

export default function PriorityBadge({ priority }: Props) {
  const variant = {
    "Baixa": "success",
    "Média": "neutral",
    "Alta": "warning",
    "Crítica": "danger",
  } as const;

  return (
    <Badge variant={variant[priority]}>
      {priority}
    </Badge>
  );
}