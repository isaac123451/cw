import MainLayout from "@/components/layout/MainLayout";

import { getCaseById } from "@/lib/actions/case.actions";

import CaseHeader from "@/components/case-details/CaseHeader";
import CaseSidebar from "@/components/case-details/CaseSidebar";
import CaseTabs from "@/components/case-details/tabs/CaseTabs";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function CasePage({ params }: Props) {
  const { id } = await params;

  const data = await getCaseById(id);

  if (!data) {
    return (
      <MainLayout>
        Caso não encontrado.
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">

        <CaseHeader
          id={data.id}
          company={data.company}
        />

        <div className="grid gap-6 lg:grid-cols-12">

          <div className="lg:col-span-8">
            <CaseTabs data={data} />
          </div>

          <div className="lg:col-span-4">
            <CaseSidebar data={data} />
          </div>

        </div>

      </div>
    </MainLayout>
  );
}