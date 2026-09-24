import type { Case } from "@/lib/models/case";
import type { CaseMovement } from "@/lib/models/movement";
import type { AgendaTask } from "@/lib/models/agenda";
import { PRAZOS_DA_DOCUMENTACAO, type SlaRule } from "@/lib/models/sla";
import type { AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import type { LinhaDeMetrica } from "@/lib/actions/metricas";

import { FRENTES_DA_OPERACAO, frente, type FrenteId } from "@/lib/models/frentes";
import { isEncerrado, tentativasMinimas, tipoPorNome, TIPOS_PADRAO, type NpsKindOption, type NpsResponseView } from "@/lib/models/nps";
import { filaDeAvaliacao, semNoticia } from "@/lib/models/cadencia";
import { eFinalDasRedes } from "@/lib/models/redes";
import type { AtividadeDaRotina, ChaveDaRotina } from "@/lib/models/rotina";

import { caseHref, isOpen, isReclameAqui, isSocial } from "@/lib/services/case.service";
import { lateMovements, isPending } from "@/lib/services/movement.service";
import { deveEncerrarSemRetorno, nivelDoNps, ordemDoNivel, podeEncerrar, tentativaAguardando, tentativasNaJanela } from "@/lib/services/nps.service";
import { podeMarcarSemRetorno } from "@/lib/models/tratativa";
import { INICIO_DO_REGISTRO_DE_CONTATO, inicioDoRelogio, primeiroContatoFeito, slaStatus } from "@/lib/services/sla.service";
import {
  EXPEDIENTE_PADRAO,
  ehDiaUtil,
  type Expediente,
  horaDoMinuto,
  minutoDaHora,
  paredeDe,
  prazoUtil,
  proximoDiaUtil,
} from "@/lib/services/horasUteis";
import { prioridadeNormalizada, respondida } from "@/lib/models/case";

/**
 * O "Meu dia": o número de cada atividade da rotina, e o plano.
 *
 * **Os números são contados, não estimados.** Cada atividade da rotina
 * que tem uma contagem ("verificar novos casos", "pedir avaliação")
 * mostra quantos itens tem hoje, em cada frente, e quantos já estão fora
 * do prazo. É o que faltava ao checklist antigo, que pedia à IA para
 * inventar a lista: aqui a IA só ajuda a ordenar e explicar.
 *
 * **O plano cabe no expediente, ou diz que não cabe.** Cada item custa
 * alguns minutos (as estimativas estão abaixo, à vista); o plano soma,
 * encaixa na ordem de prioridade e mostra o que não cabe hoje — que é a
 * pergunta de quem tem mais demanda do que tempo.
 */

export interface ItemDaRotina {
  id: string;
  /** Vazia quando o item não é de frente nenhuma (a agenda, a métrica). */
  frente?: FrenteId;
  titulo: string;
  detalhe?: string;
  href: string;
  atrasado?: boolean;
  /**
   * A ordem dentro da frente — menor vem antes. Quem não diz, vale o
   * atraso (0 atrasado, 1 no prazo). No NPS é a régua da rotina:
   * detrator crítico, detrator, neutro, promotor.
   */
  urgencia?: number;
  /** Urgente pela triagem (Reclame Aqui e Redes) ou detrator crítico do NPS — o filtro "Críticos" do Um por vez. */
  critico?: boolean;
  /** Reclamação do Reclame Aqui: a página pública e a área da empresa — ver `linksDoRa`. */
  ra?: { protocol: string; raUrl?: string };
}

/** Marcar um item: fiz hoje, ou não se aplica a esta atividade. */
/** `adiado`: sai até a véspera do dia escolhido e volta sozinho nesse dia (Fase 24). */
export type TipoDeMarcaDeItem = "feito" | "dispensado" | "adiado";

/**
 * Um item tirado de uma atividade por quem trabalha — gravado no banco.
 *
 * A contagem sai dos dados, e o dado às vezes não acompanha o que foi
 * feito: o FUP foi por um canal que não se registra, o caso espera um
 * terceiro. Sem isto o item ficava na lista o dia inteiro.
 */
export interface MarcaDeItem {
  id: string;
  chave: ChaveDaRotina;
  /** `frente:id` — a mesma chave da fila do dia. */
  item: string;
  tipo: TipoDeMarcaDeItem;
  /** O dia em que foi marcado (AAAA-MM-DD, Brasília). */
  dia: string;
  /** O último dia em que vale; vazio é "até desfazer". */
  ate: string | null;
  titulo: string;
}

/** A chave de um item numa atividade — a mesma da fila do dia. */
export function chaveDoItem(i: Pick<ItemDaRotina, "frente" | "id">, chave: ChaveDaRotina) {
  return `${i.frente ?? chave}:${i.id}`;
}

export function marcaValeHoje(m: Pick<MarcaDeItem, "dia" | "ate">, hoje: string) {
  return m.dia <= hoje && (m.ate === null || m.ate >= hoje);
}

/*
  Adiar para outro dia (Fase 24).

  O Isaac: "que seja possível remover a atividade, marcar um check,
  adiar para outro dia". Tirar "só hoje" devolvia o item amanhã, e "por
  7 dias" era uma semana cravada. Adiar é escolher o dia da volta:
  amanhã, o próximo dia útil ou uma data. A marca vale até a véspera, e
  no dia escolhido o item volta sozinho — se ainda for trabalho.
*/

/** Até quantos dias à frente dá para adiar. Mais que isso é "até devolver". */
export const ADIAR_NO_MAXIMO_DIAS = 90;

function somarDiasCorridos(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** O último dia da marca de quem volta em `volta`; `null` quando a data não serve. */
export function ateDoAdiamento(hoje: string, volta: string): string | null {
  /* O `Date` aceita 30/02 e vira 02/03 calado: a data tem de voltar igual. */
  const t = /^\d{4}-\d{2}-\d{2}$/.test(volta) ? Date.parse(`${volta}T00:00:00Z`) : NaN;
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== volta) return null;
  if (volta <= hoje || volta > somarDiasCorridos(hoje, ADIAR_NO_MAXIMO_DIAS)) return null;
  return somarDiasCorridos(volta, -1);
}

/** O dia em que um item adiado volta. */
export function voltaDoAdiado(m: Pick<MarcaDeItem, "ate">) {
  return m.ate ? somarDiasCorridos(m.ate, 1) : null;
}

/** As escolhas prontas: amanhã e o próximo dia útil — uma só quando são o mesmo dia. */
export function opcoesDeAdiar(hoje: string, expediente: Expediente = EXPEDIENTE_PADRAO) {
  const amanha = somarDiasCorridos(hoje, 1);
  const util = proximoDiaUtil(hoje, expediente);
  return util === amanha
    ? [{ id: "amanha", rotulo: "Amanhã", volta: amanha }]
    : [
        { id: "amanha", rotulo: "Amanhã", volta: amanha },
        { id: "util", rotulo: "Próximo dia útil", volta: util },
      ];
}

/** "25/09" — o dia curto das marcas. */
export function diaCurtoDaMarca(dia: string) {
  return dia.split("-").reverse().slice(0, 2).join("/");
}

export interface Contagem {
  total: number;
  porFrente: Partial<Record<FrenteId, number>>;
  atrasados: number;
  /** Frase curta que diz o que o número é. */
  resumo: string;
  itens: ItemDaRotina[];
  /** O que saiu hoje desta atividade por marca de quem trabalha — para ver e desfazer. */
  tirados: MarcaDeItem[];
}

/**
 * Minutos por item, por atividade — a estimativa do plano.
 *
 * Números de partida, honestos sobre serem estimativa: um 1º contato
 * leva mais que um pedido de avaliação; uma cobrança à área é uma
 * mensagem. O plano mostra a soma, e quem conhece o próprio ritmo
 * ajusta a duração-base da atividade em Configurar a rotina.
 */
export const MINUTOS_POR_ITEM: Partial<Record<ChaveDaRotina, Partial<Record<FrenteId | "geral", number>>>> = {
  novos: { "reclame-aqui": 15, redes: 10, nps: 8, google: 8 },
  "em-aberto": { "reclame-aqui": 5, redes: 5, nps: 4, google: 4 },
  fups: { "reclame-aqui": 5, redes: 5, nps: 4 },
  moderacoes: { "reclame-aqui": 3 },
  avaliacoes: { "reclame-aqui": 4 },
  ligacoes: { "reclame-aqui": 6, redes: 6, nps: 6 },
  concluidos: { "reclame-aqui": 3, nps: 3, google: 3 },
  areas: { "reclame-aqui": 3, redes: 3 },
  pendencias: { geral: 5 },
};

export interface DadosDoDia {
  casos: Case[];
  nps: NpsResponseView[];
  tiposNps?: NpsKindOption[];
  google: Pick<AvaliacaoGoogleView, "id" | "autor" | "status" | "respondidaEm" | "classificacao" | "tratativaResultado" | "publicadaEm">[];
  movimentos: CaseMovement[];
  tarefas: AgendaTask[];
  regrasSla: SlaRule[];
  metricaHoje?: LinhaDeMetrica | null;
  /** As ligações do dia, contadas no servidor pela cadência de cada caso. */
  ligacoes?: ItemDaRotina[];
  /** O relatório do ciclo de hoje, e se já foi salvo. */
  relatorio?: { ciclo: string; rotulo: string; salvo: boolean } | null;
  /** Os itens que quem trabalha tirou das atividades (feito hoje, dispensado). */
  marcasDeItens?: MarcaDeItem[];
  /**
   * Os casos com tentativa aguardando retorno há mais de 2 horas — vêm do
   * servidor, que tem o registro de contatos. É FUP: marcar sem retorno
   * ou registrar a resposta.
   */
  aguardandoRetorno?: ItemDaRotina[];
}

/** A ordem do documento entre as frentes; sem frente (a agenda), logo depois do Reclame Aqui. */
export const prioridadeDaFrente = (f?: FrenteId) => (f ? frente(f).prioridade : 1.5);

export const urgenciaDe = (i: Pick<ItemDaRotina, "urgencia" | "atrasado">) => i.urgencia ?? (i.atrasado ? 0 : 1);

/**
 * A lista de uma atividade, na ordem da documentação.
 *
 * "Em cenários de alto volume: Reclame Aqui, Redes Sociais, NPS e
 * Google" — a frente manda primeiro. Dentro dela, o fora do prazo e a
 * criticidade (no NPS, o detrator crítico antes do promotor).
 */
function contagem(itens: ItemDaRotina[], resumo: string, tirados: MarcaDeItem[] = []): Contagem {
  const porFrente: Partial<Record<FrenteId, number>> = {};
  for (const i of itens) if (i.frente) porFrente[i.frente] = (porFrente[i.frente] ?? 0) + 1;
  return {
    total: itens.length,
    porFrente,
    atrasados: itens.filter((i) => i.atrasado).length,
    resumo,
    itens: itens
      .map((i, n) => ({ i, n }))
      .sort(
        (a, b) =>
          prioridadeDaFrente(a.i.frente) - prioridadeDaFrente(b.i.frente) ||
          urgenciaDe(a.i) - urgenciaDe(b.i) ||
          a.n - b.n
      )
      .map((x) => x.i),
    tirados,
  };
}

const frenteDoCaso = (c: Case): FrenteId => (isSocial(c) ? "redes" : "reclame-aqui");

/** Quanto esperar a resposta de uma avaliação do Google: 48h úteis, pelo documento. */
export const HORAS_DE_RESPOSTA_DO_GOOGLE = 48;

function diasCorridosDesde(iso: string, agora: Date) {
  return (agora.getTime() - Date.parse(iso)) / 86_400_000;
}

/**
 * As regras de prazo que valem na conta.
 *
 * Sem nenhuma cadastrada em Processos, valem as da documentação (a
 * tabela de criticidade do Reclame Aqui e o 1º contato das Redes) —
 * senão nenhum caso fica "fora do prazo" e a rotina não sabe o que vem
 * primeiro.
 */
export function regrasQueValem(regras: SlaRule[]): SlaRule[] {
  if (regras.some((r) => r.active)) return regras;
  return PRAZOS_DA_DOCUMENTACAO.map((p, i) => ({ ...p, id: `documentacao-${i}`, active: true }));
}

const CRITICIDADE: Record<string, number> = { urgente: 0, alta: 1, normal: 2 };

/**
 * A ordem de um caso dentro da frente: fora do prazo primeiro, depois a
 * criticidade do documento (urgente, alta, normal).
 */
function urgenciaDoCaso(c: Case, atrasado: boolean) {
  return (atrasado ? 0 : 3) + (CRITICIDADE[prioridadeNormalizada(c.priority).toLowerCase()] ?? 2);
}

/**
 * Anterior ao registro de contatos (12/09): o caso aberto e sem resposta
 * pública sem 1º contato registrado. Não é "novo" — já foi trabalhado
 * fora da plataforma —, e sem isto não caía em atividade nenhuma: 13
 * reclamações abertas, algumas de junho, somiam do Meu dia (medido em
 * 23/09).
 */
const legado = (c: Case) => c.createdAt < INICIO_DO_REGISTRO_DE_CONTATO && !primeiroContatoFeito(c);

/** O caso aberto passou do prazo — o do 1º contato ou o da solução. */
function foraDoPrazo(c: Case, regras: SlaRule[], opcoes: { agora: Date; expediente: Expediente }) {
  const s = slaStatus(c, regras, opcoes);
  if (s.situation === "estourado") return true;
  if (s.situation !== "sem-registro" || !s.rule || !(s.rule.solutionHours > 0)) return false;
  /* Sem 1º contato registrado, anterior ao registro: vale o prazo da solução. */
  const { inicio } = inicioDoRelogio(c, opcoes.expediente);
  return opcoes.agora.getTime() > prazoUtil(inicio, s.rule.solutionHours, opcoes.expediente).getTime();
}

/** A ordem de uma resposta do NPS: detrator crítico primeiro, e o fora do prazo antes, dentro do nível. */
function urgenciaDoNps(r: NpsResponseView, atrasado: boolean) {
  return ordemDoNivel(nivelDoNps(r).nivel) * 2 + (atrasado ? 0 : 1);
}

function rotuloDoNivel(r: NpsResponseView) {
  const { nivel, motivos } = nivelDoNps(r);
  return nivel === "detrator-critico" ? `Detrator crítico (${motivos[0]})` : undefined;
}

/** O que houve de contato hoje com a resposta do NPS — tentativa, conversa ou confirmação. */
function mexidoHojeNps(r: NpsResponseView, hoje: string) {
  const datas = [r.postContactAt, r.confirmedAt, ...r.attempts.map((a) => a.createdAt)].filter((d): d is string => Boolean(d));
  return datas.some((d) => paredeDe(new Date(d)).dia === hoje);
}

export interface EtapaDoNps {
  etapa: "novo" | "ligacao" | "sem-retorno" | "em-aberto" | "fup" | "concluir" | "esperando";
  /** Em português, para o detalhe do item. */
  motivo: string;
  /** Classificar depois da conversa é o passo seguinte, e não "voltar à fila": vale no mesmo dia. */
  mesmoMexidoHoje?: boolean;
}

/**
 * Onde está uma resposta aberta do NPS — uma atividade só.
 *
 * Antes, a resposta com uma tentativa sem sucesso contava em "em aberto"
 * e nas ligações ao mesmo tempo (22 em 23/09): registrar a tentativa
 * jogava o cliente de volta à fila de hoje, que era justamente o que não
 * fazia sentido. A régua agora é o guia:
 *
 * - sem 1º contato: novo;
 * - só tentativas: a próxima tentativa no dia seguinte (ligação), ou
 *   encerrar sem retorno quando o critério do guia chegou;
 * - conversamos: falta classificar ou o retorno com a solução (em aberto);
 *   a confirmação do cliente é espera, e vira FUP depois de 2 dias;
 * - checklist completo: concluir.
 */
export function etapaDoNps(r: NpsResponseView, tipos: NpsKindOption[] | undefined, agora: Date): EtapaDoNps {

  const regra = tipoPorNome(tipos ?? TIPOS_PADRAO, r.kind);

  if (podeEncerrar(r, tipos) && (r.postContactAt || r.kind === "Engano")) {
    return { etapa: "concluir", motivo: "pronto para encerrar" };
  }

  if (!r.firstContactAt) return { etapa: "novo", motivo: "sem 1º contato" };

  if (!r.postContactAt) {
    /* A tentativa ainda aguardando: espera 2 horas; depois, é FUP — marcar sem retorno ou registrar a conversa. */
    const pendente = tentativaAguardando(r);
    if (pendente) {
      return podeMarcarSemRetorno(pendente.createdAt, agora)
        ? { etapa: "fup", motivo: `tentativa por ${pendente.channel} sem resposta há 2h — marcar sem retorno` }
        : { etapa: "esperando", motivo: "tentativa aguardando retorno" };
    }
    const semRetorno = deveEncerrarSemRetorno(r, agora);
    if (semRetorno.deve && r.attempts.length > 0) return { etapa: "sem-retorno", motivo: semRetorno.motivo ?? "critério do guia atingido" };
    if (r.attempts.length > 0) return { etapa: "ligacao", motivo: "cliente ainda não atendeu" };
    return { etapa: "em-aberto", motivo: "falta o retorno" };
  }

  if (!r.kind || (regra?.requiresRootCause && !r.rootCause)) {
    return { etapa: "em-aberto", motivo: r.kind ? "falta a causa raiz" : "falta classificar", mesmoMexidoHoje: true };
  }

  if (regra?.requiresConfirmation && !r.confirmedAt) {
    if (r.resolvedAfter === false) return { etapa: "em-aberto", motivo: "não resolveu ainda — falta a solução" };
    return diasCorridosDesde(r.postContactAt, agora) >= 2
      ? { etapa: "fup", motivo: "falta a confirmação do cliente" }
      : { etapa: "esperando", motivo: "esperando a confirmação do cliente" };
  }

  return { etapa: "em-aberto", motivo: "falta o registro final" };
}

/** O número de cada atividade que a plataforma sabe contar. */
export function contarRotina(
  dados: DadosDoDia,
  agora = new Date(),
  expediente: Expediente = EXPEDIENTE_PADRAO
): Record<ChaveDaRotina, Contagem> {

  const hoje = paredeDe(agora).dia;
  const abertos = dados.casos.filter(isOpen);
  const opcoes = { agora, expediente };
  const regras = regrasQueValem(dados.regrasSla);
  const atrasadoCaso = (c: Case) => foraDoPrazo(c, regras, opcoes);

  /* Contato registrado hoje: o retorno de hoje já foi dado — volta amanhã, se ainda faltar. */
  const mexidoHoje = (c: Case) => Boolean(c.ultimoContatoEm && paredeDe(new Date(c.ultimoContatoEm)).dia === hoje);

  /* Tentativa aguardando retorno há mais de 2 horas: é FUP, e só lá. */
  const aguardandoRetorno = dados.aguardandoRetorno ?? [];
  const aguardandoIds = new Set(aguardandoRetorno.map((i) => i.id));

  const npsAbertos = dados.nps.filter((r) => !isEncerrado(r.status));
  const etapaNps = new Map(npsAbertos.map((r) => [r.id, etapaDoNps(r, dados.tiposNps, agora)]));
  const naEtapa = (e: EtapaDoNps["etapa"]) => npsAbertos.filter((r) => etapaNps.get(r.id)!.etapa === e);

  /* ---- novos: chegou e ninguém começou ---- */
  const novos: ItemDaRotina[] = [
    ...abertos
      .filter((c) => isReclameAqui(c) && !primeiroContatoFeito(c) && !legado(c))
      .map((c) => {
        const atrasado = atrasadoCaso(c);
        return {
          id: c.id,
          frente: "reclame-aqui" as const,
          titulo: c.title,
          detalhe: `${c.priority} · ${c.customer}`,
          href: caseHref(c),
          ra: { protocol: c.protocol, raUrl: c.raUrl },
          atrasado,
          urgencia: urgenciaDoCaso(c, atrasado),
          critico: prioridadeNormalizada(c.priority) === "Urgente",
        };
      }),
    ...abertos
      .filter((c) => isSocial(c) && !c.primeiroContatoEm && !eFinalDasRedes(c.status))
      .map((c) => {
        const atrasado = atrasadoCaso(c);
        return {
          id: c.id,
          frente: "redes" as const,
          titulo: c.title,
          detalhe: `${c.source} · ${c.customer}`,
          href: caseHref(c),
          atrasado,
          urgencia: urgenciaDoCaso(c, atrasado),
          critico: prioridadeNormalizada(c.priority) === "Urgente",
        };
      }),
    /*
      Todo NPS sem 1º contato — o de semanas atrás também. Até a 1.30 o
      parado havia mais de 5 dias ficava fora (era "o acumulado", com um
      link para a triagem), e 139 respostas vencidas não entravam em
      atividade nenhuma. Agora entram, fora do prazo, na régua da rotina:
      o detrator crítico primeiro.
    */
    ...naEtapa("novo")
      .map((r) => {
        const atrasado = agora.getTime() > Date.parse(r.firstContactDueAt);
        const nivel = rotuloDoNivel(r);
        return {
          id: r.id,
          frente: "nps" as const,
          titulo: `Nota ${r.score}${r.comment.trim() ? ` — ${r.comment.trim().slice(0, 60)}` : " · sem comentário"}`,
          detalhe: [nivel, r.customerName || r.customer].filter(Boolean).join(" · "),
          href: `/nps/${r.id}`,
          atrasado,
          urgencia: urgenciaDoNps(r, atrasado),
          critico: nivelDoNps(r).nivel === "detrator-critico",
        };
      }),
    ...dados.google
      .filter((a) => a.status === "aberta" && !a.respondidaEm)
      .map((a) => {
        const atrasado = agora.getTime() > prazoUtil(new Date(a.publicadaEm), HORAS_DE_RESPOSTA_DO_GOOGLE, expediente).getTime();
        return {
          id: a.id,
          frente: "google" as const,
          titulo: `Avaliação ${a.classificacao} de ${a.autor}`,
          href: `/google?avaliacao=${a.id}`,
          atrasado,
          urgencia: (atrasado ? 0 : 2) + (a.classificacao === "negativa" ? 0 : 1),
        };
      }),
  ];

  /*
    ---- em aberto: já começou, falta o nosso retorno ----

    Três coisas não entram, e entravam:
    - o caso em que o cliente não atende (tentativa sem resposta): é das
      ligações, pela cadência — em aberto, ele aparecia duas vezes;
    - o que teve contato hoje: o retorno de hoje já foi dado. Era o "fiz
      e voltou para a fila" — registrar o 1º contato jogava o caso de
      "novos" direto em "em aberto", no mesmo dia;
    - no NPS, a resposta só tentada (sem conversa): também é das ligações.
  */
  const emAberto: ItemDaRotina[] = [
    ...abertos
      .filter((c) => (primeiroContatoFeito(c) || legado(c)) && (isSocial(c) ? !eFinalDasRedes(c.status) : !respondida(c)))
      .filter((c) => !(c.tentativasSemResposta && c.tentativasSemResposta > 0) && !mexidoHoje(c) && !aguardandoIds.has(c.id))
      .map((c) => {
        const atrasado = atrasadoCaso(c);
        return {
          id: c.id,
          frente: frenteDoCaso(c),
          titulo: c.title,
          detalhe: `${c.status} · ${c.customer}${legado(c) ? " · 1º contato não registrado" : ""}`,
          href: caseHref(c),
          ...(frenteDoCaso(c) === "reclame-aqui" ? { ra: { protocol: c.protocol, raUrl: c.raUrl } } : {}),
          atrasado,
          urgencia: urgenciaDoCaso(c, atrasado),
          critico: prioridadeNormalizada(c.priority) === "Urgente",
        };
      }),
    ...naEtapa("em-aberto")
      .filter((r) => etapaNps.get(r.id)!.mesmoMexidoHoje || !mexidoHojeNps(r, hoje))
      .map((r) => ({
        id: r.id,
        frente: "nps" as const,
        titulo: `Nota ${r.score} · ${r.kind ?? "sem tipo"}`,
        detalhe: [etapaNps.get(r.id)!.motivo, r.customerName || r.customer].join(" · "),
        href: `/nps/${r.id}`,
        urgencia: urgenciaDoNps(r, false),
        critico: nivelDoNps(r).nivel === "detrator-critico",
      })),
    ...dados.google
      .filter((a) => a.status === "aberta" && a.respondidaEm && a.classificacao === "negativa" && !a.tratativaResultado)
      .map((a) => ({
        id: a.id,
        frente: "google" as const,
        titulo: `Tratativa privada de ${a.autor}`,
        href: `/google?avaliacao=${a.id}`,
      })),
  ];

  /*
    ---- FUPs: o cliente espera notícia nossa ----

    Quem está na cadência de tentativas (o cliente não atende) é das
    ligações, e não daqui: contado nos dois, o mesmo cliente custava o
    tempo duas vezes no plano.
  */
  const fups: ItemDaRotina[] = [
    ...aguardandoRetorno,
    ...abertos
      .filter((c) => !(c.tentativasSemResposta && c.tentativasSemResposta > 0) && !aguardandoIds.has(c.id))
      .map((c) => ({ c, s: semNoticia(c, agora, expediente) }))
      .filter((x) => x.s?.atrasado)
      .map(({ c, s }) => ({
        id: c.id,
        frente: frenteDoCaso(c),
        titulo: c.title,
        detalhe: `${s!.dias} dia(s) útil(eis) sem notícia · ${c.customer}`,
        href: caseHref(c),
        ...(frenteDoCaso(c) === "reclame-aqui" ? { ra: { protocol: c.protocol, raUrl: c.raUrl } } : {}),
        atrasado: true,
      })),
    /* No NPS: a tentativa passou de 2 horas sem resposta, ou a confirmação do cliente passou de 2 dias. */
    ...naEtapa("fup")
      .map((r) => ({
        id: r.id,
        frente: "nps" as const,
        titulo: `Nota ${r.score} · ${etapaNps.get(r.id)!.motivo}`,
        detalhe: r.customerName || r.customer,
        href: `/nps/${r.id}`,
        urgencia: urgenciaDoNps(r, false),
        critico: nivelDoNps(r).nivel === "detrator-critico",
      })),
  ];

  /* ---- moderações em aberto (a fila que a 2.9 prometeu) ---- */
  const moderacoes: ItemDaRotina[] = dados.casos
    .filter((c) => c.moderacaoPedidaEm && (!c.moderacaoResultado || c.moderacaoResultado === "pendente"))
    .map((c) => ({
      id: c.id,
      frente: "reclame-aqui" as const,
      titulo: c.title,
      detalhe: `pedida em ${c.moderacaoPedidaEm!.slice(8, 10)}/${c.moderacaoPedidaEm!.slice(5, 7)}${c.moderacaoMotivo ? ` · ${c.moderacaoMotivo}` : ""}`,
      href: caseHref(c),
      ra: { protocol: c.protocol, raUrl: c.raUrl },
      atrasado: diasCorridosDesde(c.moderacaoPedidaEm!, agora) > 10,
    }));

  /* ---- avaliações a pedir hoje ---- */
  const avaliacoes: ItemDaRotina[] = filaDeAvaliacao(dados.casos.filter(isReclameAqui), agora).hoje.map(({ item, pedido }) => ({
    id: item.id,
    frente: "reclame-aqui" as const,
    titulo: item.title,
    detalhe: `${pedido.resumo} · ${item.customer}`,
    href: caseHref(item),
    atrasado: pedido.proximoDia !== undefined && pedido.proximoDia < hoje,
  }));

  /*
    ---- ligações do dia: RA e redes vêm do servidor; NPS pela cadência do guia ----

    A resposta só tentada (nunca conversamos): a próxima tentativa é no
    dia seguinte à última. Atingido o critério de sem retorno, ela sai
    daqui e vai para os concluídos — o guia manda encerrar.
  */
  const ligacoesNps: ItemDaRotina[] = naEtapa("ligacao")
    .filter((r) => paredeDe(new Date(r.attempts[r.attempts.length - 1].createdAt)).dia < hoje)
    .map((r) => {
      const feitas = tentativasNaJanela(r, agora).length;
      return {
        id: r.id,
        frente: "nps" as const,
        titulo: `Tentativa ${feitas + 1} de ${tentativasMinimas(r.kind)} · nota ${r.score}`,
        detalhe: r.customerName || r.customer,
        href: `/nps/${r.id}`,
        urgencia: urgenciaDoNps(r, false),
        critico: nivelDoNps(r).nivel === "detrator-critico",
      };
    });
  const ligacoes = [...(dados.ligacoes ?? []), ...ligacoesNps];

  /* ---- concluídos a registrar ---- */
  const concluidos: ItemDaRotina[] = [
    ...naEtapa("concluir").map((r) => ({
      id: r.id,
      frente: "nps" as const,
      titulo: `Nota ${r.score} · checklist completo`,
      detalhe: `${r.customerName || r.customer} — pronto para encerrar`,
      href: `/nps/${r.id}`,
    })),
    ...naEtapa("sem-retorno").map((r) => ({
      id: r.id,
      frente: "nps" as const,
      titulo: `Nota ${r.score} · encerrar sem retorno`,
      detalhe: `${r.customerName || r.customer} — ${etapaNps.get(r.id)!.motivo}`,
      href: `/nps/${r.id}`,
      atrasado: true,
    })),
    ...dados.google
      .filter((a) => a.status === "aberta" && (a.tratativaResultado === "resolvido" || a.tratativaResultado === "sem-retorno"))
      .map((a) => ({
        id: a.id,
        frente: "google" as const,
        titulo: `Avaliação de ${a.autor}`,
        detalhe: "tratativa encerrada — falta a resposta pública",
        href: `/google?avaliacao=${a.id}`,
      })),
  ];

  /* ---- solicitações às áreas ---- */
  const atrasadas = new Set(lateMovements(dados.movimentos, opcoes).map((l) => l.movement.id));
  const porId = new Map(dados.casos.map((c) => [c.id, c]));
  const areas: ItemDaRotina[] = dados.movimentos.filter(isPending).map((m) => {
    const c = porId.get(m.caseId);
    return {
      id: m.id,
      frente: c ? frenteDoCaso(c) : ("reclame-aqui" as const),
      titulo: `${m.destination}${m.chamado ? ` · chamado ${m.chamado}` : ""}`,
      detalhe: c ? c.title : m.reason,
      href: c ? caseHref(c) : "/processos",
      atrasado: atrasadas.has(m.id),
    };
  });

  /* ---- pendências da agenda ---- */
  const pendencias: ItemDaRotina[] = dados.tarefas
    .filter((t) => !t.done && t.dueDate <= hoje)
    .map((t) => ({
      id: t.id,
      titulo: t.title,
      detalhe: t.time ? `${t.dueDate.split("-").reverse().slice(0, 2).join("/")} ${t.time}` : t.dueDate.split("-").reverse().slice(0, 2).join("/"),
      href: "/agenda",
      atrasado: t.dueDate < hoje,
    }));

  /* ---- a métrica do dia: os campos manuais ainda vazios ---- */
  const m = dados.metricaHoje;
  const faltando = !m
    ? ["a medição de hoje"]
    : [
        /* Resolvidas no ciclo e ciclos com selo são calculados desde a Fase 5: só o portal sabe estes dois. */
        m.visualizacoes === null ? "visualizações" : null,
        m.desativadas === null ? "desativadas" : null,
      ].filter((x): x is string => Boolean(x));

  /*
    As marcas de quem trabalha: o item feito hoje ou dispensado sai da
    atividade (e da fila e do plano), e fica listado para desfazer.
  */
  const marcas = (dados.marcasDeItens ?? []).filter((mm) => marcaValeHoje(mm, hoje));
  const montar = (chave: ChaveDaRotina, itens: ItemDaRotina[], resumo: (n: number, lista: ItemDaRotina[]) => string): Contagem => {
    const daqui = marcas.filter((mm) => mm.chave === chave);
    if (!daqui.length) return contagem(itens, resumo(itens.length, itens));
    const presentes = new Map(itens.map((i) => [chaveDoItem(i, chave), i]));
    const tirados = daqui.filter((mm) => presentes.has(mm.item));
    const fora = new Set(tirados.map((mm) => mm.item));
    const ficam = itens.filter((i) => !fora.has(chaveDoItem(i, chave)));
    return contagem(ficam, resumo(ficam.length, ficam), tirados);
  };

  const metricas = contagem(
    faltando.map((f) => ({ id: f, titulo: f, href: "/analytics" })),
    !m ? "A métrica de hoje ainda não foi medida — ela entra de madrugada; confira mais tarde." : faltando.length ? `Falta preencher: ${faltando.join(", ")}.` : "Métrica de hoje completa."
  );

  const semItens = (resumo: string): Contagem => ({ total: 0, porFrente: {}, atrasados: 0, resumo, itens: [], tirados: [] });
  const foraDoPrazoTexto = (lista: ItemDaRotina[]) => {
    const n = lista.filter((i) => i.atrasado).length;
    return n ? `, ${n} fora do prazo` : "";
  };

  return {
    metricas,
    pendencias: montar("pendencias", pendencias, (n) => (n ? `${n} tarefa(s) da agenda para hoje ou atrasadas.` : "Nenhuma tarefa da agenda vencendo.")),
    "em-aberto": montar("em-aberto", emAberto, (n, l) => (n ? `${n} em andamento esperando o nosso retorno${foraDoPrazoTexto(l)}.` : "Nada em andamento esperando retorno.")),
    novos: montar("novos", novos, (n, l) => (n ? `${n} sem 1º contato${foraDoPrazoTexto(l)}.` : "Nenhum caso novo esperando.")),
    fups: montar("fups", fups, (n) => (n ? `${n} sem notícia ou sem resposta a uma tentativa.` : "Ninguém sem notícia.")),
    moderacoes: montar("moderacoes", moderacoes, (n) => (n ? `${n} moderação(ões) aguardando o Reclame Aqui.` : "Nenhuma moderação em aberto.")),
    avaliacoes: montar("avaliacoes", avaliacoes, (n) => (n ? `${n} pedido(s) de avaliação para hoje.` : "Nenhum pedido de avaliação para hoje.")),
    ligacoes: montar("ligacoes", ligacoes, (n) => (n ? `${n} tentativa(s) da cadência para hoje.` : "Nenhuma tentativa marcada para hoje.")),
    concluidos: montar("concluidos", concluidos, (n) => (n ? `${n} concluído(s) sem o registro final.` : "Tudo o que terminou está registrado.")),
    areas: montar("areas", areas, (n, l) => (n ? `${n} com as áreas, ${l.filter((i) => i.atrasado).length} fora do prazo.` : "Nada com as áreas.")),
    checkpoint: semItens("O texto de ontem, hoje e riscos sai pronto no fim desta tela."),
    indicadores: semItens("Analytics e as projeções da semana."),
    relatorio: !dados.relatorio
      ? semItens("O relatório do ciclo, pronto para a gestão.")
      : dados.relatorio.salvo
        ? semItens(`O relatório do ciclo ${dados.relatorio.rotulo} já foi salvo — dá para revisar e salvar de novo.`)
        : contagem(
            [{ id: dados.relatorio.ciclo, titulo: `Relatório do ciclo ${dados.relatorio.rotulo}`, detalhe: "montado com os números da base; falta a análise e o envio", href: "/relatorio" }],
            `O relatório do ciclo ${dados.relatorio.rotulo} está pronto para revisar, analisar e enviar.`
          ),
    processos: semItens("O que mudar nos processos a partir do que a semana mostrou."),
    sprint: semItens("As demandas da Sprint, em Projetos."),
  };
}

/* ============================================================
   O PLANO DO DIA
============================================================ */

export interface BlocoDoPlano {
  atividadeId: string;
  titulo: string;
  /** A frente deste pedaço da atividade — vazia quando a atividade não é de frente. */
  frente?: FrenteId;
  inicio: string;
  fim: string;
  minutos: number;
  itens: number;
  atrasados: number;
  /** Por que está nesta posição — em português, para a tela. */
  motivo: string;
}

export interface PlanoDoDia {
  blocos: BlocoDoPlano[];
  /** O que não coube no expediente de hoje, na ordem em que sairia. */
  naoCabe: BlocoDoPlano[];
  minutosNecessarios: number;
  minutosDisponiveis: number;
  /** Atividades de hoje sem nada a fazer — marcam-se sem gastar tempo. */
  semTrabalho: string[];
}

/** Os minutos que uma atividade pede hoje: a base mais os itens. */
export function minutosDaAtividade(a: AtividadeDaRotina, c?: Contagem) {
  if (!a.chave || !c) return a.duracaoMin;
  const porItem = MINUTOS_POR_ITEM[a.chave];
  if (!porItem) return a.duracaoMin;
  const daFrente = FRENTES_DA_OPERACAO.reduce((s, f) => s + (c.porFrente[f.id] ?? 0), 0);
  const itens =
    FRENTES_DA_OPERACAO.reduce((s, f) => s + (c.porFrente[f.id] ?? 0) * (porItem[f.id] ?? porItem.geral ?? 3), 0) +
    (c.total - daFrente) * (porItem.geral ?? 3);
  return c.total === 0 ? 0 : Math.max(a.duracaoMin, itens);
}

interface Pedaco {
  a: AtividadeDaRotina;
  frente?: FrenteId;
  itens: number;
  atrasados: number;
  minutos: number;
  /** Minutos por item — o que permite pôr parte do pedaço quando ele não cabe inteiro. */
  porItem?: number;
}

/**
 * Uma atividade em pedaços, um por frente.
 *
 * "Verificar novos casos" com 3 do Reclame Aqui e 47 do NPS não é um
 * bloco só: o documento manda, com volume alto, o Reclame Aqui antes das
 * redes, do NPS e do Google. Em pedaços, o RA de todas as atividades vem
 * antes do NPS de qualquer uma — e o NPS acumulado deixa de engolir o
 * dia inteiro.
 */
function pedacos(a: AtividadeDaRotina, c: Contagem | undefined): Pedaco[] {
  const porItem = a.chave ? MINUTOS_POR_ITEM[a.chave] : undefined;

  if (!c || !porItem || c.total === 0) {
    return [{ a, itens: c?.total ?? 0, atrasados: c?.atrasados ?? 0, minutos: minutosDaAtividade(a, c) }];
  }

  const lista: Pedaco[] = [];

  for (const f of FRENTES_DA_OPERACAO) {
    const itens = c.porFrente[f.id] ?? 0;
    if (!itens) continue;
    const cada = porItem[f.id] ?? porItem.geral ?? 3;
    lista.push({
      a,
      frente: f.id,
      itens,
      atrasados: c.itens.filter((i) => i.frente === f.id && i.atrasado).length,
      minutos: itens * cada,
      porItem: cada,
    });
  }

  const semFrente = c.itens.filter((i) => !i.frente);
  if (semFrente.length) {
    lista.push({ a, itens: semFrente.length, atrasados: semFrente.filter((i) => i.atrasado).length, minutos: semFrente.length * (porItem.geral ?? 3) });
  }

  /* A duração-base é o piso da atividade inteira: o que falta vai no primeiro pedaço. */
  const soma = lista.reduce((s, p) => s + p.minutos, 0);
  if (lista.length && soma < a.duracaoMin) lista[0].minutos += a.duracaoMin - soma;

  return lista;
}

/** Sem frente (a agenda, uma semanal sem contagem): logo depois do Reclame Aqui. */
const prioridadeDo = (p: Pedaco) => prioridadeDaFrente(p.frente);

/**
 * Encaixa a rotina que falta no expediente que sobra.
 *
 * As que têm horário (a planilha às 8h, o checkpoint no fim do dia)
 * ficam no horário delas — ou no primeiro espaço livre, se a hora já
 * passou. O resto vai em pedaços por frente, nesta ordem: primeiro a
 * prioridade do documento (Reclame Aqui, Redes, NPS, Google); dentro da
 * frente, o que está fora do prazo; depois, a ordem da rotina.
 *
 * Até a 1.30 o fora do prazo vinha antes da frente. Com o NPS vencido
 * dentro das atividades (139 respostas em 23/09), isso poria o NPS na
 * frente de todo o Reclame Aqui — o contrário do documento.
 */
export function planoDoDia(
  atividades: AtividadeDaRotina[],
  contagens: Record<ChaveDaRotina, Contagem>,
  feitas: Set<string>,
  agora = new Date(),
  expediente: Expediente = EXPEDIENTE_PADRAO
): PlanoDoDia {

  const { dia, min } = paredeDe(agora);
  const util = ehDiaUtil(dia, expediente);

  const inicio = util ? Math.max(min, expediente.inicioMin) : expediente.inicioMin;
  const fim = expediente.fimMin;
  const disponiveis = util ? Math.max(0, fim - inicio) : 0;

  const pendentes = atividades.filter((a) => !feitas.has(a.id));

  const semTrabalho = pendentes
    .filter((a) => a.chave && contagens[a.chave] && contagens[a.chave].total === 0 && MINUTOS_POR_ITEM[a.chave])
    .map((a) => a.id);

  const comTrabalho = pendentes.filter((a) => !semTrabalho.includes(a.id));

  const temHorario = (a: AtividadeDaRotina) => Boolean(a.horario && Number.isFinite(minutoDaHora(a.horario)));

  const fixos = comTrabalho
    .filter(temHorario)
    .map((a) => {
      const c = a.chave ? contagens[a.chave] : undefined;
      return { a, itens: c?.total ?? 0, atrasados: c?.atrasados ?? 0, minutos: minutosDaAtividade(a, c) } as Pedaco;
    })
    /*
      O que ainda tem o horário pela frente fica nele; o que já passou da
      hora encaixa depois, no espaço livre. Na ordem só de horário, a
      planilha das 9h e a semanal das 15h, vistas às 17h, ocupavam antes o
      horário do checkpoint das 17h30 — que ia para as 18h07 dizendo "tem
      horário marcado: 17:30".
    */
    .sort(
      (x, y) =>
        Number(minutoDaHora(x.a.horario!) < inicio) - Number(minutoDaHora(y.a.horario!) < inicio) ||
        minutoDaHora(x.a.horario!) - minutoDaHora(y.a.horario!) ||
        x.a.ordem - y.a.ordem
    );

  const livres = comTrabalho
    .filter((a) => !temHorario(a))
    .flatMap((a) => pedacos(a, a.chave ? contagens[a.chave] : undefined))
    .sort(
      (x, y) =>
        prioridadeDo(x) - prioridadeDo(y) ||
        Number(y.atrasados > 0) - Number(x.atrasados > 0) ||
        x.a.ordem - y.a.ordem
    );

  const ocupado: { de: number; ate: number }[] = [];
  const blocos: BlocoDoPlano[] = [];
  const naoCabe: BlocoDoPlano[] = [];

  const bloco = (p: Pedaco, de: number, motivo: string): BlocoDoPlano => ({
    atividadeId: p.a.id,
    titulo: p.a.titulo,
    frente: p.frente,
    inicio: horaDoMinuto(de),
    fim: horaDoMinuto(de + p.minutos),
    minutos: p.minutos,
    itens: p.itens,
    atrasados: p.atrasados,
    motivo,
  });

  /* O primeiro espaço livre a partir de `de` que comporta `minutos`. */
  const livreDesde = (de: number, minutos: number) => {
    let x = de;
    for (let guarda = 0; guarda < 100; guarda++) {
      const choque = ocupado.find((o) => x < o.ate && x + minutos > o.de);
      if (!choque) return x;
      x = choque.ate;
    }
    return x;
  };

  for (const p of fixos) {
    const hora = minutoDaHora(p.a.horario!);
    const de = livreDesde(Math.max(inicio, hora), p.minutos);
    if (!util || de + p.minutos > fim) {
      naoCabe.push(bloco(p, de, "Não cabe mais no expediente de hoje."));
      continue;
    }
    ocupado.push({ de, ate: de + p.minutos });
    blocos.push(
      bloco(
        p,
        de,
        hora < inicio
          ? `Era para as ${p.a.horario}: no primeiro espaço livre.`
          : de === hora
            ? `Tem horário marcado: ${p.a.horario}.`
            : `Marcado para as ${p.a.horario}: no primeiro espaço livre depois.`
      )
    );
  }

  for (const p of livres) {
    const de = livreDesde(inicio, p.minutos);
    const motivo =
      p.atrasados > 0
        ? `${p.atrasados} fora do prazo${p.frente ? ` em ${frente(p.frente).nome}` : ""} — sobe na fila.`
        : p.frente
          ? `Prioridade do documento: ${frente(p.frente).nome}.`
          : "Na ordem da rotina.";
    if (!util || de + p.minutos > fim) {

      /*
        Não cabe inteiro: vai o que cabe, e só o resto fica para depois.
        Sem isto, o pedaço atrasado e grande ia todo para "não cabe"
        enquanto os menores e menos urgentes ocupavam o dia.
      */
      const inicioDoBuraco = util ? livreDesde(inicio, p.porItem ?? p.minutos) : fim;
      const buracoFim = ocupado.filter((o) => o.de >= inicioDoBuraco).reduce((m, o) => Math.min(m, o.de), fim);
      const cabem = p.porItem ? Math.floor((buracoFim - inicioDoBuraco) / p.porItem) : 0;

      if (util && cabem > 0 && cabem < p.itens) {
        const parte: Pedaco = { ...p, itens: cabem, minutos: cabem * p.porItem!, atrasados: Math.min(p.atrasados, cabem) };
        const resto: Pedaco = { ...p, itens: p.itens - cabem, minutos: p.minutos - parte.minutos, atrasados: Math.max(0, p.atrasados - cabem) };
        ocupado.push({ de: inicioDoBuraco, ate: inicioDoBuraco + parte.minutos });
        blocos.push(bloco(parte, inicioDoBuraco, `${motivo} Vão ${cabem} de ${p.itens}; o resto fica para amanhã.`));
        naoCabe.push(bloco(resto, buracoFim, motivo));
        continue;
      }

      naoCabe.push(bloco(p, de, motivo));
      continue;
    }
    ocupado.push({ de, ate: de + p.minutos });
    blocos.push(bloco(p, de, motivo));
  }

  blocos.sort((a, b) => a.inicio.localeCompare(b.inicio));

  return {
    blocos,
    naoCabe,
    minutosNecessarios: [...blocos, ...naoCabe].reduce((s, b) => s + b.minutos, 0),
    minutosDisponiveis: disponiveis,
    semTrabalho,
  };
}
