/**
 * A nota depois de cada resposta pronta conta certo?
 *
 *   npm run check:respostas-que-funcionam
 *
 * Sem banco (09/11/2026): só avaliações depois do primeiro uso; cada caso
 * uma vez por texto; abaixo de 3 avaliações, nada.
 */
import { efeitoPorResposta } from "../lib/models/respostasQueFuncionam";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${JSON.stringify(esperado)}`);
}

const u = (macroId: string, caseId: string, usadoEm: string, nota: number | null, avaliadoEm: string | null) => ({ macroId, caseId, usadoEm, nota, avaliadoEm });

const base = [
  u("A", "c1", "2026-11-01", 10, "2026-11-05"),
  u("A", "c2", "2026-11-01", 8, "2026-11-04"),
  u("A", "c3", "2026-11-02", 9, "2026-11-02"),
  u("A", "c1", "2026-11-03", 10, "2026-11-05"),
  u("A", "c4", "2026-11-06", 2, "2026-11-01"),
  u("A", "c5", "2026-11-06", null, null),
  u("B", "c1", "2026-11-01", 10, "2026-11-05"),
  u("B", "c2", "2026-11-01", 8, "2026-11-04"),
];
const e = efeitoPorResposta(base);
conferir("A: três casos avaliados depois (10, 8, 9) = 9,0", e.A, { avaliacoes: 3, media: 9 });
conferir("o mesmo caso usado duas vezes conta uma", e.A?.avaliacoes, 3);
conferir("avaliação de antes do uso não conta (c4, nota 2)", e.A?.media !== 7.3, true);
conferir("B com duas avaliações: nada (abaixo de 3)", e.B, undefined);
conferir("avaliado no mesmo dia do uso conta", efeitoPorResposta([u("C", "x", "2026-11-02T15:00:00Z", 10, "2026-11-02T00:00:00Z"), u("C", "y", "2026-11-02", 10, "2026-11-03"), u("C", "z", "2026-11-02", 7, "2026-11-03")]).C?.avaliacoes, 3);
conferir("sem usos: nada", efeitoPorResposta([]), {});

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
