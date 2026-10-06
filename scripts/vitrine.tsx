/**
 * A vitrine: um componente da aplicação desenhado fora dela.
 *
 * Para conferir o visual de uma peça sem login e sem banco — renderiza no
 * servidor (React) e embrulha com o CSS que o `next dev` está servindo, que
 * é o Tailwind compilado de verdade. O resultado vai para `.bancada/`
 * (ignorada pelo git) e abre em qualquer navegador.
 *
 *   CW_BASE=http://localhost:3200 npx tsx scripts/vitrine.tsx novidades
 *
 * Só leitura: nenhum dado de ninguém, nenhuma rota tocada além do CSS.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

import RevisaoGeral from "../components/novidades/RevisaoGeral";

const base = (process.env.CW_BASE ?? "http://localhost:3000").replace(/\/$/, "");

const PECAS: Record<string, () => React.ReactElement> = {
  novidades: () => <RevisaoGeral novas={new Set(["ext-caso-a-caso", "ext-numeros-nas-abas"])} />,
};

async function main() {
  const qual = process.argv[2] ?? "novidades";
  const peca = PECAS[qual];
  if (!peca) throw new Error(`Peça desconhecida: ${qual}. Há: ${Object.keys(PECAS).join(", ")}`);

  const html = await fetch(`${base}/login`).then((r) => r.text());
  const folhas = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => `${base}${m[1]}`);
  /* Embutido: aberto de arquivo, o navegador não busca a folha na outra origem. */
  const css = (await Promise.all(folhas.map((u) => fetch(u).then((r) => r.text())))).join("\n");

  const pagina = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
</head><body class="bg-zinc-50"><main class="mx-auto max-w-4xl p-6">${renderToStaticMarkup(peca())}</main></body></html>`;

  const pasta = resolve(__dirname, "..", ".bancada");
  mkdirSync(pasta, { recursive: true });
  const destino = resolve(pasta, `vitrine-${qual}.html`);
  writeFileSync(destino, pagina);
  console.log(destino);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
