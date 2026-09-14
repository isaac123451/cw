/**
 * Um período de datas, no dia de Brasília.
 *
 * Nasceu no NPS ("não tem como colocar um filtro por data"), e é
 * genérico: os atalhos de sempre (este mês, mês passado, 7, 30 e 90
 * dias) e o personalizado, de uma data a outra. As pontas valem inteiras
 * — "até 31/08" inclui a resposta das 23h do dia 31 em Brasília.
 */

export type AtalhoDoPeriodo = "tudo" | "hoje" | "7d" | "30d" | "90d" | "mes" | "mes-passado" | "personalizado";

export const ATALHOS_DO_PERIODO: { id: AtalhoDoPeriodo; rotulo: string }[] = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "hoje", rotulo: "Hoje" },
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "90d", rotulo: "90 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes-passado", rotulo: "Mês passado" },
];

export interface Intervalo {
  /** "2026-09-01" — o primeiro dia, incluído. Nulo é "desde sempre". */
  de: string | null;
  /** "2026-09-30" — o último dia, incluído. Nulo é "até hoje". */
  ate: string | null;
}

/** "2026-09-14" menos n dias. */
function diasAntes(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * O intervalo de um atalho, a partir de hoje (dia de Brasília).
 *
 * "7 dias" é hoje e os seis anteriores — a semana que termina hoje,
 * como o portal e o Wootric contam.
 */
export function intervaloDoAtalho(atalho: AtalhoDoPeriodo, hoje: string, personalizado?: Intervalo): Intervalo {
  switch (atalho) {
    case "tudo":
      return { de: null, ate: null };
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7d":
      return { de: diasAntes(hoje, 6), ate: hoje };
    case "30d":
      return { de: diasAntes(hoje, 29), ate: hoje };
    case "90d":
      return { de: diasAntes(hoje, 89), ate: hoje };
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case "mes-passado": {
      const primeiroDoMes = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`);
      const ultimoDoAnterior = new Date(primeiroDoMes);
      ultimoDoAnterior.setUTCDate(0);
      const fim = ultimoDoAnterior.toISOString().slice(0, 10);
      return { de: `${fim.slice(0, 7)}-01`, ate: fim };
    }
    case "personalizado": {
      const de = personalizado?.de || null;
      const ate = personalizado?.ate || null;
      /* De e até trocados: a pessoa quis o intervalo entre as duas datas. */
      return de && ate && de > ate ? { de: ate, ate: de } : { de, ate };
    }
  }
}

/** O dia (de Brasília) está dentro do intervalo? `dia` já vem como "AAAA-MM-DD". */
export function diaNoIntervalo(dia: string, intervalo: Intervalo) {
  if (intervalo.de && dia < intervalo.de) return false;
  if (intervalo.ate && dia > intervalo.ate) return false;
  return true;
}

/** "01/09 a 14/09/2026", para dizer na tela que recorte é este. */
export function descreverIntervalo(intervalo: Intervalo) {
  const br = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
  if (!intervalo.de && !intervalo.ate) return "todas as datas";
  if (intervalo.de && intervalo.ate) return intervalo.de === intervalo.ate ? `em ${br(intervalo.de)}` : `de ${br(intervalo.de)} a ${br(intervalo.ate)}`;
  return intervalo.de ? `desde ${br(intervalo.de)}` : `até ${br(intervalo.ate!)}`;
}
