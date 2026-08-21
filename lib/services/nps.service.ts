import {
  ABANDONO_DIAS,
  isEncerrado,
  JANELA_TENTATIVAS_DIAS,
  kindRule,
  NpsResponseView,
  NpsSegment,
  segmentOf,
  SEGMENTS,
  STATUS_AGUARDANDO,
  TENTATIVAS_MINIMAS,
} from "@/lib/models/nps";

/* ============================================================
   PRAZO EM HORAS ÚTEIS
============================================================ */

/**
 * Sábado e domingo não contam.
 *
 * "24 horas úteis" é lido como 24 horas de relógio que caem em dia
 * útil — a interpretação mais simples de explicar para a operação e de
 * conferir num caso concreto. Feriado não entra: exigiria um calendário
 * mantido à mão, que envelheceria calado.
 */
function ehDiaUtil(d: Date) {
  const dia = d.getUTCDay();
  return dia !== 0 && dia !== 6;
}

/** Soma horas úteis a partir de uma data, pulando fim de semana. */
export function prazoUtil(
  inicio: Date,
  horasUteis: number
): Date {

  const cursor = new Date(inicio.getTime());

  let restantes = Math.max(horasUteis, 0);

  // Passo de uma hora: simples de auditar e barato no volume desta tela.
  while (restantes > 0) {
    cursor.setUTCHours(cursor.getUTCHours() + 1);
    if (ehDiaUtil(cursor)) restantes -= 1;
  }

  return cursor;
}

/** Prazo do primeiro contato: o do tipo, quando existe; senão o do segmento. */
export function prazoPrimeiroContato(
  respondedAt: Date,
  score: number,
  kind?: string | null
): Date {

  const regra = kindRule(kind);

  const horas =
    regra?.prazoProprioHoras ??
    segmentOf(score).slaHoursUteis;

  return prazoUtil(respondedAt, horas);
}

/* ============================================================
   ESTADO DO CICLO
============================================================ */

export type SlaState =
  | "no-prazo"
  | "vence-hoje"
  | "estourado"
  | "cumprido"
  | "encerrado";

export function slaState(
  item: NpsResponseView,
  agora = new Date()
): SlaState {

  if (isEncerrado(item.status)) return "encerrado";

  if (item.firstContactAt) return "cumprido";

  const prazo = new Date(item.firstContactDueAt);

  if (agora > prazo) return "estourado";

  const horas =
    (prazo.getTime() - agora.getTime()) / 3600000;

  return horas <= 24 ? "vence-hoje" : "no-prazo";
}

/**
 * Deve encerrar sozinho por falta de retorno?
 *
 * Duas portas, as duas do guia: três tentativas dentro da janela de 7
 * dias, ou 30 dias sem qualquer resposta do cliente.
 */
export function deveEncerrarSemRetorno(
  item: NpsResponseView,
  agora = new Date()
): { deve: boolean; motivo?: string } {

  if (isEncerrado(item.status)) return { deve: false };

  const dias = (iso: string) =>
    (agora.getTime() - Date.parse(iso)) / 86400000;

  // Cliente já confirmou algo — não é falta de retorno.
  if (item.confirmedAt) return { deve: false };

  const naJanela = item.attempts.filter(
    (a) => dias(a.createdAt) <= JANELA_TENTATIVAS_DIAS
  );

  if (naJanela.length >= TENTATIVAS_MINIMAS) {
    return {
      deve: true,
      motivo: `${naJanela.length} tentativas em ${JANELA_TENTATIVAS_DIAS} dias, sem resposta.`,
    };
  }

  if (dias(item.respondedAt) >= ABANDONO_DIAS) {
    return {
      deve: true,
      motivo: `${ABANDONO_DIAS} dias sem qualquer resposta.`,
    };
  }

  return { deve: false };
}

/* ============================================================
   CHECKLIST DE ENCERRAMENTO
============================================================ */

export interface ChecklistItem {
  label: string;
  ok: boolean;
  /** Impede o encerramento enquanto não estiver cumprido. */
  obrigatorio: boolean;
}

/**
 * O checklist do guia, calculado sobre o registro.
 *
 * É a trava que impede "encerrar" virar um clique sem lastro: os itens
 * obrigatórios precisam estar cumpridos para o botão liberar.
 */
export function checklist(
  item: NpsResponseView
): ChecklistItem[] {

  const regra = kindRule(item.kind);

  const precisaCausa =
    item.kind === "Reclamação" ||
    item.kind === "Erro no Sistema" ||
    item.kind === "Erro Processual";

  return [
    {
      label: "Segmento de NPS identificado",
      // Sempre verdadeiro: sai da nota. Fica na lista porque o guia pede.
      ok: true,
      obrigatorio: true,
    },
    {
      label: "Tipo de tratativa classificado",
      ok: Boolean(item.kind),
      obrigatorio: true,
    },
    {
      label: "Causa raiz marcada",
      ok: !precisaCausa || Boolean(item.rootCause),
      obrigatorio: precisaCausa,
    },
    {
      label: "Cliente contatado",
      ok: Boolean(item.firstContactAt),
      obrigatorio: true,
    },
    {
      label: "Responsável definido",
      ok: Boolean(item.owner),
      obrigatorio: false,
    },
    {
      label: "Cliente confirmou que resolveu",
      ok: Boolean(item.confirmedAt),
      obrigatorio: Boolean(regra?.exigeConfirmacao),
    },
  ];
}

export function podeEncerrar(item: NpsResponseView) {
  return checklist(item).every(
    (c) => !c.obrigatorio || c.ok
  );
}

/**
 * Status sugerido quando falta a confirmação do cliente.
 *
 * O guia é explícito: sem a resposta de reengajamento ("isso resolveu
 * sua questão?"), o loop **não** vai para resolvido.
 */
export function statusSemConfirmacao(kind?: string | null) {
  return kindRule(kind)?.exigeConfirmacao
    ? STATUS_AGUARDANDO
    : undefined;
}

/* ============================================================
   INDICADORES
============================================================ */

export interface NpsSummary {
  total: number;
  promotores: number;
  passivos: number;
  detratores: number;
  /** −100 a 100. */
  score: number;
  /** Média das notas, 0–10. */
  media: number;
  /** Quantos ainda não tiveram primeiro contato dentro do prazo. */
  estourados: number;
  abertos: number;
}

export function summarize(
  itens: NpsResponseView[],
  agora = new Date()
): NpsSummary {

  const total = itens.length;

  const conta = (rotulo: NpsSegment) =>
    itens.filter(
      (i) => segmentOf(i.score).label === rotulo
    ).length;

  const promotores = conta("Promotor");
  const passivos = conta("Passivo");
  const detratores = conta("Detrator");

  /**
   * Fórmula oficial do NPS: % promotores − % detratores. Neutro entra
   * no total mas não soma nem subtrai — é o que torna a nota sensível a
   * quem está no meio sem opinião forte.
   */
  const score =
    total === 0
      ? 0
      : Math.round(
          ((promotores - detratores) / total) * 100
        );

  const media =
    total === 0
      ? 0
      : Math.round(
          (itens.reduce((s, i) => s + i.score, 0) /
            total) *
            10
        ) / 10;

  return {
    total,
    promotores,
    passivos,
    detratores,
    score,
    media,
    estourados: itens.filter(
      (i) => slaState(i, agora) === "estourado"
    ).length,
    abertos: itens.filter(
      (i) => !isEncerrado(i.status)
    ).length,
  };
}

/** Distribuição por segmento, para a barra da tela. */
export function bySegment(itens: NpsResponseView[]) {
  return SEGMENTS.map((s) => {

    const value = itens.filter(
      (i) => segmentOf(i.score).label === s.label
    ).length;

    return {
      label: s.label,
      value,
      percent:
        itens.length === 0
          ? 0
          : Math.round(
              (value / itens.length) * 1000
            ) / 10,
      color: s.color,
    };
  });
}

/** Ranking de causa raiz — onde investir para parar de sangrar. */
export function byRootCause(itens: NpsResponseView[]) {

  const mapa = new Map<string, number>();

  for (const item of itens) {
    if (!item.rootCause) continue;
    mapa.set(
      item.rootCause,
      (mapa.get(item.rootCause) ?? 0) + 1
    );
  }

  const total = [...mapa.values()].reduce(
    (s, v) => s + v,
    0
  );

  return [...mapa.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent:
        total === 0
          ? 0
          : Math.round((value / total) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value);
}
