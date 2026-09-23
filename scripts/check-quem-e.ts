/**
 * Quem é este contato — a régua do nome e o painel.
 *
 *   npm run check:quem-e
 *
 * Sem banco: a semelhança de nomes (a mesma que escolhe os candidatos) e
 * o `painel-contato.js` de verdade num ambiente simulado — o contato
 * reconhecido pelo NPS não é mais "nada encontrado", o desconhecido
 * ganha candidatos com "É este", e o "É este" manda o telefone da
 * conversa com a ficha escolhida.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { palavrasQueDistinguem, semelhancaDeNome } from "../lib/services/contatoConhecido.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${String(JSON.stringify(obtido)).slice(0, 38)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${String(JSON.stringify(esperado)).slice(0, 38)}`);
}

console.log("\n  QUEM É ESTE CONTATO\n");

/* ---- a régua ---- */
conferir("mesma loja com e sem o ramo e o sufixo", semelhancaDeNome("Bella Napoli", "Pizzaria Bella Napoli Ltda"), 1);
conferir("o ramo sozinho não casa ('Pizzaria Central' × 'Pizzaria Bella')", semelhancaDeNome("Pizzaria Central", "Pizzaria Bella"), 0);
conferir("acento e maiúscula não importam", semelhancaDeNome("João Silva", "joao silva"), 1);
conferir("o e-mail colado do NPS ('Tre Duarte Pizzaria' × treduartepizzaria)", semelhancaDeNome("Tre Duarte Pizzaria", "treduartepizzaria"), 0.8);
conferir("nome curto não casa por dentro ('Ana' × mariana)", semelhancaDeNome("Ana", "mariana"), 0);
conferir("metade das palavras: 'Mario Rossi Burger' × 'Rossi Lanches'", semelhancaDeNome("Mario Rossi Burger", "Rossi Lanches"), 1);
conferir("sem palavra que distinga, não procura", palavrasQueDistinguem("Pizzaria Delivery"), []);

/* ---- o painel ---- */
const codigo = readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8");

async function painel() {
  const enviados: { tipo: string; [k: string]: unknown }[] = [];
  let respostaQuemE: unknown = { candidatos: [] };
  const corpo = {
    innerHTML: "",
    insertAdjacentHTML(_: string, html: string) {
      this.innerHTML += html;
    },
    querySelector: () => null,
  };
  const P: Record<string, unknown> = {
    config: {},
    corpo,
    raiz: { querySelector: () => null },
    blocoResumo: () => "",
    blocoDossie: () => "",
    tentarPelaConversa: () => false,
    pedirSinaisDaConversa: () => undefined,
    temOndeProcurar: () => true,
    parametros: () => ({}),
    vista: "contato",
  };
  const CW = {
    escapar: (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    enviar: async (m: { tipo: string }) => {
      enviados.push(m);
      if (m.tipo === "quemE") return { ok: true, dados: respostaQuemE };
      if (m.tipo === "vincularContato") return { ok: true, dados: { ok: true } };
      return { ok: true, dados: { cliente: null } };
    },
  };
  const contexto = {
    window: { CWReputacao: CW, __cwPainel: P, addEventListener() {} },
    document: { hidden: false, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    console, Date, Map, Set, JSON, Math, String, Number, Boolean, Array, Object, RegExp, Promise, URL, encodeURIComponent,
  };
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);

  const render = P.render as (d: unknown) => void;

  /* Reconhecido pelo NPS, sem reclamação. */
  P.consulta = { telefone: "+55 11 97777-6666", nome: "Tre Duarte" };
  P.telefoneDaConversa = "+55 11 97777-6666";
  P.chaveConsulta = "c1";
  corpo.innerHTML = "";
  render({ cliente: null, nps: { id: "n1", nota: 3, cliente: "treduartepizzaria", encerrado: false }, estabelecimento: null, casos: [] });
  conferir("conhecido pelo NPS não é mais 'nada encontrado'", [corpo.innerHTML.includes("reconhecido"), corpo.innerHTML.includes("Nada encontrado")], [true, false]);
  conferir("e leva ao NPS, com a nota", [corpo.innerHTML.includes("Abrir no NPS"), corpo.innerHTML.includes("NPS 3 · ciclo aberto")], [true, true]);

  /* Desconhecido: candidatos pelo nome. */
  respostaQuemE = { candidatos: [{ tipo: "nps", ref: "n9", titulo: "treduartepizzaria", detalhe: "NPS nota 3 · 20/09", semelhanca: 0.8 }] };
  P.chaveConsulta = "c2";
  corpo.innerHTML = "";
  render({ cliente: null, nps: null, estabelecimento: null, casos: [] });
  conferir("desconhecido: pergunta quem é, enquanto procura", [corpo.innerHTML.includes("Quem é este contato?"), corpo.innerHTML.includes("Procurando parecidos")], [true, true]);
  await Promise.resolve();
  await new Promise((r) => setImmediate(r));
  conferir("procurou pelo nome do contato", enviados.find((m) => m.tipo === "quemE")?.nome, "Tre Duarte");
  corpo.innerHTML = "";
  render({ cliente: null, nps: null, estabelecimento: null, casos: [] });
  conferir("e mostra o candidato com 'É este'", [corpo.innerHTML.includes("treduartepizzaria"), corpo.innerHTML.includes('data-acao="vincular" data-tipo="nps" data-ref="n9"')], [true, true]);

  /* O "É este". */
  const botao = { dataset: { tipo: "nps", ref: "n9" }, textContent: "É este", disabled: false };
  await (P.vincularContato as (b: unknown) => Promise<void>)(botao);
  const v = enviados.find((m) => m.tipo === "vincularContato") as { corpo?: Record<string, unknown> } | undefined;
  conferir("'É este' manda o telefone da conversa e a ficha", [v?.corpo?.telefone, v?.corpo?.tipo, v?.corpo?.ref], ["5511977776666", "nps", "n9"]);
  conferir("e consulta de novo, sem o cache", enviados.filter((m) => m.tipo === "contexto").some((m) => m.forcar === true), true);

  /* O vínculo aparece, com o desfazer. */
  corpo.innerHTML = "";
  render({ cliente: null, nps: { id: "n9", nota: 3, cliente: "treduartepizzaria", encerrado: false }, estabelecimento: null, casos: [], vinculo: { por: "Carlos", em: "2026-09-23T20:00:00Z", tipo: "nps" } });
  conferir("vinculado mostra quem ligou e o 'não é este cliente'", [corpo.innerHTML.includes("Vinculado a este número por Carlos em 23/09"), corpo.innerHTML.includes('data-acao="desvincular"')], [true, true]);

  /* Numa busca manual, o resultado oferece lembrar o número da conversa. */
  P.chaveConsulta = "manual:treduarte";
  P.consulta = { termo: "treduarte" };
  corpo.innerHTML = "";
  render({ cliente: null, nps: { id: "n9", nota: 3, cliente: "treduartepizzaria", encerrado: false }, estabelecimento: null, casos: [] });
  conferir("busca manual: 'É o contato da conversa aberta — lembrar'", corpo.innerHTML.includes("É o contato da conversa aberta"), true);
}

painel().then(() => {
  console.log(falhas === 0 ? "\n  O contato conhecido é reconhecido, e o desconhecido ganha candidatos.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
});
