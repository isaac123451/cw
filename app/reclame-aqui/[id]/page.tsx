import MainLayout from "@/components/layout/MainLayout";

import CaseDetailView from "@/components/reclame-aqui/detail/CaseDetailView";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function CasePage({ params }: Props) {
  const { id } = await params;

  return (
    <MainLayout>
      <CaseDetailView id={id} />
    </MainLayout>
  );
}
