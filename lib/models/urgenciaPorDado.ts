import {
  prioridadePelosCriterios,
  type Case,
  type Prioridade,
} from "@/lib/models/case";
import {
  digitosDoDocumento,
  mensalidadeDaConta,
  type Establishment,
} from "@/lib/models/establishment";
import type { NpsResponseView } from "@/lib/models/nps";

/**
 * Urgência sugerida por dado, não por memória ("Ideias além" do roadmap).
 *
 * O documento chama de Urgente três coisas que a plataforma **já sabe**
 * e quem tria costuma lembrar só às vezes:
 *
 * - **reincidência** — outra reclamação do mesmo CPF ou CNPJ nos últimos
 *   90 dias. Só pelo documento: pelo nome, "Pizzaria do João" casa com
 *   três restaurantes diferentes;
 * - **alto ticket** — a mensalidade da conta no quartil de cima da base
 *   (pelo valor da conta, ou pelo preço do plano na tabela). Sem conta
 *   com mensalidade conhecida, não sugere: "alto" só existe comparado;
 * - **risco de cancelamento** — a marca de churn no próprio caso, a conta
 *   "Em risco", ou um detrator do NPS da mesma conta marcado com risco
 *   nos últimos 90 dias.
 *
 * Cada sinal diz **por quê**, com o número e o registro de onde veio. É
 * sugestão: nada é marcado sem clique, e a triagem continua de quem tria.
 */

export interface SinalDeUrgencia {
  /** O id de `CRITERIOS` que o sinal marca. */
  criterio: "reincidencia" | "estrategico" | "cancelamento";
  motivo: string;
}

export interface UrgenciaSugerida {
  sinais: SinalDeUrgencia[];
  /** O nível que os critérios desses sinais dão — `Normal` sem sinal. */
  nivel: Prioridade;
}

export const JANELA_DE_REINCIDENCIA_DIAS = 90;

const DIA_MS = 86_400_000;

function ddmm(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** O limite do quartil de cima das mensalidades conhecidas, ou `null` com base de menos. */
export function limiteDeAltoTicket(
  contas: Pick<Establishment, "plan" | "mrr">[],
  planos: { name: string; priceCents: number; kind: string }[]
): number | null {
  const valores = contas
    .map((c) => mensalidadeDaConta(c, planos)?.reais ?? 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  /* Com menos de 8 contas com mensalidade, "as 25% maiores" são duas: comparação sem base. */
  if (valores.length < 8) return null;

  const quartil = valores[Math.floor(valores.length * 0.75)];
  const mediana = valores[Math.floor(valores.length / 2)];

  if (quartil > mediana) return quartil;

  /*
    Base concentrada num plano só: o quartil cai no plano comum, e "as 25%
    maiores" viraria todo mundo. Vale o primeiro valor acima dele — que,
    por estar acima do quartil, é de menos de 25% das contas. Sem nenhum
    acima (todos iguais), ninguém é alto ticket perto dos outros.
  */
  return valores.find((v) => v > mediana) ?? null;
}

export function urgenciaPorDado(
  caso: Pick<Case, "id" | "protocol" | "document" | "establishmentId" | "createdAt" | "churnRisk">,
  dados: {
    casos: Pick<Case, "id" | "protocol" | "document" | "createdAt">[];
    estabelecimentos: Pick<Establishment, "id" | "name" | "plan" | "mrr" | "status">[];
    planos: { name: string; priceCents: number; kind: string }[];
    nps?: Pick<NpsResponseView, "id" | "score" | "churnRisk" | "establishmentId" | "respondedAt">[];
  }
): UrgenciaSugerida {
  const sinais: SinalDeUrgencia[] = [];
  const referencia = Date.parse(`${caso.createdAt.slice(0, 10)}T12:00:00Z`);
  const naJanela = (iso: string) => {
    const t = Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
    return Number.isFinite(t) && referencia - t <= JANELA_DE_REINCIDENCIA_DIAS * DIA_MS && referencia - t >= 0;
  };

  /* ---------- reincidência ---------- */

  const documento = digitosDoDocumento(caso.document);

  if (documento) {
    const anteriores = dados.casos
      .filter((c) => c.id !== caso.id && digitosDoDocumento(c.document) === documento && naJanela(c.createdAt))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (anteriores.length > 0) {
      const lista = anteriores.slice(0, 3).map((c) => `${c.protocol} (${ddmm(c.createdAt)})`).join(", ");
      sinais.push({
        criterio: "reincidencia",
        motivo: `${anteriores.length} outra(s) reclamação(ões) do mesmo ${documento.length === 14 ? "CNPJ" : "CPF"} nos ${JANELA_DE_REINCIDENCIA_DIAS} dias anteriores: ${lista}${anteriores.length > 3 ? "…" : ""}`,
      });
    }
  }

  /* ---------- a conta ---------- */

  const conta = caso.establishmentId ? dados.estabelecimentos.find((e) => e.id === caso.establishmentId) : undefined;

  if (conta) {
    const mensalidade = mensalidadeDaConta(conta, dados.planos);
    const limite = limiteDeAltoTicket(dados.estabelecimentos, dados.planos);

    if (mensalidade && limite !== null && mensalidade.reais >= limite) {
      const valor = mensalidade.reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      sinais.push({
        criterio: "estrategico",
        motivo: `${conta.name} paga ${valor}/mês (${mensalidade.origem === "conta" ? "valor da conta" : `plano ${conta.plan}`}), entre as maiores mensalidades da base`,
      });
    }
  }

  /* ---------- cancelamento ---------- */

  const motivosDeChurn: string[] = [];

  if (caso.churnRisk) motivosDeChurn.push("o caso está marcado com risco de cancelamento");
  if (conta?.status === "Em risco") motivosDeChurn.push(`a conta ${conta.name} está "Em risco" no cadastro`);

  if (conta && dados.nps) {
    const detrator = dados.nps
      .filter((r) => r.establishmentId === conta.id && r.churnRisk && r.score <= 6 && naJanela(r.respondedAt))
      .sort((a, b) => b.respondedAt.localeCompare(a.respondedAt))[0];
    if (detrator) motivosDeChurn.push(`um detrator do NPS da conta (nota ${detrator.score}, ${ddmm(detrator.respondedAt)}) está marcado com risco`);
  }

  if (motivosDeChurn.length > 0) {
    sinais.push({ criterio: "cancelamento", motivo: motivosDeChurn.join("; ") });
  }

  return { sinais, nivel: prioridadePelosCriterios(sinais.map((s) => s.criterio)) };
}
