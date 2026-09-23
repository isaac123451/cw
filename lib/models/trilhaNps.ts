import {
  isEncerrado,
  moodOf,
  rotuloDeEtapa,
  segmentOf,
  STATUS_AGUARDANDO,
  STATUS_SEM_TRATATIVA,
  tentativasMinimas,
  tipoPorNome,
  TIPOS_PADRAO,
  type NpsKindOption,
  type NpsResponseView,
} from "@/lib/models/nps";
import type { EstadoDoPasso } from "@/lib/models/trilha";
import {
  deveEncerrarSemRetorno,
  slaState,
  tentativaAguardando,
  tentativasNaJanela,
} from "@/lib/services/nps.service";
import { podeMarcarSemRetorno, quandoLiberaSemRetorno } from "@/lib/models/tratativa";
import {
  descreverMinutosUteis,
  descreverPrazo,
  descreverRegistro,
  EXPEDIENTE_PADRAO,
  minutosUteisEntre,
  type Expediente,
} from "@/lib/services/horasUteis";

/**
 * A trilha do NPS, na ordem do guia de encerramento do ciclo.
 *
 * O Isaac, com o print da ficha antiga: "a de reclame aqui e redes
 * sociais é tão bonita e intuitiva, aqui se torna difícil". A ficha era
 * um modal comprido com tudo aberto ao mesmo tempo — contato, humor,
 * checklist, finais —, e quem abria tinha de descobrir sozinho o que
 * faltava. Aqui, como no Reclame Aqui, cada passo do guia é um botão e
 * o passo da vez vem com a ação na frente.
 *
 * Os passos saem do checklist do guia: segmento identificado; feedback
 * classificado, com a causa raiz quando o tipo pede; cliente contatado
 * no prazo do segmento; retorno registrado; confirmação do cliente
 * (quando o tipo pede); status final aplicado. As ações do promotor
 * entram como passo opcional de quem deu 9 ou 10.
 *
 * **Sem comentário, o contato vem antes da classificação.** O Isaac: "na
 * maioria dos casos não tem comentário e preciso primeiro fazer o
 * contato". Classificar uma nota 3 sem texto é chutar; é na conversa que
 * o motivo aparece. Nesses casos o passo de classificar vai para depois
 * do retorno registrado (126 das 188 respostas abertas em 23/09).
 *
 * **Cada passo se marca pelo que o banco sabe** — nada aqui é clique de
 * "feito": a primeira tentativa é o 1º contato, o pós-contato é o
 * retorno, a confirmação tem data.
 */

export type AcaoDoNps =
  | "classificar"
  | "contato"
  | "tentativa"
  | "retorno"
  | "confirmacao"
  | "promotor"
  | "encerrar";

export interface PassoDoNps {
  id: "segmento" | "classificar" | "contato" | "retorno" | "confirmacao" | "promotor" | "encerrar";
  numero: number;
  fase: "Diagnóstico" | "Contato" | "Validação" | "Encerramento";
  titulo: string;
  /** Curto, para o cartão: "Próximo: classificar". */
  curto: string;
  estado: EstadoDoPasso;
  detalhe?: string;
  /** Quando foi feito, se foi. */
  quando?: string;
  acao?: AcaoDoNps;
  /** Pede atenção agora: prazo estourado, critério de sem retorno atingido. */
  alerta?: boolean;
}

type Rascunho = Omit<PassoDoNps, "estado" | "numero"> & {
  feito: boolean;
  opcional?: boolean;
};

/** O que fazer no retorno, pelo tipo — o "o que fazer" de cada tipo do guia. */
const RETORNO_DO_TIPO: Record<string, string> = {
  Reclamação: "Registre a solução ou os próximos passos combinados e como o cliente ficou.",
  Sugestão: "Registre a sugestão, vincule ao cliente e envie o link de acompanhamento.",
  Elogio: "Agradeça em até 72h úteis e registre como foi.",
  "Erro no Sistema": "Encaminhe ao time técnico (detrator é urgente), mantenha o cliente informado e registre o retorno.",
  "Erro Processual": "Identifique o processo que falhou, avise o time responsável e registre como ficou com o cliente.",
};

export interface ContextoDaTrilhaNps {
  tipos?: NpsKindOption[];
  agora?: Date;
  expediente?: Expediente;
}

export function trilhaDoNps(item: NpsResponseView, contexto: ContextoDaTrilhaNps = {}): PassoDoNps[] {

  const tipos = contexto.tipos ?? TIPOS_PADRAO;
  const agora = contexto.agora ?? new Date();
  const expediente = contexto.expediente ?? EXPEDIENTE_PADRAO;

  const segmento = segmentOf(item.score);
  const regra = tipoPorNome(tipos, item.kind);
  const encerrado = isEncerrado(item.status);
  const calado = item.status === STATUS_SEM_TRATATIVA;
  const engano = item.kind === "Engano";
  const faltaDeRetorno = item.kind === "Falta de Retorno";
  const promotor = segmento.label === "Promotor";

  const prazoHoras = regra?.ownDeadlineHours ?? segmento.slaHoursUteis;
  const abandono = deveEncerrarSemRetorno(item, agora);
  const naJanela = tentativasNaJanela(item, agora).length;
  const minimas = tentativasMinimas(item.kind);

  const passos: Rascunho[] = [];

  /* Sem comentário e sem tipo: não há o que classificar antes de falar com o cliente. */
  const classificarDepois = !item.comment.trim() && !item.kind;
  const aguardando = tentativaAguardando(item);

  /* 1. Segmento — sai da nota; o guia pede que esteja identificado. */
  passos.push({
    id: "segmento",
    fase: "Diagnóstico",
    titulo: "Segmento identificado",
    curto: "segmento",
    feito: true,
    detalhe: `${segmento.label}, nota ${item.score}: 1º contato em até ${descreverPrazo(prazoHoras)}.`,
  });

  /* 2. Classificar — o tipo, e a causa raiz quando o tipo pede. */
  const precisaCausa = Boolean(regra?.requiresRootCause);
  passos.push({
    id: "classificar",
    fase: "Diagnóstico",
    titulo: precisaCausa || !item.kind ? "Classificar tipo e causa" : "Classificar o tipo",
    curto: "classificar",
    feito: Boolean(item.kind) && (!precisaCausa || Boolean(item.rootCause)),
    opcional: calado,
    acao: "classificar",
    detalhe: !item.kind
      ? classificarDepois
        ? "Sem comentário na pesquisa: classifique depois de falar com o cliente — é na conversa que o motivo aparece."
        : "Reclamação, sugestão, elogio, engano, erro no sistema, erro processual ou falta de retorno."
      : precisaCausa && !item.rootCause
        ? `${item.kind} pede a causa raiz — é ela que mostra a tendência.`
        : `${regra?.emoji ? `${regra.emoji} ` : ""}${item.kind}${item.rootCause ? ` · ${item.rootCause}` : ""}`,
  });

  /* 3. 1º contato — a primeira tentativa já conta; o prazo é do segmento (ou do tipo). */
  const sla = slaState(item, agora);
  const devido = new Date(item.firstContactDueAt);
  let detalheContato: string;
  let alertaContato = false;

  if (item.firstContactAt) {
    const noPrazo = Date.parse(item.firstContactAt) <= devido.getTime();
    detalheContato = `Em ${descreverRegistro(item.firstContactAt)} — ${noPrazo ? "no prazo" : "fora do prazo"}.`;
  } else if (sla === "estourado") {
    alertaContato = true;
    detalheContato = `Fora do prazo há ${descreverMinutosUteis(minutosUteisEntre(devido, agora, expediente), expediente)} (vencia ${descreverRegistro(item.firstContactDueAt)}).`;
  } else {
    detalheContato = `${venceEm(agora, devido, expediente)}.`;
  }

  passos.push({
    id: "contato",
    fase: "Contato",
    titulo: faltaDeRetorno ? "Tentativas de contato" : "1º contato no prazo",
    curto: faltaDeRetorno ? "tentar contato" : "1º contato",
    feito: Boolean(item.firstContactAt),
    opcional: engano || calado,
    acao: faltaDeRetorno ? "tentativa" : "contato",
    alerta: alertaContato && !encerrado,
    quando: item.firstContactAt,
    detalhe: detalheContato,
  });

  /* 4. Retorno — o que foi feito e como o cliente ficou (a régua de humor). */
  const humor = moodOf(item.moodAfter);
  passos.push({
    id: "retorno",
    fase: "Contato",
    titulo: "Retorno registrado",
    curto: "registrar o retorno",
    feito: Boolean(item.postContactAt),
    opcional: engano || faltaDeRetorno || calado,
    acao: "retorno",
    quando: item.postContactAt,
    detalhe: item.postContactAt
      ? [
          humor ? `${humor.emoji} ${humor.label}` : null,
          item.resolvedAfter === true ? "resolveu" : item.resolvedAfter === false ? "não resolveu" : null,
          item.postContactNote ? `"${item.postContactNote}"` : null,
        ]
          .filter(Boolean)
          .join(" · ") || `Registrado em ${descreverRegistro(item.postContactAt)}.`
      : aguardando
        ? podeMarcarSemRetorno(aguardando.createdAt, agora)
          ? `A tentativa por ${aguardando.channel} passou de 2 horas sem resposta: marque sem retorno em Contatos, ou registre a conversa se o cliente respondeu.`
          : `Tentativa por ${aguardando.channel} aguardando retorno — sem retorno só a partir das ${quandoLiberaSemRetorno(aguardando.createdAt, agora)}.`
        : (item.kind && RETORNO_DO_TIPO[item.kind]) || regra?.action || "Registre a solução ou o retorno dado ao cliente.",
  });

  /* Sem comentário: classificar vem logo depois da conversa, na fase do contato. */
  if (classificarDepois) {
    const i = passos.findIndex((p) => p.id === "classificar");
    const [classificar] = passos.splice(i, 1);
    passos.push({ ...classificar, fase: "Contato", titulo: "Classificar depois da conversa" });
  }

  /* 5. Confirmação — só quando o tipo pede ("isso resolveu sua questão?"). */
  if (regra?.requiresConfirmation) {
    passos.push({
      id: "confirmacao",
      fase: "Validação",
      titulo: "Cliente confirmou",
      curto: "confirmar com o cliente",
      feito: Boolean(item.confirmedAt),
      acao: "confirmacao",
      quando: item.confirmedAt,
      detalhe: item.confirmedAt
        ? `Em ${descreverRegistro(item.confirmedAt)}.`
        : item.status === STATUS_AGUARDANDO
          ? "Pergunta enviada — aguardando a resposta do cliente."
          : "Pergunte \"isso resolveu sua questão?\". Sem a confirmação, o ciclo não encerra como resolvido.",
    });
  }

  /* 6. Ações do promotor — review no Google, case, indicação. */
  if (promotor && !engano) {
    const pedidas = [item.reviewAsked, item.testimonialAsked, item.referralAsked].filter(Boolean).length;
    const resultados = [
      item.reviewFeita ? "review publicada" : null,
      item.aceitaCase ? "aceita ser case" : null,
      item.indicacoes ? `${item.indicacoes} indicação(ões)` : null,
    ].filter(Boolean);
    passos.push({
      id: "promotor",
      fase: "Validação",
      titulo: "Review, case e indicação",
      curto: "ações do promotor",
      feito: pedidas === 3,
      opcional: true,
      acao: "promotor",
      detalhe: resultados.length
        ? resultados.join(" · ")
        : pedidas
          ? `${pedidas} de 3 pedidos feitos.`
          : "Enquanto o sentimento está positivo: review no Google, depoimento e indicação.",
    });
  }

  /* 7. Status final — os finais que o tipo aceita. */
  let detalheFinal: string;
  if (encerrado) {
    detalheFinal = calado
      ? "Promotor sem comentário: entra na conta do NPS, sem ciclo."
      : `${rotuloDeEtapa(item.status)}${item.closedAt ? ` em ${descreverRegistro(item.closedAt)}` : ""}.`;
  } else if (abandono.deve) {
    detalheFinal = `Critério de falta de retorno atingido: ${abandono.motivo}`;
  } else if (faltaDeRetorno) {
    detalheFinal = `Faltam ${Math.max(0, minimas - naJanela)} tentativa(s) em 7 dias para encerrar sem retorno.`;
  } else {
    detalheFinal = "Aplique o status final que o tipo aceita.";
  }

  passos.push({
    id: "encerrar",
    fase: "Encerramento",
    titulo: "Status final aplicado",
    curto: "encerrar",
    feito: encerrado,
    acao: faltaDeRetorno && !abandono.deve && !encerrado ? "tentativa" : "encerrar",
    alerta: abandono.deve && !encerrado,
    quando: item.closedAt,
    detalhe: detalheFinal,
  });

  /*
    O passo da vez: o primeiro obrigatório por fazer. Com o critério de
    sem retorno atingido, é o encerramento — o guia manda fechar, e o
    resto da trilha não vai andar sem o cliente.
  */
  const atualId = encerrado
    ? undefined
    : abandono.deve
      ? "encerrar"
      : passos.find((p) => !p.feito && !p.opcional)?.id;

  return passos.map(({ feito, opcional, ...p }, i) => ({
    ...p,
    numero: i + 1,
    estado: feito ? "feito" : p.id === atualId ? "atual" : opcional ? "opcional" : "pendente",
  }));
}

/**
 * "Vence em 2h40 (14/09 18:00)" — ou só a data, quando não há tempo útil
 * até lá: no domingo, um prazo de segunda às 8h tem zero minuto útil
 * pela frente, e "vence em 0min" parecia prazo estourado.
 */
export function venceEm(agora: Date, prazo: Date, expediente: Expediente = EXPEDIENTE_PADRAO) {
  const minutos = minutosUteisEntre(agora, prazo, expediente);
  const quando = descreverRegistro(prazo.toISOString());
  return minutos > 0 ? `Vence em ${descreverMinutosUteis(minutos, expediente)} (${quando})` : `Vence ${quando}`;
}

/** O passo da vez, para o cartão e a lista: "Próximo: classificar". */
export function proximoDoNps(item: NpsResponseView, contexto: ContextoDaTrilhaNps = {}) {
  return trilhaDoNps(item, contexto).find((p) => p.estado === "atual");
}

/** A pergunta de reengajamento do guia, pronta para o canal privado. */
export function mensagemDeReengajamento(item: Pick<NpsResponseView, "customerName">) {
  const nome = item.customerName?.trim().split(/\s+/)[0];
  return `Oi${nome ? `, ${nome}` : ""}! Tudo bem? Passando para saber: o que combinamos resolveu a sua questão? Se ainda faltar alguma coisa, é só me responder por aqui que eu sigo com você.`;
}
