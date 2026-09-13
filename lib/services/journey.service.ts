import { Case } from "@/lib/models/case";
import type { FrenteId } from "@/lib/models/frentes";
import { isEncerrado, STATUS_SEM_TRATATIVA, type NpsResponseView } from "@/lib/models/nps";
import type { AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import {
  caseHref,
  isOpen,
  isSocial,
} from "@/lib/services/case.service";
import { diaNaOperacao } from "@/lib/services/reputation.service";

export type Sentiment =
  | "Promotor"
  | "Neutro"
  | "Detrator";

export interface CustomerJourney {
  company: string;

  customers: string[];

  cases: Case[];

  total: number;

  open: number;

  resolved: number;

  averageScore: number;

  sentiment: Sentiment;

  churnRisk: boolean;

  /** Mais de um caso registrado para a mesma empresa. */
  recurring: boolean;

  lastInteraction: string;

  /** Quantos casos vieram de cada frente. */
  reclameAqui: number;
  social: number;

  /** Etapa sugerida pelos dados, antes de qualquer ajuste manual. */
  suggestedStage: string;
}

/**
 * Deduz a etapa do ciclo de vida a partir do comportamento do cliente.
 * É só uma sugestão: a operação pode arrastar o card para outra etapa.
 */
function suggestStage(input: {
  churnRisk: boolean;
  averageScore: number;
  total: number;
  resolved: number;
  wouldReturn: boolean;
}): string {

  if (input.churnRisk) return "Em risco";

  if (input.total === 1 && input.resolved === 0) {
    return "Primeiro contato";
  }

  if (input.averageScore >= 8 && input.wouldReturn) {
    return "Promotor";
  }

  if (
    input.resolved > 0 &&
    input.resolved === input.total
  ) {
    return "Recuperado";
  }

  return "Em acompanhamento";
}

function sentimentOf(score: number): Sentiment {
  if (score >= 7) return "Promotor";
  if (score >= 5) return "Neutro";
  return "Detrator";
}

/* ============================================================
   A JORNADA NAS QUATRO FRENTES
============================================================ */

/**
 * Um ponto da linha do tempo, de qualquer frente.
 *
 * A jornada mostrava só casos (Reclame Aqui e redes). O cliente que
 * respondeu o NPS com nota 3 e depois deixou uma estrela no Google
 * aparecia como "sem ocorrências" — a parte da história que mais
 * explica o resto ficava de fora.
 */
export interface PontoDaJornada {
  id: string;
  frente: FrenteId;
  titulo: string;
  detalhe: string;
  /** ISO — a data do fato, em Brasília na tela. */
  em: string;
  href: string;
  estado: "aberto" | "resolvido" | "risco" | "neutro";
}

export interface JornadaNasFrentes extends CustomerJourney {
  porFrente: Record<FrenteId, number>;
  pontos: PontoDaJornada[];
}

export type NpsDaJornada = Pick<
  NpsResponseView,
  "id" | "score" | "comment" | "respondedAt" | "customer" | "customerName" | "email" | "establishmentId" | "status" | "churnRisk" | "kind"
>;

export type GoogleDaJornada = Pick<
  AvaliacaoGoogleView,
  "id" | "estrelas" | "autor" | "texto" | "publicadaEm" | "status" | "caso" | "promotorNps" | "notaAtualizada"
>;

const limparChave = (s?: string | null) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

function trecho(texto: string | undefined, max = 70) {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * As jornadas com as quatro frentes juntas.
 *
 * **Quem é o mesmo cliente.** A chave continua sendo a do Reclame Aqui
 * (o nome do consumidor), para os posicionamentos manuais no quadro
 * seguirem valendo. As outras frentes entram na jornada de quem já
 * existe quando há como saber que é a mesma pessoa: o e-mail (o único
 * dado que o NPS tem em comum com os casos), o estabelecimento
 * vinculado, ou o vínculo que alguém fez à mão (a avaliação do Google
 * ligada a um caso ou ao promotor do NPS). Sem vínculo, viram jornada
 * própria, com o nome que a frente conhece.
 *
 * **Que respostas do NPS entram.** As que abriram ciclo. O promotor
 * calado — nota 9 ou 10 sem uma palavra — não tem jornada a acompanhar:
 * são ~1.100 cartões que esconderiam os que precisam de alguém, e ele
 * continua inteiro na análise do NPS. Entra, sim, quando casa com um
 * cliente que já tem jornada: aí ele é parte da história.
 *
 * **A nota.** A média das notas das quatro frentes na mesma escala de 0
 * a 10 — a do Reclame Aqui e a do NPS como vêm, a do Google em dobro
 * (estrelas de 1 a 5, a nota atualizada quando o cliente atualizou).
 */
export function montarJornadas(entrada: {
  casos: Case[];
  nps: NpsDaJornada[];
  google: GoogleDaJornada[];
}): JornadaNasFrentes[] {

  type Grupo = { casos: Case[]; nps: NpsDaJornada[]; google: GoogleDaJornada[] };

  const grupos = new Map<string, Grupo>();
  const grupo = (chave: string) => {
    let g = grupos.get(chave);
    if (!g) {
      g = { casos: [], nps: [], google: [] };
      grupos.set(chave, g);
    }
    return g;
  };

  const porEmail = new Map<string, string>();
  const porConta = new Map<string, string>();
  const porCaso = new Map<string, string>();

  for (const c of entrada.casos) {
    grupo(c.company).casos.push(c);
    const email = limparChave(c.email);
    if (email && !porEmail.has(email)) porEmail.set(email, c.company);
    if (c.establishmentId && !porConta.has(c.establishmentId)) porConta.set(c.establishmentId, c.company);
    porCaso.set(c.protocol, c.company);
    porCaso.set(c.id, c.company);
  }

  const porNps = new Map<string, string>();

  for (const r of entrada.nps) {
    const casada =
      (r.email ? porEmail.get(limparChave(r.email)) : undefined) ??
      (r.establishmentId ? porConta.get(r.establishmentId) : undefined);

    if (!casada && r.status === STATUS_SEM_TRATATIVA) continue;

    const chave = casada ?? (r.customerName?.trim() || r.customer);
    grupo(chave).nps.push(r);
    porNps.set(r.id, chave);
  }

  for (const a of entrada.google) {
    const chave =
      (a.caso ? porCaso.get(a.caso.protocolo) ?? porCaso.get(a.caso.id) : undefined) ??
      (a.promotorNps ? porNps.get(a.promotorNps.id) : undefined) ??
      a.autor;
    grupo(chave).google.push(a);
  }

  return [...grupos.entries()]
    .map(([company, g]): JornadaNasFrentes => {

      const casosOrdenados = [...g.casos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const notas = [
        ...g.casos.filter((c) => typeof c.score === "number").map((c) => c.score as number),
        ...g.nps.map((r) => r.score),
        ...g.google.filter((a) => a.status !== "denunciada").map((a) => (a.notaAtualizada ?? a.estrelas) * 2),
      ];

      const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0;
      const nota = Math.round(media * 10) / 10;

      const churnRisk = g.casos.some((c) => c.churnRisk) || g.nps.some((r) => r.churnRisk);

      const resolvidos =
        g.casos.filter((c) => c.resolved).length +
        g.nps.filter((r) => r.status.startsWith("[Encerrado] Resolvido")).length +
        g.google.filter((a) => a.status === "respondida").length;

      const abertos =
        g.casos.filter(isOpen).length +
        g.nps.filter((r) => !isEncerrado(r.status)).length +
        g.google.filter((a) => a.status === "aberta").length;

      const total = g.casos.length + g.nps.length + g.google.length;

      const pontos: PontoDaJornada[] = [
        ...g.casos.map((c): PontoDaJornada => ({
          id: `caso:${c.id}`,
          frente: isSocial(c) ? "redes" : "reclame-aqui",
          titulo: c.title,
          detalhe: [c.category, c.source].filter(Boolean).join(" · "),
          em: c.recebidaEm ?? c.createdAt,
          href: caseHref(c),
          estado: c.resolved ? "resolvido" : c.churnRisk ? "risco" : isOpen(c) ? "aberto" : "neutro",
        })),
        ...g.nps.map((r): PontoDaJornada => ({
          id: `nps:${r.id}`,
          frente: "nps",
          titulo: `Nota ${r.score} no NPS${r.comment.trim() ? ` — “${trecho(r.comment)}”` : ""}`,
          detalhe: [r.kind, r.status.replace(/^\[Encerrado\]\s*/, "")].filter(Boolean).join(" · "),
          em: r.respondedAt,
          href: `/nps?resposta=${r.id}`,
          estado: r.churnRisk ? "risco" : isEncerrado(r.status) ? "resolvido" : "aberto",
        })),
        ...g.google.map((a): PontoDaJornada => ({
          id: `google:${a.id}`,
          frente: "google",
          titulo: `${a.notaAtualizada ?? a.estrelas} estrela(s) no Google${a.texto ? ` — “${trecho(a.texto)}”` : ""}`,
          detalhe: a.autor,
          em: a.publicadaEm,
          href: `/google?avaliacao=${a.id}`,
          estado: a.status === "aberta" ? "aberto" : a.status === "respondida" ? "resolvido" : "neutro",
        })),
      ].sort((a, b) => Date.parse(b.em) - Date.parse(a.em));

      const porFrente: Record<FrenteId, number> = {
        "reclame-aqui": g.casos.filter((c) => !isSocial(c)).length,
        redes: g.casos.filter(isSocial).length,
        nps: g.nps.length,
        google: g.google.length,
      };

      return {
        company,
        customers: [
          ...new Set([
            ...g.casos.map((c) => c.customer),
            ...g.nps.map((r) => r.customerName?.trim() || r.customer),
            ...g.google.map((a) => a.autor),
          ]),
        ],
        cases: casosOrdenados,
        total,
        open: abertos,
        resolved: resolvidos,
        averageScore: nota,
        sentiment: sentimentOf(media),
        churnRisk,
        recurring: total > 1,
        lastInteraction: pontos[0] ? diaNaOperacao(pontos[0].em) : "-",
        reclameAqui: porFrente["reclame-aqui"],
        social: porFrente.redes,
        suggestedStage: suggestStage({
          churnRisk,
          averageScore: nota,
          total,
          resolved: resolvidos,
          wouldReturn: g.casos.some((c) => c.wouldDoBusiness) || g.nps.some((r) => r.score >= 9),
        }),
        porFrente,
        pontos,
      };
    })
    .sort((a, b) => (a.churnRisk !== b.churnRisk ? (a.churnRisk ? -1 : 1) : b.total - a.total));
}
