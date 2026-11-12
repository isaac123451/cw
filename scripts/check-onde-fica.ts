/**
 * Onde fica? — cada função leva à tela certa, e a busca acha cada uma.
 *
 *   npm run check:onde-fica
 *
 * 12/11/2026. Sem banco: os ids são únicos; todo "Ir até lá" aponta para
 * uma página que existe; toda tela do menu está no mapa; e a busca (Ctrl K)
 * acha as funções pelo nome e pelos apelidos que as pessoas usam.
 */
import { existsSync, readFileSync } from "node:fs";

import { itemDeConfiguracoes, menuItems } from "../core/navigation/menu";
import { buscarNaPlataforma } from "../lib/models/buscaGlobal";
import { filtrarMapa, MAPA } from "../lib/models/ondeFica";
import { telasDaBusca } from "../lib/models/telasDaBusca";
import { hrefNoMenu, TOURS_DAS_TELAS } from "../lib/models/primeiraSemana";

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

console.log("\n  O TOUR DE CADA TELA (1.1.73)\n");
const telasDoMapa = [...new Set(MAPA.map((m) => m.href).filter((h): h is string => Boolean(h) && !h!.includes("?")))];
conferir("toda tela do mapa tem tour", telasDoMapa.filter((h) => !TOURS_DAS_TELAS[h]), []);
conferir("os 5 tours feitos à mão continuam os mesmos", ["/meu-dia", "/reclame-aqui", "/nps", "/redes-sociais", "/agenda"].map((h) => TOURS_DAS_TELAS[h]?.id), ["tela-meu-dia", "tela-reclame-aqui", "tela-nps", "tela-redes", "tela-agenda"]);
conferir("ids dos tours únicos", new Set(Object.values(TOURS_DAS_TELAS).map((t) => t.id)).size, Object.keys(TOURS_DAS_TELAS).length);
conferir("o balão do cabeçalho existe no componente das telas", readFileSync("components/shared/PageHeading.tsx", "utf8").includes('data-tour="cabecalho"'), true);
const linksDoMenu = new Set(doMenu);
const semLink = Object.values(TOURS_DAS_TELAS)
  .flatMap((t) => t.passos.map((p) => p.alvo.match(/a\[href="([^"]+)"\]/)?.[1]).filter(Boolean))
  .filter((h) => !linksDoMenu.has(h!));
conferir("o balão do menu aponta para um link que está no menu", semLink, []);
conferir("Permissões aponta para Configurações no menu", hrefNoMenu("/configuracoes/permissoes"), "/configuracoes");
conferir("Nota e metas aponta para o próprio item do Reclame Aqui", hrefNoMenu("/reclame-aqui/indice"), "/reclame-aqui/indice");
const okr = TOURS_DAS_TELAS["/okr"];
conferir("o tour do OKR diz o que faz e onde fica", okr?.passos.map((p) => p.titulo), ["OKR", "Onde ela fica"]);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
