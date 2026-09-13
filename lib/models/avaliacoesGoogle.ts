import type { Prioridade } from "@/lib/models/case";
import { primeiroNome } from "@/lib/models/mensagens";
import { ACAO_JUDICIAL, ORGAO_DO_CONSUMIDOR } from "@/lib/models/redes";

import {
  EXPEDIENTE_PADRAO,
  type Expediente,
  minutosUteisEntre,
  prazoUtil,
} from "@/lib/services/horasUteis";

/**
 * As avaliações do Google, como o documento "Google" trata.
 *
 * "Aqui o cliente muitas vezes não está buscando resolução, está
 * deixando um registro público de uma experiência já concluída." A
 * resposta é para quem avaliou e para todo futuro cliente que vai ler.
 * Por isso: classificação pela nota e pelo texto, prazo de resposta
 * pela criticidade, e uma régua contra resposta genérica.
 */

export type Classificacao = "positiva" | "neutra" | "negativa";

export type StatusDaAvaliacao = "aberta" | "respondida" | "sem-identificacao" | "sem-retorno" | "denunciada";

export const ROTULO_DO_STATUS_GOOGLE: Record<StatusDaAvaliacao, string> = {
  aberta: "Aberta",
  respondida: "[Encerrado] Respondida",
  "sem-identificacao": "[Encerrado] Sem Identificação",
  "sem-retorno": "[Encerrado] Sem Retorno do Cliente",
  denunciada: "Denunciada ao Google",
};

export const EXCECOES_GOOGLE = [
  { id: "ofensiva", texto: "Ofensiva" },
  { id: "falsa", texto: "Falsa" },
  { id: "nao-cliente", texto: "De quem não é cliente" },
] as const;

export type MotivoDeUrgencia = "juridico" | "cobranca" | "reincidencia";

export const ROTULO_DA_URGENCIA: Record<MotivoDeUrgencia, string> = {
  juridico: "risco jurídico",
  cobranca: "cobrança indevida",
  reincidencia: "mesmo problema em várias avaliações recentes",
};

/** O mesmo corte das Redes Sociais: órgão do consumidor ou ação judicial com intenção. */
const juridico = (t: string) => ORGAO_DO_CONSUMIDOR.test(t) || ACAO_JUDICIAL.test(t);

const COBRANCA = /cobran[çc]a indevida|\bcobra(do|ram|ndo)\b[^.]{0,40}\b(indevid|sem autoriza|duas vezes|a mais|errad)|\bcobran[çc]a (em )?duplicad|\bfraude\b|\bestorno\b/i;

/**
 * Ressalva num texto de nota alta: "é bom, mas…" é neutra, e não positiva.
 *
 * "Falta" e "poderia" só contam sem o "não" na frente: "não falta nada"
 * e "não poderia ser melhor" são o elogio mais comum que existe.
 */
const RESSALVA = /\b(mas|por[ée]m|s[óo] que|entretanto|contudo|deixa a desejar|precisa melhorar|apesar)\b|(?<!n[ãa]o (me |nos )?)\b(falta|poderia)\b/i;

/**
 * Problema relatado como não resolvido, mesmo com nota média.
 *
 * "Não consigo mais trabalhar sem o sistema" é elogio: o "não consigo"
 * seguido de viver/trabalhar/imaginar/ficar sem fica de fora.
 */
const PROBLEMA_ABERTO = /\bn[ãa]o (resolv|funciona|responde|atende|retorn)|\bn[ãa]o consig(o|uimos|uem|ue)\b(?! (mais )?(imaginar|viver|trabalhar|ficar) sem\b)|\bsem (resposta|retorno|solu[çc][ãa]o)\b|\bpar(ou|ado) de funcionar\b|\bn[ãa]o recebo\b/i;

export interface Triagem {
  classificacao: Classificacao;
  criticidade: Prioridade;
  motivos: MotivoDeUrgencia[];
}

/**
 * A tabela do documento.
 *
 * Positiva: 4 ou 5 estrelas, sem crítica relevante. Neutra: 3 estrelas,
 * ou comentário misto (elogio + ressalva). Negativa: 1 ou 2 estrelas, ou
 * comentário relatando problema não resolvido — Alta, e Urgente quando
 * fala em risco jurídico, cobrança indevida, ou quando o mesmo problema
 * se repete em várias avaliações recentes.
 */
export function classificarAvaliacao(
  estrelas: number,
  texto: string | undefined,
  reincidente = false
): Triagem {

  const t = texto ?? "";

  const negativa = estrelas <= 2 || PROBLEMA_ABERTO.test(t);
  const neutra = !negativa && (estrelas === 3 || RESSALVA.test(t));

  const classificacao: Classificacao = negativa ? "negativa" : neutra ? "neutra" : "positiva";

  const motivos: MotivoDeUrgencia[] = [];
  if (negativa) {
    if (juridico(t)) motivos.push("juridico");
    if (COBRANCA.test(t)) motivos.push("cobranca");
    if (reincidente) motivos.push("reincidencia");
  }

  return {
    classificacao,
    criticidade: negativa ? (motivos.length > 0 ? "Urgente" : "Alta") : "Normal",
    motivos,
  };
}

/** "Até 48h úteis para qualquer avaliação; negativas 24h (Alta) e 4h (Urgente)." */
export function prazoDeResposta(criticidade: Prioridade) {
  return criticidade === "Urgente" ? 4 : criticidade === "Alta" ? 24 : 48;
}

export function venceEm(publicadaEm: string, criticidade: Prioridade, expediente: Expediente = EXPEDIENTE_PADRAO) {
  return prazoUtil(new Date(publicadaEm), prazoDeResposta(criticidade), expediente);
}

/* ============================================================
   A RESPOSTA PÚBLICA
============================================================ */

export interface AvisoDaResposta {
  aviso: string;
}

/**
 * O que a resposta pública ainda não cumpre.
 *
 * "Nunca usar respostas genéricas ou copiadas sem adaptação — a
 * genericidade transmite descaso." E, por tipo: agradecer nominalmente
 * a positiva; na negativa, direcionar para canal privado, sem prometer
 * solução e sem discutir o mérito.
 */
export function conferirResposta(entrada: {
  resposta: string;
  autor: string;
  classificacao: Classificacao;
  /** A maior semelhança com uma resposta já publicada, de 0 a 100. */
  semelhancaMaxima?: number;
}): AvisoDaResposta[] {

  const r = entrada.resposta.trim();
  const avisos: AvisoDaResposta[] = [];

  if (!r) return avisos;

  const nome = primeiroNome(entrada.autor);

  if (r.length < 80) avisos.push({ aviso: "Curta demais para não soar genérica — diga algo que só esta avaliação tem." });

  if ((entrada.semelhancaMaxima ?? 0) >= 60) {
    avisos.push({ aviso: `${entrada.semelhancaMaxima}% igual a uma resposta já publicada — adapte ao que esta pessoa escreveu.` });
  }

  /* "Joao" no perfil e "João" na resposta são a mesma pessoa. */
  const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  if (entrada.classificacao !== "negativa" && nome && !semAcento(r).includes(semAcento(nome))) {
    avisos.push({ aviso: `Agradeça nominalmente: a resposta não cita ${nome}.` });
  }

  if (entrada.classificacao === "negativa") {
    if (!/whats|e-?mail|privad|direct|contato|telefone|liga/i.test(r)) {
      avisos.push({ aviso: "Direcione para um canal privado (WhatsApp, e-mail) para continuar a tratativa." });
    }
    if (/\b(vamos resolver|ser[áa] resolvido|garantimos|j[áa] est[áa] resolvido|resolveremos)\b/i.test(r)) {
      avisos.push({ aviso: "Não prometa solução na resposta pública — ofereça o canal privado." });
    }
    if (/\b(voc[êe] (n[ãa]o )?(deveria|precisava|errou)|culpa|conforme (o )?contrato|n[ãa]o procede)\b/i.test(r)) {
      avisos.push({ aviso: "Tom defensivo: não discuta o mérito nem ponha a culpa no cliente." });
    }
  }

  return avisos;
}

/* ============================================================
   INDICADORES
============================================================ */

export interface AvaliacaoParaIndicador {
  estrelas: number;
  classificacao: Classificacao;
  publicadaEm: string;
  respondidaEm?: string;
  notaAtualizada?: number;
  status: StatusDaAvaliacao;
}

export interface IndicadoresGoogle {
  total: number;
  /** Nota média, com a nota atualizada quando o cliente atualizou. */
  notaMedia: number | null;
  respondidas: number;
  percentualRespondidas: number | null;
  /** Mediana de minutos úteis entre a publicação e a resposta. */
  tempoMedianoMin: number | null;
  /** Respondidas dentro do SLA de 48h úteis. */
  noPrazo: number;
  negativas: number;
  /** Negativas cuja nota foi atualizada para 4 ou 5. */
  revertidas: number;
  percentualRevertidas: number | null;
}

/**
 * Os quatro indicadores do documento.
 *
 * O "tempo médio" sai como mediana: dez respostas em uma hora e uma
 * esquecida por um mês dariam uma média que não descreve nenhuma delas.
 * A nota média usa a nota atualizada — é a que o Google mostra hoje.
 */
export function indicadoresGoogle(
  avaliacoes: AvaliacaoParaIndicador[],
  expediente: Expediente = EXPEDIENTE_PADRAO
): IndicadoresGoogle {

  const validas = avaliacoes.filter((a) => a.status !== "denunciada");
  const total = validas.length;

  const nota = (a: AvaliacaoParaIndicador) => a.notaAtualizada ?? a.estrelas;

  const respondidas = validas.filter((a) => a.respondidaEm);

  const tempos = respondidas
    .map((a) => minutosUteisEntre(new Date(a.publicadaEm), new Date(a.respondidaEm!), expediente))
    .map((m) => Math.max(0, m))
    .sort((a, b) => a - b);

  const mediana = tempos.length === 0
    ? null
    : tempos.length % 2
      ? tempos[(tempos.length - 1) / 2]
      : Math.round((tempos[tempos.length / 2 - 1] + tempos[tempos.length / 2]) / 2);

  const porDia = expediente.fimMin - expediente.inicioMin;
  const noPrazo = tempos.filter((m) => m <= 48 / 24 * porDia).length;

  const negativas = validas.filter((a) => a.classificacao === "negativa");
  const revertidas = negativas.filter((a) => (a.notaAtualizada ?? 0) >= 4).length;

  return {
    total,
    notaMedia: total ? Math.round((validas.reduce((s, a) => s + nota(a), 0) / total) * 10) / 10 : null,
    respondidas: respondidas.length,
    percentualRespondidas: total ? Math.round((respondidas.length / total) * 100) : null,
    tempoMedianoMin: mediana,
    noPrazo,
    negativas: negativas.length,
    revertidas,
    percentualRevertidas: negativas.length ? Math.round((revertidas / negativas.length) * 100) : null,
  };
}
