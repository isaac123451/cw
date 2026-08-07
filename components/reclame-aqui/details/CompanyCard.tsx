import { Case } from "@/lib/models/case";

interface Props {
  caseData: Case;
}

export default function CompanyCard({
  caseData,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-5 text-lg font-semibold">
        Empresa
      </h2>

      <div className="grid grid-cols-2 gap-5">

        <Info
          title="Empresa"
          value={caseData.company}
        />

        <Info
          title="Responsável"
          value={caseData.owner}
        />

        <Info
          title="Categoria"
          value={caseData.category}
        />

        <Info
          title="Subcategoria"
          value={caseData.subcategory}
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