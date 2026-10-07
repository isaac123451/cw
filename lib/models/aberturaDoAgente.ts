import type { Case } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";
import type { SlaRule } from "@/lib/models/sla";

import { filaDeAvaliacao, semNoticia } from "@/lib/models/cadencia";
import { resumoDaEspera, type RetratoDaEspera } from "@/lib/models/esperaNoWhatsapp";
import { sinaisDeCrise } from "@/lib/models/redes";

import { caseHref, isOpen, isSocial } from "@/lib/services/case.service";
import { diaNaOperacao } from "@/lib/services/reputation.service";
import { slaStatus } from "@/lib/services/sla.service";
import { deveEncerrarSemRetorno } from "@/lib/services/nps.service";

import {
  EXPEDIENTE_PADRAO,
  type Expediente,
} from "@/lib/services/horasUteis";
import { pluralDe } from "@/lib/plural";

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
  chave: "prazo" | "sem-noticia" | "avaliacao" | "crise" | "whatsapp";
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
  /**
   * Quem está por trás do número (1.90): "o pede ação agora tem de mostrar
   * as pendências ao clicar". Até 15, na ordem da urgência.
   */
  itens?: ItemDoAviso[];
}

export interface ItemDoAviso {
  titulo: string;
  detalhe?: string;
  href: string;
  janela?: { frente: "reclame-aqui" | "redes"; ref: string; titulo: string };
}

const MAXIMO_DE_ITENS = 15;

function itemDoCaso(c: Case, detalhe?: string): ItemDoAviso {
  return {
    titulo: `${c.protocol} · ${c.customer}`,
    detalhe: detalhe ?? c.title,
    href: caseHref(c),
    janela: { frente: isSocial(c) ? "redes" : "reclame-aqui", ref: c.id, titulo: `${c.protocol} · ${c.customer}` },
  };
}

/** Os casos e ciclos de NPS por trás do aviso de prazo — o estourado primeiro. */
export function itensDePrazo(abertos: Case[], regras: SlaRule[], nps: NpsResponseView[], expediente: Expediente, agora: Date): ItemDoAviso[] {
  const hoje = diaNaOperacao(agora);
  const lista: { item: ItemDoAviso; estourado: boolean; quando: number }[] = [];
  for (const caso of abertos) {
    const sla = slaStatus(caso, regras, { expediente });
    const quando = sla.prazo ? new Date(sla.prazo).getTime() : 0;
    if (sla.situation === "estourado") lista.push({ item: itemDoCaso(caso, `prazo estourado · ${caso.title}`), estourado: true, quando });
    else if (sla.prazo && diaNaOperacao(sla.prazo) === hoje) lista.push({ item: itemDoCaso(caso, `vence hoje · ${caso.title}`), estourado: false, quando });
  }
  for (const r of nps) {
    if (r.firstContactAt || r.closedAt || !r.firstContactDueAt) continue;
    const vence = new Date(r.firstContactDueAt);
    const estourado = vence.getTime() < agora.getTime();
    if (!estourado && diaNaOperacao(vence) !== hoje) continue;
    lista.push({
      item: { titulo: `NPS nota ${r.score} · ${r.customerName || r.customer}`, detalhe: estourado ? "1º contato atrasado" : "1º contato vence hoje", href: `/nps/${r.id}` },
      estourado,
      quando: vence.getTime(),
    });
  }
  return lista
    .sort((a, b) => Number(b.estourado) - Number(a.estourado) || a.quando - b.quando)
    .slice(0, MAXIMO_DE_ITENS)
    .map((x) => x.item);
}

export interface EntradaDaAbertura {
  casos: Case[];
  regras: SlaRule[];
  nps?: NpsResponseView[];
  expediente?: Expediente;
  agora?: Date;
  /** O retrato da lista do WhatsApp mandado pela extensão (1.108). */
  espera?: RetratoDaEspera | null;
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

    /*
      Já na regra do guia (30 dias sem resposta): a rotina da madrugada
      encerra, não há mais prazo de 1º contato a cumprir. Contados aqui, o
      aviso dizia "147 do NPS" logo acima do plano de recuperação com 110
      (out/2026) — a diferença eram esses.
    */
    if (deveEncerrarSemRetorno({ ...ciclo, attempts: ciclo.attempts ?? [] }, agora).deve) continue;

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
    espera = null,
  } = entrada;

  const abertos = casos.filter(isOpen);

  const avisos: AvisoDeAbertura[] = [];

  /* ---------- 1. o que vence hoje ---------- */

  const prazos = prazosDeHoje(abertos, regras, nps, expediente, agora);

  const total = prazos.estourados + prazos.vencemHoje;

  /*
    De onde vem o número (out/2026). "201 prazos estourados" sozinho não
    batia com o plano logo abaixo (108 do NPS, 19 do Reclame Aqui) e
    ninguém sabia o que somava com o quê.
  */
  const casosEstourados = prazosDeHoje(abertos, regras, [], expediente, agora).estourados;
  const npsEstourados = prazos.estourados - casosEstourados;
  const deOnde = [
    npsEstourados > 0 ? `${npsEstourados} do NPS` : "",
    casosEstourados > 0 ? `${casosEstourados} ${pluralDe(casosEstourados, "caso", "casos")}` : "",
  ].filter(Boolean).join(" e ");

  if (total > 0) {
    avisos.push({
      chave: "prazo",
      tom: prazos.estourados > 0 ? "perigo" : "atencao",
      titulo:
        prazos.estourados > 0
          ? `${prazos.estourados} ${pluralDe(prazos.estourados, "prazo", "prazos")} ${pluralDe(prazos.estourados, "estourado", "estourados")}`
          : `${prazos.vencemHoje} ${pluralDe(prazos.vencemHoje, "prazo vence", "prazos vencem")} hoje`,
      detalhe:
        prazos.estourados > 0 && prazos.vencemHoje > 0
          ? `${deOnde} · e mais ${prazos.vencemHoje} ${pluralDe(prazos.vencemHoje, "vence", "vencem")} ainda hoje`
          : prazos.estourados > 0
            ? `${deOnde} · o relógio do documento já passou nesses`
            : "dá tempo, se começar por eles",
      quantidade: total,
      href: "/meu-dia",
      pergunta: "O que está fora do prazo hoje?",
      itens: itensDePrazo(abertos, regras, nps, expediente, agora),
    });
  }

  /* ---------- 2. quem está sem notícia ---------- */

  const semNoticias = abertos.filter((c) => semNoticia(c, agora, expediente)?.atrasado);

  if (semNoticias.length > 0) {
    const porDias = semNoticias
      .map((c) => ({ c, dias: semNoticia(c, agora, expediente)?.dias ?? 0 }))
      .sort((a, b) => b.dias - a.dias);
    const maisAntigo = porDias[0];

    avisos.push({
      chave: "sem-noticia",
      tom: "atencao",
      titulo: `${semNoticias.length} ${pluralDe(semNoticias.length, "cliente", "clientes")} sem notícia`,
      detalhe: `o mais parado está há ${maisAntigo.dias} ${pluralDe(maisAntigo.dias, "dia útil", "dias úteis")} sem nenhuma mensagem nossa`,
      quantidade: semNoticias.length,
      href: caseHref(maisAntigo.c),
      pergunta: "Quem está sem notícia há mais tempo?",
      janela: {
        frente: isSocial(maisAntigo.c) ? "redes" : "reclame-aqui",
        ref: maisAntigo.c.id,
        titulo: `${maisAntigo.c.protocol} · ${maisAntigo.c.customer}`,
      },
      itens: porDias.slice(0, MAXIMO_DE_ITENS).map(({ c, dias }) => itemDoCaso(c, `${dias} ${pluralDe(dias, "dia útil", "dias úteis")} sem mensagem nossa · ${c.title}`)),
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
      titulo: `${fila.hoje.length} ${pluralDe(fila.hoje.length, "avaliação", "avaliações")} para pedir hoje`,
      detalhe:
        "é a maior alavanca da nota: a avaliação traz a média e a solução, 30% cada, e o \"voltaria\", 20%",
      quantidade: fila.hoje.length,
      href: "/reclame-aqui/avaliacoes",
      pergunta: "De quem eu peço avaliação hoje?",
      itens: fila.hoje.slice(0, MAXIMO_DE_ITENS).map((x) => itemDoCaso(x.item, `pedir avaliação · ${x.item.title}`)),
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
      titulo: `${emCrise.length} ${pluralDe(emCrise.length, "caso", "casos")} com sinal de crise`,
      detalhe: motivos.slice(0, 3).join(" · "),
      quantidade: emCrise.length,
      href: caseHref(emCrise[0].caso),
      pergunta: "Quais casos estão com sinal de crise?",
      janela: {
        frente: isSocial(emCrise[0].caso) ? "redes" : "reclame-aqui",
        ref: emCrise[0].caso.id,
        titulo: `${emCrise[0].caso.protocol} · ${emCrise[0].caso.customer}`,
      },
      itens: emCrise.slice(0, MAXIMO_DE_ITENS).map((x) => itemDoCaso(x.caso, x.sinais.map((s) => s.motivo).join(" · "))),
    });
  }

  /* ---------- 5. quem espera resposta no WhatsApp (1.108) ---------- */

  const whatsapp = resumoDaEspera(espera, agora);

  if (whatsapp) {
    avisos.push({
      chave: "whatsapp",
      tom: whatsapp.tom,
      titulo: whatsapp.titulo,
      detalhe: whatsapp.detalhe,
      quantidade: whatsapp.quantidade,
      href: "https://web.whatsapp.com/",
      pergunta: "Quem está esperando resposta no WhatsApp?",
      itens: whatsapp.itens,
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
