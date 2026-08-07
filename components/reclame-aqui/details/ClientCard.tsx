import { Case } from "@/lib/models/case";

interface Props {
  caseData: Case;
}

export default function ClientCard({
  caseData,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-5 text-lg font-semibold">
        Cliente
      </h2>

      <div className="grid grid-cols-2 gap-5">

        <Info
          title="Nome"
          value={caseData.customer}
        />

        <Info
          title="Cidade"
          value={caseData.city}
        />

        <Info
          title="UF"
          value={caseData.state}
        />

        <Info
          title="Origem"
          value={caseData.source}
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
    <div>

      <p className="text-sm text-zinc-500">
        {title}
      </p>

      <strong>{value || "-"}</strong>

    </div>
  );
}