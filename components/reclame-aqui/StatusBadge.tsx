import Badge from "@/components/design-system/Badge";

interface Props {
  status:
    | "Novo"
    | "Em Atendimento"
    | "Aguardando Cliente"
    | "Aguardando Interno"
    | "Resolvido";
}

export default function StatusBadge({ status }: Props) {
  const variant = {
    "Novo": "primary",
    "Em Atendimento": "warning",
    "Aguardando Cliente": "warning",
    "Aguardando Interno": "danger",
    "Resolvido": "success",
  } as const;

  return (
    <Badge variant={variant[status]}>
      {status}
    </Badge>
  );
}