import MainLayout from "@/components/layout/MainLayout";

import FichaDoNps from "@/components/nps/ficha/FichaDoNps";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

/**
 * O ciclo de NPS tem endereço próprio, como a reclamação e o
 * atendimento das redes.
 *
 * Era um modal por cima da lista: não dava para mandar o link a alguém,
 * abrir dois lado a lado nem voltar com o botão do navegador. O Meu dia,
 * a Jornada, Projetos e a ficha do estabelecimento apontam para cá.
 */
export default async function NpsCicloPage({ params }: Props) {
  const { id } = await params;

  return (
    <MainLayout>
      <FichaDoNps id={id} />
    </MainLayout>
  );
}
