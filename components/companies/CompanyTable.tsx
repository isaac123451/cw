import CompanyRow from "./CompanyRow";
import { mockCompanies } from "@/lib/data/mockCompanies";

export default function CompanyTable() {
  return (
    <div className="rounded-2xl border bg-white">

      <table className="w-full">

        <thead>

          <tr className="border-b bg-zinc-50">

            <th className="px-6 py-4 text-left">Empresa</th>

            <th className="text-left">CNPJ</th>

            <th className="text-left">Cidade</th>

            <th className="text-left">Plano</th>

            <th className="text-left">Casos</th>

            <th className="text-left">Nota</th>

          </tr>

        </thead>

        <tbody>

          {mockCompanies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
            />
          ))}

        </tbody>

      </table>

    </div>
  );
}