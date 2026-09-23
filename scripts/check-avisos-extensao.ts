/**
 * Os avisos ao abrir a conversa dizem o que importa, na ordem certa?
 *
 *   npm run check:avisos-extensao
 *
 * Fase 17. O painel da extensão abre com até quatro linhas do que pede
 * cuidado com o contato: prazo estourado, risco, detrator do NPS,
 * reincidência, reclamação sem solução. A regra (`P.avisosDoContato`)
 * roda aqui dentro de uma página de mentira, só com o que ela usa.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { criarIndice } from "../lib/models/sugestaoPorTexto";
import { tendenciaDoHumor } from "../lib/services/motorProprio";
import { avisosDaConversa } from "../lib/services/sinaisDaConversa";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(58)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(58)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const P: Record<string, unknown> = {};
const janela = { CWReputacao: { escapar: (t: string) => t }, __cwPainel: P };
runInNewContext(readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8"), {
  window: janela,
  document: {},
  chrome: undefined,
  console,
});

type Aviso = { tom: string; texto: string };
const avisos = P.avisosDoContato as (dados: unknown, agora?: number) => Aviso[];
const textos = (d: unknown, agora?: number) => avisos(d, agora).map((a) => a.texto);

const agora = new Date("2026-09-18T12:00:00-03:00").getTime();
const cliente = (c: Record<string, unknown> = {}) => ({ nome: "Ana", total: 1, abertos: 1, naoResolvidos: 0, risco: false, ...c });

console.log("\n  AVISOS AO ABRIR A CONVERSA\n");

conferir("sem cliente, nada", avisos({}), []);
conferir("cliente tranquilo, nada", avisos({ cliente: cliente(), casos: [{ aberto: true, protocolo: "RA-1", sla: { situacao: "ok" } }] }), []);
conferir("prazo estourado", textos({ cliente: cliente(), casos: [{ aberto: true, protocolo: "RA-1", sla: { situacao: "estourado" } }] }), ["Prazo estourado em RA-1"]);
conferir("caso fechado não conta prazo", textos({ cliente: cliente(), casos: [{ aberto: false, protocolo: "RA-1", sla: { situacao: "estourado" } }] }), []);
conferir("prazo perto de vencer traz o rótulo", textos({ cliente: cliente(), casos: [{ aberto: true, protocolo: "RA-2", sla: { situacao: "atencao", rotulo: "vence em 2h" } }] }), ["RA-2: vence em 2h"]);
conferir("reincidente", textos({ cliente: cliente({ total: 2 }) }), ["Já reclamou 2 vezes"]);
conferir(
  "detrator do NPS com os dias",
  textos({ cliente: cliente(), nps: { nota: 3, encerrado: false, respondidoEm: "2026-09-15T12:00:00-03:00" } }, agora),
  ["Detrator do NPS (nota 3) há 3 dias"]
);
conferir("NPS encerrado não avisa", textos({ cliente: cliente(), nps: { nota: 3, encerrado: true } }), []);
conferir("promotor não avisa", textos({ cliente: cliente(), nps: { nota: 9, encerrado: false } }), []);
conferir("sem solução, no singular", textos({ cliente: cliente({ naoResolvidos: 1 }) }), ["1 reclamação terminou sem solução"]);

const tudo = avisos(
  {
    cliente: cliente({ total: 4, naoResolvidos: 2, risco: true }),
    casos: [{ aberto: true, protocolo: "RA-9", sla: { situacao: "estourado" } }],
    nps: { nota: 2, encerrado: false, respondidoEm: "2026-09-18T08:00:00-03:00" },
  },
  agora
);
conferir("no máximo quatro", tudo.length, 4);
conferir("o grave vem primeiro", tudo.map((a) => a.tom), ["perigo", "perigo", "perigo", "atencao"]);
conferir("detrator de hoje", tudo[2].texto, "Detrator do NPS (nota 2), respondeu hoje");

const estilo = readFileSync(resolve(__dirname, "../extensao/conteudo/estilo.js"), "utf8");
const painel = readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8");
const posAvisos = painel.indexOf("partes.push(blocoAvisos(P.avisosDoContato(dados), true));");
conferir("o painel desenha os avisos antes do resumo", posAvisos > 0 && posAvisos < painel.indexOf("partes.push(P.blocoResumo());"), true);
conferir("e o estilo existe", estilo.includes(".avisos-contato li.perigo"), true);

/* ---------- os sinais que só a conversa dá (servidor) ---------- */

console.log("\n  SINAIS DA CONVERSA\n");

const cli = (texto: string) => ({ de: "cliente" as const, texto });
const nos = (texto: string) => ({ de: "nos" as const, texto });

conferir("poucas mensagens, sem tendência", tendenciaDoHumor([cli("oi"), cli("tudo certo?")]), null);
const piorou = [cli("oi, bom dia"), cli("obrigado pela ajuda"), cli("funcionou, valeu"), nos("que bom!"), cli("de novo não funciona"), cli("absurdo, péssimo"), cli("vou cancelar")];
conferir("o humor piorou", avisosDaConversa(piorou, null).map((a) => a.texto), ["O humor piorou nas últimas mensagens"]);
const melhorou = [cli("não funciona"), cli("absurdo"), cli("péssimo atendimento"), cli("agora funcionou"), cli("obrigado"), cli("valeu, resolveu")];
conferir("o humor melhorou", avisosDaConversa(melhorou, null).map((a) => a.texto), ["O humor melhorou nas últimas mensagens"]);

const relato = "Fiz o pedido pelo cardápio digital na sexta, o pagamento via pix foi aprovado mas o pedido nunca chegou na cozinha do restaurante e ninguém do suporte respondeu no chat";
const indice = criarIndice([
  { id: "1", referencia: "RA-COLADO", texto: relato, rotulo: "" },
  { id: "2", referencia: "RA-OUTRO", texto: "A impressora térmica não imprime as comandas depois da atualização do aplicativo no tablet", rotulo: "" },
  { id: "3", referencia: "RA-TERCEIRO", texto: "Cobrança duplicada na mensalidade do plano, pedi estorno e não fizeram", rotulo: "" },
]);
conferir(
  "relato colado é a mesma reclamação",
  avisosDaConversa([cli(relato)], indice).map((a) => a.texto.replace(/\(\d+%\)/, "(%)")),
  ["A mensagem é a mesma da reclamação RA-COLADO (%)"]
);
conferir("texto curto não compara", avisosDaConversa([cli("o pedido não chegou")], indice), []);
conferir(
  "assunto parecido não vira aviso de reclamação colada",
  avisosDaConversa([cli("Bom dia, minha impressora parou de imprimir as comandas do salão desde ontem à noite, já reiniciei tudo")], indice).some((a) =>
    a.texto.startsWith("A mensagem é a mesma")
  ),
  false
);

const rota = readFileSync(resolve(__dirname, "../app/api/extensao/sinais/route.ts"), "utf8");
const sw = readFileSync(resolve(__dirname, "../extensao/fundo/service-worker.js"), "utf8");
conferir("a rota exige sessão", rota.includes("semSessao(request)"), true);
conferir("o service worker conhece o caminho", sw.includes('sinais: "/api/extensao/sinais"') && sw.includes("sinaisDaConversa"), true);
conferir("o painel pede os sinais com e sem cadastro", (painel.match(/P\.pedirSinaisDaConversa\(\);/g) ?? []).length, 2);

console.log(falhas === 0 ? "\n  O painel abre dizendo o que pede cuidado.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
