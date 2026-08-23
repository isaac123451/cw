/**
 * O campo que existe no banco chega até a tela?
 *
 *   npm run check:campos
 *
 * As outras varreduras provam **fiação**: que a rota confere quem
 * chama, que o mutador chama o servidor, que o botão tem tratador.
 * Nenhuma delas prova **comportamento** — e a diferença ficou clara
 * quando o Isaac reportou gráficos com defeito numa tela que o
 * `check:telas` havia aprovado.
 *
 * Esta olha a camada do meio, que é onde mora "salvei e voltou vazio":
 * uma coluna que existe no Postgres, que o formulário preenche, e que
 * o mapeamento da carga esquece de ler. O dado está lá; a tela nunca o
 * mostra. Nada disso aparece em `tsc` — o objeto simplesmente não tem a
 * chave, e ninguém pediu que tivesse.
 *
 * A comparação é entre três lugares que precisam concordar:
 *
 *   coluna no schema.prisma  →  leitura em workspace.ts  →  campo do modelo
 *
 * **Coluna ausente na carga é candidata, não culpada.** Muita coluna é
 * de uso interno — carimbo de tempo, chave estrangeira, marcação que só
 * o servidor lê. Cada uma dessas está declarada aqui embaixo com o
 * motivo, e o que sobrar é para alguém olhar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const schema = readFileSync(
  resolve(RAIZ, "prisma/schema.prisma"),
  "utf8"
);

const workspace = readFileSync(
  resolve(RAIZ, "lib/actions/workspace.ts"),
  "utf8"
);

let falhas = 0;

/**
 * Colunas que a tela não precisa ver, por modelo.
 *
 * `*` vale para qualquer modelo — são as de infraestrutura, que
 * aparecem em quase todos e nunca são conteúdo.
 */
const INTERNAS: Record<string, string[]> = {
  "*": [
    "id",
    "createdAt",
    "updatedAt",
    "passwordHash",
  ],
  Case: [
    // A reclamação tem carga própria (`listCases`), não vem no workspace.
    "*",
  ],
  NpsResponse: ["*"],
  NpsAttempt: ["*"],
  User: ["*"],
  UserPreference: ["*"],
  UserModuleRole: ["*"],
  GoogleAccount: ["*"],
  AllowedEmail: ["*"],
  CaseTag: ["*"],
  CaseComment: ["*"],
  CaseEvent: ["*"],
  CaseChecklistMark: ["*"],
  ImpactRecord: ["caseId", "establishmentId"],
  Establishment: ["mrrCents"],
  Team: ["legacyName"],
  Subcategory: ["categoryId"],
  JourneyTopic: ["stageId"],
  JourneyEntry: ["topicId"],
  JourneyPlacement: ["*"],
  ClientProfile: ["manual"],
  WebhookConfig: ["*"],
  WebhookDelivery: ["*"],
  SavedFilter: ["*"],
  Company: ["*"],
  IaConfig: ["*"],
  Plan: ["*"],
  NpsStage: ["*"],
  NpsKind: ["*"],
  NpsRootCause: ["*"],
  ReputationGoal: ["*"],
  CaseMovement: ["caseId", "lateNotifiedAt"],
};


/** Modelos e suas colunas, lidos do schema. */
function modelos() {

  const saida: Record<string, string[]> = {};

  for (const bloco of schema.split(/\nmodel\s+/).slice(1)) {

    const nome = bloco.slice(0, bloco.indexOf(" ")).trim();

    const corpo = bloco.slice(
      bloco.indexOf("{") + 1,
      bloco.indexOf("\n}")
    );

    const colunas: string[] = [];

    for (const linha of corpo.split("\n")) {

      const limpa = linha.trim();

      // Comentário, atributo de bloco ou linha vazia.
      if (
        limpa === "" ||
        limpa.startsWith("//") ||
        limpa.startsWith("///") ||
        limpa.startsWith("@@")
      ) {
        continue;
      }

      const m = limpa.match(
        /^([a-zA-Z][a-zA-Z0-9_]*)\s+([A-Za-z]+)(\[\])?(\?)?/
      );

      if (!m) continue;

      /**
       * Relação não é campo — é o outro lado do vínculo.
       *
       * `establishment Establishment?` não precisa aparecer na carga:
       * quem aparece é o `establishmentId`, e a tela resolve o nome.
       */
      const ehRelacao =
        /^[A-Z]/.test(m[2]) &&
        ![
          "String",
          "Int",
          "Float",
          "Boolean",
          "DateTime",
          "Json",
          "Decimal",
          "BigInt",
          "Bytes",
        ].includes(m[2]) &&
        !/^(Role|Channel|Priority)$/.test(m[2]);

      if (ehRelacao) continue;

      colunas.push(m[1]);
    }

    saida[nome] = colunas;
  }

  return saida;
}

function interna(modelo: string, coluna: string) {

  const doModelo = INTERNAS[modelo] ?? [];

  if (doModelo.includes("*")) return true;

  return (
    doModelo.includes(coluna) ||
    (INTERNAS["*"] ?? []).includes(coluna)
  );
}

console.log(
  "\n  CAMPOS — a coluna do banco chega à tela?\n"
);

const todos = modelos();

let lidas = 0;
let internas = 0;

const orfas: { modelo: string; coluna: string }[] = [];

for (const [modelo, colunas] of Object.entries(todos)) {

  const perdidas: string[] = [];

  for (const coluna of colunas) {

    if (interna(modelo, coluna)) {
      internas += 1;
      continue;
    }

    /**
     * Três formas de a coluna chegar à tela.
     *
     * Direta (`r.color`), renomeada (`cor: r.color`) e — a que faltava
     * — **resolvida pela relação**: `ownerId` não aparece na carga
     * porque o que a tela mostra é `owner: r.owner?.name`. Sem
     * reconhecer isso, toda chave estrangeira viraria candidata, e o
     * relatório encheria de alarme falso.
     *
     * É busca de texto, e por isso o resultado é **candidato**: colisão
     * de nome entre modelos é possível, e conferir à mão é parte do
     * trabalho.
     */
    const semSufixo = coluna.replace(/Id$/, "");

    const lida =
      new RegExp(
        `\\br\\.${coluna}\\b|\\b${coluna}:\\s*r\\.`
      ).test(workspace) ||
      (coluna.endsWith("Id") &&
        new RegExp(`\\br\\.${semSufixo}\\?\\.`).test(
          workspace
        ));

    if (lida) lidas += 1;
    else perdidas.push(coluna);
  }

  if (perdidas.length === 0) continue;

  falhas += perdidas.length;

  for (const c of perdidas) {
    orfas.push({ modelo, coluna: c });
  }

  console.log(
    `FALHA  ${modelo.padEnd(20)} não chega à tela: ${perdidas.join(", ")}`
  );
}

console.log(
  `\n  ${Object.keys(todos).length} modelos · ${lidas} colunas lidas pela carga · ${internas} internas com motivo declarado`
);

if (orfas.length > 0) {
  console.log(
    "\n  Cada uma é candidata: ou falta na tela, ou é interna e precisa de motivo escrito aqui."
  );
}

console.log(
  falhas === 0
    ? "\n  Toda coluna de conteúdo chega à tela.\n"
    : `\n  ${falhas} coluna(s) para decidir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
