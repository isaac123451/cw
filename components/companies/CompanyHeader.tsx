import { Company } from "@/lib/data/mockCompanies";

interface Props {
  company: Company;
}

export default function CompanyHeader({ company }: Props) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold">
            {company.name}
          </h1>

          <p className="mt-2 text-zinc-500">
            {company.cnpj}
          </p>

        </div>

        <div className="rounded-full bg-green-100 px-5 py-2 text-green-700">

          {company.status}

        </div>

      </div>

    </div>
  );
}