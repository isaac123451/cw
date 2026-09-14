/**
 * Os ciclos do documento de Reclame Aqui.
 *
 * "Resolvidas por ciclo: volume total de reclamações solucionadas dentro
 * de uma janela específica, no caso 7 dias (1 a 7, 8 a 14, 15 a 21, 22 a
 * 28 e 29 a 30/31)." O relatório de reputação é "ao final de cada
 * ciclo", e "ciclos com o selo ativo" conta nessas mesmas janelas.
 *
 * Tudo em dias `AAAA-MM-DD` de Brasília — nunca em instante UTC.
 */

export interface Ciclo {
  /** "2026-09-c2" — mês e número do ciclo. */
  id: string;
  inicio: string;
  fim: string;
  numero: 1 | 2 | 3 | 4 | 5;
  /** "8 a 14/09" */
  rotulo: string;
}

const INICIOS = [1, 8, 15, 22, 29] as const;

function ultimoDiaDoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function doisDigitos(n: number) {
  return String(n).padStart(2, "0");
}

function montar(ano: number, mes: number, numero: 1 | 2 | 3 | 4 | 5): Ciclo {
  const ultimo = ultimoDiaDoMes(ano, mes);
  const de = INICIOS[numero - 1];
  const ate = numero === 5 ? ultimo : de + 6;
  const ym = `${ano}-${doisDigitos(mes)}`;
  return {
    id: `${ym}-c${numero}`,
    inicio: `${ym}-${doisDigitos(de)}`,
    fim: `${ym}-${doisDigitos(ate)}`,
    numero,
    rotulo: `${de} a ${ate}/${doisDigitos(mes)}`,
  };
}

/** O ciclo em que um dia cai. */
export function cicloDe(dia: string): Ciclo {
  const [ano, mes, d] = dia.split("-").map(Number);
  const numero = (d >= 29 ? 5 : Math.floor((d - 1) / 7) + 1) as 1 | 2 | 3 | 4 | 5;
  return montar(ano, mes, numero);
}

/** O ciclo pelo id ("2026-09-c2"), ou `null` se o id não for de ciclo. */
export function cicloPorId(id: string): Ciclo | null {
  const m = id.match(/^(\d{4})-(\d{2})-c([1-5])$/);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  const ciclo = montar(Number(m[1]), mes, Number(m[3]) as 1 | 2 | 3 | 4 | 5);
  /* Fevereiro de 28 dias não tem o quinto ciclo. */
  return ciclo.inicio <= ciclo.fim ? ciclo : null;
}

/** O ciclo que vem antes. */
export function cicloAnterior(c: Ciclo): Ciclo {
  const [ano, mes] = c.inicio.split("-").map(Number);
  if (c.numero > 1) return montar(ano, mes, (c.numero - 1) as 1 | 2 | 3 | 4);
  const a = mes === 1 ? ano - 1 : ano;
  const m = mes === 1 ? 12 : mes - 1;
  /* O último ciclo do mês anterior — em fevereiro de 28 dias, o quarto. */
  return ultimoDiaDoMes(a, m) >= 29 ? montar(a, m, 5) : montar(a, m, 4);
}

/** Os `n` ciclos até o que contém `dia`, do mais recente para o mais antigo. */
export function ciclosAte(dia: string, n: number): Ciclo[] {
  const lista: Ciclo[] = [];
  let c = cicloDe(dia);
  for (let i = 0; i < n; i++) {
    lista.push(c);
    c = cicloAnterior(c);
  }
  return lista;
}
