import { checkToken } from "@/lib/api/auth";
import {
  getApiCases,
  toPublicCase,
} from "@/lib/api/source";

import { Channel } from "@/lib/services/case.service";

import {
  getRange,
  inRange,
  PeriodKey,
  periodLabels,
} from "@/lib/services/reputation.service";

export const runtime = "nodejs";

const PERIODOS: PeriodKey[] = [
  "30d",
  "3m",
  "6m",
  "12m",
];

const CANAIS: Channel[] = [
  "reclame-aqui",
  "social",
  "all",
];

/** Teto por página: sem isso, um cliente distraído puxaria a base toda. */
const LIMITE_MAXIMO = 200;

/**
 * Lista de reclamações, paginada.
 *
 * Filtros: periodo, canal, status, categoria e responsavel. Sem
 * `periodo` devolve a base inteira — útil para carga inicial de outro
 * sistema.
 */
export async function GET(request: Request) {

  const barrado = checkToken(request);
  if (barrado) return barrado;

  const url = new URL(request.url);
  const params = url.searchParams;

  const canal = (params.get("canal") ??
    "reclame-aqui") as Channel;

  if (!CANAIS.includes(canal)) {
    return Response.json(
      {
        error: `Canal inválido. Use um de: ${CANAIS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const periodo = params.get("periodo") as PeriodKey | null;

  if (periodo && !PERIODOS.includes(periodo)) {
    return Response.json(
      {
        error: `Período inválido. Use um de: ${PERIODOS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const limite = Math.min(
    Math.max(Number(params.get("limite") ?? 50), 1),
    LIMITE_MAXIMO
  );

  const pagina = Math.max(
    Number(params.get("pagina") ?? 1),
    1
  );

  const status = params.get("status");
  const categoria = params.get("categoria");
  const responsavel = params.get("responsavel");

  /**
   * Sincronização incremental: devolve só o que mudou depois da data.
   *
   * É o que um sistema que puxa periodicamente precisa para não
   * reprocessar a base inteira a cada rodada. Cai no `createdAt` quando o
   * caso nunca foi editado.
   */
  const atualizadoApos = params.get("atualizadoApos");

  if (
    atualizadoApos &&
    !/^\d{4}-\d{2}-\d{2}$/.test(atualizadoApos)
  ) {
    return Response.json(
      {
        error:
          "atualizadoApos deve estar no formato AAAA-MM-DD.",
      },
      { status: 400 }
    );
  }

  const range = periodo ? getRange(periodo) : null;

  const base = await getApiCases(canal);

  const filtrados = base.filter((item) => {

    if (
      range &&
      !inRange(item, range.start, range.end)
    ) {
      return false;
    }

    if (status && item.status !== status) return false;

    if (categoria && item.category !== categoria) {
      return false;
    }

    if (
      responsavel &&
      (item.owner ?? "") !== responsavel
    ) {
      return false;
    }

    if (atualizadoApos) {

      const mudou = item.updatedAt ?? item.createdAt;

      if (mudou <= atualizadoApos) return false;
    }

    return true;
  });

  // Mais recentes primeiro: é o que outro sistema quer ao sincronizar.
  const ordenados = [...filtrados].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const inicio = (pagina - 1) * limite;

  const pagina_atual = ordenados.slice(
    inicio,
    inicio + limite
  );

  return Response.json({
    periodo: range
      ? {
          chave: periodo,
          rotulo: periodo
            ? periodLabels[periodo]
            : undefined,
          inicio: range.start,
          fim: range.end,
        }
      : null,

    canal,

    total: ordenados.length,

    pagina,

    limite,

    paginas: Math.max(
      Math.ceil(ordenados.length / limite),
      1
    ),

    casos: pagina_atual.map(toPublicCase),
  });
}
