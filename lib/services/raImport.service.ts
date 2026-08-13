import * as XLSX from "xlsx";

import { Case } from "@/lib/models/case";

import {
  classificar,
  classificarPorProblema,
} from "@/lib/services/raClassify";

/**
 * Leitura do export "Dados do Reclame Aqui" (HugMe).
 *
 * Vive em `lib` e não em `scripts` porque tem dois consumidores: o
 * comando de linha que regenera o dataset de demonstração e o botão
 * Importar da tela, que grava direto no banco. Ter duas cópias desta
 * lógica seria garantir que uma delas ficasse para trás.
 */

export interface ImportOptions {
  /**
   * Mantém e-mail e telefone sem máscara.
   *
   * Só para destino não versionado — o banco. O dataset do repositório
   * é público para quem tem acesso ao git, e o export traz PII real.
   */
  keepPii?: boolean;
}

export interface ImportResult {
  cases: Case[];
  /** Primeira e última data de reclamação encontradas. */
  from: string | null;
  to: string | null;
}

export class ImportFormatError extends Error {}

function toIso(value: unknown) {
  if (!value) return null;

  const [date] = String(value).split(" ");
  const [d, m, y] = date.split("/");

  if (!y) return null;

  return `${y}-${m}-${d}`;
}

function toDate(value: unknown) {
  if (!value) return null;

  const [date, time] = String(value).split(" ");
  const [d, m, y] = date.split("/");

  if (!y) return null;

  return new Date(
    `${y}-${m}-${d}T${time || "00:00"}:00Z`
  );
}

/** Diferença entre duas datas, no formato que as telas exibem. */
function elapsed(from: Date | null, to: Date | null) {
  if (!from || !to) return "-";

  const minutes = Math.round(
    (to.getTime() - from.getTime()) / 60000
  );

  if (minutes < 0) return "-";
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;

  return `${Math.round(hours / 24)} dias`;
}

function maskEmail(value: unknown, keepPii: boolean) {
  if (!value) return undefined;
  if (keepPii) return String(value);

  const [user, domain] = String(value).split("@");

  if (!domain) return undefined;

  return `${user.slice(0, 2)}${"•".repeat(
    Math.max(user.length - 2, 3)
  )}@${domain}`;
}

function maskPhone(value: unknown, keepPii: boolean) {
  if (!value) return undefined;

  const primeiro = String(value).split(";")[0].trim();

  if (keepPii) return primeiro;

  const digits = primeiro.replace(/\D/g, "");

  if (digits.length < 6) return undefined;

  return `(${digits.slice(0, 2)})•••••-${digits.slice(-4)}`;
}

/**
 * Status do quadro, fiéis ao ciclo real do portal.
 *
 * "Respondido" não é atendimento em andamento: é caso já respondido,
 * aguardando a avaliação do consumidor.
 */
function mapStatus(statusRa: unknown) {
  switch (String(statusRa)) {
    case "Avaliado Resolvido":
      return "Resolvido";
    case "Avaliado Não Resolvido":
      return "Não resolvido";
    case "Não respondido":
      return "Novo";
    case "Réplica do consumidor":
      return "Aguardando nossa réplica";
    case "Réplica da empresa":
    case "Respondido":
      return "Aguardando avaliação";
    default:
      return "Novo";
  }
}

function priorityOf(info: {
  score: number | null;
  resolved: boolean;
  evaluated: boolean;
  answered: boolean;
}): Case["priority"] {

  if (!info.answered) return "Crítica";
  if (info.evaluated && !info.resolved) return "Alta";

  if (
    info.evaluated &&
    info.score !== null &&
    info.score <= 4
  ) {
    return "Alta";
  }

  if (!info.evaluated) return "Média";

  return "Baixa";
}

/** Etiquetas coerentes com o estado real do caso. */
function tagsOf(item: Case) {

  const tags: string[] = [];

  if (!item.publicResponse) {
    tags.push("Aguardando área interna");
  }

  if (item.resolved && !item.evaluated) {
    tags.push("Favorável a avaliação");
  }

  if (
    item.evaluated &&
    (item.score ?? 0) >= 9
  ) {
    tags.push("Possível avaliação positiva");
  }

  if (item.churnRisk) {
    tags.push("Risco de nota baixa");
  }

  return tags;
}

/** Converte o conteúdo de um .xlsx do Reclame Aqui em reclamações. */
export function parseReclameAqui(
  data: ArrayBuffer | Buffer | Uint8Array,
  { keepPii = false }: ImportOptions = {}
): ImportResult {

  const wb = XLSX.read(data, { type: "buffer" });

  const grid = XLSX.utils.sheet_to_json<unknown[]>(
    wb.Sheets[wb.SheetNames[0]],
    { header: 1, defval: null, raw: false }
  );

  // O cabeçalho não fica na primeira linha do export.
  const headerRow = grid.findIndex(
    (row) =>
      Array.isArray(row) && row.includes("Id HugMe")
  );

  if (headerRow === -1) {
    throw new ImportFormatError(
      "Cabeçalho não encontrado. O arquivo precisa ser o export " +
        '"Base de dados do Reclame Aqui" do HugMe, com a coluna "Id HugMe".'
    );
  }

  const head = grid[headerRow] as unknown[];
  const col = (name: string) => head.indexOf(name);

  const rows = grid
    .slice(headerRow + 1)
    .filter((row) => Array.isArray(row) && row[0]);

  const cases: Case[] = rows.map((row, index) => {

    const created = toDate(row[col("Data Reclamação")]);
    const answeredAt = toDate(row[col("Data de Resposta")]);
    const evaluatedAt = toDate(row[col("Data Avaliacao")]);

    const rawScore = row[col("Nota")];

    const score =
      rawScore === null || rawScore === ""
        ? null
        : Number(rawScore);

    /**
     * O portal marca as avaliações que ele mesmo invalidou. Aqui vira
     * sinalização; quem tira do cálculo da nota é `reputation.service`.
     */
    const scoreDisregarded =
      String(
        row[col("Avaliações desconsideradas RA")] ?? ""
      )
        .trim()
        .toLowerCase() === "sim";

    const evaluated = score !== null;
    const answered = Boolean(answeredAt);

    const resolved =
      row[col("Seu problema foi resolvido?")] === "Sim";

    const wouldDoBusiness =
      row[col("Voltaria a fazer negócio?")] === "Sim";

    const statusRa = row[col("Status RA")];

    const { categoria, subcategoria } =
      col("Problema RA") === -1
        ? classificar(String(row[col("Título")] ?? ""))
        : classificarPorProblema(
            String(row[col("Problema RA")] ?? ""),
            String(row[col("Título")] ?? "")
          );

    const nome = String(row[col("Nome")] ?? "").trim();

    const idHugme = String(
      row[col("Id HugMe")] ?? index + 1
    );

    // Texto público da reclamação, quando o export o traz.
    const texto =
      col("Texto da Reclamação") === -1
        ? ""
        : String(row[col("Texto da Reclamação")] ?? "")
            .replace(/\r/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

    const item: Case = {
      id: idHugme,
      protocol: `RA-${idHugme}`,
      // O export não traz o estabelecimento: o reclamante é o cliente.
      company: nome || "Não informado",
      customer: nome || "Não informado",
      email: maskEmail(row[col("Email")], keepPii),
      phone: maskPhone(row[col("Telefones")], keepPii),
      city:
        (row[col("Cidade")] as string) || undefined,
      state:
        (row[col("Estado")] as string) || undefined,
      source: "Reclame Aqui",
      category: categoria,
      subcategory: subcategoria,
      priority: priorityOf({
        score,
        resolved,
        evaluated,
        answered,
      }),
      status: mapStatus(statusRa),
      title:
        String(
          row[col("Título")] ?? "Sem título"
        ).trim() || "Sem título",
      description:
        texto || "Reclamação registrada no Reclame Aqui.",
      publicResponse: answered
        ? "Resposta pública registrada no portal."
        : "",
      score: score ?? undefined,
      evaluated,
      scoreDisregarded: scoreDisregarded || undefined,
      resolved,
      wouldDoBusiness,
      responseTime: elapsed(created, answeredAt),
      solutionTime: elapsed(created, evaluatedAt),
      sla: resolved ? "Concluído" : "48h",
      createdAt: toIso(
        row[col("Data Reclamação")]
      ) as string,
      updatedAt:
        toIso(row[col("Data Avaliacao")]) ??
        toIso(row[col("Data de Resposta")]) ??
        toIso(row[col("Data Reclamação")]) ??
        undefined,
      lastInteraction:
        toIso(row[col("Data Avaliacao")]) ??
        toIso(row[col("Data de Resposta")]) ??
        toIso(row[col("Data Reclamação")]) ??
        undefined,
      churnRisk:
        evaluated && !resolved && !wouldDoBusiness,
      tags: [],
    };

    item.tags = tagsOf(item);

    return item;
  });

  const validos = cases.filter((item) => item.createdAt);

  if (validos.length === 0) {
    throw new ImportFormatError(
      "Nenhuma reclamação com data válida foi encontrada no arquivo."
    );
  }

  const datas = validos
    .map((item) => item.createdAt)
    .sort();

  // Mais recentes primeiro, como as telas esperam.
  validos.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return {
    cases: validos,
    from: datas[0] ?? null,
    to: datas[datas.length - 1] ?? null,
  };
}
