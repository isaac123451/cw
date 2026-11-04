/**
 * OKR do time (04/11/2026).
 *
 * Pedido do Isaac: "seria interessante uma página com possibilidade de
 * montar o okr com x métrica" — e o KR que não existia: "voltado para o
 * nps… a porcentagem é com base de detratores no mês x responderam a
 * pesquisa de forma positiva".
 *
 * O OKR é montado na tela (objetivo, vigência, resultados-chave) e cada
 * resultado-chave aponta para uma métrica deste catálogo. A plataforma
 * calcula o realizado de cada mês; ninguém digita o número.
 *
 * Só funções puras aqui; o banco fica em `lib/services/okr.service.ts`.
 */

export type MetricaId =
  | "nps-confianca"
  | "nps-contato-2du"
  | "nps-score"
  | "ra-voltaria"
  | "ra-nota"
  | "ra-solucao"
  | "ra-resposta";

export interface Metrica {
  id: MetricaId;
  nome: string;
  frente: "NPS" | "Reclame Aqui";
  /** "%" (0–100) ou "nota" (0–10) ou "pontos" (−100 a 100). */
  unidade: "%" | "nota" | "pontos";
  /** Como o mês é lido — vai para a tela, embaixo do número. */
  leitura: string;
  minimo: number;
  maximo: number;
}

export const METRICAS: Metrica[] = [
  {
    id: "nps-confianca",
    nome: "Confiança recuperada (detratores do NPS)",
    frente: "NPS",
    unidade: "%",
    leitura: "Detratores com a solução confirmada e \"Sim\" na pesquisa de confiança ÷ detratores elegíveis, acumulado até o fim do mês.",
    minimo: 0,
    maximo: 100,
  },
  {
    id: "nps-contato-2du",
    nome: "Detratores contatados em até 2 dias úteis",
    frente: "NPS",
    unidade: "%",
    leitura: "Primeiro contato até o 2º dia útil depois da resposta à pesquisa, acumulado até o fim do mês.",
    minimo: 0,
    maximo: 100,
  },
  {
    id: "nps-score",
    nome: "NPS do mês",
    frente: "NPS",
    unidade: "pontos",
    leitura: "% de promotores − % de detratores entre as respostas do mês.",
    minimo: -100,
    maximo: 100,
  },
  {
    id: "ra-voltaria",
    nome: "Voltariam a fazer negócio (Reclame Aqui)",
    frente: "Reclame Aqui",
    unidade: "%",
    leitura: "Painel oficial, janela de 6 meses, lido pelo vigia no último dia útil do mês.",
    minimo: 0,
    maximo: 100,
  },
  {
    id: "ra-nota",
    nome: "Nota do Reclame Aqui",
    frente: "Reclame Aqui",
    unidade: "nota",
    leitura: "Painel oficial, janela de 6 meses, lido pelo vigia no último dia útil do mês.",
    minimo: 0,
    maximo: 10,
  },
  {
    id: "ra-solucao",
    nome: "Índice de solução (Reclame Aqui)",
    frente: "Reclame Aqui",
    unidade: "%",
    leitura: "Painel oficial, janela de 6 meses, lido pelo vigia no último dia útil do mês.",
    minimo: 0,
    maximo: 100,
  },
  {
    id: "ra-resposta",
    nome: "Índice de resposta (Reclame Aqui)",
    frente: "Reclame Aqui",
    unidade: "%",
    leitura: "Painel oficial, janela de 6 meses, lido pelo vigia no último dia útil do mês.",
    minimo: 0,
    maximo: 100,
  },
];

export const metricaDe = (id: string) => METRICAS.find((m) => m.id === id);

export interface ResultadoChave {
  id: string;
  /** "Confiança recuperada" — curto; o nome da métrica já explica o resto. */
  titulo: string;
  metrica: MetricaId;
  /** A meta no fim da vigência. */
  meta: number;
  linhaDeBase: number | null;
  /** "80,8% em 15/10/2026", "Sem linha de base (criar indicador)". */
  linhaDeBaseNota: string;
  /** "2026-10" → meta do mês. */
  metasMensais: Record<string, number>;
  /** Até quando alguém entra na população (o KR1 fecha a entrada em 15/12). */
  corte: string | null;
  /** Regra em uma ou duas frases, para quem abre o KR. */
  regra: string;
}

export interface OkrView {
  id: string;
  objetivo: string;
  inicio: string;
  fim: string;
  contexto: string;
  krs: ResultadoChave[];
  atualizadoEm?: string;
  atualizadoPor?: string | null;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Os meses da vigência: "2026-10", "2026-11", "2026-12". */
export function mesesDoOkr(inicio: string, fim: string): string[] {
  if (!DIA.test(inicio) || !DIA.test(fim) || fim < inicio) return [];
  const meses: string[] = [];
  let [a, m] = inicio.slice(0, 7).split("-").map(Number);
  const ultimo = fim.slice(0, 7);
  for (let i = 0; i < 36; i += 1) {
    const mes = `${a}-${String(m).padStart(2, "0")}`;
    meses.push(mes);
    if (mes === ultimo) break;
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return meses;
}

export function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

const NOME_DO_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeDoMes = (mes: string) => NOME_DO_MES[Number(mes.slice(5, 7)) - 1] ?? mes;

/** "60%", "8,5", "+42". */
export function formatarValor(valor: number | null | undefined, unidade: Metrica["unidade"]) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const n = valor.toLocaleString("pt-BR", { minimumFractionDigits: unidade === "nota" ? 1 : 0, maximumFractionDigits: 1 });
  if (unidade === "%") return `${n}%`;
  if (unidade === "pontos") return valor > 0 ? `+${n}` : n;
  return n;
}

/**
 * Confere o OKR vindo da tela. Devolve o primeiro problema, em português
 * de quem usa, ou null.
 */
export function problemaDoOkr(o: OkrView): string | null {
  if (!o.objetivo?.trim()) return "Escreva o objetivo.";
  if (o.objetivo.length > 300) return "O objetivo passa de 300 caracteres.";
  if (!DIA.test(o.inicio) || !DIA.test(o.fim)) return "Escolha o começo e o fim da vigência.";
  if (o.fim < o.inicio) return "O fim da vigência vem antes do começo.";
  if (mesesDoOkr(o.inicio, o.fim).length > 12) return "A vigência passa de 12 meses.";
  if ((o.contexto ?? "").length > 3000) return "O contexto passa de 3.000 caracteres.";
  if (!Array.isArray(o.krs) || o.krs.length === 0) return "Inclua pelo menos um resultado-chave.";
  if (o.krs.length > 8) return "No máximo 8 resultados-chave.";
  const meses = new Set(mesesDoOkr(o.inicio, o.fim));
  for (const [i, kr] of o.krs.entries()) {
    const nome = `O KR${i + 1}`;
    const metrica = metricaDe(kr.metrica);
    if (!metrica) return `${nome} está sem métrica.`;
    if (!kr.titulo?.trim()) return `${nome} está sem nome.`;
    if (kr.titulo.length > 120) return `O nome do KR${i + 1} passa de 120 caracteres.`;
    const dentro = (v: number) => Number.isFinite(v) && v >= metrica.minimo && v <= metrica.maximo;
    if (typeof kr.meta !== "number" || !dentro(kr.meta)) return `A meta do KR${i + 1} precisa ficar entre ${metrica.minimo} e ${metrica.maximo}.`;
    if (kr.linhaDeBase != null && !dentro(kr.linhaDeBase)) return `A linha de base do KR${i + 1} precisa ficar entre ${metrica.minimo} e ${metrica.maximo}.`;
    for (const [mes, v] of Object.entries(kr.metasMensais ?? {})) {
      if (!MES.test(mes) || !meses.has(mes)) return `O KR${i + 1} tem meta para um mês fora da vigência.`;
      if (!dentro(v)) return `A meta de ${nomeDoMes(mes)} do KR${i + 1} precisa ficar entre ${metrica.minimo} e ${metrica.maximo}.`;
    }
    if (kr.corte != null && kr.corte !== "" && (!DIA.test(kr.corte) || kr.corte < o.inicio || kr.corte > o.fim)) return `A data de corte do KR${i + 1} precisa estar dentro da vigência.`;
    if ((kr.regra ?? "").length > 1500) return `A regra do KR${i + 1} passa de 1.500 caracteres.`;
    if ((kr.linhaDeBaseNota ?? "").length > 200) return `A nota da linha de base do KR${i + 1} passa de 200 caracteres.`;
  }
  return null;
}

/** O OKR do 4º trimestre de 2026, como o time escreveu — o ponto de partida do botão "Usar o OKR do 4º tri". */
export const OKR_4T_2026: Omit<OkrView, "id"> = {
  objetivo: "Reverter experiências negativas e reconstruir a confiança de clientes detratores na Cardápio Web.",
  inicio: "2026-10-01",
  fim: "2026-12-31",
  contexto:
    "Frente principal: gestão e recuperação de detratores. Iniciativa: programa de recuperação proativa de experiências negativas — identificar a insatisfação, coordenar a solução e confirmar a recuperação da confiança. Frente complementar: Reclame Aqui, indicador \"Voltariam a fazer negócio\". Fora do escopo: RA1000, acompanhado separadamente.",
  krs: [
    {
      id: "kr1",
      titulo: "Confiança recuperada",
      metrica: "nps-confianca",
      meta: 60,
      linhaDeBase: null,
      linhaDeBaseNota: "Sem linha de base (indicador novo)",
      metasMensais: { "2026-10": 28.5, "2026-11": 44.3, "2026-12": 60 },
      corte: "2026-12-15",
      regra:
        "Só conta como sucesso com a causa resolvida, a solução confirmada pelo cliente e \"Sim\" na pesquisa de confiança até 31/12. Todos os elegíveis ficam no denominador, inclusive os não contatados e as contas que cancelarem. Uma linha por conta.",
    },
    {
      id: "kr2",
      titulo: "Voltariam a fazer negócio",
      metrica: "ra-voltaria",
      meta: 85,
      linhaDeBase: 80.8,
      linhaDeBaseNota: "80,8% em 15/10/2026",
      metasMensais: { "2026-10": 81.7, "2026-11": 83.3, "2026-12": 85 },
      corte: null,
      regra: "Vale a leitura do painel do Reclame Aqui no último dia útil do mês. Só chega a 85% se o \"Sim\" nas novas avaliações passar de 85%: a alavanca é a qualidade da resolução, não o volume.",
    },
  ],
};

/* ============================================================
   KR · CONFIANÇA RECUPERADA
============================================================ */

export type RespostaDeConfianca = "sim" | "parcialmente" | "nao";

export const RESPOSTAS_DE_CONFIANCA: { id: RespostaDeConfianca; nome: string }[] = [
  { id: "sim", nome: "Sim" },
  { id: "parcialmente", nome: "Parcialmente" },
  { id: "nao", nome: "Não" },
];

export const PERGUNTA_DE_CONFIANCA = "Após essa tratativa, você considera que sua confiança na Cardápio Web foi recuperada?";

/** Um detrator, com as datas já no dia de Brasília (AAAA-MM-DD). */
export interface DetratorDoKr {
  id: string;
  /** A conta — o mesmo restaurante com duas respostas é uma linha só. */
  conta: string;
  dia: string;
  contatadoDia?: string | null;
  /** Primeiro contato até o 2º dia útil depois da resposta. */
  contatadoNoPrazo: boolean;
  confirmadoDia?: string | null;
  enviadaDia?: string | null;
  resposta?: RespostaDeConfianca | null;
  respondidaDia?: string | null;
}

export interface ConfiancaDoPeriodo {
  elegiveis: number;
  sucesso: number;
  percentual: number | null;
  contatados: number;
  contatadosNoPrazo: number;
  percentualNoPrazo: number | null;
  /** Solução confirmada e pesquisa ainda não enviada — o próximo passo. */
  confirmadosSemPesquisa: number;
  enviadas: number;
  respondidas: number;
  taxaDeResposta: number | null;
  sim: number;
  parcialmente: number;
  nao: number;
  /** Enviada e sem resposta: "Recuperação não comprovada" no fechamento. */
  semResposta: number;
  naoContatados: number;
}

const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 1000) / 10 : null);

/**
 * O KR1 até um dia: elegíveis = detratores com resposta entre o início
 * e o corte (e até o dia lido); sucesso = solução confirmada e "Sim" na
 * pesquisa, os dois até o dia lido. Por conta: a conta com duas respostas
 * conta uma vez, e vale o melhor desfecho dela.
 */
export function confiancaRecuperada(detratores: DetratorDoKr[], periodo: { inicio: string; corte: string | null; ate: string }): ConfiancaDoPeriodo {
  const limiteDeEntrada = periodo.corte && periodo.corte < periodo.ate ? periodo.corte : periodo.ate;
  const ate = periodo.ate;
  const ate2 = (d?: string | null) => Boolean(d) && d! <= ate;

  const porConta = new Map<string, DetratorDoKr[]>();
  for (const d of detratores) {
    if (d.dia < periodo.inicio || d.dia > limiteDeEntrada) continue;
    const lista = porConta.get(d.conta) ?? [];
    lista.push(d);
    porConta.set(d.conta, lista);
  }

  const r: ConfiancaDoPeriodo = {
    elegiveis: porConta.size,
    sucesso: 0,
    percentual: null,
    contatados: 0,
    contatadosNoPrazo: 0,
    percentualNoPrazo: null,
    confirmadosSemPesquisa: 0,
    enviadas: 0,
    respondidas: 0,
    taxaDeResposta: null,
    sim: 0,
    parcialmente: 0,
    nao: 0,
    semResposta: 0,
    naoContatados: 0,
  };

  const ORDEM: Record<RespostaDeConfianca, number> = { sim: 3, parcialmente: 2, nao: 1 };
  for (const lista of porConta.values()) {
    const contatado = lista.some((d) => ate2(d.contatadoDia));
    if (contatado) r.contatados += 1;
    else r.naoContatados += 1;
    if (lista.some((d) => d.contatadoNoPrazo && ate2(d.contatadoDia))) r.contatadosNoPrazo += 1;

    const respondidas = lista.filter((d) => d.resposta && ate2(d.respondidaDia));
    const melhor = respondidas.sort((a, b) => ORDEM[b.resposta!] - ORDEM[a.resposta!])[0];
    const enviada = lista.some((d) => ate2(d.enviadaDia)) || Boolean(melhor);
    if (enviada) r.enviadas += 1;
    if (melhor) {
      r.respondidas += 1;
      r[melhor.resposta!] += 1;
    } else if (enviada) {
      r.semResposta += 1;
    } else if (lista.some((d) => ate2(d.confirmadoDia))) {
      r.confirmadosSemPesquisa += 1;
    }
    if (lista.some((d) => d.resposta === "sim" && ate2(d.respondidaDia) && ate2(d.confirmadoDia))) r.sucesso += 1;
  }

  r.percentual = pct(r.sucesso, r.elegiveis);
  r.percentualNoPrazo = pct(r.contatadosNoPrazo, r.elegiveis);
  r.taxaDeResposta = pct(r.respondidas, r.enviadas);
  return r;
}

/** NPS de um conjunto de notas: % promotores − % detratores, inteiro. */
export function npsDasNotas(notas: number[]): number | null {
  if (!notas.length) return null;
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  return Math.round(((promotores - detratores) / notas.length) * 100);
}

/* ============================================================
   LEITURA DO PAINEL NO MÊS
============================================================ */

export interface LeituraDoPainel {
  /** Dia da leitura, em Brasília. */
  dia: string;
  voltaria: number | null;
  nota: number | null;
  solucao: number | null;
  resposta: number | null;
}

/**
 * A leitura que vale para o mês: a do último dia útil (ou a mais recente
 * antes dele, se o vigia não leu naquele dia). No mês corrente, a mais
 * recente até hoje — é o "como estamos agora". Sem leitura no mês, null:
 * a de um mês não serve para o outro.
 */
export function leituraDoMes(leituras: LeituraDoPainel[], mes: string, ultimoDiaUtil: string, hoje: string): LeituraDoPainel | null {
  const ate = hoje < ultimoDiaUtil ? hoje : ultimoDiaUtil;
  const doMes = leituras.filter((l) => l.dia.startsWith(mes) && l.dia <= ate).sort((a, b) => a.dia.localeCompare(b.dia));
  return doMes[doMes.length - 1] ?? null;
}

/* ============================================================
   O QUE A TELA MOSTRA DE CADA KR
============================================================ */

export interface MesDoKr {
  mes: string;
  meta: number | null;
  realizado: number | null;
  /** O mês ainda não começou. */
  futuro: boolean;
  /** O mês está em curso: o realizado é parcial. */
  emCurso: boolean;
}

export interface KrCalculado {
  kr: ResultadoChave;
  atual: number | null;
  /** A meta do mês corrente (ou a final, depois da vigência). */
  metaDeAgora: number | null;
  meses: MesDoKr[];
  confianca?: ConfiancaDoPeriodo;
  /** Quando o realizado não sai (sem leitura do painel, tabela que falta). */
  aviso?: string;
}

/** Na meta, perto (até 10% da distância da linha de base) ou abaixo. */
export function situacao(atual: number | null, meta: number | null): "na-meta" | "perto" | "abaixo" | null {
  if (atual == null || meta == null) return null;
  if (atual >= meta) return "na-meta";
  return meta - atual <= Math.max(1, Math.abs(meta) * 0.05) ? "perto" : "abaixo";
}

/** Quantos sucessos faltam para a meta do mês no KR de confiança. */
export function faltamParaMeta(c: ConfiancaDoPeriodo, meta: number | null) {
  if (meta == null || !c.elegiveis) return null;
  const precisa = Math.ceil((meta / 100) * c.elegiveis - 1e-9);
  return Math.max(0, precisa - c.sucesso);
}

/* ============================================================
   A PESQUISA DE CONFIANÇA NA CONVERSA
============================================================ */

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A nossa mensagem é a pergunta de confiança (a do OKR, ou parecida). */
export function ehPerguntaDeConfianca(texto: string) {
  const t = semAcento(texto);
  return /confianca/.test(t) && /recuperad/.test(t);
}

/**
 * A resposta curta do cliente: "Sim", "Sim, foi", "Parcialmente", "Não".
 * Texto longo ou sem uma das três no começo fica para a pessoa ler — a
 * IA não interpreta "olha, até que sim, mas…".
 */
export function respostaNaMensagem(texto: string): RespostaDeConfianca | null {
  const t = semAcento(texto).trim();
  if (!t || t.length > 120) return null;
  if (/^(em parte|parcial(mente)?)\b/.test(t)) return "parcialmente";
  if (/^(sim|s|com certeza|claro|foi sim|recuperada|recuperou)\b/.test(t)) return "sim";
  if (/^(nao|n|ainda nao|de jeito nenhum)\b/.test(t)) return "nao";
  return null;
}

/**
 * Na conversa: quando saiu a pergunta e o que o cliente respondeu logo
 * depois (a primeira mensagem dele que é uma das três respostas, antes de
 * outra pergunta nossa).
 */
export function pesquisaNaConversa(mensagens: { de: "nos" | "cliente"; texto: string | null; em: Date }[]): { enviadaEm: Date; resposta: RespostaDeConfianca | null; respondidaEm: Date | null } | null {
  const ordem = [...mensagens].sort((a, b) => a.em.getTime() - b.em.getTime());
  let pergunta = -1;
  for (let i = ordem.length - 1; i >= 0; i -= 1) {
    if (ordem[i].de === "nos" && ehPerguntaDeConfianca(ordem[i].texto ?? "")) {
      pergunta = i;
      break;
    }
  }
  if (pergunta < 0) return null;
  for (const m of ordem.slice(pergunta + 1)) {
    if (m.de !== "cliente") continue;
    const r = respostaNaMensagem(m.texto ?? "");
    if (r) return { enviadaEm: ordem[pergunta].em, resposta: r, respondidaEm: m.em };
  }
  return { enviadaEm: ordem[pergunta].em, resposta: null, respondidaEm: null };
}
