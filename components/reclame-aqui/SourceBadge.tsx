import Badge from "@/components/design-system/Badge";

interface Props {
  source:
    | "Reclame Aqui"
    | "Instagram"
    | "Google"
    | "Facebook";
}

export default function SourceBadge({ source }: Props) {
  return (
    <Badge variant="primary">
      {source}
    </Badge>
  );
}