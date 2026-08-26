import MainLayout from "@/components/layout/MainLayout";

import CaseDetailView from "@/components/reclame-aqui/detail/CaseDetailView";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

/**
 * O atendimento de rede social tem endereço próprio.
 *
 * Antes ele abria em `/reclame-aqui/[id]` — mesma tela, módulo errado.
 * O efeito não era só estético: o caminho na barra do navegador, o link
 * copiado dali e o botão "voltar" diziam todos que aquele atendimento
 * do Instagram era uma reclamação do Reclame Aqui. São frentes
 * diferentes, com filas, métricas e cadastros diferentes.
 *
 * A tela é a mesma de propósito — o que muda entre as frentes são as
 * abas, e isso o `CaseDetail` resolve pelo canal do caso. Duplicar a
 * tela inteira faria as duas divergirem na primeira correção que
 * alguém aplicasse só de um lado.
 */
export default async function SocialCasePage({
  params,
}: Props) {
  const { id } = await params;

  return (
    <MainLayout>
      <CaseDetailView id={id} modulo="social" />
    </MainLayout>
  );
}
