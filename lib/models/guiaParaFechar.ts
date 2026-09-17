/**
 * O guia para fechar: a fila do dia, um item por vez, com o que falta.
 *
 * **O pedido.** "Guia para finalizar as atividades." O Meu dia dizia
 * quantos itens cada atividade tinha e levava à lista; não dizia, de
 * cada caso, o que faltava para ele sair dali. E a lista de quarenta
 * itens de seis atividades diferentes não diz por onde começar.
 *
 * **O que este arquivo decide.**
 *
 * 1. A fila (`filaDoDia`): os itens das atividades de hoje que ainda não
 *    foram marcadas, sem repetir o mesmo caso (um caso novo e atrasado
 *    aparece em "novos" e em "FUPs" — é um trabalho só), o fora do prazo
 *    primeiro e, depois, na ordem do documento.
 * 2. Os passos de cada item (`passosParaFechar`): as trilhas que as fichas
 *    já mostram — a do Reclame Aqui e a do NPS —, e as das Redes e do
 *    Google, pelo documento de cada uma. **Cada passo se marca pelo que o
 *    banco sabe:** registrou o contato na janela, o passo aparece feito.
 *    Nada aqui é um clique de "feito" que não corresponde a um registro.
 *
 * Sem React, para a conferência provar sem tela.
 */
import type { Case } from "@/lib/models/case";
import type { AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import type { NpsResponseView } from "@/lib/models/nps";
import type { FrenteId } from "@/lib/models/frentes";
import type { AtividadeDaRotina } from "@/lib/models/rotina";
import type { Contagem } from "@/lib/models/meuDia";

import { trilhaDoCaso, type ContextoDaTrilha, type EstadoDoPasso } from "@/lib/models/trilha";
import { trilhaDoNps, type ContextoDaTrilhaNps } from "@/lib/models/trilhaNps";
import { eFinalDasRedes } from "@/lib/models/redes";
import { janelaDoEndereco, type PedidoDeJanela } from "@/lib/models/janelas";

export interface ItemDaFila {
  /** `frente:id` — o mesmo caso em duas atividades é um item só. */
  chave: string;
  frente?: FrenteId;
  /** O id do caso, da resposta ou da avaliação. */
  ref: string;
  titulo: string;
  detalhe?: string;
  href: string;
  atrasado: boolean;
  /** As atividades de hoje em que o item aparece, na ordem do documento. */
  atividades: string[];
  /** A ficha que abre em mini-janela — `null` quando o item é uma tela. */
  janela: PedidoDeJanela | null;
}

/**
 * A fila do dia, na ordem de fazer.
 *
 * As atividades marcadas saem: quem marcou "FUPs" como feita não quer
 * ver os FUPs de novo no modo próximo, mesmo que a conta ainda os traga.
 */
export function filaDoDia(
  atividades: Pick<AtividadeDaRotina, "id" | "titulo" | "chave">[],
  contagens: Partial<Record<string, Pick<Contagem, "itens">>>,
  marcadas: Set<string> = new Set()
): ItemDaFila[] {

  const porChave = new Map<string, ItemDaFila & { ordem: number }>();
  let ordem = 0;

  for (const a of atividades) {
    if (marcadas.has(a.id) || !a.chave) continue;
    for (const i of contagens[a.chave]?.itens ?? []) {
      const chave = `${i.frente ?? a.chave}:${i.id}`;
      const ja = porChave.get(chave);
      if (ja) {
        if (!ja.atividades.includes(a.titulo)) ja.atividades.push(a.titulo);
        ja.atrasado = ja.atrasado || Boolean(i.atrasado);
        continue;
      }
      porChave.set(chave, {
        chave,
        frente: i.frente,
        ref: i.id,
        titulo: i.titulo,
        detalhe: i.detalhe,
        href: i.href,
        atrasado: Boolean(i.atrasado),
        atividades: [a.titulo],
        janela: janelaDoEndereco(i.href, i.titulo),
        ordem: ordem++,
      });
    }
  }

  return [...porChave.values()]
    .sort((x, y) => Number(y.atrasado) - Number(x.atrasado) || x.ordem - y.ordem)
    .map((i): ItemDaFila => {
      const item: ItemDaFila & { ordem?: number } = { ...i };
      delete item.ordem;
      return item;
    });
}

/**
 * Onde a fila continua depois que um item saiu dela.
 *
 * Fechar o item 3 de 10 não pode mandar a pessoa de volta ao 1 — o
 * próximo é o que ocupou o lugar dele. Se o item atual ainda está na
 * fila, fica nele; se saiu, o mesmo índice (ou o último, se era o fim).
 */
export function posicaoNaFila(fila: Pick<ItemDaFila, "chave">[], chaveAtual: string | null, indiceAnterior: number) {
  if (fila.length === 0) return -1;
  const achado = chaveAtual ? fila.findIndex((i) => i.chave === chaveAtual) : -1;
  if (achado >= 0) return achado;
  return Math.min(Math.max(indiceAnterior, 0), fila.length - 1);
}

export interface PassoParaFechar {
  id: string;
  titulo: string;
  estado: EstadoDoPasso;
  detalhe?: string;
  /** Pede atenção agora: prazo estourado, tentativas esgotadas. */
  alerta?: boolean;
}

export type EntradaDoGuia =
  | { frente: "reclame-aqui"; item: Case; contexto?: ContextoDaTrilha }
  | { frente: "redes"; item: Case }
  | { frente: "nps"; item: NpsResponseView; contexto?: ContextoDaTrilhaNps }
  | { frente: "google"; item: AvaliacaoGoogleView };

/** A ordem vira estado: o primeiro que falta é o atual, o resto espera. */
function ordenar(passos: { id: string; titulo: string; feito: boolean; opcional?: boolean; detalhe?: string; alerta?: boolean }[]): PassoParaFechar[] {
  let atual = false;
  return passos.map(({ feito, opcional, ...p }) => {
    if (feito) return { ...p, estado: "feito" as const };
    if (opcional) return { ...p, estado: "opcional" as const };
    if (!atual) {
      atual = true;
      return { ...p, estado: "atual" as const };
    }
    return { ...p, estado: "pendente" as const };
  });
}

export function passosParaFechar(entrada: EntradaDoGuia): PassoParaFechar[] {

  if (entrada.frente === "reclame-aqui") {
    return trilhaDoCaso(entrada.item, entrada.contexto).map((p) => ({
      id: p.id,
      titulo: p.titulo,
      estado: p.estado,
      detalhe: p.detalhe,
    }));
  }

  if (entrada.frente === "nps") {
    return trilhaDoNps(entrada.item, entrada.contexto).map((p) => ({
      id: p.id,
      titulo: p.titulo,
      estado: p.estado,
      detalhe: p.detalhe,
      alerta: p.alerta,
    }));
  }

  if (entrada.frente === "redes") {
    /* O fluxo do documento das Redes: triagem, contato, validação e a saída. */
    const c = entrada.item;
    const final = eFinalDasRedes(c.status);
    const tentativas = c.tentativasSemResposta ?? 0;
    return ordenar([
      {
        id: "triagem",
        titulo: "Triar: gravidade e origem",
        feito: Boolean(c.triadaEm) || final,
        detalhe: c.triadaEm ? `${c.priority} · ${c.source}` : "Quem é, qual rede, o que aconteceu e a gravidade.",
      },
      {
        id: "contato",
        titulo: "1º contato pelo canal privado",
        feito: Boolean(c.primeiroContatoEm) || final,
        detalhe: tentativas > 0 ? `${tentativas} de 3 tentativas sem resposta` : c.primeiroContatoCanal,
        alerta: tentativas >= 3 && !final,
      },
      {
        id: "validacao",
        titulo: "Validar com o cliente",
        feito: Boolean(c.validadoEm),
        opcional: final,
        detalhe: c.validadoEm ? undefined : "Confirmar que a solicitação foi atendida.",
      },
      {
        id: "encerrar",
        titulo: "Encerrar com a saída",
        feito: final,
        detalhe: final ? c.status : "Resolvido, Sem contato ou Sem identificação.",
      },
    ]);
  }

  /* Google: responder em público; a negativa ainda pede a tratativa privada. */
  const a = entrada.item;
  const negativa = a.classificacao === "negativa";
  const fechada = a.status !== "aberta";
  return ordenar([
    {
      id: "resposta",
      titulo: "Responder publicamente",
      feito: Boolean(a.respondidaEm) || a.status === "denunciada",
      detalhe: a.respondidaEm ? undefined : `${a.classificacao}, ${a.estrelas} estrela(s) — em até 48h úteis.`,
    },
    ...(negativa
      ? [
          {
            id: "tratativa",
            titulo: "Tratativa privada com o cliente",
            feito: Boolean(a.tratativaResultado) || fechada,
            detalhe: a.identificado ? a.tratativaCanal : "Identificar o cliente antes do contato.",
          },
        ]
      : []),
    {
      id: "encerrar",
      titulo: "Encerrar a avaliação",
      feito: fechada,
      detalhe: fechada ? undefined : negativa ? "Resolvido, sem retorno ou sem identificação." : "Sai sozinha ao responder.",
    },
  ]);
}

/** "Próximo: validar com o cliente" — ou o que dizer quando não falta passo. */
export function resumoDosPassos(passos: PassoParaFechar[]) {
  const atual = passos.find((p) => p.estado === "atual");
  const feitos = passos.filter((p) => p.estado === "feito").length;
  const contados = passos.filter((p) => p.estado !== "opcional").length;
  return {
    atual: atual ?? null,
    feitos,
    total: contados,
    texto: atual ? `Próximo: ${atual.titulo.charAt(0).toLowerCase()}${atual.titulo.slice(1)}` : "Nenhum passo pendente",
  };
}
