import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SegurancaCard from "@/components/configuracoes/SegurancaCard";

export const metadata = {
  title: "Segurança do acesso · CW Reputação",
};

export default function SegurancaPage() {
  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Configurações"
          title="Segurança do acesso"
          description="Quem entra na plataforma, e o que é preciso provar para entrar."
        />

        <SegurancaCard />

      </div>

    </MainLayout>
  );
}
