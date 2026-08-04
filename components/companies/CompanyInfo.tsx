import { Company } from "@/lib/data/mockCompanies";

interface Props {
  company: Company;
}

export default function CompanyInfo({ company }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="mb-6 text-xl font-semibold">
        Informações
      </h2>

      <div className="grid gap-5 md:grid-cols-2">

        <Field
          label="Empresa"
          value={company.name}
        />

        <Field
          label="CNPJ"
          value={company.cnpj}
        />

        <Field
          label="Cidade"
          value={company.city}
        />

        <Field
          label="Plano"
          value={company.plan}
        />

      </div>

    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-sm text-zinc-500">

        {label}

      </p>

      <strong>

        {value}

      </strong>

    </div>
  );
}