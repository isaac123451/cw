/**
 * O `vercel.json` é válido para a Vercel?
 *
 *   npm run check:vercel
 *
 * **O estrago que isto existe para não deixar acontecer de novo.** Em
 * 03/09/2026 eu acrescentei um bloco de comentário ao `vercel.json`,
 * numa chave `"//"` — a convenção que se usa em JSON, que não tem
 * comentário. O schema da Vercel declara `additionalProperties: false`:
 * qualquer chave que ele não conheça **invalida o arquivo e derruba o
 * build**.
 *
 * O resultado foi o pior tipo de falha:
 *
 * - três deploys seguidos com Error, do dia 3 ao dia 9;
 * - a Vercel continuou servindo a versão anterior, sem avisar ninguém;
 * - a produção ficou seis dias rodando código velho — sem a carga 5×
 *   mais rápida, sem a região de São Paulo, sem nada do que foi feito
 *   depois;
 * - e o sintoma chegou ao Isaac como **"os dados não carregam"**, três
 *   vezes, enquanto tudo que dava para medir daqui estava certo: o
 *   banco de pé, o código compilando, os imports em ordem.
 *
 * Um arquivo de configuração inválido não avisa em lugar nenhum do
 * fluxo de trabalho local. `tsc` não olha, o `next build` não olha, o
 * lint não olha. Só a Vercel olha — e ela olha tarde, do outro lado do
 * push.
 *
 * Esta conferência traz esse olhar para cá: baixa o schema oficial e
 * valida o arquivo contra ele, com o mesmo rigor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const ENDERECO_DO_SCHEMA =
  "https://openapi.vercel.sh/vercel.json";

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

interface Schema {
  properties?: Record<string, unknown>;
  additionalProperties?: boolean;
}

async function main() {

  console.log(
    "\n  VERCEL.JSON — a Vercel aceita este arquivo?\n"
  );

  const bruto = readFileSync(
    resolve(RAIZ, "vercel.json"),
    "utf8"
  );

  /* ---------------- 1. é JSON? ---------------- */

  let config: Record<string, unknown>;

  try {
    config = JSON.parse(bruto) as Record<string, unknown>;
    ok(
      "o arquivo é JSON válido",
      `${Object.keys(config).length} chave(s)`
    );
  } catch (erro) {
    falhar(
      "o arquivo é JSON válido",
      erro instanceof Error ? erro.message : String(erro)
    );
    process.exitCode = 1;
    return;
  }

  /* ---------------- 2. as chaves existem? ---------------- */

  let schema: Schema;

  try {

    const r = await fetch(ENDERECO_DO_SCHEMA, {
      signal: AbortSignal.timeout(20_000),
    });

    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    schema = (await r.json()) as Schema;

  } catch (erro) {

    /*
      Sem rede, a conferência não inventa um veredito.

      Dizer "ok" aqui seria pior que não conferir: daria a garantia sem
      ter olhado, que é exatamente o tipo de verde que deixou o build
      quebrado por seis dias.
    */
    console.log(
      [
        "  --     não consegui baixar o schema da Vercel",
        `         ${erro instanceof Error ? erro.message : erro}`,
        "         Sem ele não dá para validar as chaves. Rode com rede antes",
        "         de empurrar mudança no vercel.json.",
        "",
      ].join("\n")
    );
    return;
  }

  const conhecidas = new Set(
    Object.keys(schema.properties ?? {})
  );

  const desconhecidas = Object.keys(config).filter(
    (chave) => !conhecidas.has(chave)
  );

  if (schema.additionalProperties === false) {

    if (desconhecidas.length === 0) {
      ok(
        "toda chave é conhecida pela Vercel",
        `o schema recusa chave estranha (additionalProperties: false), e não há nenhuma`
      );
    } else {
      falhar(
        "toda chave é conhecida pela Vercel",
        [
          `chave(s) que a Vercel não conhece: ${desconhecidas.map((c) => `"${c}"`).join(", ")}`,
          "",
          "         O schema declara additionalProperties: false — qualquer chave",
          "         a mais **invalida o arquivo e derruba o build**. Foi assim que",
          '         uma chave "//" de comentário deixou a produção seis dias no ar',
          "         com código velho, servindo o último deploy que deu certo.",
          "",
          "         JSON não tem comentário. A explicação vai para o ROADMAP.",
        ].join("\n")
      );
    }
  }

  /* ---------------- 3. os limites do plano ---------------- */

  const regioes = config.regions;

  if (Array.isArray(regioes)) {

    if (regioes.length === 1) {
      ok(
        "uma região só, como o plano Hobby permite",
        `${regioes[0]}`
      );
    } else {
      falhar(
        "uma região só, como o plano Hobby permite",
        `${regioes.length} regiões declaradas. No Hobby, mais de uma faz o deploy falhar antes do build.`
      );
    }
  }

  const crons = config.crons;

  if (Array.isArray(crons)) {

    /**
     * O Hobby aceita duas rotinas, e uma execução por dia cada.
     *
     * Passar disso não é um aviso: o deploy falha. E falha do mesmo
     * jeito silencioso — a versão anterior continua no ar.
     */
    if (crons.length <= 2) {
      ok(
        "no máximo duas rotinas agendadas",
        `${crons.length} declarada(s)`
      );
    } else {
      falhar(
        "no máximo duas rotinas agendadas",
        `${crons.length} declaradas; o plano Hobby aceita 2.`
      );
    }
  }

  console.log(
    falhas === 0
      ? "\n  A Vercel aceita este arquivo.\n"
      : `\n  ${falhas} ponto(s) a corrigir — o deploy vai falhar assim.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
