import { Case } from "@/lib/models/case";

interface Props {
  data: Case;
}

export default function OverviewTab({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6">

      <Field title="Empresa" value={data.company} />

      <Field title="Cliente" value={data.customer} />

      <Field title="Origem" value={data.source} />

      <Field title="Categoria" value={data.category} />

      <Field title="Departamento" value={data.department} />

      <Field title="Responsável" value={data.owner} />

      <Field title="Prioridade" value={data.priority} />

      <Field title="Status" value={data.status} />

    </div>
  );
}

function Field({
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

      <strong>

        {value || "-"}

      </strong>

    </div>
  );
}