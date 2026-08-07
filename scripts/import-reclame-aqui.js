/**
 * Converte o export "Dados do Reclame Aqui" (HugMe) em lib/data/mockCases.ts.
 *
 *   node scripts/import-reclame-aqui.js <arquivo.xlsx> [--pii]
 *
 * Por padrão mascara e-mail e telefone e descarta o CPF: o arquivo gerado
 * é versionado no git, e o export traz dados pessoais reais. Use --pii
 * apenas se o destino não for um repositório público.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { classificar } = require("./classify");

const [, , file, ...flags] = process.argv;

if (!file) {
  console.error(
    "Uso: node scripts/import-reclame-aqui.js <arquivo.xlsx> [--pii]"
  );
  process.exit(1);
}

const keepPii = flags.includes("--pii");

const wb = XLSX.readFile(file);
const grid = XLSX.utils.sheet_to_json(
  wb.Sheets[wb.SheetNames[0]],
  { header: 1, defval: null, raw: false }
);

// O cabeçalho não fica na primeira linha do export.
const headerRow = grid.findIndex(
  (row) => row && row.includes("Id HugMe")
);

if (headerRow === -1) {
  console.error(
    "Cabeçalho não encontrado — o export mudou de formato?"
  );
  process.exit(1);
}

const head = grid[headerRow];
const col = (name) => head.indexOf(name);

const rows = grid
  .slice(headerRow + 1)
  .filter((row) => row && row[0]);

function toIso(value) {
  if (!value) return null;
  const [date] = String(value).split(" ");
  const [d, m, y] = date.split("/");
  if (!y) return null;
  return `${y}-${m}-${d}`;
}

function toDate(value) {
  if (!value) return null;
  const [date, time] = String(value).split(" ");
  const [d, m, y] = date.split("/");
  if (!y) return null;
  return new Date(`${y}-${m}-${d}T${time || "00:00"}:00Z`);
}

/** Diferença em minutos, formatada como o app espera. */
function elapsed(from, to) {
  if (!from || !to) return "-";

  const minutes = Math.round((to - from) / 60000);

  if (minutes < 0) return "-";
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;

  return `${Math.round(hours / 24)} dias`;
}

function maskEmail(value) {
  if (!value) return null;
  if (keepPii) return value;

  const [user, domain] = String(value).split("@");
  if (!domain) return null;

  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(
    Math.max(user.length - 2, 3)
  )}@${domain}`;
}

function maskPhone(value) {
  if (!value) return null;
  if (keepPii) return String(value).split(";")[0].trim();

  const digits = String(value)
    .split(";")[0]
    .replace(/\D/g, "");

  if (digits.length < 6) return null;

  return `(${digits.slice(0, 2)})•••••-${digits.slice(-4)}`;
}

/**
 * Status do quadro, fiéis ao ciclo real do Reclame Aqui.
 * "Respondido" não é atendimento em andamento: é caso já respondido
 * aguardando a avaliação do consumidor.
 */
function mapStatus(statusRa) {
  switch (statusRa) {
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

function priorityOf({ score, resolved, evaluated, answered }) {
  if (!answered) return "Crítica";
  if (evaluated && !resolved) return "Alta";
  if (evaluated && score !== null && score <= 4)
    return "Alta";
  if (!evaluated) return "Média";
  return "Baixa";
}

const cases = rows.map((row, index) => {
  const created = toDate(row[col("Data Reclamação")]);
  const answeredAt = toDate(row[col("Data de Resposta")]);
  const evaluatedAt = toDate(row[col("Data Avaliacao")]);

  const rawScore = row[col("Nota")];
  const score =
    rawScore === null || rawScore === ""
      ? null
      : Number(rawScore);

  const evaluated = score !== null;
  const answered = Boolean(answeredAt);

  const resolved =
    row[col("Seu problema foi resolvido?")] === "Sim";

  const wouldDoBusiness =
    row[col("Voltaria a fazer negócio?")] === "Sim";

  const statusRa = row[col("Status RA")];
  const status = mapStatus(statusRa);

  const { categoria, subcategoria } = classificar(
    row[col("Título")]
  );

  const name = String(row[col("Nome")] || "").trim();

  return {
    id: String(row[col("Id HugMe")] || index + 1),
    protocol: `RA-${row[col("Id HugMe")]}`,
    // O export não traz o estabelecimento: o reclamante é o cliente.
    company: name || "Não informado",
    customer: name || "Não informado",
    email: maskEmail(row[col("Email")]),
    phone: maskPhone(row[col("Telefones")]),
    city: row[col("Cidade")] || null,
    state: row[col("Estado")] || null,
    source: "Reclame Aqui",
    // O export vem sem classificação: derivada do título por palavra-chave.
    category: categoria,
    subcategory: subcategoria,
    priority: priorityOf({
      score,
      resolved,
      evaluated,
      answered,
    }),
    status,
    owner: null,
    department: null,
    title:
      String(row[col("Título")] || "Sem título").trim(),
    description: `Reclamação registrada no Reclame Aqui em ${toIso(
      row[col("Data Reclamação")]
    )}. Status no portal: ${statusRa || "—"}.`,
    publicResponse: answered
      ? "Resposta pública registrada no portal."
      : "",
    score,
    evaluated,
    resolved,
    wouldDoBusiness,
    responseTime: elapsed(created, answeredAt),
    solutionTime: elapsed(created, evaluatedAt),
    sla: resolved ? "Concluído" : "48h",
    createdAt: toIso(row[col("Data Reclamação")]),
    updatedAt:
      toIso(row[col("Data Avaliacao")]) ||
      toIso(row[col("Data de Resposta")]) ||
      toIso(row[col("Data Reclamação")]),
    lastInteraction:
      toIso(row[col("Data Avaliacao")]) ||
      toIso(row[col("Data de Resposta")]) ||
      toIso(row[col("Data Reclamação")]),
    churnRisk:
      evaluated && !resolved && !wouldDoBusiness,
    tags: [],
  };
});

// Etiquetas coerentes com o estado real do caso.
for (const item of cases) {
  const tags = [];

  if (!item.publicResponse) tags.push("Aguardando área interna");
  if (item.resolved && !item.evaluated)
    tags.push("Favorável a avaliação");
  if (item.evaluated && item.score >= 9)
    tags.push("Possível avaliação positiva");
  if (item.churnRisk) tags.push("Risco de nota baixa");

  item.tags = tags;
}

cases.sort((a, b) =>
  (b.createdAt || "").localeCompare(a.createdAt || "")
);

function serialize(item) {
  const lines = [];

  const push = (key, value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      lines.push(`    ${key}: ${JSON.stringify(value)},`);
      return;
    }
    lines.push(
      `    ${key}: ${
        typeof value === "string"
          ? JSON.stringify(value)
          : value
      },`
    );
  };

  push("id", item.id);
  push("protocol", item.protocol);
  push("company", item.company);
  push("customer", item.customer);
  push("email", item.email);
  push("phone", item.phone);
  push("city", item.city);
  push("state", item.state);
  push("source", item.source);
  push("category", item.category);
  push("subcategory", item.subcategory);
  push("priority", item.priority);
  push("status", item.status);
  push("owner", item.owner);
  push("department", item.department);
  if (item.churnRisk) push("churnRisk", true);
  push("title", item.title);
  push("description", item.description);
  push("publicResponse", item.publicResponse);
  if (item.score !== null) push("score", item.score);
  push("evaluated", item.evaluated);
  push("resolved", item.resolved);
  push("wouldDoBusiness", item.wouldDoBusiness);
  push("responseTime", item.responseTime);
  push("solutionTime", item.solutionTime);
  push("sla", item.sla);
  push("createdAt", item.createdAt);
  push("updatedAt", item.updatedAt);
  push("lastInteraction", item.lastInteraction);
  push("tags", item.tags);

  return `  {\n${lines.join("\n")}\n  },`;
}

const first = cases[cases.length - 1]?.createdAt;
const last = cases[0]?.createdAt;

const output = `import { Case } from "@/lib/models/case";

/**
 * Base real exportada do Reclame Aqui (HugMe) — ${cases.length} reclamações
 * de ${first} a ${last}.
 *
 * Gerado por scripts/import-reclame-aqui.js.${
   keepPii
     ? ""
     : "\n * E-mail e telefone estão mascarados e o CPF foi descartado:\n * este arquivo é versionado no git."
 }
 *
 * O export não traz classificação nem estabelecimento — categoria fica
 * como "Não classificado" e o reclamante é tratado como o cliente.
 */
export const mockCases: Case[] = [
${cases.map(serialize).join("\n")}
];
`;

const target = path.join(
  process.cwd(),
  "lib/data/mockCases.ts"
);

fs.writeFileSync(target, output);

const answered = cases.filter(
  (item) => item.publicResponse
).length;
const evaluated = cases.filter(
  (item) => item.evaluated
).length;
const resolved = cases.filter(
  (item) => item.resolved
).length;

console.log(`Importadas ${cases.length} reclamações.`);
console.log(`Período: ${first} → ${last}`);
console.log(
  `Respondidas: ${answered} | Avaliadas: ${evaluated} | Resolvidas: ${resolved}`
);
console.log(
  keepPii
    ? "ATENÇÃO: dados pessoais gravados sem máscara."
    : "E-mail/telefone mascarados, CPF descartado."
);
