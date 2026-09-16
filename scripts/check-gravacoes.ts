/**
 * Toda gravação diz o que aconteceu?
 *
 *   npm run check:gravacoes
 *
 * **O defeito.** As ações de cadastro devolviam nada e, quando algo dava
 * errado, lançavam exceção. Em desenvolvimento a mensagem chegava à
 * tela; em produção o Next a esconde, e a tela só podia chutar "sessão
 * expirada ou sem permissão" — para um nome repetido, para uma etiqueta
 * em uso que não pode ser excluída, para um registro que outra pessoa
 * já tinha apagado. E "criar reclamação" dizia "criada" antes de o
 * servidor responder.
 *
 * Esta conferência prova as três metades:
 *
 * 1. **nenhuma ação de escrita devolve nada** — ou ela responde
 *    `{ ok }`, ou devolve um valor que quem chama usa (e está na lista
 *    de exceções, com o motivo);
 * 2. **a tela lê a recusa** — o `sincronizar` trata `{ ok: false }` como
 *    falha, e não como sucesso;
 * 3. **o erro previsto vira frase** — cada falha conhecida do Prisma e a
 *    falta de permissão saem com a frase certa.
 *
 * Roda sem servidor. A condição `react-server` é o que deixa importar o
 * serviço marcado `server-only` fora do Next.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Prisma } from "@prisma/client";

import { SemPermissao } from "../lib/auth/guard";
import { comResultado, ErroPrevisto, traduzirFalha } from "../lib/services/gravacao";
import { recusou } from "../lib/models/resultadoDaGravacao";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, passou: boolean, detalhe = "") {
  if (!passou) falhas += 1;
  console.log(`  ${passou ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${detalhe.slice(0, 60)}`);
}

/* ============================================================
   1. NENHUMA AÇÃO DE ESCRITA DEVOLVE NADA
============================================================ */

const ESCRITA =
  /^(save|create|update|delete|remove|limpar|salvar|excluir|registrar|gravar|marcar|encerrar|reabrir|vincular|desvincular|importar|aplicar|responder|anotar|concluir|guardar|definir|assumir|classificar|unificar|renomear|confirmar|cancelar|toggle|set|add|move|apagar)/i;

/**
 * As que devolvem um valor que quem chama **usa** — id criado, nota
 * gravada, "está em uso". Mudar o formato delas é mudar cada tela que as
 * chama; ficam aqui, com o motivo, até alguém fazer isso. Uma ação nova
 * que devolva nada não tem lugar nesta lista: tem de responder `{ ok }`.
 */
const DEVOLVEM_VALOR: Record<string, string> = {
  addCaseNote: "a anotação criada entra na lista da tela",
  saveNpsRootCause: "o id da causa criada",
  removeNpsRootCause: "quantos registros usam a causa (desativa em vez de apagar)",
  saveNpsStage: "o id da etapa criada",
  saveNpsKind: "o id do tipo criado",
  removeNpsStage: "a contagem de uso",
  removeNpsKind: "a contagem de uso",
  savePlan: "o id do plano criado",
  saveSavedFilter: "o id do filtro criado",
  saveWebhookConfig: "a configuração gravada, com o segredo",
};

console.log("\n  GRAVAÇÕES — toda escrita diz o que aconteceu\n");
console.log("— Nenhuma ação de escrita devolve nada —\n");

const pasta = join(RAIZ, "lib/actions");

let conferidas = 0;
const mudas: string[] = [];

for (const nome of readdirSync(pasta).filter((n) => n.endsWith(".ts"))) {

  const fonte = readFileSync(join(pasta, nome), "utf8");

  if (!/^\s*["']use server["']/.test(fonte)) continue;

  /* Cada `export async function nome(...) ... {` até o `}` da coluna 0. */
  const blocos = fonte.split(/\r?\n(?=export )/);

  for (const bloco of blocos) {

    const cabeca = bloco.match(/^export async function (\w+)\s*\(/);
    if (!cabeca) continue;

    const funcao = cabeca[1];
    if (!ESCRITA.test(funcao)) continue;

    conferidas += 1;

    /*
      O fim do corpo é o `}` sozinho na coluna 0 — e não o `})` que fecha
      o tipo dos parâmetros (`entrada: { ... }): Promise<...>`), que também
      começa na coluna 0. Confundir os dois cortava a função antes do tipo
      de retorno, e 25 ações que respondem `{ ok }` pareciam mudas.
    */
    const fim = bloco.search(/\r?\n\}(?![)\]])/);
    const corpo = fim > 0 ? bloco.slice(0, fim) : bloco;

    const respondeOk =
      /comResultado\(/.test(corpo) ||
      /\bok\s*:\s*(true|false)/.test(corpo) ||
      /Promise<[^>]*(ResultadoDaGravacao|Falha|Gravacao|\{\s*erro|ok\s*:)/.test(corpo);

    const devolveValor = /\breturn\s+[^;\s]/.test(corpo);

    if (respondeOk) continue;

    if (devolveValor && DEVOLVEM_VALOR[funcao]) continue;

    mudas.push(`${nome}:${funcao}`);
  }
}

conferir(
  `${conferidas} ações de escrita conferidas`,
  mudas.length === 0,
  mudas.length ? `${mudas.length} sem { ok }:` : "todas respondem { ok } ou estão na lista"
);

for (const muda of mudas) console.log(`          ${muda}`);

/*
  Item novo tem de ser reconhecido como novo.

  As telas de cadastro dão ao item acrescentado um id "novo-…" até ele
  ser gravado. A causa raiz do NPS só reconhecia "padrao-…" como novo,
  tentava **atualizar** um registro que não existia e estourava — era o
  "dá erro ao salvar causa raiz". Toda gravação que decide "criar ou
  atualizar" pelo prefixo tem de conhecer os dois.
*/
{
  const decidem: string[] = [];
  const esquecem: string[] = [];

  for (const base of ["lib/actions", "lib/services"]) {
    for (const nome of readdirSync(join(RAIZ, base)).filter((n) => n.endsWith(".ts"))) {
      const fonte = readFileSync(join(RAIZ, base, nome), "utf8");
      for (const m of fonte.matchAll(/const novo\s*=[\s\S]{0,400}?;/g)) {
        if (!/padrao-/.test(m[0])) continue;
        decidem.push(`${base}/${nome}`);
        if (!/novo-/.test(m[0])) esquecem.push(`${base}/${nome}`);
      }
    }
  }

  conferir(
    `${decidem.length} gravação(ões) que decidem criar pelo id reconhecem "novo-"`,
    esquecem.length === 0,
    esquecem.join(", ")
  );
}

/* ============================================================
   2. A TELA LÊ A RECUSA
============================================================ */

console.log("\n— A tela trata recusa como falha —\n");

{
  const sync = readFileSync(join(RAIZ, "lib/context/sync.ts"), "utf8");

  conferir(
    "o sincronizar lê { ok: false } do que voltou",
    /recusou\(resposta\)/.test(sync),
    "sem isto, uma recusa seria contada como sucesso"
  );

  const caso = readFileSync(join(RAIZ, "lib/context/CaseContext.tsx"), "utf8");

  conferir(
    "criar reclamação devolve o resultado",
    /async function createCase\(data: Case\): Promise<Gravacao>/.test(caso),
    ""
  );

  conferir(
    "e tira da lista o caso que o servidor recusou",
    /if \(!resultado\.ok\) \{\s*setCases\(\(prev\) => prev\.filter/.test(caso),
    ""
  );

  const formulario = readFileSync(join(RAIZ, "components/forms/NewCaseForm.tsx"), "utf8");

  conferir(
    'o formulário só diz "criada" depois do servidor',
    formulario.indexOf("await createCase(novo)") > -1 &&
      formulario.indexOf("await createCase(novo)") < formulario.indexOf("criada."),
    ""
  );

  for (const [arquivo, trecho] of [
    ["components/reclame-aqui/modals/CreateCaseModal.tsx", "if (resultado.ok) onClose();"],
    ["app/redes-sociais/page.tsx", "if (!resultado.ok) return;"],
  ] as const) {
    conferir(
      `${arquivo.split("/").slice(-2).join("/")} fecha só se aceitou`,
      readFileSync(join(RAIZ, arquivo), "utf8").includes(trecho),
      ""
    );
  }
}

/* ============================================================
   3. O ERRO PREVISTO VIRA FRASE
============================================================ */

console.log("\n— O erro previsto vira frase —\n");

function erroDoPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError("falha simulada", {
    code,
    clientVersion: "teste",
  });
}

const CASOS: [string, unknown, RegExp][] = [
  ["sem permissão", new SemPermissao("Seu acesso é somente leitura."), /somente leitura/],
  ["nome repetido (P2002)", erroDoPrisma("P2002"), /Já existe/],
  ["em uso por outro registro (P2003)", erroDoPrisma("P2003"), /em uso/],
  ["já excluído por outra pessoa (P2025)", erroDoPrisma("P2025"), /não existe mais/],
  ["texto comprido demais (P2000)", erroDoPrisma("P2000"), /tamanho/],
  ["erro que a própria ação decidiu lançar", new ErroPrevisto("Informe o nome."), /Informe o nome/],
];

for (const [titulo, erro, esperado] of CASOS) {
  const frase = traduzirFalha(erro) ?? "";
  conferir(titulo, esperado.test(frase), frase);
}

conferir(
  "erro desconhecido não é traduzido (vai para o log)",
  traduzirFalha(new Error("ECONNRESET interno")) === null,
  ""
);

async function executar() {

  const aceita = await comResultado("teste", async () => undefined);
  conferir("gravação que dá certo responde { ok: true }", aceita.ok === true, JSON.stringify(aceita));

  const recusada = await comResultado("teste", async () => {
    throw erroDoPrisma("P2002");
  });
  conferir(
    "gravação recusada responde a frase, não lança",
    recusou(recusada) && /Já existe/.test(recusada.erro),
    recusou(recusada) ? recusada.erro : JSON.stringify(recusada)
  );

  /* O imprevisto também não lança — e não vaza o texto interno. */
  const originalError = console.error;
  console.error = () => undefined;
  const imprevista = await comResultado("teste", async () => {
    throw new Error("detalhe interno: senha=123");
  });
  console.error = originalError;

  conferir(
    "o imprevisto responde uma frase honesta, sem detalhe interno",
    recusou(imprevista) && !/senha/.test(imprevista.erro),
    recusou(imprevista) ? imprevista.erro : ""
  );

  console.log(
    falhas === 0
      ? "\n  Toda gravação diz o que aconteceu — inclusive quando não aconteceu.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

void executar();
