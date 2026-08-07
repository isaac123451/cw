import { Case } from "@/lib/models/case";

interface Props {
  data: Case;
}

export default function CaseInfo({ data }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-8">

      <h2 className="mb-6 text-xl font-bold">
        Informações
      </h2>

      <div className="grid grid-cols-2 gap-6">

        <Item label="Empresa" value={data.company} />

        <Item label="Origem" value={data.source} />

        <Item label="Categoria" value={data.category} />

        <Item label="Responsável" value={data.owner} />

        <Item label="Departamento" value={data.department} />

        <Item label="Prioridade" value={data.priority} />

        <Item label="Status" value={data.status} />

      </div>

    </div>
  );
}

function Item({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>

      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="font-semibold">
        {value || "-"}
      </p>

    </div>
  );
}