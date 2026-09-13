/**
 * Prova das regras de ofertas e renegociações — `lib/models/negociacao.ts`.
 *
 * Sem banco. A fórmula da renegociação é conferida com contas feitas à
 * mão (plano anual e mensal), cada linha saindo da de cima como o
 * documento escreve; a oferta, com a regra do "fora do padrão" em cada
 * criticidade; e os textos, com o que o documento exige que eles digam.
 *
 *   npm run check:negociacao
 */
import {
  calcularRenegociacao,
  centavosDoTexto,
  custoDoModelo,
  mensagemAoFinanceiro,
  mesDaOperacao,
  modeloDeOferta,
  ofertaSugerida,
  precisaDeValidacao,
  prontoParaOferta,
  reais,
  textoDaProposta,
  type CalculoDaRenegociacao,
} from "../lib/models/negociacao";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

/* Reais sem o espaço especial do Intl, para comparar texto. */
const r = (cents: number) => reais(cents).replace(/\s/g, " ");

console.log("\n— Renegociação: a fórmula do documento —");

/*
  Plano anual de R$ 1.200,00, de 01/01/2026 a 01/01/2027 (365 dias),
  cancelado em 01/07/2026 (184 dias não utilizados). À mão:
    por dia      1.200,00 ÷ 365 = 3,2877… → R$ 3,29
    proporcional 3,29 × 184       = R$ 605,36
    encargos     605,36 × 0,30    = 181,608 → R$ 181,61
    final        605,36 − 181,61  = R$ 423,75
*/
const anual = calcularRenegociacao({ pagoCents: 120000, inicio: "2026-01-01", fim: "2027-01-01", solicitacao: "2026-07-01" }) as CalculoDaRenegociacao;
confere(
  "plano anual: dias, por dia, proporcional, encargos e final",
  [anual.diasDoPlano, anual.diasNaoUtilizados, anual.valorPorDiaCents, anual.proporcionalCents, anual.descontoCents, anual.finalCents],
  [365, 184, 329, 60536, 18161, 42375]
);
confere("cada linha sai da de cima: por dia × dias = proporcional", anual.valorPorDiaCents * anual.diasNaoUtilizados, anual.proporcionalCents);

/* Plano mensal de R$ 299,90 (30 dias), cancelado no 12º dia: 18 dias × R$ 10,00 = 180,00; − 54,00 = 126,00. */
const mensal = calcularRenegociacao({ pagoCents: 29990, inicio: "2026-09-01", fim: "2026-10-01", solicitacao: "2026-09-13" }) as CalculoDaRenegociacao;
confere("plano mensal", [mensal.diasDoPlano, mensal.diasNaoUtilizados, mensal.valorPorDiaCents, mensal.finalCents], [30, 18, 1000, 12600]);

confere("cancelado no último dia: nada a restituir", (calcularRenegociacao({ pagoCents: 29990, inicio: "2026-09-01", fim: "2026-10-01", solicitacao: "2026-10-01" }) as CalculoDaRenegociacao).finalCents, 0);
confere("solicitação antes do início é erro", "erro" in calcularRenegociacao({ pagoCents: 1000, inicio: "2026-09-01", fim: "2026-10-01", solicitacao: "2026-08-20" }), true);
confere("solicitação depois do fim é erro", "erro" in calcularRenegociacao({ pagoCents: 1000, inicio: "2026-09-01", fim: "2026-10-01", solicitacao: "2026-10-05" }), true);
confere("fim antes do início é erro", "erro" in calcularRenegociacao({ pagoCents: 1000, inicio: "2026-10-01", fim: "2026-09-01", solicitacao: "2026-09-15" }), true);
confere("valor pago zero é erro", "erro" in calcularRenegociacao({ pagoCents: 0, inicio: "2026-09-01", fim: "2026-10-01", solicitacao: "2026-09-15" }), true);

console.log("\n— Valores digitados —");
confere("1.234,56", centavosDoTexto("1.234,56"), 123456);
confere("R$ 1.200", centavosDoTexto("R$ 1.200"), 120000);
confere("89,9", centavosDoTexto("89,9"), 8990);
confere("1234.56 (ponto decimal)", centavosDoTexto("1234.56"), 123456);
confere("três casas não é valor", centavosDoTexto("10,555"), null);
confere("texto não é valor", centavosDoTexto("abc"), null);

console.log("\n— Oferta: a sugestão e o fora do padrão —");
confere("Urgente sugere 1 mês gratuito", ofertaSugerida("Urgente")?.id, "mes-gratis");
confere("Alta sugere 10% por 3 meses", ofertaSugerida("Alta")?.id, "desconto-10-3m");
confere("Normal não tem oferta prevista", ofertaSugerida("Normal"), null);
confere("custo de 1 mês com mensalidade de R$ 150", custoDoModelo(modeloDeOferta("mes-gratis"), 15000), 15000);
confere("custo de 10% × 3 meses com mensalidade de R$ 150", custoDoModelo(modeloDeOferta("desconto-10-3m"), 15000), 4500);

const base = { mensalidadeCents: 15000 };
confere("Urgente, 1 mês pelo custo do modelo: dentro do padrão", precisaDeValidacao({ ...base, prioridade: "Urgente", modelo: "mes-gratis", valorCents: 15000 }), false);
confere("Urgente, 1 mês abaixo do custo: dentro do padrão", precisaDeValidacao({ ...base, prioridade: "Urgente", modelo: "mes-gratis", valorCents: 10000 }), false);
confere("Urgente, 1 mês acima do custo: fora do padrão", precisaDeValidacao({ ...base, prioridade: "Urgente", modelo: "mes-gratis", valorCents: 20000 }), true);
confere("Urgente com o modelo de Alta: fora do padrão", precisaDeValidacao({ ...base, prioridade: "Urgente", modelo: "desconto-10-3m", valorCents: 4500 }), true);
confere("Alta, 10% × 3 pelo custo: dentro do padrão", precisaDeValidacao({ ...base, prioridade: "Alta", modelo: "desconto-10-3m", valorCents: 4500 }), false);
confere("Alta pedindo 1 mês gratuito: fora do padrão", precisaDeValidacao({ ...base, prioridade: "Alta", modelo: "mes-gratis", valorCents: 15000 }), true);
confere("Normal, qualquer condição: fora do padrão", precisaDeValidacao({ ...base, prioridade: "Normal", modelo: "personalizada", valorCents: 0 }), true);
confere("sem mensalidade no cadastro, o modelo certo não pede validação", precisaDeValidacao({ prioridade: "Urgente", modelo: "mes-gratis", valorCents: 99999 }), false);

console.log("\n— Nunca como primeira abordagem —");
confere("sem triagem e sem 1º contato", prontoParaOferta({}), { pronto: false, falta: ["a triagem da criticidade", "o 1º contato com o cliente"] });
confere("triado e contatado", prontoParaOferta({ triadaEm: "2026-09-14T12:00:00Z", primeiroContatoEm: "2026-09-14T13:00:00Z" }).pronto, true);

console.log("\n— Os textos —");
const proposta = textoDaProposta({ nome: "maria souza", plano: "Plano Anual", calculo: anual, validaAte: "30/09/2026 às 18:00" });
confere(
  "a proposta traz o que o documento exige",
  [
    proposta.startsWith("Olá, Maria!"),
    proposta.includes(`Valor final a ser restituído: ${reais(42375)}.`),
    proposta.includes("Dias não utilizados: 184"),
    proposta.includes("via Pix"),
    proposta.includes("não é possível estorno parcial"),
    proposta.includes("Não gera precedente"),
    proposta.includes("Validade: até 30/09/2026 às 18:00"),
    proposta.includes("confirmação expressa"),
  ],
  [true, true, true, true, true, true, true, true]
);
const financeiro = mensagemAoFinanceiro({ cliente: "Pizzaria Teste", portal: "https://portal.x/1", valorFinalCents: 42375, protocolo: "RA-1" });
confere(
  "o pedido ao financeiro tem portal e valor, e deixa a chave Pix para o Slack",
  [financeiro.includes("Gabriela"), financeiro.includes("Portal: https://portal.x/1"), financeiro.includes(`Valor final da proposta: ${r(42375).replace(/ /g, " ")}`) || financeiro.includes("423,75"), financeiro.includes("[cole os dados que o cliente enviou]")],
  [true, true, true, true]
);

console.log("\n— O mês da operação —");
confere("23h30 de 30/09 em Brasília ainda é setembro", mesDaOperacao(new Date("2026-10-01T02:30:00Z")), "2026-09");
confere("00h01 de 01/10 em Brasília já é outubro", mesDaOperacao(new Date("2026-10-01T03:01:00Z")), "2026-10");

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
