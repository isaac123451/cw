import { Company } from "@/lib/data/mockCompanies";

interface Props {
  company: Company;
}

export default function CompanyStats({ company }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">

      <Card
        title="Casos em Aberto"
        value={company.openCases.toString()}
      />

      <Card
        title="Nota"
        value={company.score.toString()}
      />

      <Card
        title="Plano"
        value={company.plan}
      />

    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <p className="text-sm text-zinc-500">

        {title}

      </p>

      <h2 className="mt-3 text-3xl font-bold">

        {value}

      </h2>

    </div>
  );
}