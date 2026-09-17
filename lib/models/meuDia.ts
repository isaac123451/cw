import type { Case } from "@/lib/models/case";
import type { CaseMovement } from "@/lib/models/movement";
import type { AgendaTask } from "@/lib/models/agenda";
import type { SlaRule } from "@/lib/models/sla";
import type { AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import type { LinhaDeMetrica } from "@/lib/actions/metricas";

import { FRENTES_DA_OPERACAO, frente, type FrenteId } from "@/lib/models/frentes";
import { isEncerrado, tentativasMinimas, type NpsKindOption, type NpsResponseView } from "@/lib/models/nps";
import { filaDeAvaliacao, semNoticia } from "@/lib/models/cadencia";
import { eFinalDasRedes } from "@/lib/models/redes";
import type { AtividadeDaRotina, ChaveDaRotina } from "@/lib/models/rotina";

import { caseHref, isOpen, isReclameAqui, isSocial } from "@/lib/services/case.service";
import { lateMovements, isPending } from "@/lib/services/movement.service";
import { podeEncerrar } from "@/lib/services/nps.service";
import { INICIO_DO_REGISTRO_DE_CONTATO, primeiroContatoFeito, slaStatus } from "@/lib/services/sla.service";
import {
  EXPEDIENTE_PADRAO,
  ehDiaUtil,
  type Expediente,
  horaDoMinuto,
  minutoDaHora,
  paredeDe,
} from "@/lib/services/horasUteis";
import { respondida } from "@/lib/models/case";

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
}

export interface Contagem {
  total: number;
  porFrente: Partial<Record<FrenteId, number>>;
  atrasados: number;
  /** Frase curta que diz o que o número é. */
  resumo: string;
  itens: ItemDaRotina[];
  /**
   * O acumulado que não é do dia — o backlog antigo, com o caminho para
   * tratá-lo. Fica fora do total e do plano: senão um estoque de semanas
   * vira "o dia pede 23 horas", e o plano deixa de servir para o dia.
   */
  acumulado?: { total: number; texto: string; href: string };
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
}

function contagem(itens: ItemDaRotina[], resumo: string): Contagem {
  const porFrente: Partial<Record<FrenteId, number>> = {};
  for (const i of itens) if (i.frente) porFrente[i.frente] = (porFrente[i.frente] ?? 0) + 1;
  const ordem = FRENTES_DA_OPERACAO.map((f) => f.id);
  return {
    total: itens.length,
    porFrente,
    atrasados: itens.filter((i) => i.atrasado).length,
    resumo,
    itens: [...itens].sort(
      (a, b) =>
        Number(Boolean(b.atrasado)) - Number(Boolean(a.atrasado)) ||
        (a.frente ? ordem.indexOf(a.frente) : 9) - (b.frente ? ordem.indexOf(b.frente) : 9)
    ),
  };
}

const frenteDoCaso = (c: Case): FrenteId => (isSocial(c) ? "redes" : "reclame-aqui");

/** Quantos dias uma resposta de NPS sem contato conta como "nova". */
export const DIAS_DE_NPS_NOVO = 5;

function diasCorridosDesde(iso: string, agora: Date) {
  return (agora.getTime() - Date.parse(iso)) / 86_400_000;
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

  /*
    O NPS que chegou nesta semana é "novo"; o parado há mais tempo é o
    backlog que a triagem do NPS trata, na ordem dos críticos. Medido em
    13/09: 169 parados, quase todos de semanas atrás — contados como
    novos, o plano pedia 23 horas para um dia de 10.
  */
  const recenteNps = (r: NpsResponseView) => diasCorridosDesde(r.respondedAt, agora) <= DIAS_DE_NPS_NOVO;
  const paradosNps = dados.nps.filter((r) => !isEncerrado(r.status) && !r.firstContactAt);
  const backlogNps = paradosNps.filter((r) => !recenteNps(r)).length;

  /* ---- novos: chegou e ninguém começou ---- */
  const novos: ItemDaRotina[] = [
    ...abertos
      .filter((c) => isReclameAqui(c) && !primeiroContatoFeito(c) && c.createdAt >= INICIO_DO_REGISTRO_DE_CONTATO)
      .map((c) => ({
        id: c.id,
        frente: "reclame-aqui" as const,
        titulo: c.title,
        detalhe: `${c.priority} · ${c.customer}`,
        href: caseHref(c),
        atrasado: slaStatus(c, dados.regrasSla, opcoes).situation === "estourado",
      })),
    ...abertos
      .filter((c) => isSocial(c) && !c.primeiroContatoEm && !eFinalDasRedes(c.status))
      .map((c) => ({
        id: c.id,
        frente: "redes" as const,
        titulo: c.title,
        detalhe: `${c.source} · ${c.customer}`,
        href: caseHref(c),
        atrasado: slaStatus(c, dados.regrasSla, opcoes).situation === "estourado",
      })),
    ...paradosNps
      .filter(recenteNps)
      .map((r) => ({
        id: r.id,
        frente: "nps" as const,
        titulo: `Nota ${r.score}${r.comment.trim() ? ` — ${r.comment.trim().slice(0, 60)}` : ""}`,
        detalhe: r.customerName || r.customer,
        href: `/nps/${r.id}`,
        atrasado: agora.getTime() > Date.parse(r.firstContactDueAt),
      })),
    ...dados.google
      .filter((a) => a.status === "aberta" && !a.respondidaEm)
      .map((a) => ({
        id: a.id,
        frente: "google" as const,
        titulo: `Avaliação ${a.classificacao} de ${a.autor}`,
        href: `/google?avaliacao=${a.id}`,
      })),
  ];

  /* ---- em aberto: já começou, falta o retorno ---- */
  const emAberto: ItemDaRotina[] = [
    ...abertos
      .filter((c) => primeiroContatoFeito(c) && (isSocial(c) ? !eFinalDasRedes(c.status) : !respondida(c)))
      .map((c) => ({
        id: c.id,
        frente: frenteDoCaso(c),
        titulo: c.title,
        detalhe: `${c.status} · ${c.customer}`,
        href: caseHref(c),
        atrasado: slaStatus(c, dados.regrasSla, opcoes).situation === "estourado",
      })),
    ...dados.nps
      .filter((r) => !isEncerrado(r.status) && r.firstContactAt)
      .map((r) => ({
        id: r.id,
        frente: "nps" as const,
        titulo: `Nota ${r.score} · ${r.kind ?? "sem tipo"}`,
        detalhe: r.customerName || r.customer,
        href: `/nps/${r.id}`,
      })),
    ...dados.google
      .filter((a) => a.status === "aberta" && a.respondidaEm && a.classificacao === "negativa")
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
    ...abertos
      .filter((c) => !(c.tentativasSemResposta && c.tentativasSemResposta > 0))
      .map((c) => ({ c, s: semNoticia(c, agora, expediente) }))
      .filter((x) => x.s?.atrasado)
      .map(({ c, s }) => ({
        id: c.id,
        frente: frenteDoCaso(c),
        titulo: c.title,
        detalhe: `${s!.dias} dia(s) útil(eis) sem notícia · ${c.customer}`,
        href: caseHref(c),
        atrasado: true,
      })),
    /* No NPS: já conversamos, falta a confirmação — e faz 2 dias. */
    ...dados.nps
      .filter((r) => !isEncerrado(r.status) && r.postContactAt && !r.confirmedAt)
      .filter((r) => diasCorridosDesde(r.postContactAt!, agora) >= 2)
      .map((r) => ({
        id: r.id,
        frente: "nps" as const,
        titulo: `Nota ${r.score} · falta a confirmação do cliente`,
        detalhe: r.customerName || r.customer,
        href: `/nps/${r.id}`,
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

  /* ---- ligações do dia: RA e redes vêm do servidor; NPS pela cadência do guia ---- */
  const ligacoesNps: ItemDaRotina[] = dados.nps
    /* Ainda não conseguimos falar: é a cadência de tentativas do guia. */
    .filter((r) => !isEncerrado(r.status) && !r.postContactAt && !r.confirmedAt)
    .filter((r) => r.attempts.length > 0 && r.attempts.length < tentativasMinimas(r.kind))
    .filter((r) => paredeDe(new Date(r.attempts[r.attempts.length - 1].createdAt)).dia < hoje)
    .map((r) => ({
      id: r.id,
      frente: "nps" as const,
      titulo: `Tentativa ${r.attempts.length + 1} de ${tentativasMinimas(r.kind)} · nota ${r.score}`,
      detalhe: r.customerName || r.customer,
      href: `/nps/${r.id}`,
    }));
  const ligacoes = [...(dados.ligacoes ?? []), ...ligacoesNps];

  /* ---- concluídos a registrar ---- */
  const concluidos: ItemDaRotina[] = [
    ...dados.nps
      .filter((r) => !isEncerrado(r.status) && r.confirmedAt && podeEncerrar(r, dados.tiposNps))
      .map((r) => ({
        id: r.id,
        frente: "nps" as const,
        titulo: `Nota ${r.score} · checklist completo`,
        detalhe: `${r.customerName || r.customer} — pronto para encerrar`,
        href: `/nps/${r.id}`,
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

  const metricas = contagem(
    faltando.map((f) => ({ id: f, titulo: f, href: "/analytics" })),
    !m ? "A métrica de hoje ainda não foi medida — ela entra de madrugada; confira mais tarde." : faltando.length ? `Falta preencher: ${faltando.join(", ")}.` : "Métrica de hoje completa."
  );

  const semItens = (resumo: string): Contagem => ({ total: 0, porFrente: {}, atrasados: 0, resumo, itens: [] });

  return {
    metricas,
    pendencias: contagem(pendencias, pendencias.length ? `${pendencias.length} tarefa(s) da agenda para hoje ou atrasadas.` : "Nenhuma tarefa da agenda vencendo."),
    "em-aberto": contagem(emAberto, emAberto.length ? `${emAberto.length} em andamento, esperando o nosso retorno.` : "Nada em andamento esperando retorno."),
    novos: {
      ...contagem(novos, novos.length ? `${novos.length} sem 1º contato.` : "Nenhum caso novo esperando."),
      acumulado: backlogNps
        ? { total: backlogNps, texto: `+${backlogNps} parados há mais de ${DIAS_DE_NPS_NOVO} dias no NPS — pela triagem, críticos primeiro`, href: "/nps" }
        : undefined,
    },
    fups: contagem(fups, fups.length ? `${fups.length} sem notícia há 2 dias úteis ou mais.` : "Ninguém sem notícia."),
    moderacoes: contagem(moderacoes, moderacoes.length ? `${moderacoes.length} moderação(ões) aguardando o Reclame Aqui.` : "Nenhuma moderação em aberto."),
    avaliacoes: contagem(avaliacoes, avaliacoes.length ? `${avaliacoes.length} pedido(s) de avaliação para hoje.` : "Nenhum pedido de avaliação para hoje."),
    ligacoes: contagem(ligacoes, ligacoes.length ? `${ligacoes.length} tentativa(s) da cadência para hoje.` : "Nenhuma tentativa marcada para hoje."),
    concluidos: contagem(concluidos, concluidos.length ? `${concluidos.length} concluído(s) sem o registro final.` : "Tudo o que terminou está registrado."),
    areas: contagem(areas, areas.length ? `${areas.length} com as áreas, ${atrasadas.size} fora do prazo.` : "Nada com as áreas."),
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
const prioridadeDo = (p: Pedaco) => (p.frente ? frente(p.frente).prioridade : 1.5);

/**
 * Encaixa a rotina que falta no expediente que sobra.
 *
 * As que têm horário (a planilha às 8h, o checkpoint no fim do dia)
 * ficam no horário delas — ou no primeiro espaço livre, se a hora já
 * passou. O resto vai em pedaços por frente, nesta ordem: primeiro o que
 * está fora do prazo; depois a prioridade do documento (Reclame Aqui,
 * Redes, NPS, Google); dentro disso, a ordem da rotina.
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
    .sort((x, y) => minutoDaHora(x.a.horario!) - minutoDaHora(y.a.horario!) || x.a.ordem - y.a.ordem);

  const livres = comTrabalho
    .filter((a) => !temHorario(a))
    .flatMap((a) => pedacos(a, a.chave ? contagens[a.chave] : undefined))
    .sort(
      (x, y) =>
        Number(y.atrasados > 0) - Number(x.atrasados > 0) ||
        prioridadeDo(x) - prioridadeDo(y) ||
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
    blocos.push(bloco(p, de, hora >= inicio ? `Tem horário marcado: ${p.a.horario}.` : `Era para as ${p.a.horario}: no primeiro espaço livre.`));
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
