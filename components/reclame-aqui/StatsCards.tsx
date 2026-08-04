import MetricCard from "@/components/design-system/MetricCard";
import {
  CircleAlert,
  Clock3,
 ShieldCheck,
  Star,
} from "lucide-react";

export default function StatsCards() {
  return (
    <div className="grid grid-cols-4 gap-6">

      <MetricCard
        title="Casos"
        value="18"
        subtitle="Em andamento"
        icon={CircleAlert}
      />

      <MetricCard
        title="Tempo Médio"
        value="1,2 dias"
        subtitle="Últimos 30 dias"
        icon={Clock3}
      />

      <MetricCard
        title="RA1000"
        value="Ativo"
        subtitle="Excelente"
        icon={ShieldCheck}
      />

      <MetricCard
        title="Avaliações"
        value="92%"
        subtitle="Respondidas"
        icon={Star}
      />

    </div>
  );
}