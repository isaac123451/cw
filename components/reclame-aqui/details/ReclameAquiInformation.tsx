import { Case } from "@/lib/models/case";

interface Props {
  caseData: Case;
}

export default function ReclameAquiInformation({
  caseData,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-5 text-lg font-semibold">
        Indicadores RA
      </h2>

      <div className="space-y-4">

        <Info
          title="Nota"
          value={`⭐ ${caseData.rating}`}
        />

        <Info
          title="Resolvido"
          value={caseData.solved ? "Sim" : "Não"}
        />

        <Info
          title="Voltaria"
          value={caseData.wouldDoBusinessAgain ? "Sim" : "Não"}
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
  value: string;
}) {
  return (
    <div className="flex justify-between">

      <span>{title}</span>

      <strong>{value}</strong>

    </div>
  );
}