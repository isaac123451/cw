/**
 * O motor próprio lê a conversa direito quando nenhuma IA responde?
 *
 *   npm run check:motor-proprio
 *
 * **O pedido.** "Quero algo gratuito... trabalhe no agente de IA que
 * você fez para eu utilizar na plataforma e melhorar." Hoje só o Gemini
 * está configurado de verdade (a chave da Anthropic é o marcador do
 * `.env.example`), e camada gratuita congestiona — foi o que aconteceu
 * em 26/08/2026. Este arquivo prova, sem rede e sem IA nenhuma, que o
 * retrato da conversa continua saindo:
 *
 * 1. **humor** sobe e desce com o léxico, e pesa mais a mensagem mais
 *    recente do cliente — é "como ele está agora", não no começo;
 * 2. **assunto** usa as mesmas regras da triagem do Reclame Aqui;
 * 3. **resumo** é extrativo — não inventa nada que não esteja na
 *    conversa;
 * 4. **pendência e próximo passo** seguem de quem falou por último, e
 *    "resolvido" só quando há confirmação de verdade;
 * 5. **os três rascunhos** existem sempre, prontos para revisar — e o
 *    principal muda com o estado da conversa;
 * 6. **a rota não desiste mais sem provedor**: o motor entra quando
 *    `pedirEstruturado` não tem o que responder.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assuntoDaConversa,
  estadoDaConversa,
  humorDaConversa,
  rascunhosDaConversa,
  resumirTexto,
  retratarConversaSemIA,
  triarSemIA,
  dossieSemIA,
  type MensagemDaConversa,
} from "../lib/services/motorProprio";
import { conferirRascunho } from "../lib/models/rascunho";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

const m = (de: "cliente" | "nos", texto: string): MensagemDaConversa => ({ de, texto });

console.log("\n  MOTOR PRÓPRIO — RETRATO DA CONVERSA SEM IA\n");

/* ---- 1. humor ---- */

conferir("elogio no fim puxa para cima", humorDaConversa([m("cliente", "obrigado, funcionou perfeitamente!")]), 5);
conferir("reclamação forte no fim puxa para baixo", humorDaConversa([m("cliente", "isso é um absurdo, péssimo atendimento, vou cancelar")]), 1);
conferir("sem sinal nenhum, neutro", humorDaConversa([m("cliente", "bom dia, tenho uma dúvida sobre o cardápio")]), 3);
conferir(
  "a última mensagem pesa mais que a primeira",
  humorDaConversa([m("cliente", "que péssimo, nada funciona"), m("nos", "vamos verificar"), m("cliente", "perfeito, obrigado, resolveu!")]),
  5
);
conferir("sem mensagem do cliente, neutro (nada para julgar)", humorDaConversa([m("nos", "Olá, tudo bem?")]), 3);
conferir("frustração leve não derruba tanto quanto reclamação forte", humorDaConversa([m("cliente", "ainda não recebi retorno")]) >= humorDaConversa([m("cliente", "isso é ridículo, inaceitável")]), true);

/* ---- 2. assunto ---- */

conferir("cobrança vira Financeiro", assuntoDaConversa([m("cliente", "fui cobrado em duplicidade no cartão")]), "Financeiro");
conferir("sistema travando vira Sistema", assuntoDaConversa([m("cliente", "o aplicativo não sincroniza os pedidos, muito lento")]), "Sistema");
conferir("sem palavra reconhecida, cai em Atendimento (o padrão do canal)", assuntoDaConversa([m("cliente", "oi, bom dia")]), "Atendimento");

/* ---- 3. resumo é extrativo ---- */

const resumo1 = resumirTexto([m("cliente", "meu pedido não chegou"), m("nos", "vamos verificar"), m("cliente", "já faz três dias, quero uma solução")]);
conferir("cita a primeira e a última fala do cliente", resumo1.includes("meu pedido não chegou") && resumo1.includes("já faz três dias, quero uma solução"), true);
conferir("uma mensagem só do cliente vira citação direta", resumirTexto([m("cliente", "preciso de ajuda com o cardápio")]), 'O cliente relata: "preciso de ajuda com o cardápio"');
conferir("sem mensagem do cliente, diz isso — não inventa", resumirTexto([m("nos", "Olá!")]), "O cliente ainda não escreveu nesta conversa.");
conferir("mesma fala repetida não duplica a frase", resumirTexto([m("cliente", "não funciona"), m("cliente", "não funciona")]).includes("insiste"), true);

/* ---- 4. pendência, próximo passo e resolvido ---- */

conferir("cliente fala por último: aguardando a operação", estadoDaConversa([m("nos", "oi"), m("cliente", "ainda não recebi retorno")]).proximoPasso, "Responder ao cliente.");
conferir("nós perguntamos por último: aguardando o cliente", estadoDaConversa([m("cliente", "oi"), m("nos", "pode me confirmar o pedido?")]).pendencia.includes("aguarda a resposta do cliente"), true);
conferir("confirmação do cliente encerra", estadoDaConversa([m("nos", "ficou resolvido?"), m("cliente", "sim, perfeito, obrigado!")]).resolvido, true);
conferir("a operação avisando que resolveu também encerra", estadoDaConversa([m("cliente", "ainda não funciona"), m("nos", "já resolvemos, já está funcionando")]).resolvido, true);
conferir("nós falamos e não fizemos pergunta: aguarda confirmação do cliente", estadoDaConversa([m("cliente", "obrigado"), m("nos", "por nada, qualquer coisa chama")]).resolvido, false);
conferir("conversa vazia não quebra", estadoDaConversa([]), { pendencia: "Nada pendente.", proximoPasso: "Nenhuma ação — a conversa está vazia.", resolvido: false });

/* ---- 5. os três rascunhos ---- */

const rascunhos = rascunhosDaConversa({ nome: "Maria Silva", assunto: "Financeiro", pendencia: "x" });
conferir("são sempre três, na mesma ordem", rascunhos.map((r) => r.titulo), ["Responder agora", "Pedir o que falta", "Confirmar e encerrar"]);
conferir("usa o primeiro nome", rascunhos[0].texto.startsWith("Oi, Maria!"), true);
conferir("sem nome, ainda funciona", rascunhosDaConversa({ assunto: "Sistema", pendencia: "x" })[0].texto.startsWith("Oi!"), true);
conferir("nenhum rascunho promete prazo nem inventa protocolo", rascunhos.every((r) => !/\bàs \d{1,2}h\b|\bprotocolo \d/.test(r.texto)), true);

/* ---- o retrato inteiro, e a escolha do rascunho principal ---- */

const retrato = retratarConversaSemIA([m("cliente", "meu pedido não chegou"), m("nos", "vamos verificar")], { nome: "João" });
conferir("o retrato tem os oito campos do esquema da IA", Object.keys(retrato).sort(), ["resumo", "assunto", "humor", "pendencia", "proximoPasso", "resposta", "respostas", "resolvido"].sort());
conferir("nós falamos por último sem resolver: o rascunho principal pede o que falta", retratarConversaSemIA([m("cliente", "oi"), m("nos", "pode me mandar o número do pedido?")]).resposta.includes("preciso de mais uma informação"), true);
conferir("conversa resolvida: o rascunho principal confirma e encerra", retratarConversaSemIA([m("nos", "tudo certo?"), m("cliente", "perfeito, obrigado, resolveu!")]).resposta.includes("Passando para confirmar"), true);

/* ---- 6. a fiação: a rota não desiste mais sem provedor ---- */

const rota = ler("app/api/extensao/conversa/route.ts");
conferir("a rota não recusa mais de cara sem provedor configurado", /if \(!provedorDeIA\(\)\) \{\s*return responder/.test(rota), false);
conferir("o motor próprio entra quando o pedido estruturado não traz dados", rota.includes("retratarConversaSemIA"), true);
conferir("a rota do GET continua dizendo que dá para resumir mesmo sem provedor", /disponivel: true/.test(rota), true);

/* ---------- triagem sem IA (Fase 16) ---------- */

console.log("\n  TRIAGEM SEM IA\n");

const macros = [
  { titulo: "Como alterar o horário de funcionamento", corpo: "Para alterar o horário, acesse Configurações > Loja > Horários e salve." },
  { titulo: "Cancelamento do plano", corpo: "O cancelamento é feito pelo painel, em Plano > Cancelar." },
];

const cobranca = triarSemIA({ titulo: "Cobrança duplicada", relato: "Fui cobrado duas vezes na mensalidade e ninguém faz o estorno.", nome: "Maria Souza", macros });
conferir("cobrança pede apuração do financeiro", [cobranca.decisao, cobranca.areaSugerida, cobranca.gravidade], ["analisar", "Financeiro", "media"]);
conferir("e diz o que falta descobrir", cobranca.oQueFalta, ["Conferir a cobrança e o histórico de pagamentos da conta."]);

const procon = triarSemIA({ titulo: "Sistema parou", relato: "O sistema parou no sábado, perdi vendas e vou no Procon.", nome: "João", macros });
conferir("Procon e prejuízo são gravidade alta", procon.gravidade, "alta");
conferir("erro de sistema vai para o suporte técnico", procon.areaSugerida, "Suporte técnico");
conferir(
  "pedido cancelado não é intenção de sair",
  triarSemIA({ titulo: "Pedido cancelado", relato: "O pedido do cliente foi cancelado sozinho pelo sistema ontem.", nome: "Rui", macros }).gravidade === "alta",
  false
);
conferir(
  "cancelar o plano é",
  triarSemIA({ titulo: "Quero sair", relato: "Vou cancelar o meu plano se isso não for resolvido.", nome: "Rui", macros }).gravidade,
  "alta"
);

const coberta = triarSemIA({ titulo: "Horário de funcionamento", relato: "Como faço para alterar o horário de funcionamento da loja no domingo?", nome: "Ana Lima", macros });
conferir("dúvida coberta por texto aprovado: responder", coberta.decisao, "responder");
conferir("com o texto aprovado no rascunho", coberta.rascunho.includes("Configurações > Loja > Horários"), true);

const semTexto = triarSemIA({ titulo: "Sugestão", relato: "Gostaria que o cardápio tivesse modo escuro.", nome: "Bia", macros });
conferir("sem texto aprovado que cubra: na dúvida, analisar", semTexto.decisao, "analisar");

for (const [nome, t] of [["cobrança", cobranca], ["coberta", coberta], ["sem texto", semTexto]] as const) {
  const achados = conferirRascunho(t.rascunho, { nome: nome === "cobrança" ? "Maria Souza" : nome === "coberta" ? "Ana Lima" : "Bia", publicadas: [], publico: false });
  conferir(`o rascunho (${nome}) passa na conferência de nome e acolhimento`, achados.filter((a) => a.tipo === "sem-nome" || a.tipo === "sem-validacao").length, 0);
}

/* ---------- dossiê sem IA ---------- */

console.log("\n  DOSSIÊ SEM IA\n");

const casoBase = {
  protocol: "RA-XY12", customer: "Maria Souza", source: "Reclame Aqui", status: "Novo", title: "Cobrança duplicada",
  createdAt: "2026-09-10", description: "Fui cobrada duas vezes.", publicResponse: null, evaluated: false,
  resolved: false, score: undefined, churnRisk: false, category: "Financeiro",
} as unknown as Parameters<typeof dossieSemIA>[0]["caso"];

const novo = dossieSemIA({ caso: casoBase, linhaDoTempo: [], historico: [] });
conferir("sem resposta pública: a pendência é publicar", novo.pendencias, ["Publicar a resposta pública."]);
conferir("e o último diz que nada aconteceu", novo.ultimo, "Nada aconteceu depois do relato: ainda sem resposta pública.");
conferir("três respostas, nos títulos do dossiê", novo.respostas.map((r) => r.titulo), ["Acolher e apurar", "Responder com solução", "Encerrar e pedir reavaliação"]);
conferir("o texto começa pelo nome", novo.respostas.every((r) => r.texto.startsWith("Olá, Maria!")), true);
conferir("onde falta a solução, fica o espaço para preencher", novo.respostas[1].texto.includes("[Explique aqui"), true);

const movido = dossieSemIA({
  caso: { ...casoBase!, publicResponse: "Olá, Maria, estamos verificando.", status: "Aguardando nossa réplica" },
  linhaDoTempo: ["12/09 — anotação de Ana: pedido ao financeiro", "13/09 — movido para Financeiro, **ainda não devolvido**"],
  historico: ["01/08 — NPS nota 3"],
});
conferir("réplica e área sem retorno viram pendência", movido.pendencias, ["Responder a réplica do consumidor.", "Cobrar o retorno da área para onde o caso foi movido.", "Pedir a avaliação ao consumidor."]);
conferir("o último é o último registro da linha do tempo", movido.ultimo, "13/09 — movido para Financeiro, **ainda não devolvido**");
conferir("o dossiê traz a linha do tempo e as outras frentes", movido.dossie.includes("Linha do tempo interna:") && movido.dossie.includes("Outras frentes deste contato:"), true);
conferir("sem caso, sai do histórico do contato", dossieSemIA({ caso: null, linhaDoTempo: [], historico: ["01/08 — NPS nota 3"] }).ultimo, "01/08 — NPS nota 3");

const triagem = readFileSync(resolve(RAIZ, "app/api/extensao/triagem/route.ts"), "utf8");
const dossieRota = readFileSync(resolve(RAIZ, "app/api/extensao/resumo-caso/route.ts"), "utf8");
conferir("o dossiê da extensão cai no motor, e as peças vão junto", /provedor: "motor-proprio" as const,\s*dados: dossieSemIA\(/.test(dossieRota) && dossieRota.includes("    pecas,"), true);
conferir("a triagem da extensão cai no motor quando a IA não responde", /provedor: "motor-proprio",\s*dados: triarSemIA\(/.test(triagem), true);
const conversas = readFileSync(resolve(RAIZ, "lib/actions/conversas.ts"), "utf8");
conferir("o resumo das conversas da plataforma também", conversas.includes("retratarConversaSemIA("), true);

console.log(falhas === 0 ? "\n  O motor próprio lê a conversa direito, mesmo sem nenhuma IA.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
