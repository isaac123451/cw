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

/** "17/09 às 14:20" — o horário é sempre o de Brasília, dito uma vez no topo. */
function quando(d: Date | null) {
  if (!d) return "";
  const texto = descreverRegistro(d.toISOString());
  return texto.includes(" ") ? texto.replace(" ", " às ") : texto;
}

/**
 * Os detalhes do caso, como a nota do Wootric vai mostrar (refeita na 1.90).
 *
 * "A nota do caso encerrado não fica clara." A anterior era uma frase
 * corrida com siglas e parênteses ("Ciclo encerrado: Resolvido em 17/09
 * 14:20 (Brasília), por … Tipo: … · causa raiz: …"). Agora: uma linha de
 * título com o desfecho, e embaixo um rótulo por linha — quem abre a
 * resposta no Wootric lê de cima a baixo o que aconteceu. Sem emoji: o
 * painel de lá não promete mostrar.
 */
export function textoDaNota(ciclo: CicloParaANota, quemEncerrou?: string) {
  const canais = [...new Set(ciclo.attempts.map((a) => a.channel))];
  const humor = moodOf(ciclo.moodAfter);
  const comoTerminou = ciclo.outcome && ciclo.outcome !== ciclo.status ? ciclo.outcome.trim() : "";
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");

  const retorno = [
    humor ? humor.label.toLowerCase() : null,
    ciclo.resolvedAfter === true ? "disse que resolveu" : ciclo.resolvedAfter === false ? "disse que não resolveu" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const encerrada = [
    ciclo.closedAt ? `Encerrada em ${quando(ciclo.closedAt)}` : "Encerrada",
    quemEncerrou ? ` por ${quemEncerrou}` : "",
    " (horários de Brasília).",
  ].join("");

  const linha = (rotulo: string, valor: string | null | false | undefined) => (valor ? `${rotulo}: ${valor}` : null);

  const linhas = [
    `Tratativa do CW Reputação — ${rotuloDeEtapa(ciclo.status)}`,
    encerrada,
    "",
    linha("Classificação", ciclo.kind || "não classificada"),
    linha("Causa raiz", ciclo.rootCause),
    linha("Responsável", ciclo.owner?.name),
    linha(
      "Primeiro contato",
      ciclo.firstContactAt
        ? `${quando(ciclo.firstContactAt)}, ${ciclo.firstContactAt <= ciclo.firstContactDueAt ? "dentro do prazo" : "fora do prazo"}`
        : "não houve contato registrado"
    ),
    linha("Tentativas de contato", ciclo.attempts.length ? `${ciclo.attempts.length} (${canais.join(", ")})` : null),
    linha(
      "Retorno do cliente",
      ciclo.postContactAt
        ? `${quando(ciclo.postContactAt)}${ciclo.postContactBy ? `, registrado por ${ciclo.postContactBy}` : ""}${retorno ? ` — ${retorno}` : ""}${ciclo.postContactNote?.trim() ? `. Anotação: "${ciclo.postContactNote.trim()}"` : ""}`
        : null
    ),
    linha("Confirmação", ciclo.confirmedAt ? `o cliente confirmou a solução em ${quando(ciclo.confirmedAt)}` : null),
    linha("Como terminou", comoTerminou),
    linha("Risco de cancelamento", ciclo.churnRisk ? "sim — acompanhado pela retenção" : null),
    app ? "" : null,
    linha("Ficha completa", app ? `${app}/nps/${ciclo.id}` : null),
  ];

  return linhas
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}
