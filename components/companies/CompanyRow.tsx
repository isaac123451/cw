import Link from "next/link";
import { Company } from "@/lib/data/mockCompanies";

interface Props {
  company: Company;
}

export default function CompanyRow({ company }: Props) {
  return (
    <tr className="border-b hover:bg-zinc-50">

      <td className="px-6 py-4">

        <Link
          href={`/empresas/${company.id}`}
          className="font-semibold text-violet-600"
        >
          {company.name}
        </Link>

      </td>

      <td>{company.cnpj}</td>

      <td>{company.city}</td>

      <td>{company.plan}</td>

      <td>{company.openCases}</td>

      <td>{company.score}</td>

    </tr>
  );
}