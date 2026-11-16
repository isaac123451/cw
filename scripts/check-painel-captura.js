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

/*
  Qual reclamação é esta conversa (16/11/2026): "apontando para o caso
  errado, além disso seria interessante ter como sinalizar o caso
  correto" — e o acesso rápido ao CW e à área da empresa.
*/
const Q = { telefoneDaConversa: "11999990000" };
const janela2 = { CWReputacao: { escapar: (t) => String(t), icone: () => "", enviar: async () => ({}) }, __cwPainel: Q };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8"), {
  window: janela2, document: { addEventListener() {} }, console, setTimeout, clearTimeout, location: { hostname: "web.whatsapp.com" },
});

const CASO_TT = { protocolo: "RA-TT_wCjTVg8RIeq_L", idRa: "262662525", titulo: "Perdendo vendas por falha no estoque do combo", aberto: true, canal: "Reclame Aqui", url: "https://cw/reclame-aqui/a", urlEmpresa: "https://ra/area-da-empresa/reclamacoes/TT_wCjTVg8RIeq_L/" };
const CASO_PIX = { protocolo: "RA-H6G7Dgby4mdOyQ1Y", idRa: "262398585", titulo: "Não recebi o repasse de pagamentos via pix", aberto: true, url: "https://cw/reclame-aqui/b" };

console.log("\n  QUAL RECLAMAÇÃO É ESTA CONVERSA\n");
const qual = Q.blocoQualReclamacao({ casos: [CASO_TT], outrosDoContato: [CASO_PIX], vinculo: { por: "Michele" } });
conferir("duas reclamações do contato: o painel pergunta", qual.includes("2 reclamações deste contato"), true);
conferir("a vinculada fica em foco", /ID 262662525[^<]*<\/span>.*?em foco/s.test(qual), true);
conferir("a outra ganha 'é esta' com o protocolo dela", qual.includes('data-acao="vincular" data-tipo="caso" data-ref="RA-H6G7Dgby4mdOyQ1Y"'), true);
conferir("com vínculo, a lista vem recolhida", qual.includes('<details class="qual-reclamacao">'), true);
conferir("sem vínculo, a lista vem aberta", Q.blocoQualReclamacao({ casos: [CASO_TT, CASO_PIX] }).includes('<details class="qual-reclamacao" open>'), true);
conferir("uma reclamação só: nada a perguntar", Q.blocoQualReclamacao({ casos: [CASO_TT], outrosDoContato: [] }), "");
conferir("a mesma não aparece duas vezes", Q.blocoQualReclamacao({ casos: [CASO_TT], outrosDoContato: [CASO_TT] }), "");

/*
  O ID em todos os lugares da extensão (16/11/2026): a lista "quem é" ainda
  mostrava "RA-yep1kcHjlWzmgyDa · Avaliado como resolvido".
*/
console.log("\n  O ID DO RECLAME AQUI NA EXTENSÃO\n");
const nucleo = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../extensao/conteudo/nucleo.js"), "utf8"), {
  window: Object.assign(nucleo, { addEventListener() {} }), document: { addEventListener() {} }, chrome: { runtime: {} }, location: { hostname: "x" }, console, setTimeout,
});
const rotulo = nucleo.CWReputacao.rotuloDoCaso;
conferir("caso do RA com ID → 'ID <número>'", rotulo({ protocolo: "RA-yep1kcHjlWzmgyDa", idRa: "256873207" }), "ID 256873207");
conferir("caso do RA ainda sem ID → o protocolo", rotulo({ protocolo: "RA-yep1kcHjlWzmgyDa", idRa: null }), "RA-yep1kcHjlWzmgyDa");
conferir("caso das Redes → o protocolo", rotulo({ protocolo: "RS-123", idRa: "999999" }), "RS-123");
const ler = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const servico = ler("lib/services/contatoConhecido.service.ts");
conferir("'quem é' mostra o ID nos candidatos", (servico.match(/detalhe: `\$\{c\.idRa \? `ID \$\{c\.idRa\}` : c\.protocol\}/g) ?? []).length, 3);
conferir("'quem é' lê o idRa nas três buscas", (servico.match(/protocol: true, idRa: true/g) ?? []).length, 3);
const contato = ler("extensao/conteudo/painel-contato.js");
conferir("prazo estourado diz o ID", contato.includes("Prazo estourado em ${CW.rotuloDoCaso(caso)}"), true);
conferir("popup e caso rápido usam o ID", ler("extensao/popup/popup.js").includes("escapar(rotuloDoCaso(caso))") && ler("extensao/caso-rapido/caso-rapido.js").includes("escapar(rotuloDoCaso(c))"), true);
conferir("caso rápido acha pelo ID", ler("app/api/extensao/caso-rapido/route.ts").includes("[{ idRa: q.trim() }]"), true);

console.log("\n  ACESSO RÁPIDO\n");
const rapido = Q.blocoAcessoRapido({ casos: [CASO_TT] });
conferir("abrir no CW leva ao caso", rapido.includes('data-url="https://cw/reclame-aqui/a">Abrir no CW'), true);
conferir("área da empresa leva à reclamação no RA", rapido.includes('area-da-empresa/reclamacoes/TT_wCjTVg8RIeq_L/">Área da empresa'), true);
conferir("sem caso, sem acesso rápido", Q.blocoAcessoRapido({ casos: [] }), "");

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
