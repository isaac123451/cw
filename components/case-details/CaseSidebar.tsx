import { Case } from "@/lib/models/case";
import StatusSelector from "./StatusSelector";
import OwnerSelector from "./OwnerSelector";

interface Props {
  data: Case;
}

export default function CaseSidebar({ data }: Props) {
  return (
    <div className="space-y-5">

      <Card
        title="Prioridade"
        value={data.priority}
      />
      <StatusSelector value={data.status} />
<OwnerSelector value={data.owner} />
      <Card
        title="Status"
        value={data.status}
      />

      <Card
        title="Departamento"
        value={data.department}
      />

      <Card
        title="Solicitação"
        value={data.request}
      />

      <Card
        title="SLA"
        value={data.sla}
      />

      <Card
        title="Risco de Churn"
        value={data.churnRisk ? "Sim" : "Não"}
      />

    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5">

      <p className="text-sm text-zinc-500">
        {title}
      </p>

      <h3 className="mt-2 text-lg font-bold">
        {value || "-"}
      </h3>

    </div>
  );
}