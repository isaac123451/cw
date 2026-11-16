/**
 * O painel reconhece a reclamação aberta que já está no quadro.
 *
 *   node scripts/check-painel-captura.js
 *
 * 16/11/2026: "não está reconhecendo os clientes do reclame aqui a extensão,
 * novamente". Na reclamação ID 264271711 o painel oferecia "Ler reclamação
 * 264271711 e adicionar ao Kanban" para um caso que já estava no quadro: a
 * conferência comparava o número da página só com o protocolo (RA-<COD>).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let falhas = 0;
function conferir(titulo, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)}`);
}

const P = {};
const janela = { CWReputacao: { escapar: (t) => String(t) }, __cwPainel: P };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../extensao/conteudo/painel-etapas.js"), "utf8"), { window: janela, document: {}, console });

const jaEsta = (casos) => P.blocoCaptura({ casos }).includes("já está no CW Reputação");
P.captura = { id: "264271711", cod: "f2MkXHzDK60I-0ar", titulo: "PIOR EMPRESA DO RAMO" };

console.log("\n  A RECLAMAÇÃO ABERTA JÁ ESTÁ NO QUADRO?\n");
conferir("pelo ID do RA (o número da página)", jaEsta([{ id: "cmw1", protocolo: "RA-xxxxxxxxxxxxxxxx", idRa: "264271711" }]), true);
conferir("pelo COD (o protocolo do caso)", jaEsta([{ id: "cmw1", protocolo: "RA-f2MkXHzDK60I-0ar", idRa: null }]), true);
conferir("outro caso do mesmo cliente não conta", jaEsta([{ id: "cmw2", protocolo: "RA-outroCodigo1234", idRa: "263517373" }]), false);
conferir("sem idRa nem COD iguais, oferece adicionar", jaEsta([]), false);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
