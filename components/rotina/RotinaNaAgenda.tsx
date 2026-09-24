"use client";

import { useState } from "react";

import RotinaDoDia from "@/components/rotina/RotinaDoDia";
import ConfigurarRotina from "@/components/rotina/ConfigurarRotina";
import type { useMeuDia } from "@/components/rotina/useMeuDia";

/**
 * A rotina de hoje dentro da Agenda.
 *
 * O "Checklist do dia" da Agenda era montado pela IA sobre o que estava
 * aberto. O Isaac: "no checklist que é montado na agenda precisa também
 * seguir algo com a gestão de rotina". Agora é a mesma rotina do Meu dia
 * — as mesmas marcas, as mesmas contagens —, na versão enxuta, com o
 * atalho para o plano e o checkpoint.
 */
/* O `dia` vem da página: a linha do tempo usa as mesmas contagens, sem uma segunda ida ao servidor. */
export default function RotinaNaAgenda({ dia }: { dia: ReturnType<typeof useMeuDia> }) {

  const [marcas, setMarcas] = useState<Set<string> | null>(null);
  const [configurando, setConfigurando] = useState(false);

  return (
    <>
      <RotinaDoDia dia={dia} compacto rascunho={marcas ?? dia.feitasHoje} setRascunho={setMarcas} onConfigurar={() => setConfigurando(true)} />
      {configurando && (
        <ConfigurarRotina
          atividades={dia.atividades}
          onClose={() => setConfigurando(false)}
          onSalvo={(lista) => {
            dia.setAtividades(lista);
            setMarcas(null);
          }}
        />
      )}
    </>
  );
}
