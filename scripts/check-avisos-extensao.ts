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
import { avisosDaConversa, dadosDaConversa, humorDoCabecalho, oQueCompletar } from "../lib/services/sinaisDaConversa";

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

/* ---------- completar o cadastro pela conversa ---------- */

console.log("\n  COMPLETAR PELA CONVERSA\n");

const conversa = [
  nos("Pode me mandar o e-mail da conta? O nosso é suporte@cardapioweb.com, (11) 4000-1234"),
  cli("claro, é Maria.Souza@Exemplo.com.br"),
  cli("meu cpf 529.982.247-25 e o celular (48) 99909-5712"),
];
conferir("e-mail, CPF e telefone do cliente", dadosDaConversa(conversa), { email: "maria.souza@exemplo.com.br", documento: "52998224725", telefone: "48999095712" });
conferir("o que nós escrevemos não conta", dadosDaConversa([nos("suporte@cardapioweb.com, (11) 4000-1234")]), {});
conferir("o número da página vale mais que o digitado", dadosDaConversa(conversa, "5511987654321").telefone, "11987654321");
conferir("CPF com dígito errado não é documento", dadosDaConversa([cli("cpf 529.982.247-24")]).documento, undefined);
conferir("CNPJ válido entra", dadosDaConversa([cli("o cnpj da loja é 11.222.333/0001-81")]).documento, "11222333000181");
conferir("CNPJ com dígito errado não entra", dadosDaConversa([cli("o cnpj da loja é 11.222.333/0001-82")]).documento, undefined);
conferir(
  "só o que falta no caso",
  oQueCompletar({ email: "ja@tem.com", phone: null, document: null }, dadosDaConversa(conversa)).map((c) => c.campo),
  ["telefone", "documento"]
);
conferir("caso completo, nada a sugerir", oQueCompletar({ email: "a@b.com", phone: "48999095712", document: "52998224725" }, dadosDaConversa(conversa)), []);

const rotaCompletar = readFileSync(resolve(__dirname, "../app/api/extensao/completar-pela-conversa/route.ts"), "utf8");
const base = readFileSync(resolve(__dirname, "../extensao/conteudo/painel-base.js"), "utf8");
conferir("gravar exige quem pode escrever", rotaCompletar.includes('usuario.papel === "LEITURA"') && rotaCompletar.includes("completarContato("), true);
conferir("o botão chega ao painel", base.includes('acao === "completar-conversa"') && sw.includes("completarPelaConversa"), true);
conferir("só diz gravado quando o servidor gravou", /completou\.length > 0\) \{\s*sinais\.completar = null;/.test(painel), true);

/* ---------- cabeçalho do cliente ---------- */

console.log("\n  CABEÇALHO DO CLIENTE\n");

const cabecalho = P.blocoCabecalho as (dados: unknown, tom: string, rotulo: string) => string;
const html = cabecalho(
  {
    cliente: cliente(),
    estabelecimento: { nome: "Pizzaria Bella" },
    casos: [
      { aberto: true, canal: "Reclame Aqui" },
      { aberto: true, canal: "Reclame Aqui" },
      { aberto: false, canal: "Reclame Aqui" },
      { aberto: true, canal: "Instagram" },
    ],
    nps: { nota: 4, encerrado: false },
  },
  "ok",
  "confirmado"
);
const chips = [...html.matchAll(/<span class="frente-chip[^"]*">([^<]+)<\/span>/g)].map((m) => m[1]);
conferir("frentes abertas: RA, Redes e NPS", chips, ["Reclame Aqui · 2 abertos", "Redes · 1 aberto", "NPS 4 · ciclo aberto"]);
conferir("a conta aparece", html.includes('<div class="cab-conta">Pizzaria Bella</div>'), true);
conferir("detrator em destaque", html.includes('frente-chip perigo">NPS 4'), true);
conferir("o termômetro nasce escondido", html.includes('<span class="termometro" hidden></span>'), true);
conferir(
  "nada aberto diz isso",
  [...cabecalho({ cliente: cliente(), casos: [] }, "ok", "x").matchAll(/frente-chip[^"]*">([^<]+)</g)].map((m) => m[1]),
  ["nada aberto"]
);

conferir("humor com uma mensagem só: nada", humorDoCabecalho([cli("oi")]), null);
conferir("humor de agora, sem tendência com poucas", humorDoCabecalho([cli("absurdo"), cli("péssimo, vou cancelar")]), { agora: 1, tendencia: null });
conferir("humor piorando", humorDoCabecalho(piorou)?.tendencia, "piorando");
conferir("humor melhorando", humorDoCabecalho(melhorou)?.tendencia, "melhorando");

console.log(falhas === 0 ? "\n  O painel abre dizendo o que pede cuidado.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
