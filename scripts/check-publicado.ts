/**
 * O que está no ar tem tudo que a extensão chama?
 *
 *   npm run check:publicado
 *   CW_PRODUCAO=https://outro-endereco npm run check:publicado
 *
 * **O buraco que isto fecha.** `check:fiacao` confere que cada rota que
 * a extensão chama existe **no repositório**. `check:extensao` prova o
 * contrato contra a aplicação **rodando aqui**. Nenhum dos dois olha
 * para o que está publicado — e é exatamente ali que a extensão e a
 * aplicação se encontram no dia a dia.
 *
 * O sintoma dessa lacuna, em 09/09/2026: o botão "Respostas rápidas"
 * aparecia no WhatsApp, abria, e a lista vinha com erro. Tudo daqui
 * estava certo — a rota existia, os testes passavam, o build subia. O
 * que faltava era um `git push`: a extensão, que é carregada da pasta
 * local, já chamava uma rota que a produção ainda não tinha. E a
 * mensagem na tela era "A aplicação respondeu 404.".
 *
 * A extensão sempre anda na frente do que está publicado, porque ela
 * roda do disco e a aplicação roda de um deploy. Esta conferência mede
 * essa distância antes de alguém descobri-la com o cliente na linha.
 *
 * **Só leitura, e sem sessão.** O que se pergunta é "esta rota existe
 * aí?", e para isso 401 é uma resposta tão boa quanto 200: as duas
 * dizem que o arquivo está publicado. 404 é a única que responde não.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

/**
 * O endereço de produção, na ordem em que dá para descobri-lo.
 *
 * O `DEPLOY.md` entra na lista porque é onde ele está escrito por
 * extenso — e porque `NEXT_PUBLIC_APP_URL` costuma apontar para
 * `localhost` no `.env` de quem desenvolve, que é o valor certo lá e o
 * errado aqui.
 */
function enderecoDeProducao() {
  const doAmbiente =
    process.env.CW_PRODUCAO ??
    (process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")
      ? undefined
      : process.env.NEXT_PUBLIC_APP_URL);

  if (doAmbiente) {
    return doAmbiente.replace(/\/$/, "");
  }

  try {
    const deploy = readFileSync(
      resolve(RAIZ, "DEPLOY.md"),
      "utf8"
    );

    const achado = deploy.match(
      /https:\/\/[a-z0-9-]+\.vercel\.app/i
    );

    if (achado) return achado[0];
  } catch {
    /* Sem DEPLOY.md, cai no aviso abaixo. */
  }

  return "";
}

/** Os caminhos que a extensão chama, lidos do próprio service worker. */
function caminhosDaExtensao() {
  const worker = readFileSync(
    resolve(RAIZ, "extensao/fundo/service-worker.js"),
    "utf8"
  );

  const bloco = worker.match(
    /const CAMINHOS = \{([\s\S]*?)\};/
  );

  if (!bloco) return [];

  return [
    ...bloco[1].matchAll(/"(\/api\/[a-z0-9/-]+)"/g),
  ].map((m) => m[1]);
}

let falhas = 0;

async function main() {
  console.log(
    "\n  PUBLICADO — a produção tem o que a extensão chama?\n"
  );

  const base = enderecoDeProducao();

  if (!base) {
    console.log(
      [
        "  --     não achei o endereço de produção",
        "         Passe um: CW_PRODUCAO=https://... npm run check:publicado",
        "",
      ].join("\n")
    );
    return;
  }

  const caminhos = caminhosDaExtensao();

  if (caminhos.length === 0) {
    console.log(
      "FALHA    não consegui ler CAMINHOS do service worker\n"
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `  Contra ${base} — ${caminhos.length} rota(s).\n`
  );

  const faltando: string[] = [];

  for (const caminho of caminhos) {
    let situacao = "";
    let existe = false;

    try {
      const r = await fetch(base + caminho, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });

      /**
       * 404 é a única resposta que quer dizer "não está publicada".
       *
       * 401 e 403 dizem que a rota existe e recusou por falta de
       * sessão — que é o esperado, já que esta conferência não manda
       * nenhuma. 405 diz que existe e só aceita POST.
       */
      existe = r.status !== 404;

      situacao = `${r.status}`;
    } catch (erro) {
      situacao =
        erro instanceof Error ? erro.message : String(erro);
      existe = false;
    }

    if (existe) {
      console.log(
        `  ok     ${caminho.padEnd(34)} ${situacao}`
      );
    } else {
      faltando.push(caminho);
      console.log(
        `FALHA    ${caminho.padEnd(34)} ${situacao}`
      );
    }
  }

  if (faltando.length > 0) {
    falhas = faltando.length;

    console.log(
      [
        "",
        `  ${faltando.length} rota(s) que a extensão chama e a produção não tem.`,
        "",
        "  A extensão roda do disco e a aplicação roda de um deploy — então",
        "  ela anda na frente sempre que algo é feito e não é publicado.",
        "  Falta um `git push`, ou o deploy falhou (`npm run check:vercel`).",
        "",
      ].join("\n")
    );
  } else {
    console.log(
      "\n  A produção atende todas as rotas da extensão.\n"
    );
  }

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
