import MainLayout from "@/components/layout/MainLayout";
import PageHeader from "@/components/design-system/PageHeader";

import CompanyHeader from "@/components/companies/CompanyHeader";
import CompanyInfo from "@/components/companies/CompanyInfo";
import CompanyStats from "@/components/companies/CompanyStats";
import CompanyCases from "@/components/companies/CompanyCases";
import CompanyTimeline from "@/components/companies/CompanyTimeline";

import { mockCompanies } from "@/lib/data/mockCompanies";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function CompanyPage({ params }: Props) {
  const { id } = await params;

  const company = mockCompanies.find((c) => c.id === id);

  if (!company) {
    return (
      <MainLayout>
        <div className="p-8">
          Empresa não encontrada.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeader
          title="Empresa"
          description="Visão geral do cliente."
        />

        <CompanyHeader company={company} />

        <CompanyStats company={company} />

        <div className="grid gap-6 xl:grid-cols-3">

          <div className="xl:col-span-2 space-y-6">

            <CompanyInfo company={company} />

            <CompanyCases />

          </div>

          <CompanyTimeline />

        </div>

      </div>

    </MainLayout>
  );
}