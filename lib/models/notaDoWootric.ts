import { moodOf, rotuloDeEtapa } from "@/lib/models/nps";
import { descreverRegistro } from "@/lib/services/horasUteis";

/**
 * O texto da nota que o encerramento manda ao Wootric.
 *
 * Separado de `wootric.escrita.ts` (que tem as credenciais) para a ficha
 * mostrar a prévia exata antes de encerrar — o que a pessoa lê é o que
 * vai, sem levar segredo nenhum ao navegador.
 */
export interface CicloParaANota {
  id: string;
  status: string;
  closedAt: Date | null;
  outcome: string | null;
  kind: string | null;
  rootCause: string | null;
  churnRisk: boolean;
  firstContactAt: Date | null;
  firstContactDueAt: Date;
  postContactAt: Date | null;
  postContactBy: string | null;
  postContactNote: string | null;
  moodAfter: number | null;
  resolvedAfter: boolean | null;
  confirmedAt: Date | null;
  owner: { name: string } | null;
  attempts: { channel: string; createdAt: Date }[];
}

/**
 * Os detalhes do caso, como a nota do Wootric vai mostrar.
 *
 * Texto curto, na ordem do checklist do guia: como terminou, a
 * classificação, o contato no prazo, o retorno, a confirmação. Sem
 * emoji — o painel de lá não promete mostrar.
 */
export function textoDaNota(ciclo: CicloParaANota, quemEncerrou?: string) {
  const quando = (d: Date | null) => (d ? descreverRegistro(d.toISOString()) : "");
  const canais = [...new Set(ciclo.attempts.map((a) => a.channel))];
  const humor = moodOf(ciclo.moodAfter);
  const comoTerminou = ciclo.outcome && ciclo.outcome !== ciclo.status ? ciclo.outcome.trim() : "";
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");

  const retorno = [
    humor ? `cliente ${humor.label.toLowerCase()}` : null,
    ciclo.resolvedAfter === true ? "resolveu" : ciclo.resolvedAfter === false ? "não resolveu" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const linhas = [
    `[CW Reputação] Ciclo encerrado: ${rotuloDeEtapa(ciclo.status)}${ciclo.closedAt ? ` em ${quando(ciclo.closedAt)} (Brasília)` : ""}${quemEncerrou ? `, por ${quemEncerrou}` : ""}.`,
    [
      ciclo.kind ? `Tipo: ${ciclo.kind}` : "Tipo: não classificado",
      ciclo.rootCause ? `causa raiz: ${ciclo.rootCause}` : null,
      ciclo.owner?.name ? `responsável: ${ciclo.owner.name}` : null,
    ]
      .filter(Boolean)
      .join(" · ") + ".",
    ciclo.firstContactAt
      ? `1º contato em ${quando(ciclo.firstContactAt)} (${ciclo.firstContactAt <= ciclo.firstContactDueAt ? "no prazo" : "fora do prazo"}).`
      : "Sem registro de contato.",
    ciclo.attempts.length ? `Tentativas: ${ciclo.attempts.length} (${canais.join(", ")}).` : null,
    ciclo.postContactAt
      ? `Retorno em ${quando(ciclo.postContactAt)}${ciclo.postContactBy ? `, por ${ciclo.postContactBy}` : ""}: ${retorno || "registrado"}${ciclo.postContactNote ? ` — "${ciclo.postContactNote.trim()}"` : ""}.`
      : null,
    ciclo.confirmedAt ? `O cliente confirmou que resolveu em ${quando(ciclo.confirmedAt)}.` : null,
    comoTerminou ? `Como terminou: ${comoTerminou}` : null,
    ciclo.churnRisk ? "Marcado como risco de cancelamento (retenção)." : null,
    app ? `Ficha: ${app}/nps/${ciclo.id}` : null,
  ];

  return linhas.filter(Boolean).join("\n").slice(0, 2000);
}
