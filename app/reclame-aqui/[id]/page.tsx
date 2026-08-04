import MainLayout from "@/components/layout/MainLayout";

import CaseHeader from "@/components/reclame-aqui/details/CaseHeader";
import ClientCard from "@/components/reclame-aqui/details/ClientCard";
import CompanyCard from "@/components/reclame-aqui/details/CompanyCard";
import CaseInformation from "@/components/reclame-aqui/details/CaseInformation";
import ReclameAquiInformation from "@/components/reclame-aqui/details/ReclameAquiInformation";
import ChecklistCard from "@/components/reclame-aqui/details/ChecklistCard";
import Timeline from "@/components/reclame-aqui/details/Timeline";

import { mockCases } from "@/lib/data/mockCases";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function CasePage({ params }: Props) {
  const { id } = await params;

  const data = mockCases.find((item) => item.id === id);

  if (!data) {
    return (
      <MainLayout>
        <div className="p-10">
          Caso não encontrado.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <CaseHeader caseData={data} />

        <div className="grid grid-cols-12 gap-6">

          <div className="col-span-8 space-y-6">

            <ClientCard caseData={data} />

            <CompanyCard caseData={data} />

            <CaseInformation caseData={data} />

            <ChecklistCard />

          </div>

          <div className="col-span-4 space-y-6">

            <ReclameAquiInformation caseData={data} />

            <Timeline />

          </div>

        </div>

      </div>

    </MainLayout>
  );
}