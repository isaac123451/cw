/**
 * Nenhuma vulnerabilidade conhecida em dependência de produção.
 *
 *   npm run check:dependencias
 *
 * Rodou pela primeira vez em 23/08 e encontrou **18** — nada disso
 * aparece em `tsc`, `lint` ou teste: é código de terceiro, e o único
 * jeito de saber é perguntar ao registro.
 *
 * Onze saíram com `npm audit fix`, três com `next@16.3.2`, e uma
 * mereceu decisão: o **`xlsx`** do npm está congelado na 0.18.5 com
 * *prototype pollution* conhecido e **sem correção publicada lá**. Não
 * é teórico — esta aplicação lê planilha que a operação envia, e é
 * exatamente esse o caminho. A versão mantida vive no CDN do próprio
 * SheetJS, e é de lá que ela passou a vir.
 *
 * **As três que sobram são um artefato do `npm audit`.** Ele oferece
 * como "correção" para a cadeia do CLI do Prisma a versão **6.12.0** —
 * que é anterior à 7 que a aplicação usa, com `prisma.config.ts` e
 * adapters. Aceitar essa sugestão quebraria o banco inteiro para
 * resolver um aviso sobre código que **não roda em produção**: o CLI do
 * Prisma é ferramenta de linha de comando.
 *
 * Por isso o teto é por severidade e com exceção nomeada, em vez de
 * "zero vulnerabilidades" — um teto impossível vira um check que
 * alguém desliga.
 */
import { execFileSync } from "node:child_process";

/**
 * Pacotes cuja correção oferecida é pior que o problema.
 *
 * Cada linha custa uma decisão consciente e traz a data — se em algum
 * momento o Prisma publicar correção na linha 7, isto sai daqui.
 */
const ACEITAS: Record<string, string> = {
  prisma:
    "npm sugere prisma@6.12.0, anterior à 7 que a aplicação usa. CLI, não roda em produção. (23/08/2026)",
  "@prisma/config":
    "Dependência do CLI do Prisma; mesma situação. (23/08/2026)",
  "deepmerge-ts":
    "Puxada pelo CLI do Prisma ao ler a configuração; não está no caminho de consulta. (23/08/2026)",
};

interface Auditoria {
  metadata?: {
    vulnerabilities?: Record<string, number>;
  };
  vulnerabilities?: Record<
    string,
    { severity: string; fixAvailable: unknown }
  >;
}

console.log("\n  DEPENDÊNCIAS DE PRODUÇÃO\n");

let bruto = "";

try {
  bruto = execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["audit", "--omit=dev", "--json"],
    { encoding: "utf8", shell: process.platform === "win32" }
  );
} catch (erro) {
  /**
   * `npm audit` sai com código 1 quando **acha** algo.
   *
   * O relatório vem na saída padrão do mesmo jeito — tratar o código de
   * saída como falha de execução faria o script morrer justamente
   * quando tem o que dizer.
   */
  bruto =
    (erro as { stdout?: string }).stdout ?? "";
}

if (!bruto.trim()) {
  console.error(
    "  Não consegui falar com o registro do npm — sem rede?\n"
  );
  process.exit(1);
}

const auditoria = JSON.parse(bruto) as Auditoria;

const contagem = auditoria.metadata?.vulnerabilities ?? {};

const achadas = Object.entries(
  auditoria.vulnerabilities ?? {}
);

const naoAceitas = achadas.filter(
  ([nome]) => !(nome in ACEITAS)
);

for (const [nome, info] of achadas) {

  const aceita = ACEITAS[nome];

  console.log(
    `${aceita ? "  --  " : "FALHA "} ${info.severity.padEnd(9)} ${nome.padEnd(18)} ${aceita ?? "sem justificativa"}`
  );
}

console.log(
  `\n  ${achadas.length} pacote(s) com aviso · ${Object.keys(ACEITAS).length} aceito(s) com motivo escrito`
);

console.log(
  `  severidades: ${JSON.stringify(contagem)}`
);

console.log(
  naoAceitas.length === 0
    ? "\n  Nada em produção sem correção ou sem decisão registrada.\n"
    : `\n  ${naoAceitas.length} pacote(s) precisam de decisão.\n`
);

process.exit(naoAceitas.length === 0 ? 0 : 1);
