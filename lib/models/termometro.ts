/**
 * O termômetro do cliente (09/10/2026) — a parte que não fala com banco.
 *
 * "Preciso saber a satisfação do cliente como possui no NPS, com precisão,
 * e que salve de verdade" e "um termômetro de avaliação conforme o caso e o
 * histórico de atendimentos anteriores".
 *
 * Duas leituras e uma conta:
 *
 * 1. **Os sinais** — o que se mede sem IA: o humor das últimas falas do
 *    cliente (o mesmo léxico do cabeçalho), quanto tempo ele está esperando
 *    resposta, promessa nossa atrasada, resposta pública dada, caso
 *    encerrado. Dá a satisfação de base, de 0 a 10.
 * 2. **A IA** — lê o relato, a conversa e o histórico e diz a satisfação, a
 *    nota que o cliente daria hoje e as chances de "resolvido" e "voltaria".
 * 3. **A calibragem** — a resposta final mistura as duas (a IA pesa mais,
 *    os sinais seguram o exagero) e puxa a nota e as chances para o que o
 *    histórico real mostra: as avaliações anteriores deste cliente e as da
 *    operação no Reclame Aqui. Uma IA otimista não vira "nota 10" para
 *    quem está esperando resposta há dois dias.
 */

export interface HistoricoDeAvaliacoes {
  /** Avaliações reais anteriores (Reclame Aqui) — 0 quando não há. */
  avaliacoes: number;
  notaMedia: number | null;
  /** 0 a 100. */
  resolvido: number | null;
  voltaria: number | null;
}

export interface SinaisDoTermometro {
  /** 1 (muito irritado) a 5 (muito satisfeito) — o humor das últimas falas do cliente; null sem fala dele. */
  humor: 1 | 2 | 3 | 4 | 5 | null;
  /** Horas que o cliente espera a nossa resposta (0 quando nós falamos por último). */
  horasEsperando: number;
  promessaAtrasada: boolean;
  respostaPublica: boolean;
  encerrado: boolean;
  /** A nota do NPS, quando o atendimento é de um NPS. */
  notaNps: number | null;
}

export interface Termometro {
  satisfacao: number;
  notaPrevista: number;
  chanceResolvido: number;
  chanceVoltaria: number;
  motivo: string;
  sinais: string[];
}

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const arred = (v: number) => Math.round(v);

/** A satisfação só pelos sinais, de 0 a 10, com o porquê de cada ajuste. */
export function satisfacaoPelosSinais(s: SinaisDoTermometro): { valor: number; porque: string[] } {
  const porque: string[] = [];
  let valor: number;
  if (s.humor !== null) {
    valor = (s.humor - 1) * 2.5;
    porque.push(`humor das últimas falas: ${["", "muito irritado", "insatisfeito", "neutro", "satisfeito", "muito satisfeito"][s.humor]}`);
  } else if (s.notaNps !== null) {
    valor = s.notaNps;
    porque.push(`sem conversa: vale a nota do NPS (${s.notaNps})`);
  } else {
    valor = 5;
    porque.push("sem fala do cliente: ponto neutro");
  }
  if (s.horasEsperando >= 24) {
    valor -= 2;
    porque.push(`esperando resposta há ${Math.round(s.horasEsperando)} h`);
  } else if (s.horasEsperando >= 4) {
    valor -= 1;
    porque.push(`esperando resposta há ${Math.round(s.horasEsperando)} h`);
  }
  if (s.promessaAtrasada) {
    valor -= 1;
    porque.push("retorno prometido atrasado");
  }
  if (s.respostaPublica) {
    valor += 0.5;
    porque.push("já tem resposta pública");
  }
  if (s.encerrado) {
    valor += 0.5;
    porque.push("caso encerrado");
  }
  return { valor: entre(arred(valor), 0, 10), porque };
}

/** A base da operação quando o cliente não tem avaliação anterior. */
const PADRAO: HistoricoDeAvaliacoes = { avaliacoes: 0, notaMedia: 6, resolvido: 60, voltaria: 50 };

/**
 * A conta final. `ia` pode faltar (sem IA no ar): aí sai só pelos sinais e
 * pelo histórico. O histórico do cliente pesa mais quanto mais avaliações
 * ele tem (até 3); sem nenhuma, vale o da operação.
 */
export function calibrar(
  base: { valor: number; porque: string[] },
  historicoDoCliente: HistoricoDeAvaliacoes,
  daOperacao: HistoricoDeAvaliacoes,
  ia: Partial<Termometro> | null
): Termometro {
  const op = { ...PADRAO, ...Object.fromEntries(Object.entries(daOperacao).filter(([, v]) => v !== null)) } as HistoricoDeAvaliacoes;
  const pesoCliente = Math.min(historicoDoCliente.avaliacoes, 3) / 3;
  const referencia = (campo: "notaMedia" | "resolvido" | "voltaria") => {
    const doCliente = historicoDoCliente[campo];
    const daOp = op[campo] as number;
    return doCliente === null ? daOp : pesoCliente * doCliente + (1 - pesoCliente) * daOp;
  };

  const satIa = typeof ia?.satisfacao === "number" ? entre(ia.satisfacao, 0, 10) : null;
  const satisfacao = entre(arred(satIa === null ? base.valor : 0.75 * satIa + 0.25 * base.valor), 0, 10);

  /* A nota que daria hoje: a satisfação de agora, puxada para o que este cliente (ou a operação) costuma dar. */
  /*
    A previsão parte do que é real e a leitura desloca (calibrado em
    09/10/2026 contra as avaliações reais: a IA lê a conversa no meio da
    reclamação e erra para baixo — 5 de 5 abaixo, 2,4 pontos em média —,
    enquanto a operação tem média 7,3 e 43% de nota 10). A referência é a
    média do cliente (ou da operação); a leitura de agora (IA e satisfação)
    sobe ou desce a partir dela.
  */
  const notaIa = typeof ia?.notaPrevista === "number" ? entre(ia.notaPrevista, 0, 10) : satisfacao;
  const leitura = 0.6 * notaIa + 0.4 * satisfacao;
  const desvio = leitura - 5;
  const notaPrevista = entre(arred(referencia("notaMedia") + 0.55 * desvio), 0, 10);

  /* As chances: a referência real de "resolvido" e "voltaria", deslocada pela leitura e pelo que a IA disse. */
  const chance = (campo: "resolvido" | "voltaria", daIa: unknown) => {
    const ref = referencia(campo);
    const pelaLeitura = ref + 6 * desvio;
    return entre(arred(typeof daIa === "number" ? 0.65 * pelaLeitura + 0.35 * entre(daIa, 0, 100) : pelaLeitura), 0, 100);
  };
  const chanceResolvido = chance("resolvido", ia?.chanceResolvido);
  const chanceVoltaria = chance("voltaria", ia?.chanceVoltaria);

  const sinais = [...(Array.isArray(ia?.sinais) ? ia!.sinais.filter((x) => typeof x === "string" && x.trim()).slice(0, 4) : []), ...base.porque].slice(0, 6);
  if (historicoDoCliente.avaliacoes > 0) {
    sinais.push(`${historicoDoCliente.avaliacoes} avaliação(ões) anterior(es) deste cliente: nota média ${historicoDoCliente.notaMedia?.toFixed(1) ?? "—"}`);
  }

  const motivo = String(ia?.motivo ?? "").trim() || base.porque.join("; ");
  return { satisfacao, notaPrevista, chanceResolvido, chanceVoltaria, motivo: motivo.slice(0, 400), sinais };
}

/** Promotor, neutro ou detrator — a mesma faixa do NPS. */
export function faixaDaSatisfacao(v: number): "promotor" | "neutro" | "detrator" {
  return v >= 9 ? "promotor" : v >= 7 ? "neutro" : "detrator";
}

export function tendenciaEntre(anterior: number | null | undefined, agora: number): "melhorando" | "piorando" | "estavel" | null {
  if (anterior === null || anterior === undefined) return null;
  return agora - anterior >= 1 ? "melhorando" : anterior - agora >= 1 ? "piorando" : "estavel";
}

export interface TermometroView {
  satisfacao: number;
  faixa: "promotor" | "neutro" | "detrator";
  notaPrevista: number | null;
  chanceResolvido: number | null;
  chanceVoltaria: number | null;
  tendencia: "melhorando" | "piorando" | "estavel" | null;
  motivo: string;
  sinais: string[];
  fonte: string;
  /** ISO. */
  em: string;
  /** As leituras anteriores, da mais antiga para a mais nova (só a satisfação). */
  historico: { satisfacao: number; em: string }[];
}
