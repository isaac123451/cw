"use client";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import PainelDoPremio from "@/components/premio/PainelDoPremio";

/**
 * O Prêmio Reclame Aqui (Fase 23).
 *
 * O voto vem de quem já foi bem atendido: a base sabe quem são. Aqui se
 * cadastra a campanha, se tira a lista certa e se acompanha o pedido
 * antes de a votação fechar.
 */
export default function PremioPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeading
          eyebrow="Reclame Aqui"
          title="Prêmio Reclame Aqui"
          description="A campanha de votação: quem pedir, a mensagem pronta para o WhatsApp e quem já recebeu o pedido."
        />
        <PainelDoPremio />
      </div>
    </MainLayout>
  );
}
