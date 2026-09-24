/**
 * O impacto que a conversa mostra (Fase 28).
 *
 *   npm run check:impacto-conversa
 *
 * Sem banco: o desconto, os meses sem mensalidade, a isenção, o estorno
 * e a cortesia dados por nós viram condição com o valor pela
 * mensalidade; o que o cliente escreve e o percentual que não é
 * desconto ficam de fora; a mesma condição dita duas vezes é uma só.
 */
import { condicaoDaFrase, condicoesNaConversa, descricaoDoImpacto } from "../lib/models/impactoNaConversa";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 70)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 70)}`);
}

const MENSALIDADE = 29900;
const c = (f: string, m: number | null = MENSALIDADE) => {
  const x = condicaoDaFrase(f, m);
  return x ? [x.tipo, x.descricao, x.valorCents ?? null] : null;
};

console.log("\n  Cada condição, com o valor\n");
conferir("20% na próxima fatura", c("Vou te dar 20% de desconto na próxima fatura."), ["percentual", "20% em 1 mensalidade", 5980]);
conferir("10% por 3 meses (o modelo da Alta)", c("Consigo 10% de desconto por 3 meses."), ["percentual", "10% em 3 mensalidades", 8970]);
conferir("15% nas próximas 3 faturas", c("Te dou 15% nas próximas 3 faturas."), ["percentual", "15% em 3 mensalidades", 13455]);
conferir("1 mês grátis (o modelo da Urgente)", c("Você terá 1 mês grátis."), ["meses-gratis", "1 mensalidade sem cobrança", 29900]);
conferir("dois meses sem cobrança", c("Dois meses sem cobrança, combinado?"), ["meses-gratis", "2 mensalidades sem cobrança", 59800]);
conferir("isentar a próxima mensalidade", c("Vamos isentar a próxima mensalidade."), ["meses-gratis", "1 mensalidade sem cobrança", 29900]);
conferir("estorno em reais", c("Fizemos um estorno de R$ 149,90 no seu cartão."), ["valor", "R$ 149,90 concedidos", 14990]);
conferir("R$ 1.200,00 de desconto", c("Te dou R$ 1.200,00 de desconto."), ["valor", "R$ 1.200,00 concedidos", 120000]);
conferir("cortesia sem valor", c("Como cortesia, não vamos cobrar a taxa."), ["condicao", "Condição especial concedida", null]);
conferir("sem mensalidade conhecida: sem valor", c("Vou te dar 20% de desconto na próxima fatura.", null), ["percentual", "20% em 1 mensalidade", null]);

console.log("\n  O que não é condição\n");
conferir("percentual que não é desconto", c("O sistema ficou 20% mais rápido."), null);
conferir("prazo em meses não é mês grátis", c("Seu pedido chega em 2 meses."), null);
conferir("conversa sem condição", condicoesNaConversa([{ de: "nos", texto: "Olá! Já verifiquei a sua conta." }]), []);

console.log("\n  Na conversa inteira\n");
const conversa = [
  { de: "cliente" as const, texto: "Quero 50% de desconto na próxima fatura, senão cancelo." },
  { de: "nos" as const, texto: "Entendo. Consigo 20% de desconto na próxima fatura." },
  { de: "cliente" as const, texto: "Pode ser." },
  { de: "nos" as const, texto: "Combinado: 20% de desconto na próxima fatura. Obrigado!" },
];
const achadas = condicoesNaConversa(conversa, MENSALIDADE);
conferir("só as nossas: o pedido do cliente não é condição dada", achadas.map((x) => x.descricao), ["20% em 1 mensalidade"]);
conferir("a mesma condição dita duas vezes é uma, a mais recente", achadas[0].trecho, "Combinado: 20% de desconto na próxima fatura.");
conferir("descrição para o Impacto", descricaoDoImpacto(achadas[0], "24/09/2026"), "20% em 1 mensalidade — combinado na conversa do WhatsApp em 24/09/2026: “Combinado: 20% de desconto na próxima fatura.”");

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
