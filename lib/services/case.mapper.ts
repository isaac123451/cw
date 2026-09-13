import {
  Case,
  prioridadeNormalizada,
} from "@/lib/models/case";

import { digitosDoDocumento } from "@/lib/models/establishment";

import {
  diaNaOperacao,
  formatElapsed,
} from "@/lib/services/reputation.service";

/**
 * Tradução entre a reclamação do banco e o modelo que as telas usam.
 *
 * Vive num arquivo próprio porque tem dois consumidores: a API pública
 * (`lib/api/source.ts`) e as ações de servidor que gravam pelas telas
 * (`lib/actions/cases.ts`). Duplicar isso seria garantir divergência.
 */

/**
 * Dois nomes são o mesmo nome, ignorando caixa, acento e espaço.
 *
 * Comparação local e propositalmente simples: aqui não se está casando
 * pessoas — só detectando que a coluna de empresa recebeu uma cópia da
 * coluna de consumidor, que é uma igualdade literal com ruído de
 * formatação.
 */
function mesmoNome(a?: string | null, b?: string | null) {

  const limpar = (v?: string | null) =>
    (v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const um = limpar(a);

  return um !== "" && um === limpar(b);
}

const CANAL_PARA_ORIGEM: Record<string, string> = {
  RECLAME_AQUI: "Reclame Aqui",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  MANYCHAT: "ManyChat",
  OUTRO: "Outro",
};

const ORIGEM_PARA_CANAL: Record<string, string> = {
  "Reclame Aqui": "RECLAME_AQUI",
  Instagram: "INSTAGRAM",
  Facebook: "FACEBOOK",
  WhatsApp: "WHATSAPP",
  ManyChat: "MANYCHAT",
};

/**
 * O enum do banco e os nomes da documentação.
 *
 * O enum ficou com os quatro valores antigos — trocá-lo exigiria
 * regravar 357 linhas por uma diferença que é só de nome. Média e Baixa
 * chegam à tela como Normal; ao salvar, Normal grava MEDIA. Uma
 * reclamação "Baixa" que alguém salve vira "Média" no banco, e as duas
 * são o mesmo Normal da documentação.
 */
const ENUM_PARA_PRIORIDADE: Record<
  string,
  Case["priority"]
> = {
  CRITICA: "Urgente",
  ALTA: "Alta",
  MEDIA: "Normal",
  BAIXA: "Normal",
};

const PRIORIDADE_PARA_ENUM: Record<Case["priority"], string> = {
  Urgente: "CRITICA",
  Alta: "ALTA",
  Normal: "MEDIA",
};

/** Data ISO curta (YYYY-MM-DD), que é a precisão usada nas telas. */
/**
 * O dia de Brasília de uma coluna do banco — ver `diaNaOperacao`.
 *
 * As colunas só de data (`publishedAt`, `evaluatedAt`) passam reto; o
 * `updatedAt`, que tem hora, deixa de virar amanhã depois das 21h.
 */
export function toIsoDay(value?: Date | null) {
  return value
    ? diaNaOperacao(value)
    : undefined;
}

/** Dia ISO → Date em UTC, sem escorregar de fuso. */
export function fromIsoDay(value?: string | null) {
  return value
    ? new Date(`${value}T00:00:00Z`)
    : undefined;
}

/** Linha do banco (com relações carregadas) → modelo das telas. */
export function toCaseModel(row: {
  id: string;
  externalId: string | null;
  protocol: string;
  companyName: string;
  document: string | null;
  establishmentId: string | null;
  establishmentManual?: boolean;
  establishment?: { name: string } | null;
  customer: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  channel: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  publicResponse: string | null;
  publicResponseAt: Date | null;

  /**
   * O fato, quando quem chama tem o fato e nao o texto.
   *
   * A lista de reclamacoes deixou de trazer `publicResponse` — sao
   * 250 kB que nenhuma tela dela mostra — e passa este booleano no
   * lugar. Opcional porque quem tem o texto (a tela de detalhe, a
   * extensao) continua derivando dele.
   */
  respondida?: boolean;
  draftResponse: string | null;
  /**
   * Opcional porque a lista **não** o carrega.
   *
   * São milhares de caracteres por caso, e só a tela de detalhe os
   * mostra — o mesmo motivo que tirou `description` da carga. A lista
   * omite a coluna, então o campo simplesmente não chega aqui, e exigi-lo
   * quebraria a carga inteira por um texto que quase ninguém abre.
   */
  dossier?: string | null;
  dossierAt?: Date | null;
  dossierBy?: string | null;
  socialHandle: string | null;
  followers: number | null;
  evaluated: boolean;
  score: number | null;
  scoreDisregarded?: boolean | null;
  resolved: boolean;
  wouldDoBusiness: boolean;
  evaluatedAt: Date | null;
  churnRisk: boolean;
  request: string | null;
  responseMinutes: number | null;
  solutionMinutes: number | null;
  slaTarget: string | null;
  externalUrl: string | null;
  publishedAt: Date;
  updatedAt: Date;

  /*
    Opcionais porque há leitores antigos — scripts, amostras — que não
    selecionam as colunas de 12/09/2026. Ausente é "não se sabe".
  */
  recebidaEm?: Date | null;
  triadaEm?: Date | null;
  triadaPor?: string | null;
  criterios?: string[] | null;
  primeiroContatoEm?: Date | null;
  primeiroContatoCanal?: string | null;
  primeiroContatoPor?: string | null;
  ultimoContatoEm?: Date | null;
  ultimaRespostaEm?: Date | null;
  tentativasSemResposta?: number | null;
  validadoEm?: Date | null;
  ultimoPedidoAvaliacaoEm?: Date | null;
  pedidosDeAvaliacao?: number | null;
  imersaoEm?: Date | null;
  imersaoPor?: string | null;
  cwEngineEm?: Date | null;
  cwEnginePor?: string | null;
  moderacaoPedidaEm?: Date | null;
  moderacaoMotivo?: string | null;
  moderacaoResultado?: string | null;
  moderacaoRespondidaEm?: Date | null;

  category?: { name: string } | null;
  subcategory?: { name: string } | null;
  owner?: { name: string } | null;
  team?: { name: string } | null;
  tags?: { tag: { name: string } }[];
}): Case {
  return {
    // O id do portal é o que as URLs usam; o cuid só existe no banco.
    id: row.externalId ?? row.id,
    protocol: row.protocol,
    /**
     * A empresa é o **estabelecimento**, não o consumidor.
     *
     * Os 343 casos desta base têm `companyName` idêntico ao
     * `customer`: a exportação do Reclame Aqui não traz o nome do
     * restaurante, e a carga preencheu a coluna com o nome de quem
     * reclamou. O efeito na tela era o que o Isaac reportou duas vezes
     * — "você adicionou nome do cliente como estabelecimento".
     *
     * A ordem aqui é a correção: quando há vínculo, o nome vem do
     * cadastro. Quando não há, **nada** vem — e o vazio é a informação
     * certa: "está faltando este restaurante", que é acionável, contra
     * "Ana Karla da Silva", que finge que está tudo resolvido.
     *
     * `companyName` ainda é usado quando difere do consumidor, porque
     * aí alguém digitou uma empresa de verdade e ela não deve sumir.
     */
    company:
      row.establishment?.name ??
      (mesmoNome(row.companyName, row.customer)
        ? ""
        : row.companyName),
    document: row.document ?? undefined,
    establishmentId: row.establishmentId ?? undefined,
    establishmentManual: row.establishmentManual,
    customer: row.customer,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    source: CANAL_PARA_ORIGEM[row.channel] ?? "Outro",
    category:
      row.category?.name ?? "Não classificado",
    subcategory: row.subcategory?.name ?? undefined,
    priority:
      ENUM_PARA_PRIORIDADE[row.priority] ?? "Normal",
    triadaEm: row.triadaEm?.toISOString() ?? undefined,
    triadaPor: row.triadaPor ?? undefined,
    criterios:
      row.criterios && row.criterios.length > 0
        ? row.criterios
        : undefined,
    recebidaEm: row.recebidaEm?.toISOString() ?? undefined,
    primeiroContatoEm:
      row.primeiroContatoEm?.toISOString() ?? undefined,
    primeiroContatoCanal: row.primeiroContatoCanal ?? undefined,
    primeiroContatoPor: row.primeiroContatoPor ?? undefined,
    ultimoContatoEm: row.ultimoContatoEm?.toISOString() ?? undefined,
    ultimaRespostaEm: row.ultimaRespostaEm?.toISOString() ?? undefined,
    tentativasSemResposta: row.tentativasSemResposta ?? undefined,
    validadoEm: row.validadoEm?.toISOString() ?? undefined,
    ultimoPedidoAvaliacaoEm: row.ultimoPedidoAvaliacaoEm?.toISOString() ?? undefined,
    pedidosDeAvaliacao: row.pedidosDeAvaliacao ?? undefined,
    imersaoEm: row.imersaoEm?.toISOString() ?? undefined,
    imersaoPor: row.imersaoPor ?? undefined,
    cwEngineEm: row.cwEngineEm?.toISOString() ?? undefined,
    cwEnginePor: row.cwEnginePor ?? undefined,
    moderacaoPedidaEm: row.moderacaoPedidaEm?.toISOString() ?? undefined,
    moderacaoMotivo: row.moderacaoMotivo ?? undefined,
    moderacaoResultado:
      (row.moderacaoResultado as Case["moderacaoResultado"]) ?? undefined,
    moderacaoRespondidaEm: row.moderacaoRespondidaEm?.toISOString() ?? undefined,
    status: row.status,
    owner: row.owner?.name ?? undefined,
    department: row.team?.name ?? undefined,
    request: row.request ?? undefined,
    churnRisk: row.churnRisk,
    title: row.title,
    description: row.description ?? "",
    publicResponse: row.publicResponse ?? undefined,

    /* O fato vem pronto quando o texto ficou para tras. */
    respondida:
      row.respondida ??
      ((row.publicResponse ?? "").trim() !== ""),
    publicResponseAt:
      row.publicResponseAt?.toISOString() ?? undefined,
    draftResponse: row.draftResponse ?? undefined,
    dossier: row.dossier ?? undefined,
    dossierAt:
      row.dossierAt?.toISOString() ?? undefined,
    dossierBy: row.dossierBy ?? undefined,
    socialHandle: row.socialHandle ?? undefined,
    followers: row.followers ?? undefined,
    score: row.score ?? undefined,
    evaluated: row.evaluated,
    scoreDisregarded:
      row.scoreDisregarded ?? undefined,
    evaluatedAt: toIsoDay(row.evaluatedAt),
    raUrl: row.externalUrl ?? undefined,
    resolved: row.resolved,
    wouldDoBusiness: row.wouldDoBusiness,
    responseTime:
      row.responseMinutes === null
        ? undefined
        : formatElapsed(row.responseMinutes),
    solutionTime:
      row.solutionMinutes === null
        ? undefined
        : formatElapsed(row.solutionMinutes),
    sla: row.slaTarget ?? "—",
    createdAt: toIsoDay(row.publishedAt) as string,
    updatedAt: toIsoDay(row.updatedAt),
    tags: row.tags?.map((item) => item.tag.name) ?? [],
  };
}

/**
 * Minutos a partir do texto de tempo decorrido.
 *
 * Precisa entender os dois formatos que circulam: o do importador
 * ("45min", "3h", "4 dias") e o de `formatElapsed`, que é o que volta do
 * banco ("3 horas", "19 dias e 17 horas").
 *
 * A versão anterior parava no primeiro número: "19 dias e 17 horas"
 * virava 19 dias e as 17 horas sumiam. Como o mesmo caso é lido do banco
 * e regravado pela tela, isso encolhia o tempo de resposta a cada
 * salvamento — e o tempo médio é indicador público da nota.
 */
export function parseElapsedText(value?: string) {

  if (!value || value === "-" || value === "—") {
    return null;
  }

  const texto = value.toLowerCase();

  const dias = texto.match(/(\d+)\s*dias?/);
  const horas = texto.match(/(\d+)\s*(?:h|horas?)\b/);
  const minutos = texto.match(/(\d+)\s*min/);

  if (!dias && !horas && !minutos) return null;

  return (
    (dias ? Number(dias[1]) * 1440 : 0) +
    (horas ? Number(horas[1]) * 60 : 0) +
    (minutos ? Number(minutos[1]) : 0)
  );
}

/**
 * Modelo das telas → colunas do banco.
 *
 * Fora daqui ficam as relações (categoria, subcategoria, responsável e
 * etiquetas): elas são resolvidas por nome na hora de gravar, porque a
 * tela trabalha com texto e o banco com id.
 */
export function toCaseColumns(item: Case) {
  return {
    channel: (ORIGEM_PARA_CANAL[item.source] ??
      "OUTRO") as never,
    companyName: item.company,

    // Só os dígitos: as duas grafias do mesmo número nunca casariam.
    document: digitosDoDocumento(item.document) ?? null,
    establishmentId: item.establishmentId || null,

    /**
     * `undefined` aqui não é descuido: o Prisma **pula** o campo no
     * update e usa o padrão no create. É o que deixa a importação da
     * planilha — que não conhece este campo — passar sem apagar a
     * escolha de quem vinculou na mão.
     */
    establishmentManual: item.establishmentManual,

    customer: item.customer,
    email: item.email ?? null,
    phone: item.phone ?? null,
    city: item.city ?? null,
    state: item.state ?? null,
    priority: (PRIORIDADE_PARA_ENUM[
      prioridadeNormalizada(item.priority)
    ] ?? "MEDIA") as never,
    status: item.status,

    /*
      A hora da publicação entra, mas nunca sai.

      `undefined` faz o Prisma pular o campo: a tela não conhece esta
      coluna e não pode apagá-la ao salvar. Quem a preenche é quem sabe —
      a planilha, o vigia do portal — na criação, ou pela regra de
      completar em `atualizacaoDoPortal`.

      Triagem e contatos ficam de fora pelo mesmo motivo do dossiê: têm
      ações próprias, que carimbam quem e quando.
    */
    recebidaEm: item.recebidaEm
      ? new Date(item.recebidaEm)
      : undefined,
    title: item.title,
    description: item.description || null,
    publicResponse: item.publicResponse || null,
    publicResponseAt: item.publicResponseAt
      ? new Date(item.publicResponseAt)
      : null,
    draftResponse: item.draftResponse || null,

    /*
      O dossiê **não** é escrito por aqui.

      Quem o grava é a rota da extensão, que também carimba autor e
      data. Incluí-lo no caminho da tela apagaria o dossiê a cada
      gravação do caso — a tela não o carrega para reenviar, e um campo
      ausente no formulário viraria `null` no banco.
    */

    socialHandle: item.socialHandle || null,
    followers:
      typeof item.followers === "number" &&
      Number.isFinite(item.followers)
        ? item.followers
        : null,
    evaluated: Boolean(item.evaluated),
    score: item.score ?? null,
    scoreDisregarded: Boolean(item.scoreDisregarded),
    resolved: item.resolved,
    wouldDoBusiness: item.wouldDoBusiness,
    evaluatedAt: fromIsoDay(item.evaluatedAt) ?? null,
    churnRisk: Boolean(item.churnRisk),
    request: item.request ?? null,
    responseMinutes: parseElapsedText(item.responseTime),
    solutionMinutes: parseElapsedText(item.solutionTime),
    slaTarget: item.sla ?? null,
    externalUrl: item.raUrl ?? null,
    externalId: item.id,
    publishedAt: fromIsoDay(item.createdAt) as Date,
  };
}
