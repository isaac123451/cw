import { eFinalDasRedes } from "@/lib/models/redes";

/**
 * O dia a dia das Redes (09/11/2026) — "preciso de algo parecido na parte de
 * redes sociais", sobre a tabela da Nota no Índice do Reclame Aqui.
 *
 * As Redes não têm nota; o que diz se a frente está andando é a fila: quanto
 * chegou, quanto teve o 1º contato e quanto fechou em cada dia, e o saldo
 * (chegou − fechou). Só entra o que tem data de verdade:
 *
 * - **Novos:** o dia em que o atendimento chegou (`recebidaEm`, ou a criação).
 * - **1º contato:** o dia do primeiro contato registrado.
 * - **Fechados:** o dia gravado em `encerradoEm`. Até 09/11 só o diálogo
 *   "Encerrar" gravava esse dia — arrastar no quadro não —, então os
 *   fechamentos de antes aparecem só em parte; a tela diz isso.
 */

export interface AtendimentoDoDia {
  recebidaEm?: string;
  createdAt: string;
  primeiroContatoEm?: string;
  encerradoEm?: string;
  status: string;
}

export interface LinhaDoDia {
  dia: string;
  novos: number;
  primeiroContato: number;
  resolvidos: number;
  /** Encaminhado, sem contato, sem identificação: fechou sem contar como resolvido. */
  outrosFechamentos: number;
  /** Novos − fechados: positivo, a fila cresceu. */
  saldo: number;
  emCurso: boolean;
}

/** O dia em Brasília de uma data ISO (ou já AAAA-MM-DD). */
export function diaDeBrasilia(iso?: string | null): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);
}

const menos = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

export function diaADiaDasRedes(atendimentos: AtendimentoDoDia[], hoje: string, dias = 14): LinhaDoDia[] {
  const linhas = new Map<string, LinhaDoDia>();
  for (let i = 0; i < dias; i += 1) {
    const dia = menos(hoje, i);
    linhas.set(dia, { dia, novos: 0, primeiroContato: 0, resolvidos: 0, outrosFechamentos: 0, saldo: 0, emCurso: i === 0 });
  }
  const somar = (dia: string | null, campo: "novos" | "primeiroContato" | "resolvidos" | "outrosFechamentos") => {
    const linha = dia ? linhas.get(dia) : undefined;
    if (linha) linha[campo] += 1;
  };
  for (const a of atendimentos) {
    somar(diaDeBrasilia(a.recebidaEm ?? a.createdAt), "novos");
    somar(diaDeBrasilia(a.primeiroContatoEm), "primeiroContato");
    if (a.encerradoEm && eFinalDasRedes(a.status)) {
      somar(diaDeBrasilia(a.encerradoEm), /resolvid/i.test(a.status) ? "resolvidos" : "outrosFechamentos");
    }
  }
  return [...linhas.values()].map((l) => ({ ...l, saldo: l.novos - l.resolvidos - l.outrosFechamentos }));
}
