import MainLayout from "@/components/layout/MainLayout";

import EstablishmentDetail from "@/components/estabelecimentos/EstablishmentDetail";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function EstabelecimentoPage({
  params,
}: Props) {

  const { id } = await params;

  return (
    <MainLayout>
      <EstablishmentDetail slug={id} />
    </MainLayout>
  );
}
