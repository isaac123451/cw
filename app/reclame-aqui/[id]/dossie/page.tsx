import MainLayout from "@/components/layout/MainLayout";

import DossieDoCaso from "@/components/dossie/DossieDoCaso";

interface Props {
  params: Promise<{ id: string }>;
}

/** O dossiê do caso, em tela grande (Fase 26). */
export default async function DossiePage({ params }: Props) {
  const { id } = await params;
  return (
    <MainLayout>
      <DossieDoCaso protocolo={decodeURIComponent(id)} />
    </MainLayout>
  );
}
