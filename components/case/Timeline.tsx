import Card from "@/components/design-system/Card";
import TimelineItem from "./TimelineItem";

export default function Timeline() {
  return (
    <Card>

      <h2 className="text-xl font-semibold mb-8">
        Timeline
      </h2>

      <TimelineItem
        time="08:20"
        title="Caso criado"
        description="Cliente abriu reclamação."
      />

      <TimelineItem
        time="08:35"
        title="Primeira resposta"
        description="Resposta enviada."
      />

      <TimelineItem
        time="09:10"
        title="Fiscal acionado"
        description="Equipe Fiscal notificada."
      />

      <TimelineItem
        time="10:05"
        title="Cliente respondeu"
        description="Aguardando análise."
      />

    </Card>
  );
}