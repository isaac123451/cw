/**
 * Onde fica? — cada função leva à tela certa, e a busca acha cada uma.
 *
 *   npm run check:onde-fica
 *
 * 12/11/2026. Sem banco: os ids são únicos; todo "Ir até lá" aponta para
 * uma página que existe; toda tela do menu está no mapa; e a busca (Ctrl K)
 * acha as funções pelo nome e pelos apelidos que as pessoas usam.
 */
import { existsSync } from "node:fs";

import { itemDeConfiguracoes, menuItems } from "../core/navigation/menu";
import { buscarNaPlataforma } from "../lib/models/buscaGlobal";
import { filtrarMapa, MAPA } from "../lib/models/ondeFica";
import { telasDaBusca } from "../lib/models/telasDaBusca";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

console.log("\n  O MAPA\n");
conferir("44 funções", MAPA.length, 44);
conferir("ids únicos", new Set(MAPA.map((m) => m.id)).size, MAPA.length);
const semPagina = MAPA.filter((m) => m.href && !existsSync(`app${m.href.split("?")[0]}/page.tsx`)).map((m) => m.href);
conferir("todo 'Ir até lá' abre uma página que existe", semPagina, []);
const noMapa = new Set(MAPA.map((m) => m.href));
const doMenu = [...menuItems, itemDeConfiguracoes].flatMap((m) => [m.href, ...(m.children ?? []).map((c) => c.href)]);
const foraDoMapa = [...new Set(doMenu)].filter((h) => !noMapa.has(h) && !["/primeiro-acesso", "/configuracoes"].includes(h));
conferir("toda tela do menu está no mapa", foraDoMapa, []);
conferir("o filtro acha pelo apelido, sem acento", filtrarMapa("audio").map((m) => m.id), ["conversas"]);

console.log("\n  A BUSCA (Ctrl K)\n");
const telas = telasDaBusca();
const primeira = (termo: string) => buscarNaPlataforma({ termo, telas }).find((r) => r.tipo === "tela")?.href;
conferir("uma tela, um resultado (sem href repetido)", telas.length, new Set(telas.map((t) => t.href)).size);
conferir("chamar duas vezes não duplica apelidos", JSON.stringify(telasDaBusca()) === JSON.stringify(telas), true);
for (const [termo, esperado] of [
  ["audio", "/conversas"],
  ["nota", "/reclame-aqui/indice"],
  ["recebe atendimentos", "/configuracoes/permissoes"],
  ["disparo", "/primeiro-acesso?aba=onde-fica#ext-disparo"],
  ["fup", "/agenda"],
  ["instagram", "/redes-sociais"],
  ["churn", "/retencao"],
  ["sino", "/primeiro-acesso?aba=onde-fica#notificacoes"],
] as const) conferir(`"${termo}" leva a ${esperado}`, primeira(termo), esperado);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
