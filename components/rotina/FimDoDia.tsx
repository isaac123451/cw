"use client";

import SurfaceCard from "@/components/shared/SurfaceCard";
import TextoEditavel from "@/components/shared/TextoEditavel";

import { textoDoFimDoDia } from "@/lib/models/fimDoDia";

/**
 * O fim do dia, pronto para colar (Fase 24).
 *
 * O que andou hoje, o que saiu da fila sem registro (feito por fora,
 * tirado, adiado) e o que ficou, com o porquê. Contado no banco e nas
 * marcas; nada é enviado — quem manda é você.
 */
export default function FimDoDia(props: Parameters<typeof textoDoFimDoDia>[0]) {
  return (
    <SurfaceCard
      title="Fim do dia"
      description="O que andou, o que saiu da fila e o que ficou para amanhã — escrito com o que a plataforma registrou hoje. Acrescente o que só você sabe e copie."
    >
      <TextoEditavel gerado={textoDoFimDoDia(props)} rotulo="Copiar o fim do dia" linhasMinimas={5} />
    </SurfaceCard>
  );
}
