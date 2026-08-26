import { Case } from "@/lib/models/case";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

export interface Distribution {
  label: string;
  value: number;
  percent: number;
}

export interface CaseMetrics {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  churnRisk: number;
  companies: number;
  averageScore: number;
  solutionRate: number;
  wouldDoBusinessRate: number;
  openWithoutOwner: number;
}

/**
 * Estados que **não** dependem mais de ação da operação.
 *
 * A lista é de exclusão, e não de inclusão, de propósito: o fluxo é
 * configurável em "Configurar fluxo", e com lista de inclusão qualquer
 * etapa nova criada pela operação deixaria de contar como aberta — o
 * caso sumiria silenciosamente do indicador "na fila".
 *
 * "Aguardando avaliação" entra aqui porque já foi respondido: a bola
 * está com o consumidor. "Resolvido" e "Não resolvido" são os dois
 * estados terminais do ciclo real do Reclame Aqui.
 */
const CLOSED_STATUS = [
  "Aguardando avaliação",
  "Resolvido",
  "Não resolvido",
];

export const RECLAME_AQUI = "Reclame Aqui";

/**
 * Canais que alimentam o módulo Redes Sociais. Hoje só o Instagram
 * recebe demanda; outros canais entram aqui quando forem ativados.
 */
export const SOCIAL_SOURCES = [
  "Instagram",
  "Facebook",
  "WhatsApp",
  "ManyChat",
];

export type Channel = "reclame-aqui" | "social" | "all";

export function isReclameAqui(item: Case) {
  return item.source === RECLAME_AQUI;
}

export function isSocial(item: Case) {
  return SOCIAL_SOURCES.includes(item.source);
}

/** Recorta a base pelo canal de origem. Cada módulo enxerga só o que é seu. */
export function byChannel(
  cases: Case[],
  channel: Channel
) {
  if (channel === "reclame-aqui") {
    return cases.filter(isReclameAqui);
  }

  if (channel === "social") {
    return cases.filter(isSocial);
  }

  return cases;
}

export function isOpen(item: Case) {
  return !CLOSED_STATUS.includes(item.status);
}

/**
 * O endereço deste caso, no módulo a que ele pertence.
 *
 * Existe porque **oito telas** montavam `/reclame-aqui/${id}` à mão —
 * painel, clientes, estabelecimentos, jornada, processos, a fila social
 * — e todas elas listam casos de mais de uma frente. Um atendimento do
 * Instagram aberto por qualquer uma delas caía no módulo do Reclame
 * Aqui, com a aba de avaliação do portal pedindo nota para um caso que
 * nunca vai ter uma.
 *
 * Uma função em vez de oito interpolações: a nona tela que listar casos
 * acerta sozinha, e a próxima frente que existir se resolve aqui.
 */
export function caseHref(item: Case) {
  return isSocial(item)
    ? `/redes-sociais/${item.id}`
    : `/reclame-aqui/${item.id}`;
}

function rate(part: number, total: number) {
  return total === 0
    ? 0
    : Math.round((part / total) * 100);
}

export function getMetrics(cases: Case[]): CaseMetrics {

  const total = cases.length;

  const resolved = cases.filter(
    (item) => item.resolved
  ).length;

  const scored = cases.filter(
    (item) => typeof item.score === "number"
  );

  const averageScore =
    scored.length === 0
      ? 0
      : scored.reduce(
          (sum, item) => sum + (item.score ?? 0),
          0
        ) / scored.length;

  return {
    total,

    open: cases.filter(isOpen).length,

    critical: cases.filter(
      (item) => item.priority === "Crítica"
    ).length,

    resolved,

    churnRisk: cases.filter(
      (item) => item.churnRisk
    ).length,

    companies: new Set(
      cases.map((item) => item.company)
    ).size,

    averageScore:
      Math.round(averageScore * 10) / 10,

    solutionRate: rate(resolved, total),

    wouldDoBusinessRate: rate(
      cases.filter((item) => item.wouldDoBusiness).length,
      total
    ),

    openWithoutOwner: cases.filter(
      (item) => isOpen(item) && !item.owner
    ).length,
  };
}

/**
 * Agrupa os casos por um campo e devolve a distribuição ordenada
 * do maior para o menor, já com o percentual calculado.
 */
export function groupBy(
  cases: Case[],
  field: keyof Case
): Distribution[] {

  const counters = new Map<string, number>();

  for (const item of cases) {

    const raw = item[field];

    const label =
      typeof raw === "string" && raw.trim() !== ""
        ? raw
        : "Não informado";

    counters.set(
      label,
      (counters.get(label) ?? 0) + 1
    );

  }

  return [...counters.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: rate(value, cases.length),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Evolução mensal a partir de createdAt (formato YYYY-MM-DD),
 * usada nos gráficos de tendência do Dashboard e do Analytics.
 */
export function getMonthlyTrend(cases: Case[]) {

  const months = new Map<
    string,
    { total: number; resolved: number }
  >();

  for (const item of cases) {

    const month = item.createdAt.slice(0, 7);

    const current =
      months.get(month) ??
      { total: 0, resolved: 0 };

    months.set(month, {
      total: current.total + 1,
      resolved:
        current.resolved + (item.resolved ? 1 : 0),
    });

  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: formatMonth(month),
      ...data,
    }));
}

function formatMonth(month: string) {

  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  const index = Number(month.slice(5, 7)) - 1;

  return `${names[index] ?? month} ${month.slice(2, 4)}`;
}

export function getCriticalCases(cases: Case[]) {
  return cases
    .filter(
      (item) =>
        isOpen(item) &&
        (item.priority === "Crítica" || item.churnRisk)
    )
    .sort((a, b) =>
      b.updatedAt && a.updatedAt
        ? b.updatedAt.localeCompare(a.updatedAt)
        : 0
    );
}

export function getRecentCases(
  cases: Case[],
  limit = 6
) {
  return [...cases]
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
    .slice(0, limit);
}

/* ============================================================
   MOVER DE ETAPA
============================================================ */

/**
 * O caso depois de mudar de etapa.
 *
 * Mover não é só trocar o texto do status: duas colunas do quadro
 * **são** a avaliação do consumidor. "Resolvido" e "Não resolvido"
 * significam que ele avaliou; qualquer etapa anterior significa que
 * ainda não. Por isso voltar um caso para trás **apaga a nota** — senão
 * ela continuaria pesando na reputação de um caso que, segundo o
 * próprio quadro, ainda não foi avaliado.
 *
 * Mora aqui, e não dentro do `CaseContext`, porque a extensão move caso
 * por uma rota que autentica pelo cabeçalho e não pode chamar server
 * action. Duas cópias desta regra divergiriam na primeira correção, e o
 * sintoma seria uma nota fantasma na base.
 */
export function moverPara(
  item: Case,
  status: string,
  quando: string
): Case {

  const avaliado =
    status === "Resolvido" || status === "Não resolvido";

  return {
    ...item,
    status,
    resolved: status === "Resolvido",
    evaluated: avaliado,
    score: avaliado ? item.score : undefined,
    evaluatedAt: avaliado ? item.evaluatedAt : undefined,
    updatedAt: quando,
  };
}

/**
 * A etapa vizinha, na ordem do quadro.
 *
 * Devolve `null` na ponta — não circula. Um caso em "Novo" que
 * "voltasse" para a última coluna seria a forma mais rápida de dar
 * baixa sem querer numa reclamação que ninguém atendeu.
 */
export function etapaVizinha(
  etapas: string[],
  atual: string,
  direcao: "avancar" | "voltar"
): string | null {

  const i = etapas.indexOf(atual);

  if (i < 0) return null;

  const alvo = direcao === "avancar" ? i + 1 : i - 1;

  return alvo >= 0 && alvo < etapas.length
    ? etapas[alvo]
    : null;
}

/**
 * O termo digitado casa com este caso?
 *
 * Vive aqui, e não dentro do `CaseContext`, porque tem dois
 * consumidores: o filtro da tela e o `check:busca-texto`, que o exercita
 * contra a base real. Enquanto a regra morava no contexto ela não tinha
 * como ser provada — e foi assim que passou meses sem procurar por
 * telefone sem ninguém notar.
 *
 * **O telefone é comparado em dígitos, dos dois lados.** A base guarda
 * `51992187321` e quem digita escreve `(51) 99218-7321`; comparar texto
 * com texto não casaria nunca. Quem atende chega com o número na mão —
 * é o que o WhatsApp mostra e o que o consumidor dita —, e não achar
 * nada leva à conclusão errada de que o caso não existe.
 *
 * O piso de quatro dígitos existe para "2" não devolver meia base.
 */
export function casaComTermo(
  item: Pick<
    Case,
    | "protocol"
    | "title"
    | "company"
    | "customer"
    | "category"
    | "owner"
    | "city"
    | "email"
    | "phone"
    | "document"
  >,
  termo: string
) {

  const t = termo.trim().toLowerCase();

  if (!t) return true;

  const digitos = t.replace(/[^0-9]/g, "");

  if (digitos.length >= 4) {

    const numericos = [item.phone, item.document]
      .filter(Boolean)
      .map((v) => String(v).replace(/[^0-9]/g, ""));

    if (numericos.some((v) => v.includes(digitos))) {
      return true;
    }
  }

  return [
    item.protocol,
    item.title,
    item.company,
    item.customer,
    item.category,
    item.owner,
    item.city,
    item.email,
  ]
    .filter(Boolean)
    .some((campo) =>
      String(campo).toLowerCase().includes(t)
    );
}

/**
 * Como se chama, em cada frente, o número que identifica o caso.
 *
 * O Isaac corrigiu o vocabulário: "não tem essa de protocolo, tem que
 * ser o id do reclame aqui". E é verdade — o Reclame Aqui não emite
 * protocolo, emite um id, e chamar de protocolo faz quem atende
 * procurar no portal um campo que não existe.
 *
 * O dado sempre foi o id: a carga grava `RA-<id do portal>`. O que
 * estava errado era só o rótulo, em seis telas.
 *
 * Cada frente tem o seu nome, e por isso isto é função e não constante:
 * o Instagram não tem id do Reclame Aqui, e o caso aberto à mão aqui
 * dentro não tem id de lugar nenhum — tem uma referência nossa.
 */
export function idLabel(item: Case) {

  if (isSocial(item)) return "Referência";

  /*
    O que nasce na própria aplicação começa com CW-.

    Chamar isso de "ID do Reclame Aqui" seria pior do que chamar de
    protocolo: mandaria procurar no portal um número que a aplicação
    inventou e que o portal nunca viu.
  */
  if (item.protocol.startsWith("CW-")) {
    return "Referência interna";
  }

  return "ID do Reclame Aqui";
}

/**
 * O identificador como ele é lá fora.
 *
 * `RA-` é prefixo nosso, para o número não colidir com o das outras
 * frentes dentro do banco. No portal, o id é o que vem depois — e é ele
 * que a pessoa cola na busca do Reclame Aqui.
 */
export function idExterno(item: Case) {
  return item.protocol.replace(/^RA-/, "");
}

/* ============================================================
   SITUAÇÃO — OS NÚMEROS DO PAINEL, COMO FILTRO
============================================================ */

/**
 * As situações que o painel sabe apontar.
 *
 * Em português porque entram na barra de endereço: um link colado num
 * chat é lido por gente, e `?situacao=vencidas` diz o que faz.
 *
 * Moram aqui, e não no contexto, porque a regra que **conta** e a que
 * **filtra** têm de ser a mesma — e o contexto já importa deste
 * arquivo, então o caminho contrário fecharia um ciclo.
 */
export type SituacaoDoCaso =
  | "sem-resposta"
  | "vencidas"
  | "na-fila"
  | "risco";

export const ROTULO_DA_SITUACAO: Record<
  SituacaoDoCaso,
  string
> = {
  "sem-resposta": "Sem resposta pública",
  vencidas: "Vencidas há +7 dias",
  "na-fila": "Na fila da operação",
  risco: "Risco de cancelamento",
};

/**
 * O corte de "vencida": sete dias atrás, no fuso da operação.
 *
 * Sete dias porque é onde o Reclame Aqui passa a marcar a reclamação
 * como vencida no painel público — não é um número escolhido aqui.
 */
export function seteDiasAtras() {

  const limite = new Date(
    `${hojeNaOperacao()}T00:00:00Z`
  );

  limite.setUTCDate(limite.getUTCDate() - 7);

  return limite.toISOString().slice(0, 10);
}

/**
 * O caso está na situação apontada pelo painel?
 *
 * Mesma regra que o painel usa para **contar**, agora disponível para
 * **filtrar**. Estavam duplicadas: o dashboard somava "sem resposta
 * pública" com uma expressão sua, e não havia como pedir a lista dessa
 * mesma conta. Contagem e lista que discordam é o defeito clássico
 * desse tipo de tela, e a única defesa é as duas saírem daqui.
 *
 * `corte` entra por parâmetro em vez de ser calculado dentro porque
 * isto roda uma vez por caso — 341 chamadas a `new Date` por render
 * para responder sempre a mesma pergunta.
 */
export function naSituacao(
  item: Case,
  situacao: SituacaoDoCaso,
  corte: string
) {

  const semResposta =
    isReclameAqui(item) &&
    (item.publicResponse ?? "").trim() === "";

  switch (situacao) {

    case "sem-resposta":
      return semResposta;

    case "vencidas":
      return semResposta && item.createdAt < corte;

    case "na-fila":
      return isOpen(item);

    case "risco":
      return Boolean(item.churnRisk);
  }
}
