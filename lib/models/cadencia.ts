import { respondida, type Case } from "@/lib/models/case";
import type { ContatoView } from "@/lib/models/tratativa";

import {
  diaDoRegistro,
  EXPEDIENTE_PADRAO,
  type Expediente,
  ehDiaUtil,
  paredeDe,
  proximoDiaUtil,
} from "@/lib/services/horasUteis";

/**
 * As cadências da documentação, calculadas.
 *
 * Três ritmos que o documento do Reclame Aqui define e que ninguém tinha
 * como seguir de cabeça em cinquenta casos:
 *
 * 1. **Persistência (Passo 4):** até 5 ligações em horários variados,
 *    distribuídas em 7 dias; e-mails complementares; esgotado, a
 *    mensagem pública transparente e o follow-up a cada 2 dias.
 * 2. **Pedido de avaliação (Passo 8):** o 1º lembrete 2 dias depois da
 *    resposta pública, e a cada 2 dias; depois, semanal, por até 6
 *    meses.
 * 3. **Cliente sem notícia (Passo 5):** caso aberto sem contato há 2
 *    dias úteis — "não deixe o cliente no vácuo".
 */

/* ============================================================
   PERSISTÊNCIA
============================================================ */

export const TENTATIVAS_DA_CADENCIA = 5;
export const JANELA_DA_CADENCIA_DIAS = 7;

export type Periodo = "manha" | "tarde" | "fim-da-tarde";

export const ROTULO_DO_PERIODO: Record<Periodo, string> = {
  manha: "de manhã",
  tarde: "no meio do dia",
  "fim-da-tarde": "no fim da tarde",
};

/** O expediente em três terços — é o que "horários variados" quer dizer. */
export function periodoDoMinuto(min: number, expediente: Expediente = EXPEDIENTE_PADRAO): Periodo {
  const terco = (expediente.fimMin - expediente.inicioMin) / 3;
  if (min < expediente.inicioMin + terco) return "manha";
  if (min < expediente.inicioMin + 2 * terco) return "tarde";
  return "fim-da-tarde";
}

export function faixaDoPeriodo(p: Periodo, expediente: Expediente = EXPEDIENTE_PADRAO) {
  const terco = (expediente.fimMin - expediente.inicioMin) / 3;
  const ordem: Periodo[] = ["manha", "tarde", "fim-da-tarde"];
  const i = ordem.indexOf(p);
  const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}h${m % 60 ? String(Math.round(m % 60)).padStart(2, "0") : ""}`;
  return `${hh(expediente.inicioMin + i * terco)}–${hh(expediente.inicioMin + (i + 1) * terco)}`;
}

export interface Persistencia {
  /** Tentativas seguidas sem resposta, na ordem. */
  tentativas: number;
  /** A cadência de 5 em 7 dias acabou sem resposta. */
  esgotada: boolean;
  /** O dia sugerido para a próxima tentativa (AAAA-MM-DD), se ainda cabe. */
  proximoDia?: string;
  /** O período que ainda não foi tentado — ou o menos tentado. */
  periodo?: Periodo;
  /** Até quando vai a janela de 7 dias. */
  janelaAte?: string;
  /** Frase pronta para a tela. */
  resumo: string;
}

/**
 * A próxima tentativa da cadência de persistência.
 *
 * "Horários variados" vira concreto: o expediente é dividido em três
 * períodos e a sugestão cai no que foi menos tentado. Uma tentativa por
 * dia útil — a quinta num dia só não é persistência, é insistência.
 */
export function persistencia(
  contatos: Pick<ContatoView, "tipo" | "resultado" | "em">[],
  agora = new Date(),
  expediente: Expediente = EXPEDIENTE_PADRAO
): Persistencia {

  const ordenados = [...contatos].sort((a, b) => a.em.localeCompare(b.em));

  const respostas = ordenados.filter((c) => c.resultado === "respondeu" || c.resultado === "pendencia");
  const ultimaResposta = respostas[respostas.length - 1]?.em;

  /* A tentativa aguardando retorno ainda não é "sem resposta" — ver ESPERA_DO_RETORNO_MIN. */
  const seguidas = ordenados.filter(
    (c) =>
      c.tipo === "tentativa" &&
      c.resultado !== "respondeu" &&
      c.resultado !== "aguardando" &&
      (!ultimaResposta || c.em > ultimaResposta)
  );

  if (seguidas.length === 0) {
    return { tentativas: 0, esgotada: false, resumo: "Nenhuma tentativa sem resposta." };
  }

  const primeira = paredeDe(new Date(seguidas[0].em)).dia;
  const janelaAte = new Date(Date.parse(`${primeira}T00:00:00Z`) + (JANELA_DA_CADENCIA_DIAS - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const hoje = paredeDe(agora).dia;

  if (seguidas.length >= TENTATIVAS_DA_CADENCIA || hoje > janelaAte) {
    return {
      tentativas: seguidas.length,
      esgotada: true,
      janelaAte,
      resumo: `${seguidas.length} tentativa(s) sem resposta — a cadência se esgotou. Publique a mensagem transparente no Reclame Aqui e siga com follow-up a cada 2 dias.`,
    };
  }

  /* Quantas vezes cada período já foi tentado. */
  const uso: Record<Periodo, number> = { manha: 0, tarde: 0, "fim-da-tarde": 0 };
  for (const t of seguidas) uso[periodoDoMinuto(paredeDe(new Date(t.em)).min, expediente)] += 1;

  const periodo = (Object.keys(uso) as Periodo[]).sort((a, b) => uso[a] - uso[b])[0];

  const ultimaDia = paredeDe(new Date(seguidas[seguidas.length - 1].em)).dia;

  /* Hoje, se ainda não houve tentativa hoje e é dia útil; senão, o próximo dia útil. */
  const proximoDia =
    ultimaDia < hoje && ehDiaUtil(hoje, expediente) ? hoje : proximoDiaUtil(hoje > ultimaDia ? hoje : ultimaDia, expediente);

  const quando = proximoDia === hoje ? "hoje" : proximoDia.split("-").reverse().slice(0, 2).join("/");

  return {
    tentativas: seguidas.length,
    esgotada: false,
    proximoDia,
    periodo,
    janelaAte,
    resumo: `Tentativa ${seguidas.length} de ${TENTATIVAS_DA_CADENCIA} feita. Próxima: ${quando}, ${ROTULO_DO_PERIODO[periodo]} (${faixaDoPeriodo(periodo, expediente)}) — horário ainda pouco tentado.`,
  };
}

/* ============================================================
   PEDIDO DE AVALIAÇÃO
============================================================ */

/** Os três primeiros lembretes, a cada 2 dias; depois, semanais. */
export const LEMBRETES_CURTOS = 3;
export const INTERVALO_CURTO_DIAS = 2;
export const INTERVALO_LONGO_DIAS = 7;
export const LIMITE_DE_ACOMPANHAMENTO_DIAS = 183;

export interface PedidoDeAvaliacao {
  /** Ainda cabe pedir: respondida, não avaliada, dentro dos 6 meses. */
  ativo: boolean;
  /** O dia do próximo lembrete (AAAA-MM-DD). */
  proximoDia?: string;
  /** O lembrete é para hoje ou já passou. */
  vencido: boolean;
  /** Qual lembrete é o próximo (1, 2, 3…). */
  numero: number;
  /** "hoje", "desde 10/09", "em 15/09" — o dia em Brasília, para a tela. */
  quando?: string;
  resumo: string;
  /** Alguém decidiu não pedir mais — não é "avaliada" nem "fora da janela". */
  dispensado?: boolean;
}

function mais(dia: string, dias: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Quando pedir a avaliação de novo.
 *
 * A base é o dia da resposta pública. Sem ele (reclamação antiga, da
 * planilha), vale o dia da última atualização do caso — melhor pedir
 * uma vez a mais do que esquecer quem já respondemos.
 */
export function pedidoDeAvaliacao(
  item: Pick<Case, "evaluated" | "respondida" | "publicResponse" | "publicResponseAt" | "updatedAt" | "createdAt" | "pedidosDeAvaliacao" | "ultimoPedidoAvaliacaoEm" | "avaliacaoDispensadaEm"> &
    Partial<Pick<Case, "status">>,
  agora = new Date()
): PedidoDeAvaliacao {

  const hoje = paredeDe(agora).dia;

  if (!respondida(item) || item.evaluated) {
    return { ativo: false, vencido: false, numero: 0, resumo: item.evaluated ? "Já avaliada." : "Ainda sem resposta pública." };
  }

  /* Decisão de não pedir mais — sai da fila mesmo dentro da janela de 6 meses. */
  if (item.avaliacaoDispensadaEm) {
    return { ativo: false, vencido: false, numero: item.pedidosDeAvaliacao ?? 0, resumo: "Dispensado — não entra mais na fila de pedir avaliação.", dispensado: true };
  }

  /* O consumidor respondeu à nossa resposta: primeiro a réplica, depois a nota. */
  if (/aguardando nossa r[ée]plica/i.test(item.status ?? "")) {
    return { ativo: false, vencido: false, numero: 0, resumo: "Aguardando a nossa réplica — responda antes de pedir a avaliação." };
  }

  const base = item.publicResponseAt
    ? diaDoRegistro(item.publicResponseAt).dia
    : (item.updatedAt ?? item.createdAt).slice(0, 10);

  if (hoje > mais(base, LIMITE_DE_ACOMPANHAMENTO_DIAS)) {
    return { ativo: false, vencido: false, numero: 0, resumo: "Mais de 6 meses desde a resposta — fora do acompanhamento." };
  }

  const feitos = item.pedidosDeAvaliacao ?? 0;
  const ultimo = item.ultimoPedidoAvaliacaoEm ? paredeDe(new Date(item.ultimoPedidoAvaliacaoEm)).dia : null;

  const proximoDia = ultimo
    ? mais(ultimo, feitos < LEMBRETES_CURTOS ? INTERVALO_CURTO_DIAS : INTERVALO_LONGO_DIAS)
    : mais(base, INTERVALO_CURTO_DIAS);

  const vencido = proximoDia <= hoje;

  const ddmm = proximoDia.split("-").reverse().slice(0, 2).join("/");
  const quando = proximoDia === hoje ? "hoje" : vencido ? `desde ${ddmm}` : `em ${ddmm}`;

  return {
    ativo: true,
    proximoDia,
    vencido,
    numero: feitos + 1,
    quando,
    resumo:
      proximoDia === hoje
        ? `${feitos + 1}º lembrete para hoje.`
        : vencido
          ? `${feitos + 1}º lembrete atrasado, desde ${ddmm}.`
          : `${feitos + 1}º lembrete em ${ddmm}.`,
  };
}

type PedivelDeAvaliacao = Parameters<typeof pedidoDeAvaliacao>[0];

export interface NaFila<T> {
  item: T;
  pedido: PedidoDeAvaliacao;
}

/**
 * A fila do Passo 8: quem pedir hoje e quem vem depois.
 *
 * "Para hoje" traz primeiro o lembrete mais atrasado — quem está há mais
 * tempo esperando o pedido é quem mais corre o risco de esquecer que
 * foi atendido. Fora da janela de 6 meses, já avaliadas e sem resposta
 * pública não entram.
 */
export function filaDeAvaliacao<T extends PedivelDeAvaliacao>(
  casos: T[],
  agora = new Date()
): { hoje: NaFila<T>[]; proximos: NaFila<T>[] } {

  const ativos = casos
    .map((item) => ({ item, pedido: pedidoDeAvaliacao(item, agora) }))
    .filter((x) => x.pedido.ativo);

  const porDia = (a: NaFila<T>, b: NaFila<T>) =>
    (a.pedido.proximoDia ?? "").localeCompare(b.pedido.proximoDia ?? "");

  return {
    hoje: ativos.filter((x) => x.pedido.vencido).sort(porDia),
    proximos: ativos.filter((x) => !x.pedido.vencido).sort(porDia),
  };
}

/* ============================================================
   CLIENTE SEM NOTÍCIA
============================================================ */

export const DIAS_SEM_NOTICIA = 2;

/**
 * Dias úteis desde o último contato com um caso ainda em aberto.
 *
 * Só conta depois do 1º contato — antes dele quem manda é o relógio da
 * meta — e só enquanto a solução não foi entregue.
 */
export function semNoticia(
  item: Pick<Case, "primeiroContatoEm" | "ultimoContatoEm" | "resolved" | "respondida" | "publicResponse" | "status">,
  agora = new Date(),
  expediente: Expediente = EXPEDIENTE_PADRAO
): { dias: number; atrasado: boolean } | null {

  if (!item.primeiroContatoEm || !item.ultimoContatoEm) return null;
  if (item.resolved || respondida(item) ||["Aguardando avaliação", "Resolvido", "Não resolvido"].includes(item.status)) return null;

  let dia = paredeDe(new Date(item.ultimoContatoEm)).dia;
  const hoje = paredeDe(agora).dia;

  let dias = 0;
  for (let guarda = 0; dia < hoje && guarda < 400; guarda++) {
    dia = mais(dia, 1);
    if (ehDiaUtil(dia, expediente)) dias += 1;
  }

  return { dias, atrasado: dias >= DIAS_SEM_NOTICIA };
}
