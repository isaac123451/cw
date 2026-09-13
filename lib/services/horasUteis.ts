/**
 * O relógio da operação: horas e dias úteis, em Brasília.
 *
 * **Por que existe.** A documentação do time de reputação (agosto/2026)
 * escreve todo prazo em tempo útil: "até 4h úteis", "até 24h úteis",
 * "1 dia útil", "até 7 dias úteis". A plataforma contava dias corridos
 * no Reclame Aqui — sábado, domingo e feriado valendo como dia de
 * trabalho — e, no NPS, horas de relógio que caíam em dia útil **pelo
 * calendário UTC**, que em Brasília erra por três horas na borda do fim
 * de semana. Um relógio só, aqui, para todas as frentes.
 *
 * **Como "hora útil" é lida.** O documento não define, e a leitura que
 * cabe nos números dele é esta:
 *
 * - **múltiplo de 24h é contado em dias úteis.** "24h úteis" é um dia
 *   útil, "48h úteis" são dois: o prazo cai na mesma hora do dia útil
 *   seguinte. É o que a própria documentação faz ao pôr, lado a lado,
 *   "Alta: até 24h úteis" e "Alta: 1 dia útil".
 * - **o que é menor que um dia conta dentro do expediente.** "4h úteis"
 *   de uma reclamação que chega às 16h, com expediente até as 18h, vence
 *   às 10h do dia útil seguinte — e não à meia-noite, quando ninguém
 *   estaria lá para cumprir.
 * - **quem chega fora do expediente começa a contar na abertura** do
 *   próximo dia útil.
 *
 * **Feriados sem calendário mantido à mão.** Os fixos estão na lei; os
 * móveis (Sexta-feira Santa, e os pontos facultativos de Carnaval e
 * Corpus Christi) saem da data da Páscoa, calculada. Um calendário
 * digitado envelheceria calado — este vale para qualquer ano.
 *
 * **Fuso fixo em UTC−3.** O Brasil não tem horário de verão desde 2019,
 * e toda data que este relógio mede é posterior a isso. Um deslocamento
 * fixo evita instanciar `Intl` a cada passo de um laço que roda sobre
 * centenas de casos por render.
 *
 * `npm run check:horas-uteis` prova cada regra com casos datados.
 */

/** Minutos que Brasília está atrás de UTC. */
const ATRASO_DE_BRASILIA_MIN = 180;

const MINUTO = 60_000;
const DIA_MIN = 24 * 60;

export interface Expediente {
  /** Abertura, em minutos desde a meia-noite (480 = 08h). */
  inicioMin: number;

  /** Fechamento, em minutos desde a meia-noite (1080 = 18h). */
  fimMin: number;

  /** Dias da semana que trabalham: 0 domingo … 6 sábado. */
  dias: number[];

  /**
   * Carnaval e Corpus Christi não contam.
   *
   * São pontos facultativos, e não feriados — cada empresa decide. Ligado
   * por padrão porque é o costume; a tela de Configurações troca.
   */
  pularFacultativos: boolean;
}

export const EXPEDIENTE_PADRAO: Expediente = {
  inicioMin: 8 * 60,
  fimMin: 18 * 60,
  dias: [1, 2, 3, 4, 5],
  pularFacultativos: true,
};

/**
 * O expediente como veio do banco, conferido.
 *
 * Abertura depois do fechamento, nenhum dia útil ou valor fora do dia
 * fariam o relógio andar para sempre procurando um minuto de trabalho —
 * então o que não faz sentido volta ao padrão, em vez de travar a tela.
 */
export function expedienteValido(
  valor?: Partial<Expediente> | null
): Expediente {

  if (!valor) return EXPEDIENTE_PADRAO;

  const inicioMin = Number(valor.inicioMin);
  const fimMin = Number(valor.fimMin);

  const dias = Array.isArray(valor.dias)
    ? [...new Set(valor.dias.map(Number))].filter(
        (d) => Number.isInteger(d) && d >= 0 && d <= 6
      )
    : [];

  if (
    !Number.isFinite(inicioMin) ||
    !Number.isFinite(fimMin) ||
    inicioMin < 0 ||
    fimMin > DIA_MIN ||
    fimMin - inicioMin < 30 ||
    dias.length === 0
  ) {
    return EXPEDIENTE_PADRAO;
  }

  return {
    inicioMin,
    fimMin,
    dias: dias.sort(),
    pularFacultativos: valor.pularFacultativos !== false,
  };
}

/* ============================================================
   DATA DE PAREDE EM BRASÍLIA
============================================================ */

/** Um instante como Brasília o vê: o dia e o minuto do dia. */
export interface Parede {
  /** `AAAA-MM-DD`. */
  dia: string;
  /** Minutos desde a meia-noite. */
  min: number;
}

export function paredeDe(instante: Date): Parede {

  const local = new Date(
    instante.getTime() - ATRASO_DE_BRASILIA_MIN * MINUTO
  );

  return {
    dia: local.toISOString().slice(0, 10),
    min: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/**
 * O dia de um registro, e se ele tem hora.
 *
 * A planilha e o portal gravam alguns campos só com o dia — a data da
 * resposta pública, a da avaliação —, e o banco guarda esse dia como
 * meia-noite UTC. Lido como instante, `2026-08-21T00:00:00Z` vira 20/08
 * às 21h em Brasília: um dia antes, e com uma hora que ninguém anotou.
 * Meia-noite UTC exata é tratada como "só o dia".
 */
export function diaDoRegistro(iso: string): { dia: string; min?: number } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) || /T00:00:00(?:\.000)?Z$/.test(iso)) {
    return { dia: iso.slice(0, 10) };
  }
  const { dia, min } = paredeDe(new Date(iso));
  return { dia, min };
}

/** "21/08" ou "21/08 14:05" — o registro como a tela mostra. */
export function descreverRegistro(iso?: string | null) {
  if (!iso) return "";
  const { dia, min } = diaDoRegistro(iso);
  const [, m, d] = dia.split("-");
  return min === undefined
    ? `${d}/${m}`
    : `${d}/${m} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function instanteDe(dia: string, min: number): Date {
  return new Date(
    Date.parse(`${dia}T00:00:00Z`) +
      (min + ATRASO_DE_BRASILIA_MIN) * MINUTO
  );
}

/**
 * Hora de parede de Brasília, escrita como o portal e a planilha
 * escrevem, virando instante de verdade.
 *
 * O portal manda `2026-09-10T21:43:37` — hora de Brasília sem fuso, às
 * vezes com um `Z` que não é verdade. A planilha manda `10/09/2026
 * 21:43`. Sem hora nenhuma, devolve `null`: um dia sem hora não diz
 * quando o relógio começou, e inventar 00:00 anteciparia o prazo.
 */
export function instanteDeParede(valor?: string | null): Date | null {

  const texto = String(valor ?? "").trim();

  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);

  if (iso) {
    return instanteDe(iso[1], Number(iso[2]) * 60 + Number(iso[3]));
  }

  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);

  if (br) {
    const dia = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    return instanteDe(dia, Number(br[4]) * 60 + Number(br[5]));
  }

  return null;
}

function somarDias(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function diaDaSemana(dia: string) {
  return new Date(`${dia}T00:00:00Z`).getUTCDay();
}

/* ============================================================
   FERIADOS
============================================================ */

/**
 * Domingo de Páscoa — algoritmo de Meeus/Jones/Butcher, calendário
 * gregoriano. Exato para qualquer ano.
 */
export function pascoa(ano: number) {

  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export interface Folga {
  dia: string;
  nome: string;
  /** Ponto facultativo: só conta como folga quando o expediente diz. */
  facultativo: boolean;
}

const cacheDeFolgas = new Map<number, Folga[]>();

/** Feriados nacionais e pontos facultativos de um ano. */
export function folgasDoAno(ano: number): Folga[] {

  const guardado = cacheDeFolgas.get(ano);

  if (guardado) return guardado;

  const fixo = (mmdd: string, nome: string): Folga => ({
    dia: `${ano}-${mmdd}`,
    nome,
    facultativo: false,
  });

  const domingo = pascoa(ano);

  const lista: Folga[] = [
    fixo("01-01", "Confraternização Universal"),
    fixo("04-21", "Tiradentes"),
    fixo("05-01", "Dia do Trabalho"),
    fixo("09-07", "Independência do Brasil"),
    fixo("10-12", "Nossa Senhora Aparecida"),
    fixo("11-02", "Finados"),
    fixo("11-15", "Proclamação da República"),
    fixo("12-25", "Natal"),
    { dia: somarDias(domingo, -2), nome: "Sexta-feira Santa", facultativo: false },
    { dia: somarDias(domingo, -48), nome: "Carnaval", facultativo: true },
    { dia: somarDias(domingo, -47), nome: "Carnaval", facultativo: true },
    { dia: somarDias(domingo, 60), nome: "Corpus Christi", facultativo: true },
  ];

  /* Feriado nacional desde 2024 — Lei 14.759/2023. */
  if (ano >= 2024) {
    lista.push(fixo("11-20", "Dia Nacional de Zumbi e da Consciência Negra"));
  }

  lista.sort((x, y) => x.dia.localeCompare(y.dia));

  cacheDeFolgas.set(ano, lista);

  return lista;
}

/** O nome da folga daquele dia, ou `null` se é dia comum. */
export function folgaDoDia(
  dia: string,
  expediente: Expediente = EXPEDIENTE_PADRAO
): string | null {

  const achada = folgasDoAno(Number(dia.slice(0, 4))).find(
    (f) =>
      f.dia === dia &&
      (!f.facultativo || expediente.pularFacultativos)
  );

  return achada?.nome ?? null;
}

export function ehDiaUtil(
  dia: string,
  expediente: Expediente = EXPEDIENTE_PADRAO
) {
  return (
    expediente.dias.includes(diaDaSemana(dia)) &&
    folgaDoDia(dia, expediente) === null
  );
}

/** O próximo dia útil **depois** de `dia`. */
export function proximoDiaUtil(
  dia: string,
  expediente: Expediente = EXPEDIENTE_PADRAO
) {

  let cursor = somarDias(dia, 1);

  /* Um ano inteiro sem dia útil só com expediente inválido. */
  for (let i = 0; i < 366 && !ehDiaUtil(cursor, expediente); i++) {
    cursor = somarDias(cursor, 1);
  }

  return cursor;
}

/* ============================================================
   PRAZOS
============================================================ */

/**
 * O primeiro minuto de trabalho a partir de um instante.
 *
 * Dentro do expediente, é ele mesmo. Antes da abertura, a abertura do
 * dia. Depois do fechamento, em fim de semana ou feriado, a abertura do
 * próximo dia útil.
 */
export function inicioUtil(
  instante: Date,
  expediente: Expediente = EXPEDIENTE_PADRAO
): Parede {

  const { dia, min } = paredeDe(instante);

  if (ehDiaUtil(dia, expediente)) {
    if (min < expediente.inicioMin) {
      return { dia, min: expediente.inicioMin };
    }

    if (min < expediente.fimMin) return { dia, min };
  }

  return {
    dia: proximoDiaUtil(dia, expediente),
    min: expediente.inicioMin,
  };
}

/**
 * Quando vence um prazo de `horas` úteis contado a partir de `inicio`.
 *
 * Múltiplo de 24 anda em dias úteis e mantém a hora; o resto consome o
 * expediente minuto a minuto — ver o comentário do arquivo.
 */
export function prazoUtil(
  inicio: Date,
  horas: number,
  expediente: Expediente = EXPEDIENTE_PADRAO
): Date {

  const partida = inicioUtil(inicio, expediente);

  if (!(horas > 0)) return instanteDe(partida.dia, partida.min);

  if (horas % 24 === 0) {

    let dia = partida.dia;

    for (let i = 0; i < horas / 24; i++) {
      dia = proximoDiaUtil(dia, expediente);
    }

    return instanteDe(dia, partida.min);
  }

  let restante = Math.round(horas * 60);
  let { dia, min } = partida;

  for (let guarda = 0; guarda < 5000; guarda++) {

    const livre = expediente.fimMin - min;

    if (restante <= livre) {
      return instanteDe(dia, min + restante);
    }

    restante -= livre;
    dia = proximoDiaUtil(dia, expediente);
    min = expediente.inicioMin;
  }

  return instanteDe(dia, min);
}

/**
 * Minutos de expediente entre dois instantes.
 *
 * Negativo quando `ate` vem antes de `de` — é o "estourado há 3h úteis"
 * das telas. Conta dia a dia: mesmo um caso de um ano atrás custa
 * trezentas voltas curtas, e é o que torna o número auditável.
 */
export function minutosUteisEntre(
  de: Date,
  ate: Date,
  expediente: Expediente = EXPEDIENTE_PADRAO
): number {

  if (ate.getTime() < de.getTime()) {
    return -minutosUteisEntre(ate, de, expediente);
  }

  const a = paredeDe(de);
  const b = paredeDe(ate);

  let total = 0;
  let dia = a.dia;

  for (let guarda = 0; guarda < 4000; guarda++) {

    if (ehDiaUtil(dia, expediente)) {

      const abre = Math.max(
        expediente.inicioMin,
        dia === a.dia ? a.min : 0
      );

      const fecha = Math.min(
        expediente.fimMin,
        dia === b.dia ? b.min : DIA_MIN
      );

      if (fecha > abre) total += fecha - abre;
    }

    if (dia >= b.dia) break;

    dia = somarDias(dia, 1);
  }

  return total;
}

/**
 * "2h40", "45min", "1 dia útil e 3h" — o tamanho de um intervalo útil.
 *
 * Um dia útil aqui é um expediente inteiro: dez horas úteis, no padrão,
 * são "1 dia útil" e não "10h". É como quem trabalha conta.
 */
export function descreverMinutosUteis(
  minutos: number,
  expediente: Expediente = EXPEDIENTE_PADRAO
) {

  const m = Math.abs(Math.round(minutos));
  const porDia = expediente.fimMin - expediente.inicioMin;

  const dias = Math.floor(m / porDia);
  const resto = m - dias * porDia;
  const horas = Math.floor(resto / 60);
  const mins = resto % 60;

  const partes: string[] = [];

  if (dias > 0) partes.push(`${dias} ${dias === 1 ? "dia útil" : "dias úteis"}`);

  if (dias > 0) {
    if (horas > 0) partes.push(`${horas}h`);
  } else if (horas > 0) {
    partes.push(mins > 0 ? `${horas}h${String(mins).padStart(2, "0")}` : `${horas}h`);
  } else {
    partes.push(`${mins}min`);
  }

  return partes.join(" e ");
}

/** "4h úteis", "1 dia útil", "5 dias úteis" — como o documento escreve. */
export function descreverPrazo(horas: number) {

  if (horas > 0 && horas % 24 === 0) {
    const dias = horas / 24;
    return `${dias} ${dias === 1 ? "dia útil" : "dias úteis"}`;
  }

  return `${horas}h ${horas === 1 ? "útil" : "úteis"}`;
}

/** "08:00" a partir de minutos desde a meia-noite. */
export function horaDoMinuto(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Minutos desde a meia-noite a partir de "08:00". */
export function minutoDaHora(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : NaN;
}
