/**
 * O OKR calcula o que o documento do time diz?
 *
 *   npm run check:okr
 *
 * Sem banco (04/11/2026). O exemplo do próprio OKR (12 de 20 = 60%), as
 * regras do KR1 (todos os elegíveis no denominador, uma linha por conta,
 * "Parcialmente" e sem resposta não contam, corte de 15/12), a leitura do
 * painel no último dia útil e a validação do que vem da tela.
 */
import {
  confiancaRecuperada,
  faltamParaMeta,
  situacao,
  leituraDoMes,
  mesesDoOkr,
  npsDasNotas,
  pesquisaNaConversa,
  respostaNaMensagem,
  OKR_4T_2026,
  problemaDoOkr,
  type DetratorDoKr,
} from "../lib/models/okr";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 40)}`);
}

const base = (i: number, extra: Partial<DetratorDoKr> = {}): DetratorDoKr => ({ id: `r${i}`, conta: `c${i}`, dia: "2026-10-10", contatadoDia: "2026-10-11", contatadoNoPrazo: true, ...extra });
const sucesso = (i: number) => base(i, { confirmadoDia: "2026-10-20", enviadaDia: "2026-10-20", resposta: "sim", respondidaDia: "2026-10-21" });
const periodo = { inicio: "2026-10-01", corte: "2026-12-15", ate: "2026-12-31" };

console.log("\n-- o exemplo do documento");
const vinte = [...Array.from({ length: 12 }, (_, i) => sucesso(i)), ...Array.from({ length: 8 }, (_, i) => base(100 + i))];
conferir("12 sucessos entre 20 elegíveis = 60%", confiancaRecuperada(vinte, periodo).percentual, 60);

console.log("\n-- as regras do KR1");
const c = confiancaRecuperada(
  [
    sucesso(1),
    base(2, { confirmadoDia: "2026-10-20", enviadaDia: "2026-10-20", resposta: "parcialmente", respondidaDia: "2026-10-22" }),
    base(3, { confirmadoDia: "2026-10-20", enviadaDia: "2026-10-20", resposta: "nao", respondidaDia: "2026-10-22" }),
    base(4, { confirmadoDia: "2026-10-20", enviadaDia: "2026-10-21" }),
    base(5, { contatadoDia: null, contatadoNoPrazo: false }),
    base(6, { confirmadoDia: "2026-10-25" }),
    base(7, { enviadaDia: "2026-10-25", resposta: "sim", respondidaDia: "2026-10-26" }),
  ],
  periodo
);
conferir("só a solução confirmada + \"Sim\" é sucesso", c.sucesso, 1);
conferir("todos ficam no denominador (inclusive o não contatado)", c.elegiveis, 7);
conferir("distribuição Sim / Parcialmente / Não", [c.sim, c.parcialmente, c.nao], [2, 1, 1]);
conferir("enviada sem resposta = recuperação não comprovada", c.semResposta, 1);
conferir("\"Sim\" sem solução confirmada não conta", c.sucesso, 1);
conferir("confirmada e ainda sem pesquisa: próximo passo", c.confirmadosSemPesquisa, 1);
conferir("não contatados", c.naoContatados, 1);
conferir("taxa de resposta = respondidas ÷ enviadas", c.taxaDeResposta, 80);

const conta = confiancaRecuperada([base(1, { conta: "mesma" }), { ...sucesso(2), conta: "mesma" }], periodo);
conferir("duas respostas da mesma conta: uma linha, vale o sucesso", [conta.elegiveis, conta.sucesso], [1, 1]);

const corte = confiancaRecuperada([base(1, { dia: "2026-12-16" }), base(2, { dia: "2026-12-15" }), base(3, { dia: "2026-09-30" })], periodo);
conferir("entra até o corte (15/12) e a partir do início (01/10)", corte.elegiveis, 1);

const outubro = confiancaRecuperada([sucesso(1), base(2, { dia: "2026-11-03" }), base(3, { confirmadoDia: "2026-10-20", enviadaDia: "2026-10-30", resposta: "sim", respondidaDia: "2026-11-02" })], { ...periodo, ate: "2026-10-31" });
conferir("em outubro: quem chegou em novembro ainda não entra", outubro.elegiveis, 2);
conferir("e o \"Sim\" de novembro não conta em outubro", outubro.sucesso, 1);
conferir("sem elegíveis, sem percentual (não é 0%)", confiancaRecuperada([], periodo).percentual, null);
conferir("faltam para 44,3% de 20 elegíveis com 5 sucessos", faltamParaMeta({ ...confiancaRecuperada(vinte, periodo), sucesso: 5 }, 44.3), 4);

conferir("80,3% contra meta 83,3%: abaixo, não perto", situacao(80.3, 83.3), "abaixo");
conferir("82,5% contra 83,3%: perto", situacao(82.5, 83.3), "perto");
conferir("nota 8,85 contra 8,9: perto", situacao(8.85, 8.9, "nota"), "perto");

console.log("\n-- NPS e painel");
conferir("NPS: 5 promotores, 3 neutros, 2 detratores = +30", npsDasNotas([10, 9, 9, 10, 9, 8, 7, 7, 3, 6]), 30);
conferir("NPS sem respostas: sem número", npsDasNotas([]), null);
const leituras = [
  { dia: "2026-10-15", voltaria: 80.8, nota: 8.9, solucao: 94, resposta: 90 },
  { dia: "2026-10-30", voltaria: 80.2, nota: 8.9, solucao: 94, resposta: 90 },
  { dia: "2026-10-31", voltaria: 99, nota: 8.9, solucao: 94, resposta: 90 },
  { dia: "2026-11-04", voltaria: 80.3, nota: 8.9, solucao: 94, resposta: 90 },
];
conferir("outubro: a leitura do último dia útil (30/10), não a do sábado", leituraDoMes(leituras, "2026-10", "2026-10-30", "2026-11-04")?.voltaria, 80.2);
conferir("novembro em curso: a mais recente até hoje", leituraDoMes(leituras, "2026-11", "2026-11-30", "2026-11-04")?.voltaria, 80.3);
conferir("mês sem leitura: nada (a de outro mês não serve)", leituraDoMes(leituras, "2026-09", "2026-09-30", "2026-11-04"), null);

console.log("\n-- vigência e validação");
conferir("meses do 4º tri", mesesDoOkr("2026-10-01", "2026-12-31"), ["2026-10", "2026-11", "2026-12"]);
conferir("virada de ano", mesesDoOkr("2026-12-01", "2027-02-28"), ["2026-12", "2027-01", "2027-02"]);
conferir("o OKR do 4º tri é válido", problemaDoOkr({ id: "", ...OKR_4T_2026 }), null);
conferir("sem objetivo", problemaDoOkr({ id: "", ...OKR_4T_2026, objetivo: " " }), "Escreva o objetivo.");
conferir("meta fora da escala da métrica", problemaDoOkr({ id: "", ...OKR_4T_2026, krs: [{ ...OKR_4T_2026.krs[0], meta: 160 }] }), "A meta do KR1 precisa ficar entre 0 e 100.");
conferir("meta de mês fora da vigência", problemaDoOkr({ id: "", ...OKR_4T_2026, krs: [{ ...OKR_4T_2026.krs[0], metasMensais: { "2027-01": 50 } }] }), "O KR1 tem meta para um mês fora da vigência.");
conferir("métrica inventada", problemaDoOkr({ id: "", ...OKR_4T_2026, krs: [{ ...OKR_4T_2026.krs[0], metrica: "xyz" as never }] }), "O KR1 está sem métrica.");

console.log("\n-- a pesquisa de confiança lida na conversa");
for (const [t, r] of [
  ["Sim", "sim"],
  ["sim, foi recuperada sim", "sim"],
  ["Com certeza!", "sim"],
  ["Parcialmente", "parcialmente"],
  ["em parte, ainda tenho receio", "parcialmente"],
  ["Não", "nao"],
  ["ainda não", "nao"],
  ["olha, até que sim, mas o problema voltou ontem", null],
  ["Bom dia", null],
  ["s".repeat(130), null],
] as const) conferir(`"${t.slice(0, 40)}"`, respostaNaMensagem(t), r);
const m = (de: "nos" | "cliente", texto: string, h: number) => ({ de, texto, em: new Date(Date.UTC(2026, 10, 4, h)) });
conferir("a pergunta e o \"Sim\" logo depois", pesquisaNaConversa([m("nos", "Ficou tudo certo?", 10), m("cliente", "Ficou", 11), m("nos", "Após essa tratativa, você considera que sua confiança na Cardápio Web foi recuperada?", 12), m("cliente", "Sim!", 13)])?.resposta, "sim");
conferir("pergunta sem resposta ainda: enviada, sem resposta", pesquisaNaConversa([m("nos", "Sua confiança na Cardápio Web foi recuperada?", 12), m("cliente", "Vou pensar", 13)])?.resposta, null);
conferir("\"sim\" antes da pergunta não vale", pesquisaNaConversa([m("cliente", "Sim", 11), m("nos", "Sua confiança foi recuperada?", 12)])?.resposta, null);
conferir("sem a pergunta: nada", pesquisaNaConversa([m("nos", "Oi, tudo bem?", 12), m("cliente", "Sim", 13)]), null);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
