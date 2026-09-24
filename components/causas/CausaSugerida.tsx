"use client";

import { useEffect, useState } from "react";

import SugestaoDoTexto from "@/components/shared/SugestaoDoTexto";

import { sugerirCausaRaiz, type SugestaoComAcerto } from "@/lib/actions/sugestoes";

type Sugeridor = (entrada: { texto: string; excluirId?: string }) => Promise<SugestaoComAcerto>;

/**
 * A causa raiz sugerida pelo texto (Fase 27) — a mesma régua nas quatro
 * frentes.
 *
 * O relato do Reclame Aqui, o post das redes, o comentário do NPS e o
 * texto do Google passam pela mesma conta, no servidor, com os
 * exemplos já classificados de todas as frentes e as palavras de cada
 * causa do catálogo. Some quando a causa sugerida já é a escolhida.
 * Nunca marca sozinha: é um clique de quem decide.
 */
export default function CausaSugerida({
  texto,
  atual,
  excluirId,
  onUsar,
  sugeridor = sugerirCausaRaiz,
}: {
  texto: string;
  atual?: string;
  excluirId?: string;
  onUsar: (causa: string) => void;
  /** Para a tela de teste; a plataforma usa o servidor. */
  sugeridor?: Sugeridor;
}) {
  const limpo = texto.trim();
  const [resposta, setResposta] = useState<{ texto: string; r: SugestaoComAcerto } | null>(null);

  useEffect(() => {
    if (limpo.length < 8) return;
    let ativo = true;
    /* Espera a pessoa parar de digitar: a conta é no servidor. */
    const t = setTimeout(() => {
      sugeridor({ texto: limpo, excluirId })
        .then((r) => {
          if (ativo) setResposta({ texto: limpo, r });
        })
        .catch(() => undefined);
    }, 500);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [limpo, excluirId, sugeridor]);

  const sugestao = resposta?.texto === limpo ? resposta.r.sugestao : null;
  if (!sugestao || sugestao.valor.trim().toLowerCase() === (atual ?? "").trim().toLowerCase()) return null;

  return (
    <div className="mt-2">
      <SugestaoDoTexto
        rotulo="Causa sugerida pelo texto"
        valor={sugestao.valor}
        motivo={sugestao.motivo || undefined}
        acerto={resposta?.r.acerto}
        onUsar={() => onUsar(sugestao.valor)}
      />
    </div>
  );
}
