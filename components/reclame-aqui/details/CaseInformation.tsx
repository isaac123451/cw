import { Case } from "@/lib/models/case";

interface Props {
  caseData: Case;
}

export default function CaseInformation({
  caseData,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-5 text-lg font-semibold">
        Dados da Reclamação
      </h2>

      <div className="space-y-4">

        <Info
          title="Prioridade"
          value={caseData.priority}
        />

        <Info
          title="SLA"
          value={caseData.sla}
        />

        <Info
          title="Criado em"
          value={caseData.createdAt}
        />

        <Info
          title="Última atualização"
          value={caseData.updatedAt}
        />

      </div>

    </div>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  return (
    <div className="flex justify-between">

      <span>{title}</span>

      <strong>{value || "-"}</strong>

    </div>
  );
}