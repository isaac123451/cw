import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import CentralDeConfiguracoes from "@/components/configuracoes/CentralDeConfiguracoes";

export const metadata = {
  title: "Configurações · CW Reputação",
};

/**
 * As configurações, num lugar só (1.115). Ver `CentralDeConfiguracoes`.
 *
 * `?secao=integracoes&abrir=ia` abre direto a seção e o ajuste — é o
 * endereço que outras telas usam para mandar a pessoa ao lugar certo.
 */
export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ secao?: string; abrir?: string }> }) {
  const { secao, abrir } = await searchParams;
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeading eyebrow="Plataforma" title="Configurações" description="Tudo o que se ajusta no CW Reputação, por assunto — o que é curto abre aqui mesmo." />
        <CentralDeConfiguracoes versao={process.env.NEXT_PUBLIC_VERSAO} secaoInicial={secao} abertoInicial={abrir} />
      </div>
    </MainLayout>
  );
}
