/**
 * Os dois endereços de uma reclamação — página pública e área da empresa.
 *
 *   npm run check:links-do-ra
 *
 * Sem banco. A regra que o quadro, a lista, a ficha, a busca, o Meu dia,
 * o sino e a extensão usam para abrir a reclamação no Reclame Aqui.
 */
import { enderecoNaAreaDaEmpresa, linksDoRa } from "../lib/models/linksDoRa";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${String(JSON.stringify(obtido)).slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${String(JSON.stringify(esperado)).slice(0, 44)}`);
}

console.log("\n  LINKS DO RECLAME AQUI\n");

const publica = "https://www.reclameaqui.com.br/cardapio-web-servicos-de-tecnologia/reembolso_dcJQJrvaB2XPoZWU/";

conferir("área da empresa sai do protocolo", enderecoNaAreaDaEmpresa("RA-dcJQJrvaB2XPoZWU"), "https://www.reclameaqui.com.br/area-da-empresa/reclamacoes/dcJQJrvaB2XPoZWU/");
conferir("protocolo que não é do RA não vira link", [enderecoNaAreaDaEmpresa("IG-abcdefghijklmnop"), enderecoNaAreaDaEmpresa("CW-LX3K9")], [null, null]);
conferir("com a página pública: os dois, pública primeiro", linksDoRa({ protocol: "RA-dcJQJrvaB2XPoZWU", raUrl: publica }).map((l) => l.tipo), ["publica", "empresa"]);
conferir("sem a página pública (42 hoje): só a área da empresa", linksDoRa({ protocol: "RA-dcJQJrvaB2XPoZWU" }).map((l) => l.tipo), ["empresa"]);
conferir("link de rede social no raUrl não passa por página do RA", linksDoRa({ protocol: "IG-123", raUrl: "https://instagram.com/p/x" }), []);
conferir("endereço que não é do reclameaqui.com.br é ignorado", linksDoRa({ protocol: "RA-dcJQJrvaB2XPoZWU", raUrl: "javascript:alert(1)" }).map((l) => l.tipo), ["empresa"]);

console.log(falhas === 0 ? "\n  Toda reclamação do RA abre nos dois lugares que existem para ela.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
