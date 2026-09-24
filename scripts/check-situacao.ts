/**
 * O resumo que situa (Fase 28).
 *
 *   npm run check:situacao
 *
 * Sem banco e sem IA: o que o cliente quer, o que foi feito, o que
 * prometemos (com a data tirada da mensagem e se venceu), o que falta e
 * o risco; o tamanho das listas pela conversa; e a conferência da
 * situação da IA — citação inventada sai, o risco não desce abaixo das
 * regras.
 */
import { citacaoExiste, conferirSituacao, itensPorLista, situarSemIA, type MensagemParaSituar } from "../lib/models/resumoQueSitua";
import { instanteDe } from "../lib/services/horasUteis";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)?.slice(0, 70)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)?.slice(0, 70)}`);
}

const c = (texto: string, carimbo?: string): MensagemParaSituar => ({ de: "cliente", texto, carimbo });
const n = (texto: string, carimbo?: string): MensagemParaSituar => ({ de: "nos", texto, carimbo });
const agora = instanteDe("2026-09-24", 11 * 60);

const conversa = [
  c("Bom dia. A impressora parou de imprimir os pedidos desde ontem.", "09:00, 22/09/2026"),
  n("Bom dia, Ana! Já verifiquei a sua conta. Vou te retornar amanhã às 10h com a solução.", "09:10, 22/09/2026"),
  c("Ok, fico no aguardo.", "09:12, 22/09/2026"),
  n("Ana, já ajustei a configuração da impressora. Pode testar?", "10:30, 23/09/2026"),
  c("Continua sem imprimir. Preciso que resolvam hoje, estou perdendo vendas!", "08:00, 24/09/2026"),
];

console.log("\n  A situação pelas regras\n");
const s = situarSemIA(conversa, agora);
conferir("quer: o último pedido do cliente", s.quer.texto, "Preciso que resolvam hoje, estou perdendo vendas!");
conferir("feito: o que nós dissemos que fizemos", s.feito.map((f) => f.texto), ["Já verifiquei a sua conta.", "Ana, já ajustei a configuração da impressora."]);
conferir("prometido: com a data da mensagem — 'amanhã' de 22/09 é 23/09", s.prometido.map((p) => [p.quando, p.vencida]), [["23/09 às 10:00", true]]);
conferir("falta: o cliente falou por último", s.falta, "O cliente escreveu por último e aguarda retorno da operação.");
conferir("risco: perdendo vendas (operação parada) — alto", s.risco.nivel, "alto");
conferir("promessa vencida sozinha — médio", situarSemIA(conversa.slice(0, 4), agora).risco.nivel, "medio");
conferir("o porquê do risco cita a promessa vencida", s.risco.porque.includes("1 promessa(s) nossa(s) com o prazo vencido"), true);
conferir("toda citação das regras existe na conversa", [s.quer, ...s.feito, ...s.prometido].every((p) => citacaoExiste(p.citacao, conversa)), true);
conferir("Procon: risco alto", situarSemIA([n("Olá"), c("Vou abrir reclamação no Procon")], agora).risco.nivel, "alto");
conferir("conversa tranquila: risco baixo", situarSemIA([n("Pronto, resolvido"), c("Obrigado, deu certo")], agora).risco, { nivel: "baixo", porque: "nenhum sinal de risco na conversa" });
conferir("resolvido: falta confirmar", situarSemIA([c("não imprime"), n("Pronto, resolvido")], agora).falta, "Nada pendente — confirmar com o cliente que ficou resolvido.");
conferir("promessa sem data entra sem 'quando'", situarSemIA([c("não imprime"), n("Vou verificar com o suporte técnico.")], agora).prometido, [{ texto: "Vou verificar com o suporte técnico.", citacao: "Vou verificar com o suporte técnico." }]);

console.log("\n  O tamanho que a conversa pede\n");
conferir("até 6 mensagens: 2 itens; até 20: 3; mais: 5", [itensPorLista(5), itensPorLista(12), itensPorLista(40)], [2, 3, 5]);
conferir("conversa longa corta as listas em 3", situarSemIA(Array.from({ length: 12 }, (_, i) => (i % 2 ? n(`Já ajustei o item ${i}.`) : c("e agora?"))), agora).feito.length, 3);

console.log("\n  A situação da IA, conferida\n");
const daIA = conferirSituacao(
  {
    quer: { texto: "Quer a impressora funcionando hoje", citacao: "preciso que resolvam HOJE, estou perdendo vendas" },
    feito: [{ texto: "Ajustamos a impressora", citacao: "já ajustei a configuração da impressora" }, { texto: "Trocamos o cabo", citacao: "troquei o cabo USB" }],
    prometido: [{ texto: "Retorno com a solução", quando: "amanhã", citacao: "Vou te retornar amanhã às 10h com a solução" }, { texto: "Técnico visita", quando: "sexta", citacao: "o técnico vai na sexta" }],
    falta: "Resolver a impressão",
    risco: { nivel: "baixo", porque: "tudo bem" },
  },
  conversa,
  agora
);
conferir("citação que existe (sem caixa e acento) fica", daIA.quer.citacao, "preciso que resolvam HOJE, estou perdendo vendas");
conferir("citação inventada sai, o ponto fica", daIA.feito.map((f) => [f.texto, f.citacao ?? null]), [["Ajustamos a impressora", "já ajustei a configuração da impressora"], ["Trocamos o cabo", null]]);
conferir("prometido: a data vem da mensagem; a da IA com a mesma citação sai", daIA.prometido.map((p) => [p.quando, p.vencida ?? null, p.citacao ?? null]), [["23/09 às 10:00", true, "Vou te retornar amanhã às 10h com a solução."], ["sexta", null, null]]);
conferir("risco da IA abaixo das regras: vale o das regras", daIA.risco.nivel, "alto");
conferir("IA com mais risco que as regras: vale o da IA", conferirSituacao({ risco: { nivel: "alto", porque: "cliente ameaçou sair" } }, conversa.slice(0, 4), agora).risco, { nivel: "alto", porque: "cliente ameaçou sair" });
conferir("sem situação da IA: as regras", conferirSituacao(undefined, conversa, agora).quer.texto, s.quer.texto);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
