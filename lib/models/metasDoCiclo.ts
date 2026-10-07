import { alvoComAjuste, type AjustesDeMeta, type OrigemDoAlvo } from "@/lib/models/ajusteDeMeta";
import { filaDeAvaliacao } from "@/lib/models/cadencia";
import { respondida, type Case } from "@/lib/models/case";
import { cicloAnterior, cicloDe, type Ciclo } from "@/lib/models/ciclo";
import type { NpsResponseView } from "@/lib/models/nps";
import { diaNaOperacao } from "@/lib/services/reputation.service";
import { semRespostaPublica } from "@/lib/services/case.service";

/**
 * As metas do ciclo (1.114): "precisa-se também de algo para o ciclo".
 *
 * O ciclo é o da planilha e do relatório (1–7, 8–14, 15–21, 22–28,
 * 29–fim). Os alvos nascem do próprio ciclo e do anterior, e cada um diz
 * de onde veio:
 *
 * - **Respostas públicas**: zerar a fila — as respondidas no ciclo mais as
 *   que ainda esperam resposta.
 * - **Avaliações**: uma a mais que no ciclo anterior inteiro (no mínimo 3).
 * - **Pedidos de avaliação**: os feitos no ciclo mais a fila de hoje.
 * - **Detratores contatados**: todos os detratores que chegaram no ciclo.
 * - **Detratores revertidos**: um a mais que no ciclo anterior (no mínimo 1).
 *
 * A pessoa pode trocar qualquer alvo só para este ciclo ou para todos.
 */

export interface MetaDoCiclo {
  chave: "respostas" | "avaliacoes" | "pedidos" | "detratores" | "revertidos";
  titulo: string;
  feito: number;
  alvo: number;
  automatico: number;
  origem: OrigemDoAlvo;
  /** De onde o número automático veio, em português. */
  porque: string;
  href: string;
}

export interface MetasDoCiclo {
  ciclo: Ciclo;
  /** Dias do ciclo que ainda faltam, contando hoje. */
  faltamDias: number;
  metas: MetaDoCiclo[];
}

export function metasDoCiclo(entrada: { casos: Case[]; nps: NpsResponseView[]; agora?: Date; ajustes?: AjustesDeMeta }): MetasDoCiclo {
  const agora = entrada.agora ?? new Date();
  const hoje = diaNaOperacao(agora);
  const ciclo = cicloDe(hoje);
  const anterior = cicloAnterior(ciclo);
  const no = (c: Ciclo, iso?: string | null) => {
    if (!iso) return false;
    const dia = diaNaOperacao(iso);
    return dia >= c.inicio && dia <= c.fim;
  };

  const ra = entrada.casos.filter((c) => c.source === "Reclame Aqui");
  const respondidasNoCiclo = ra.filter((c) => respondida(c) && no(ciclo, c.publicResponseAt)).length;
  const semResposta = entrada.casos.filter(semRespostaPublica).length;
  const avaliadasNoCiclo = ra.filter((c) => c.evaluated && no(ciclo, c.evaluatedAt)).length;
  const avaliadasAntes = ra.filter((c) => c.evaluated && no(anterior, c.evaluatedAt)).length;
  const pedidosNoCiclo = ra.filter((c) => no(ciclo, c.ultimoPedidoAvaliacaoEm)).length;
  const filaHoje = filaDeAvaliacao(ra, agora).hoje.length;
  const detratoresDoCiclo = entrada.nps.filter((r) => r.score <= 6 && no(ciclo, r.respondedAt));
  const contatados = detratoresDoCiclo.filter((r) => r.firstContactAt).length;
  const revertido = (c: Ciclo) => entrada.nps.filter((r) => r.score <= 6 && no(c, r.postContactAt) && (r.resolvedAfter === true || (r.moodAfter ?? 0) >= 4)).length;

  /* No ciclo, o padrão da pessoa vale como veio — não há "o que existe para fazer" para limitar. */
  const meta = (m: Omit<MetaDoCiclo, "alvo" | "automatico" | "origem"> & { gerado: number }): MetaDoCiclo => {
    const r = alvoComAjuste(m.chave, entrada.ajustes, (teto) => teto ?? m.gerado);
    return { chave: m.chave, titulo: m.titulo, feito: m.feito, porque: m.porque, href: m.href, alvo: r.alvo, automatico: r.automatico, origem: r.origem };
  };

  const metas = [
    meta({
      chave: "respostas",
      titulo: "Respostas públicas",
      feito: respondidasNoCiclo,
      gerado: respondidasNoCiclo + semResposta,
      porque: semResposta ? `zerar a fila: ${semResposta} ainda sem resposta` : "a fila está zerada",
      href: "/reclame-aqui",
    }),
    meta({
      chave: "avaliacoes",
      titulo: "Avaliações no portal",
      feito: avaliadasNoCiclo,
      gerado: Math.max(3, avaliadasAntes + 1),
      porque: `uma a mais que no ciclo anterior (${avaliadasAntes})`,
      href: "/reclame-aqui/avaliacoes",
    }),
    meta({
      chave: "pedidos",
      titulo: "Pedidos de avaliação",
      feito: pedidosNoCiclo,
      gerado: pedidosNoCiclo + filaHoje,
      porque: filaHoje ? `os feitos mais os ${filaHoje} da fila de hoje` : "a fila de hoje está vazia",
      href: "/reclame-aqui/avaliacoes",
    }),
    meta({
      chave: "detratores",
      titulo: "Detratores contatados",
      feito: contatados,
      gerado: detratoresDoCiclo.length,
      porque: detratoresDoCiclo.length === 1 ? "o detrator que chegou no ciclo" : `todos os ${detratoresDoCiclo.length} detratores que chegaram no ciclo`,
      href: "/nps",
    }),
    meta({
      chave: "revertidos",
      titulo: "Detratores revertidos",
      feito: revertido(ciclo),
      gerado: Math.max(1, revertido(anterior) + 1),
      porque: `um a mais que no ciclo anterior (${revertido(anterior)})`,
      href: "/nps",
    }),
  ].filter((m) => m.alvo > 0);

  const faltamDias = Math.round((Date.parse(`${ciclo.fim}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000) + 1;
  return { ciclo, faltamDias, metas };
}
