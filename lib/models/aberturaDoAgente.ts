import type { Case } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";
import type { SlaRule } from "@/lib/models/sla";

import { filaDeAvaliacao, semNoticia } from "@/lib/models/cadencia";
import { sinaisDeCrise } from "@/lib/models/redes";

import { caseHref, isOpen, isSocial } from "@/lib/services/case.service";
import { diaNaOperacao } from "@/lib/services/reputation.service";
import { slaStatus } from "@/lib/services/sla.service";

import {
  EXPEDIENTE_PADRAO,
  type Expediente,
} from "@/lib/services/horasUteis";

/**
 * O que o agente diz antes de alguém perguntar (Fase 9.2).
 *
 * **Por que existe.** Um assistente que só responde é um campo de busca
 * com boas maneiras: quem chega precisa já saber o que perguntar. As
 * quatro perguntas abaixo são as que a operação faz toda manhã, e a
 * plataforma sabe responder sozinha — então ela responde primeiro.
 *
 * **As quatro são as do documento:** o que vence hoje, quem está sem
 * notícia, de quem pedir avaliação e se há sinal de crise.
 *
 * **Nenhuma conta nova mora aqui.** `slaStatus`, `semNoticia`,
 * `filaDeAvaliacao` e `sinaisDeCrise` são as mesmas funções das telas —
 * um aviso que discorda do painel ensina a desconfiar dos dois. Este
 * arquivo só junta, ordena e escreve em português.
 *
 * **Todo aviso leva ao que resolve**: cada um tem `href`. Um aviso sem
 * saída é uma preocupação a mais, não uma ajuda.
 */

export type TomDoAviso = "perigo" | "atencao" | "neutro";

export interface AvisoDeAbertura {
  chave: "prazo" | "sem-noticia" | "avaliacao" | "crise";
  tom: TomDoAviso;
  titulo: string;
  detalhe: string;
  quantidade: number;
  /** Para onde ir — a tela que resolve. */
  href: string;
  /** A pergunta que este aviso responde, para o chat. */
  pergunta: string;
  /**
   * O caso mais urgente, para abrir numa mini-janela sem sair da tela.
   * Só quando o aviso aponta para **um** caso — prazo e avaliação são listas.
   */
  janela?: { frente: "reclame-aqui" | "redes"; ref: string; titulo: string };
}

export interface EntradaDaAbertura {
  casos: Case[];
  regras: SlaRule[];
  nps?: NpsResponseView[];
  expediente?: Expediente;
  agora?: Date;
}

/**
 * Os prazos de hoje: o que já estourou e o que ainda vence.
 *
 * Soma as duas frentes que têm relógio — os casos abertos, pelo
 * `slaStatus` do documento, e os ciclos de NPS sem 1º contato. É a mesma
 * conta que o popup da extensão mostra: quem vê 3 lá e 5 aqui deixa de
 * confiar nos dois.
 */
export function prazosDeHoje(
  abertos: Case[],
  regras: SlaRule[],
  nps: NpsResponseView[],
  expediente: Expediente,
  agora: Date
) {
  const hoje = diaNaOperacao(agora);

  let estourados = 0;
  let vencemHoje = 0;

  for (const caso of abertos) {
    const sla = slaStatus(caso, regras, { expediente });
    if (sla.situation === "estourado") estourados += 1;
    else if (sla.prazo && diaNaOperacao(sla.prazo) === hoje) vencemHoje += 1;
  }

  for (const ciclo of nps) {
    if (ciclo.firstContactAt || ciclo.closedAt) continue;
    if (!ciclo.firstContactDueAt) continue;

    const vence = new Date(ciclo.firstContactDueAt);

    if (vence.getTime() < agora.getTime()) estourados += 1;
    else if (diaNaOperacao(vence) === hoje) vencemHoje += 1;
  }

  return { estourados, vencemHoje };
}

/** Só o que ainda pode ser feito hoje: casos abertos. */
export function avisosDeAbertura(entrada: EntradaDaAbertura): AvisoDeAbertura[] {

  const {
    casos,
    regras,
    nps = [],
    expediente = EXPEDIENTE_PADRAO,
    agora = new Date(),
  } = entrada;

  const abertos = casos.filter(isOpen);

  const avisos: AvisoDeAbertura[] = [];

  /* ---------- 1. o que vence hoje ---------- */

  const prazos = prazosDeHoje(abertos, regras, nps, expediente, agora);

  const total = prazos.estourados + prazos.vencemHoje;

  if (total > 0) {
    avisos.push({
      chave: "prazo",
      tom: prazos.estourados > 0 ? "perigo" : "atencao",
      titulo:
        prazos.estourados > 0
          ? `${prazos.estourados} prazo(s) estourado(s)`
          : `${prazos.vencemHoje} prazo(s) vencem hoje`,
      detalhe:
        prazos.estourados > 0 && prazos.vencemHoje > 0
          ? `e outros ${prazos.vencemHoje} vencem ainda hoje`
          : prazos.estourados > 0
            ? "o relógio do documento já passou nesses"
            : "dá tempo, se começar por eles",
      quantidade: total,
      href: "/meu-dia",
      pergunta: "O que está fora do prazo hoje?",
    });
  }

  /* ---------- 2. quem está sem notícia ---------- */

  const semNoticias = abertos.filter((c) => semNoticia(c, agora, expediente)?.atrasado);

  if (semNoticias.length > 0) {
    const maisAntigo = semNoticias
      .map((c) => ({ c, dias: semNoticia(c, agora, expediente)?.dias ?? 0 }))
      .sort((a, b) => b.dias - a.dias)[0];

    avisos.push({
      chave: "sem-noticia",
      tom: "atencao",
      titulo: `${semNoticias.length} cliente(s) sem notícia`,
      detalhe: `o mais parado está há ${maisAntigo.dias} dia(s) útil(eis) sem nenhuma mensagem nossa`,
      quantidade: semNoticias.length,
      href: caseHref(maisAntigo.c),
      pergunta: "Quem está sem notícia há mais tempo?",
      janela: {
        frente: isSocial(maisAntigo.c) ? "redes" : "reclame-aqui",
        ref: maisAntigo.c.id,
        titulo: `${maisAntigo.c.protocol} · ${maisAntigo.c.customer}`,
      },
    });
  }

  /* ---------- 3. de quem pedir avaliação ---------- */

  /*
    A fila de avaliação olha **todas** as reclamações, e não só as abertas.

    "Aguardando avaliação" não conta como aberto para a operação — já foi
    respondida —, e é exatamente quem está nessa etapa que precisa do
    pedido. Filtrando por abertas, o aviso dizia zero enquanto a fila de
    avaliação e o Meu dia mostravam 37 na vez. A própria fila descarta as
    já avaliadas e as de fora da janela de 6 meses.
  */
  const fila = filaDeAvaliacao(casos.filter((c) => c.source === "Reclame Aqui"), agora);

  if (fila.hoje.length > 0) {
    avisos.push({
      chave: "avaliacao",
      tom: "neutro",
      titulo: `${fila.hoje.length} avaliação(ões) para pedir hoje`,
      detalhe:
        "é a maior alavanca da nota: solução e intenção de voltar pesam 30% cada",
      quantidade: fila.hoje.length,
      href: "/reclame-aqui/avaliacoes",
      pergunta: "De quem eu peço avaliação hoje?",
    });
  }

  /* ---------- 4. sinal de crise ---------- */

  const emCrise = abertos
    .map((c) => ({ caso: c, sinais: sinaisDeCrise(c, casos, agora) }))
    .filter((x) => x.sinais.length > 0);

  if (emCrise.length > 0) {
    /* Os motivos sem repetir: três casos pelo mesmo motivo é um motivo. */
    const motivos = [...new Set(emCrise.flatMap((x) => x.sinais.map((s) => s.motivo)))];

    avisos.push({
      chave: "crise",
      tom: "perigo",
      titulo: `${emCrise.length} caso(s) com sinal de crise`,
      detalhe: motivos.slice(0, 3).join(" · "),
      quantidade: emCrise.length,
      href: caseHref(emCrise[0].caso),
      pergunta: "Quais casos estão com sinal de crise?",
      janela: {
        frente: isSocial(emCrise[0].caso) ? "redes" : "reclame-aqui",
        ref: emCrise[0].caso.id,
        titulo: `${emCrise[0].caso.protocol} · ${emCrise[0].caso.customer}`,
      },
    });
  }

  /*
    A ordem é a da urgência, não a da lista: crise e prazo estourado
    primeiro. Quem abre a tela lê de cima para baixo e para no meio.
  */
  const peso: Record<TomDoAviso, number> = { perigo: 0, atencao: 1, neutro: 2 };

  return avisos.sort((a, b) => peso[a.tom] - peso[b.tom]);
}

/** Os avisos como o modelo os recebe — para a resposta não contradizer a tela. */
export function aberturaParaOPrompt(avisos: AvisoDeAbertura[]) {

  if (avisos.length === 0) {
    return "Nada vencendo, ninguém sem notícia, nenhuma avaliação atrasada e nenhum sinal de crise agora.";
  }

  return avisos
    .map((a) => `- ${a.titulo}: ${a.detalhe} (${a.href})`)
    .join("\n");
}
