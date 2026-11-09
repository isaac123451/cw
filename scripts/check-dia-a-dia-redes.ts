/**
 * O dia a dia das Redes conta certo?
 *
 *   npm run check:dia-a-dia-redes
 *
 * Sem banco (09/11/2026): novos pelo dia da chegada, 1º contato pelo dia
 * dele, fechados pelo dia gravado (e só os que estão numa etapa final),
 * saldo = novos − fechados, e o dia em Brasília (23h de lá é o mesmo dia).
 */
import { diaADiaDasRedes, diaDeBrasilia } from "../lib/models/diaADiaDasRedes";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${JSON.stringify(esperado)}`);
}

const hoje = "2026-11-09";
const linhas = diaADiaDasRedes(
  [
    { createdAt: "2026-11-09", recebidaEm: "2026-11-09T13:00:00Z", status: "Recebido" },
    { createdAt: "2026-11-08", recebidaEm: "2026-11-09T02:30:00Z", status: "Em tratativa", primeiroContatoEm: "2026-11-09T15:00:00Z" },
    { createdAt: "2026-11-01", status: "Resolvido", encerradoEm: "2026-11-09T18:00:00Z" },
    { createdAt: "2026-11-01", status: "Encaminhado", encerradoEm: "2026-11-08T12:00:00Z" },
    { createdAt: "2026-11-01", status: "Em tratativa", encerradoEm: "2026-11-07T12:00:00Z" },
    { createdAt: "2026-11-01", status: "Resolvido" },
  ],
  hoje,
  14
);
const de = (dia: string) => linhas.find((l) => l.dia === dia)!;
conferir("14 dias, do mais novo para o mais antigo", [linhas.length, linhas[0].dia, linhas[0].emCurso], [14, "2026-11-09", true]);
conferir("09/11: 1 novo (o das 23h30 de 08/11 é de 08/11)", de("2026-11-09").novos, 1);
conferir("08/11: o que chegou às 23h30 de Brasília", de("2026-11-08").novos, 1);
conferir("09/11: 1º contato", de("2026-11-09").primeiroContato, 1);
conferir("09/11: 1 resolvido; saldo 0", [de("2026-11-09").resolvidos, de("2026-11-09").saldo], [1, 0]);
conferir("08/11: encaminhado é outro fechamento; saldo 0", [de("2026-11-08").outrosFechamentos, de("2026-11-08").saldo], [1, 0]);
conferir("data de fechamento num caso reaberto não conta", de("2026-11-07").resolvidos + de("2026-11-07").outrosFechamentos, 0);
conferir("fechado sem data não aparece em dia nenhum", linhas.reduce((s, l) => s + l.resolvidos, 0), 1);
conferir("dia em Brasília", [diaDeBrasilia("2026-11-10T02:00:00Z"), diaDeBrasilia("2026-11-10"), diaDeBrasilia(undefined)], ["2026-11-09", "2026-11-10", null]);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
