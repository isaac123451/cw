/**
 * A extensão na área da empresa do Reclame Aqui — o resumo, o cartão e
 * os selos da lista.
 *
 *   npm run check:ra-area
 *
 * Sem banco e sem navegador. O resumo sai de `resumoDaReclamacao`; o
 * cartão e os selos, do `ra-area.js` de verdade, rodado numa caixa sem
 * página (só as funções que montam HTML).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { resumoDaReclamacao } from "../lib/models/resumoDaReclamacao";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${String(JSON.stringify(obtido)).slice(0, 36)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${String(JSON.stringify(esperado)).slice(0, 36)}`);
}

console.log("\n  ÁREA DA EMPRESA — resumo, cartão e selos\n");

/* ---- o resumo ---- */
const relato =
  "Estou sem receber meu repasse há 15 dias e o suporte não responde.Já mandei mensagem todos os dias. Quero o valor na minha conta até sexta! Isso é um absurdo e um descaso!!";
const r = resumoDaReclamacao("Repasse não caiu", relato);
conferir("o pedido é a frase que pede", r.quer, "Quero o valor na minha conta até sexta!");
conferir("'Web.Já' vira duas frases; o aconteceu é o começo do relato", r.aconteceu, "Estou sem receber meu repasse há 15 dias e o suporte não responde. Já mandei mensagem todos os dias.");
conferir("repasse retido é Urgente, e vem primeiro", [r.nivel, r.sinais[0]?.criterio], ["Urgente", "prejuizo"]);
conferir("absurdo + descaso + '!!' é muito irritado", r.tom, "muito irritado");
conferir("'Quero deixar claro' não é pedido", resumoDaReclamacao("x", "Quero deixar claro que uso o sistema há anos. O pedido não imprime.").quer, null);
conferir("o 'Título:' repetido no começo não entra no resumo", resumoDaReclamacao("Pedido", "Título: Pedido sumiu\nO pedido de ontem sumiu do painel.").aconteceu, "O pedido de ontem sumiu do painel.");
conferir("relato vazio não quebra: o aconteceu é o título", resumoDaReclamacao("Cobrança errada", "").aconteceu, "Cobrança errada");

/* ---- o cartão e os selos, pelo arquivo da extensão ---- */
const codigo = readFileSync(resolve(__dirname, "../extensao/conteudo/ra-area.js"), "utf8");
const CW: Record<string, unknown> = {
  escapar: (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
};
const caixa = { window: { CWReputacao: CW }, String, Number, Boolean, Array, Object, JSON, Math, RegExp };
vm.createContext(caixa);
vm.runInContext(codigo, caixa);
const area = CW.raArea as {
  htmlDoCartao: (lida: unknown, dados: unknown, recolhido?: boolean) => string;
  htmlDoSelo: (codigo: string, info: unknown) => string;
  enderecoDaReclamacao: (c: string) => string;
};

const lida = { cod: "uPDvBFKmssmEmxVa", id: "256949163" };
const caso = {
  protocolo: "RA-uPDvBFKmssmEmxVa",
  url: "http://localhost:3000/reclame-aqui/uPDvBFKmssmEmxVa",
  urlDossie: "http://localhost:3000/reclame-aqui/uPDvBFKmssmEmxVa/dossie",
  urlPortal: "https://www.reclameaqui.com.br/cardapio-web/x_uPDvBFKmssmEmxVa/",
  status: "Em tratativa",
  prioridade: "Urgente",
  triada: true,
  sla: { situacao: "estourado", rotulo: "1º contato atrasado" },
  passo: { numero: 6, titulo: "Validação com o cliente", detalhe: "" },
  responsavel: "Carlos",
  respondida: false,
  validado: false,
  replica: false,
  avaliado: false,
  nota: null,
  reincidencia: 1,
  estabelecimento: { nome: "Pizzaria Bella", plano: "Pro", situacao: "Ativo" },
  rascunho: "Olá, Marina! Agradecemos o diálogo.",
};
const resumo = { ...r, aconteceu: '<img src=x onerror="alert(1)">' };
const html = area.htmlDoCartao(lida, { resumo, caso }, false);
conferir("abrir no CW, página pública e dossiê em nova guia", ["Abrir no CW ↗", "Página pública ↗", "Dossiê ↗"].map((t) => html.includes(t)), [true, true, true]);
conferir("os três abrem em nova guia", (html.match(/target="_blank"/g) ?? []).length, 3);
conferir("sem resposta nem validação: avisa o Passo 6 antes de responder", html.includes("Passo 6"), true);
conferir("prazo, passo da vez, conta e reincidência", ["1º contato atrasado", "passo 6 — Validação com o cliente", "Conta: Pizzaria Bella (Pro)", "2ª reclamação do mesmo CPF/CNPJ"].map((t) => html.includes(t)), [true, true, true, true]);
conferir("copiar protocolo e o rascunho do CW", [html.includes('data-texto="RA-uPDvBFKmssmEmxVa"'), html.includes("Copiar o rascunho do CW")], [true, true]);
conferir("texto do consumidor não vira HTML", [html.includes("<img"), html.includes("&lt;img")], [false, true]);
conferir("com réplica pendente, o alerta aparece", area.htmlDoCartao(lida, { resumo, caso: { ...caso, replica: true } }, false).includes("a vez é nossa"), true);
conferir("respondida, o aviso do Passo 6 some", area.htmlDoCartao(lida, { resumo, caso: { ...caso, respondida: true } }, false).includes("Passo 6"), false);
const novo = area.htmlDoCartao(lida, { resumo, caso: null }, false);
conferir("fora do CW: 'Criar no quadro' e o protocolo lido da página", [novo.includes('data-acao="criar"'), novo.includes("RA-uPDvBFKmssmEmxVa")], [true, true]);
conferir("recolhido: só o topo", area.htmlDoCartao(lida, { resumo, caso }, true).includes("Resumo"), false);
conferir("carregando: diz que está lendo", area.htmlDoCartao(lida, null, false).includes("Lendo a reclamação"), true);

conferir("endereço da reclamação na área da empresa", area.enderecoDaReclamacao("uPDvBFKmssmEmxVa"), "https://www.reclameaqui.com.br/area-da-empresa/reclamacoes/uPDvBFKmssmEmxVa/");
conferir("código torto não vira link", area.enderecoDaReclamacao("abc"), "");
const seloNovo = area.htmlDoSelo("uPDvBFKmssmEmxVa", undefined);
conferir("selo de nova, com o ↗ para nova guia", [seloNovo.includes("CW · nova"), seloNovo.includes('target="_blank"')], [true, true]);
const seloNoCw = area.htmlDoSelo("uPDvBFKmssmEmxVa", { protocolo: "RA-uPDvBFKmssmEmxVa", url: caso.url, prioridade: "Alta", sla: { situacao: "estourado" }, passo: "validar a solução com o cliente" });
conferir("selo do CW: prioridade e atraso, e leva à ficha", [seloNoCw.includes("CW · Alta · atrasada"), seloNoCw.includes(caso.url)], [true, true]);

console.log(falhas === 0 ? "\n  O cartão resume, situa no CW e abre em nova guia; a lista diz o que já está no CW.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
