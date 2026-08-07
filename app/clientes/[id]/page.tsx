import MainLayout from "@/components/layout/MainLayout";

import ClientDetail from "@/components/clientes/ClientDetail";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function ClientePage({
  params,
}: Props) {

  const { id } = await params;

  return (
    <MainLayout>
      <ClientDetail slug={id} />
    </MainLayout>
  );
}
