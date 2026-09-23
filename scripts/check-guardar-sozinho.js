/**
 * A conversa se guarda sozinha com o painel fechado?
 *
 *   npm run check:guardar-sozinho
 *
 * Carrega o `painel-contato.js` de verdade num ambiente simulado (sem
 * navegador) e confere o que ele manda para a plataforma. O pedido do
 * Isaac, "salvamento automático tá aonde?", tinha resposta no código:
 * só guardava com o painel **aberto**, na vista do contato, e com caso
 * ou NPS aberto — 2 conversas guardadas em uma semana.
 */
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

let falhas = 0;
function conferir(titulo, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

const codigo = readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8");

function montar() {
  const enviados = [];
  const gatilho = { classList: { _: new Set(), toggle(c, v) { v ? this._.add(c) : this._.delete(c); }, contains(c) { return this._.has(c); } }, title: "" };
  const P = {
    config: {},
    raiz: { querySelector: (s) => (s === ".gatilho" ? gatilho : null) },
    corpo: { querySelector: () => null },
  };
  const CW = {
    escapar: (t) => String(t),
    enviar: async (m) => {
      enviados.push(m);
      return m.tipo === "guardarConversa" ? { ok: true, dados: { id: "conv1", novas: (m.corpo.mensagens || []).length } } : { ok: true, dados: {} };
    },
  };
  const contexto = {
    window: { CWReputacao: CW, __cwPainel: P, addEventListener() {} },
    document: { hidden: false, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    console,
    Date,
    Map,
    Set,
    JSON,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    Promise,
    URL,
    encodeURIComponent,
  };
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);
  return { P, enviados, gatilho, contexto };
}

async function main() {
  console.log("\n  A CONVERSA SE GUARDA SOZINHA\n");

  const { P, enviados, gatilho, contexto } = montar();
  conferir("o painel-contato carrega e expõe o salvamento", typeof P.guardarSozinho, "function");

  const mensagens = [
    { id: "m1", de: "cliente", texto: "Oi, o pedido não saiu", carimbo: "10:01, 23/09/2026" },
    { id: "m2", de: "nos", texto: "Vou verificar agora", carimbo: "10:02, 23/09/2026" },
  ];
  P.lerConversa = () => mensagens;
  P.consulta = { telefone: "+55 11 98888-7777", nome: "Loja Teste" };
  P.chaveConsulta = "chave-1";
  P.aberto = false;
  P.vista = "contato";

  P.ultimoDado = null;
  conferir("sem consulta, não guarda", P.podeGuardarSozinho(), false);

  P.ultimoDado = { cliente: null, nps: null, estabelecimento: null, casos: [] };
  conferir("contato desconhecido: não guarda (fica no botão, com confirmação)", P.podeGuardarSozinho(), false);

  P.ultimoDado = { cliente: null, nps: { id: "nps1", encerrado: true }, estabelecimento: { id: "est1" }, casos: [] };
  conferir("conhecido só pelo NPS e pela conta: guarda (antes, não)", P.podeGuardarSozinho(), true);

  await P.guardarSozinho();
  const g = enviados.find((m) => m.tipo === "guardarConversa");
  conferir("com o painel FECHADO, manda a conversa para a plataforma", Boolean(g), true);
  conferir("as duas mensagens, pelo id do WhatsApp", g?.corpo?.mensagens?.map((m) => m.id), ["m1", "m2"]);
  conferir("ligada ao NPS e à conta", [g?.corpo?.npsId, g?.corpo?.estabelecimentoId], ["nps1", "est1"]);
  conferir("o botão mostra que está guardando", [gatilho.classList.contains("guardando"), gatilho.title], [true, "CW Reputação · guardando esta conversa"]);

  enviados.length = 0;
  await P.guardarSozinho();
  conferir("de novo, sem mensagem nova: não manda nada", enviados.length, 0);

  mensagens.push({ id: "m3", de: "cliente", texto: "Obrigado!", carimbo: "10:05, 23/09/2026" });
  await P.guardarSozinho();
  conferir("mensagem nova: manda só ela", enviados.find((m) => m.tipo === "guardarConversa")?.corpo?.mensagens?.map((m) => m.id), ["m3"]);

  enviados.length = 0;
  mensagens.push({ id: "m4", de: "nos", texto: "Por nada", carimbo: "10:06, 23/09/2026" });
  contexto.document.hidden = true;
  await P.guardarSozinho();
  conferir("aba escondida: espera (não grava em segundo plano)", enviados.length, 0);
  contexto.document.hidden = false;

  P.config = { guardarPausado: { "88887777": Date.now() } };
  await P.guardarSozinho();
  conferir("conversa pausada: não guarda", enviados.length, 0);
  P.config = {};

  P.ultimoDado = { cliente: { nome: "Loja" }, nps: null, estabelecimento: null, casos: [{ protocolo: "RA-1", aberto: false }, { protocolo: "RA-2", aberto: true }] };
  mensagens.push({ id: "m5", de: "cliente", texto: "E a reclamação?", carimbo: "10:07, 23/09/2026" });
  await P.guardarSozinho();
  conferir("com dois casos, liga ao único aberto", enviados.find((m) => m.tipo === "guardarConversa")?.corpo?.protocolo, "RA-2");

  console.log(falhas === 0 ? "\n  A conversa se guarda com o painel aberto ou fechado.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main();
