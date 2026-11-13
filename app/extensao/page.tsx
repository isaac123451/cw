import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import PaginaDaExtensao from "@/components/extensao/PaginaDaExtensao";

export const metadata = {
  title: "Extensão · CW Reputação",
};

/** A extensão do Chrome: baixar, instalar, o estado neste navegador e a atualização sozinha (13/11/2026). */
export default function ExtensaoPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeading
          eyebrow="Conhecimento"
          title="Extensão do Chrome"
          description="A extensão que trabalha junto da plataforma no WhatsApp, no Reclame Aqui e nas planilhas: baixar, instalar e manter em dia."
        />
        <PaginaDaExtensao />
      </div>
    </MainLayout>
  );
}
