import type { Case } from "@/lib/models/case";
import type { ContatoView } from "@/lib/models/tratativa";

import {
  EXPEDIENTE_PADRAO,
  type Expediente,
  prazoUtil,
} from "@/lib/services/horasUteis";

/**
 * O fluxo das Redes Sociais, como o documento dele descreve.
 *
 * **A premissa muda tudo.** "O cliente que recorre à rede social
 * raramente está em primeiro contato": já tentou outro canal, ou achou
 * que a exposição pública resolveria mais rápido. Por isso o caso nasce
 * com prioridade elevada, a análise olha o que já foi tentado, e o
 * encerramento distingue "resolvido" de "sem contato" — que "não é
 * contabilizado como resolvido nos indicadores".
 *
 * As etapas eram as do Reclame Aqui ("Aguardando avaliação" num direct do
 * Instagram). Agora são as do documento.
 */

export interface EtapaDasRedes {
  nome: string;
  cor: string;
  dica: string;
  final?: boolean;
  /** O final conta como resolvido nos indicadores? */
  resolvido?: boolean;
}

export const ETAPAS_DAS_REDES: EtapaDasRedes[] = [
  { nome: "Recebido", cor: "#8B5CF6", dica: "Chegou pela automação do Slack ou pela planilha: origem, dados e registro." },
  { nome: "Em análise", cor: "#0EA5E9", dica: "Conta, histórico e o que o cliente já tentou em outros canais, antes de responder." },
  { nome: "1º contato", cor: "#F59E0B", dica: "Primeiro contato feito — hoje pelo Crisp, apresentando-se como responsável." },
  { nome: "Em tratativa", cor: "#F97316", dica: "Resolvendo, ou com uma área interna — o caso segue com a reputação." },
  { nome: "Validação", cor: "#14B8A6", dica: "Confirmando com o cliente que a solicitação foi atendida." },
  { nome: "Resolvido", cor: "#10B981", dica: "Encerrado com a solução confirmada pelo cliente.", final: true, resolvido: true },
  { nome: "Sem contato", cor: "#71717A", dica: "Três tentativas sem resposta. Não conta como resolvido; reabre se o cliente voltar.", final: true },
  { nome: "Sem identificação", cor: "#A1A1AA", dica: "O cliente não se identificou pelo canal privado. O registro fica para efeito de menção.", final: true },
];

export const FINAIS_DAS_REDES = ETAPAS_DAS_REDES.filter((e) => e.final).map((e) => e.nome);

/** "Novo" (das etapas antigas) é lido como "Recebido". */
export function etapaDasRedes(status: string) {
  if (status === "Novo") return ETAPAS_DAS_REDES[0];
  return ETAPAS_DAS_REDES.find((e) => e.nome === status);
}

export function eFinalDasRedes(status: string) {
  return FINAIS_DAS_REDES.includes(status);
}

/* ============================================================
   CADÊNCIA — "ausência de contato"
============================================================ */

/**
 * As três tentativas do documento: a 1ª no próprio 1º contato, a 2ª em
 * até 24h (WhatsApp e canal de origem), a 3ª em até 48h (canal
 * alternativo — e-mail ou telefone, se houver cadastro). Em horas
 * úteis, como todo prazo da operação.
 */
export const TENTATIVAS_DAS_REDES = 3;

export interface CadenciaDasRedes {
  tentativas: number;
  esgotada: boolean;
  /** A próxima tentativa, e até quando. */
  proxima?: { numero: 2 | 3; ate: string; canal: string };
  resumo: string;
}

export function cadenciaDasRedes(
  contatos: Pick<ContatoView, "tipo" | "resultado" | "em">[],
  expediente: Expediente = EXPEDIENTE_PADRAO
): CadenciaDasRedes {

  const ordenados = [...contatos].sort((a, b) => a.em.localeCompare(b.em));
  const respostas = ordenados.filter((c) => c.resultado === "respondeu");
  const ultimaResposta = respostas[respostas.length - 1]?.em;

  /* O 1º contato sem resposta também é tentativa: é a 1ª do documento. */
  const seguidas = ordenados.filter(
    (c) =>
      (c.tipo === "tentativa" || c.tipo === "contato") &&
      c.resultado !== "respondeu" &&
      (!ultimaResposta || c.em > ultimaResposta)
  );

  if (seguidas.length === 0) {
    return { tentativas: 0, esgotada: false, resumo: "Nenhuma tentativa sem resposta." };
  }

  if (seguidas.length >= TENTATIVAS_DAS_REDES) {
    return {
      tentativas: seguidas.length,
      esgotada: true,
      resumo: `${seguidas.length} tentativas sem resposta — encerre como "Sem contato". Se o cliente voltar, o caso reabre com o mesmo registro.`,
    };
  }

  const primeira = new Date(seguidas[0].em);
  const numero = (seguidas.length + 1) as 2 | 3;
  const ate = prazoUtil(primeira, numero === 2 ? 24 : 48, expediente).toISOString();

  return {
    tentativas: seguidas.length,
    esgotada: false,
    proxima: {
      numero,
      ate,
      canal: numero === 2 ? "WhatsApp e o canal de origem" : "canal alternativo (e-mail ou telefone, se houver cadastro)",
    },
    resumo: `${seguidas.length} tentativa(s) sem resposta. A ${numero}ª vai por ${numero === 2 ? "WhatsApp e o canal de origem" : "e-mail ou telefone"}.`,
  };
}

/* ============================================================
   CRISE — "risco de exposição"
============================================================ */

/** "Perfis de grande alcance" — o mesmo corte do prazo de 1h. */
export const SEGUIDORES_DE_ALCANCE = 10_000;

export const ORGAO_DO_CONSUMIDOR = /\bprocon\b|\bdefesa do consumidor\b|\bconsumidor\.gov\b/i;

/**
 * Ação judicial — e não a palavra "processo".
 *
 * Num sistema de pedidos, "processo" é "o processo de cadastro" e
 * "processar o pagamento". A primeira versão pegava a palavra solta, e
 * toda reclamação sobre o fluxo de implantação virava crise jurídica.
 * Aqui só conta com a intenção junto: abrir, entrar com, mover, processar
 * a empresa — ou os termos que não têm outro sentido (advogado, juizado).
 */
export const ACAO_JUDICIAL =
  /\b(abrir|abro|abrirei|entrar com|entro com|entrarei com|mover|movendo)\s+(um |uma )?(processo|a[çc][ãa]o)\b|\bprocesso (judicial|contra)\b|\b(vou|irei|vamos) processar\b|\bprocess(ar|arei|ando) (voc[êe]s|vcs|a empresa|o card[áa]pio)|\badvogad[oa]\b|\bjudicial(mente)?\b|\bna justi[çc]a\b|\bpequenas causas\b|\bjuizado\b/i;

const MENCOES_DE_RISCO: { padrao: RegExp; motivo: string }[] = [
  { padrao: ORGAO_DO_CONSUMIDOR, motivo: "menciona órgão de defesa do consumidor" },
  { padrao: ACAO_JUDICIAL, motivo: "menciona ação judicial" },
  { padrao: /\bimprensa\b|\bjornal\b|\breportagem\b|\bjornalista\b|\bmat[ée]ria\b(?!-prima)/i, motivo: "menciona imprensa" },
];

export interface SinalDeCrise {
  motivo: string;
}

/**
 * Os gatilhos do documento para acionar a liderança na hora.
 *
 * "Crescimento atípico de engajamento negativo, repercussão em perfis de
 * grande alcance, contato de imprensa, menção a ação judicial ou órgão
 * de defesa do consumidor, ou reclamações simultâneas sobre a mesma
 * falha." Engajamento a plataforma não mede; os outros quatro, sim.
 */
export function sinaisDeCrise(
  item: Pick<Case, "id" | "followers" | "title" | "description" | "category" | "createdAt" | "recebidaEm">,
  outros: Pick<Case, "id" | "category" | "createdAt" | "recebidaEm">[],
  agora = new Date()
): SinalDeCrise[] {

  const sinais: SinalDeCrise[] = [];

  if ((item.followers ?? 0) >= SEGUIDORES_DE_ALCANCE) {
    sinais.push({ motivo: `perfil com ${(item.followers ?? 0).toLocaleString("pt-BR")} seguidores` });
  }

  const texto = `${item.title} ${item.description ?? ""}`;
  for (const m of MENCOES_DE_RISCO) {
    if (m.padrao.test(texto)) sinais.push({ motivo: m.motivo });
  }

  /*
    "Reclamações simultâneas sobre a mesma falha": três ou mais da mesma
    categoria (contando esta) nas últimas 48 horas, em qualquer frente.
  */
  if (item.category && !/^n[ãa]o classificad/i.test(item.category)) {
    const limite = agora.getTime() - 48 * 3_600_000;
    const quando = (c: Pick<Case, "createdAt" | "recebidaEm">) => Date.parse(c.recebidaEm ?? `${c.createdAt}T12:00:00Z`);
    const juntas = outros.filter((c) => c.id !== item.id && c.category === item.category && quando(c) >= limite).length + 1;
    if (juntas >= 3) sinais.push({ motivo: `${juntas} casos de "${item.category}" nas últimas 48h` });
  }

  return sinais;
}
