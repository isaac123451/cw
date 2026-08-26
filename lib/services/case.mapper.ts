import { Case } from "@/lib/models/case";

import { digitosDoDocumento } from "@/lib/models/establishment";

import { formatElapsed } from "@/lib/services/reputation.service";

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

const ENUM_PARA_PRIORIDADE: Record<
  string,
  Case["priority"]
> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

const PRIORIDADE_PARA_ENUM: Record<string, string> = {
  "Crítica": "CRITICA",
  Alta: "ALTA",
  "Média": "MEDIA",
  Baixa: "BAIXA",
};

/** Data ISO curta (YYYY-MM-DD), que é a precisão usada nas telas. */
export function toIsoDay(value?: Date | null) {
  return value
    ? value.toISOString().slice(0, 10)
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
  draftResponse: string | null;
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
      ENUM_PARA_PRIORIDADE[row.priority] ?? "Média",
    status: row.status,
    owner: row.owner?.name ?? undefined,
    department: row.team?.name ?? undefined,
    request: row.request ?? undefined,
    churnRisk: row.churnRisk,
    title: row.title,
    description: row.description ?? "",
    publicResponse: row.publicResponse ?? undefined,
    draftResponse: row.draftResponse ?? undefined,
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
    priority: (PRIORIDADE_PARA_ENUM[item.priority] ??
      "MEDIA") as never,
    status: item.status,
    title: item.title,
    description: item.description || null,
    publicResponse: item.publicResponse || null,
    draftResponse: item.draftResponse || null,
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
