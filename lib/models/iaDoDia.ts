import { semDadoSensivel } from "@/lib/models/aprendizados";
import { pedidoNaMensagem, reuniaoNaMensagem } from "@/lib/models/lembretesAutomaticos";

/**
 * A IA do dia (08/10/2026).
 *
 * **O pedido.** "Preciso deixar tudo o mais automatizado … que ela esteja
 * de uma forma muito potente no auxílio do dia a dia: ela marca lembrete,
 * faz anotações, finaliza atividades que consegue identificar que eu fiz,
 * me lembra de coisas importantes, seja do Slack ou sei lá." E a decisão:
 * **age sozinha e avisa, com desfazer** — nada vai para fora (cliente,
 * Slack) sem a pessoa; o que fica dentro da plataforma, ela faz.
 *
 * Este arquivo é a parte que decide, sem banco — para poder ser provada
 * (`check:ia-do-dia`). Quem grava é `lib/services/iaDoDia.service.ts`.
 */

export type TipoDeAcao = "lembrete" | "anotacao" | "feito" | "completou" | "etapa" | "aviso";
export type OrigemDaAcao = "slack" | "whatsapp" | "caso" | "nps" | "agenda" | "area" | "pedido";

export interface AcaoDaIAView {
  id: string;
  tipo: TipoDeAcao;
  origem: OrigemDaAcao;
  titulo: string;
  detalhe?: string;
  href?: string;
  /** ISO. */
  criadaEm: string;
  desfeita: boolean;
  /** Dá para desfazer (aviso não tem o que desfazer). */
  desfazivel: boolean;
}

export const ROTULO_DA_ACAO: Record<TipoDeAcao, string> = {
  lembrete: "Lembrete criado",
  anotacao: "Anotação feita",
  feito: "Marcado como feito",
  completou: "Ficha completada",
  etapa: "Etapa registrada",
  aviso: "Aviso",
};

/** Na voz do assistente — "O que eu fiz hoje" (09/10/2026). */
export const VERBO_DA_ACAO: Record<TipoDeAcao, string> = {
  lembrete: "Lembrei",
  anotacao: "Anotei",
  feito: "Fechei",
  completou: "Completei",
  etapa: "Registrei",
  aviso: "Avisei",
};

export const ROTULO_DA_ORIGEM: Record<OrigemDaAcao, string> = {
  slack: "Slack",
  whatsapp: "WhatsApp",
  caso: "caso",
  nps: "NPS",
  agenda: "Google Agenda",
  area: "área interna",
  pedido: "seu pedido",
};

const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const trecho = (t: string, n = 90) => {
  const limpo = t.replace(/\s+/g, " ").trim();
  return limpo.length > n ? `${limpo.slice(0, n - 1).trimEnd()}…` : limpo;
};

/* ============================================================
   SLACK — o que pede ação de quem foi mencionado
============================================================ */

/**
 * Pedido sem dia nem hora também é pedido: "consegue ver isso?", "preciso
 * do relatório", "urgente". É o que se esquece no Slack — a mensagem
 * passa, o canal anda, e ninguém volta nela.
 */
const PEDE_ACAO =
  /\b(?:consegue|consegues|conseguiria|pode(?:ria)?|poderia|preciso|precisamos|precisa|urgente|prioridade|prazo|ate hoje|ate amanha|ate o fim do dia|lembra de|nao esquece|me avisa|me fala|me retorna|da uma olhada|olha isso|verifica|confere|me ajuda)\b/;

export interface MensagemDoSlack {
  canal: string;
  ts: string;
  texto: string;
  /** Quem escreveu, como o Slack mostra. */
  autor?: string;
  /** Os nomes mencionados (@Fulano). */
  mencoes?: string[];
  /** ISO. */
  quando: string;
  /** O endereço da mensagem no Slack, quando a extensão tem. */
  link?: string;
}

/** A mensagem é para a pessoa: conversa direta (canal D…) ou menção ao nome dela. */
/**
 * A mensagem é minha — escrita por quem recebe os lembretes (21/10/2026).
 * Na conversa direta toda mensagem passava como "para mim", inclusive as
 * minhas: nasceu "Responder no Slack — Carlos Isaac: como tá o programa de
 * influenciadores?" para o próprio Carlos Isaac.
 */
export function ehMinha(m: MensagemDoSlack, meuNome: string): boolean {
  const autor = sem(m.autor ?? "").trim();
  const eu = sem(meuNome).trim();
  if (!autor || !eu) return false;
  if (autor === eu) return true;
  const [a1, a2] = autor.split(/\s+/);
  const [e1, e2] = eu.split(/\s+/);
  return Boolean(a1 && a2 && a1 === e1 && a2 === e2);
}

export function ehParaMim(m: MensagemDoSlack, meuNome: string): boolean {
  if (ehMinha(m, meuNome)) return false;
  if (/^D[A-Z0-9]{6,}$/.test(m.canal)) return true;
  const primeiro = sem(meuNome).split(/\s+/)[0] ?? "";
  if (primeiro.length < 3) return false;
  const nomes = (m.mencoes ?? []).map((x) => sem(x).replace(/^@/, ""));
  if (nomes.some((n) => n === sem(meuNome) || n.split(/\s+/)[0] === primeiro)) return true;
  return new RegExp(`@${primeiro}\\b`).test(sem(m.texto));
}

export interface LembreteDoSlack {
  titulo: string;
  /** AAAA-MM-DD. */
  dia: string;
  /** HH:MM, quando a mensagem diz. */
  hora?: string;
}

/**
 * O lembrete que uma mensagem do Slack pede — ou `null` quando ela não
 * pede nada (bom dia, "ok", aviso geral).
 *
 * Dia e hora vêm do texto ("até sexta", "amanhã às 10h"); sem eles, é
 * para hoje. A regra é a mesma do WhatsApp (`lembretesAutomaticos`).
 */
export function lembreteDoSlack(m: MensagemDoSlack, hoje: string): LembreteDoSlack | null {
  const texto = m.texto.trim();
  if (texto.length < 8) return null;
  const quem = m.autor ? `${m.autor}: ` : "";
  const reuniao = reuniaoNaMensagem(texto, hoje);
  if (reuniao && reuniao.dueDate >= hoje) {
    return { titulo: `Reunião pelo Slack — ${quem}“${trecho(reuniao.trecho, 80)}”`, dia: reuniao.dueDate, hora: reuniao.time };
  }
  const pedido = pedidoNaMensagem(texto, hoje);
  if (pedido && pedido.dueDate >= hoje) {
    return { titulo: `Responder no Slack — ${quem}“${trecho(pedido.trecho, 80)}”`, dia: pedido.dueDate, hora: pedido.time };
  }
  const t = sem(texto);
  /* Agradecimento sem pergunta não pede nada: "valeu, obrigado pela ajuda". */
  if (/(?:obrigad|valeu|agradec)/.test(t) && !texto.includes("?")) return null;
  if (PEDE_ACAO.test(t) || /\?\s*$/.test(texto)) {
    return { titulo: `Responder no Slack — ${quem}“${trecho(texto, 80)}”`, dia: hoje };
  }
  return null;
}

/* ============================================================
   O QUE JÁ FOI FEITO — fechar a atividade sozinha
============================================================ */

export interface TarefaAberta {
  id: string;
  title: string;
  type: string;
  /** AAAA-MM-DD. */
  dueDate: string;
  /** ISO. */
  createdAt: string;
  caseId?: string | null;
}

export interface SinaisDeFeito {
  /** A conversa ligada ao lembrete "auto-conversa/auto-pedido": quando foi a nossa última mensagem (ISO). */
  nossaMensagemEm?: string | null;
  /** A conversa do lembrete "auto-espera": quando foi a última mensagem do cliente (ISO). */
  clienteMensagemEm?: string | null;
  /** O lembrete "auto-area": a área já respondeu. */
  areaRespondeu?: boolean;
  /** O caso ligado: o último contato registrado (ISO) e se está encerrado. */
  ultimoContatoEm?: string | null;
  casoEncerrado?: boolean;
}

/**
 * A atividade já foi feita? E por quê, numa frase para o aviso.
 *
 * Conservador de propósito: só fecha com um fato registrado depois que a
 * atividade nasceu. Na dúvida, fica aberta — fechar o que não foi feito é
 * pior do que deixar aberto o que foi.
 */
export function tarefaFeita(t: TarefaAberta, s: SinaisDeFeito): string | null {
  const dia = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

  if (t.id.startsWith("auto-area-") && s.areaRespondeu) return "a área já retornou";

  /* Retorno combinado e pedido do cliente: a nossa mensagem na conversa, a partir do dia combinado. */
  if ((t.id.startsWith("auto-conversa-") || t.id.startsWith("auto-pedido-")) && s.nossaMensagemEm) {
    if (s.nossaMensagemEm >= t.createdAt && dia(s.nossaMensagemEm) >= t.dueDate) return "você respondeu na conversa";
  }

  /* O combinado sem data (09/10/2026): a nossa mensagem depois do lembrete cumpre a promessa; a do cliente, a espera. */
  if (t.id.startsWith("auto-promessa-") && s.nossaMensagemEm && s.nossaMensagemEm >= t.createdAt) return "você respondeu na conversa";
  if (t.id.startsWith("auto-espera-") && s.clienteMensagemEm && s.clienteMensagemEm >= t.createdAt) return "o cliente mandou mensagem";

  if (t.caseId) {
    if (s.casoEncerrado) return "o caso foi encerrado";
    if (s.ultimoContatoEm && s.ultimoContatoEm >= t.createdAt && /follow|retorno|liga|contato|cobran/i.test(`${t.type} ${t.title}`)) {
      return "você registrou contato no caso";
    }
  }

  return null;
}

/* ============================================================
   CHAVES — a mesma origem nunca vira duas ações
============================================================ */

export const chaveDaAcao = {
  slack: (canal: string, ts: string) => `slack:${canal}:${ts}`,
  feito: (tarefaId: string) => `feito:${tarefaId}`,
  lembrete: (tarefaId: string) => `lembrete:${tarefaId}`,
  anotacao: (conversaId: string, dia: string) => `anotacao:conversa:${conversaId}:${dia}`,
  /**
   * Uma anotação por caso (ou NPS) por dia (21/10/2026): duas conversas do
   * mesmo caso viravam duas anotações — Gabriel, Fernanda e Matheus tinham
   * duas e três no mesmo dia. A do dia é reescrita com o dia inteiro.
   */
  anotacaoDoAlvo: (alvo: string, dia: string) => `anotacao:${alvo}:${dia}`,
  /** A atividade de retenção que nasce do pedido de cancelamento lido na conversa. */
  retencao: (alvo: string, dia: string) => `retencao:${alvo}:${dia}`,
  reuniao: (eventoId: string) => `agenda:depois:${eventoId}`,
};

/* ============================================================
   A LEITURA DA CONVERSA DO DIA, CONFERIDA (09/10/2026)
============================================================ */

export interface LeituraDoDia {
  anotar: boolean;
  /** Por que não anotou — fica na linha invisível, para quem investigar. */
  motivo: string;
  segmento: "reclamacao" | "nps" | "outro";
  corpo: string;
  retorno: { quem: "nos" | "cliente"; oque: string; dia?: string } | null;
  /**
   * O que a conversa diz de cancelamento (21/10/2026): "pediu" vira
   * atividade de retenção no mesmo dia; "cancelou" e "ficou" vão para a
   * anotação, onde a Retenção lê.
   */
  cancelamento: "nao" | "pediu" | "cancelou" | "ficou";
  /** A conversa é mesmo com este cliente — sem isso, nada na ficha muda. */
  sobreEle: boolean;
  /**
   * O que a conversa de hoje muda na ficha (21/10/2026): "a IA precisa
   * atualizar as informações dos casos". Pedimos a avaliação hoje; o
   * cliente disse que resolveu (ou que não); a causa raiz, só do catálogo.
   */
  pedimosAvaliacao: boolean;
  solucao: "confirmou" | "nao-resolveu" | "nao";
  causa: string;
}

/** A resposta da IA, conferida: campo torto vira o lado conservador (não anotar, não lembrar). */
export function leituraDaResposta(d: Record<string, unknown>, segmentos: string[], hoje: string, causas: string[] = []): LeituraDoDia {
  const limpo = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
  const seg = limpo(d.segmento);
  const segmento = (segmentos.includes(seg) ? seg : "outro") as LeituraDoDia["segmento"];
  /*
    Documento, e-mail, telefone e cartão nunca vão para a ficha (21/10/2026):
    a IA é instruída, mas pôs "CNPJ 11.222.333/0001-81" e o e-mail nos pontos
    importantes. O código garante; o ponto que era só o dado sai inteiro.
  */
  const seguro = (v: unknown) => semDadoSensivel(limpo(v));
  const resumo = seguro(d.resumo);
  const pendente = seguro(d.pendente);
  const importantes = (Array.isArray(d.importantes) ? d.importantes : [])
    .map(seguro)
    .filter((x) => {
      if (x.length <= 3) return false;
      const marcado = /\[(documento|e-mail|telefone|número|código|link)\]/.test(x);
      /* O ponto que era só o dado ("CNPJ [documento]") sai; o que tem conteúdo além dele fica. */
      return !marcado || x.replace(/\[(documento|e-mail|telefone|número|código|link)\]/g, "").replace(/[^\p{L}]/gu, "").length > 12;
    })
    .slice(0, 6);
  const sobreEle = d.sobre_este_cliente === true;
  const vale = d.vale_anotar === true && resumo.length > 0;

  const ret = (d.retorno && typeof d.retorno === "object" ? d.retorno : {}) as Record<string, unknown>;
  const dia = limpo(ret.dia);
  const retorno =
    ret.precisa === true && limpo(ret.oque)
      ? {
          quem: (limpo(ret.quem) === "cliente" ? "cliente" : "nos") as "nos" | "cliente",
          oque: limpo(ret.oque).replace(/[.!]+$/, "").slice(0, 140),
          dia: /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= hoje ? dia : undefined,
        }
      : null;

  const motivo = !sobreEle
    ? `Parece misturar outro cliente: ${limpo(d.motivo) || "trecho de outra conversa"}`
    : segmento === "outro"
      ? `Não trata ${segmentos.length > 1 ? "da reclamação nem do NPS ligados" : segmentos[0] === "nps" ? "do NPS ligado" : "da reclamação ligada"} à conversa.`
      : !vale
        ? limpo(d.motivo) || "Nada novo para guardar."
        : "";

  const canc = limpo(d.cancelamento);
  const cancelamento = (["pediu", "cancelou", "ficou"].includes(canc) && sobreEle ? canc : "nao") as LeituraDoDia["cancelamento"];
  const linhaDoCancelamento =
    cancelamento === "pediu"
      ? "Cancelamento: o cliente pediu para cancelar."
      : cancelamento === "cancelou"
        ? "Cancelamento: o cancelamento foi feito."
        : cancelamento === "ficou"
          ? "Cancelamento: o cliente desistiu de cancelar e vai continuar."
          : null;

  const sol = limpo(d.solucao);
  /* Causa fora do catálogo não entra: a IA escolhe da lista, e o nome tem que bater (sem diferença de caixa). */
  const causa = causas.find((c) => c.toLowerCase() === limpo(d.causa).toLowerCase()) ?? "";
  const vinculado = sobreEle && segmento !== "outro";

  return {
    cancelamento,
    sobreEle,
    pedimosAvaliacao: vinculado && d.pedimos_avaliacao === true,
    solucao: (vinculado && ["confirmou", "nao-resolveu"].includes(sol) ? sol : "nao") as LeituraDoDia["solucao"],
    causa: vinculado ? causa : "",
    anotar: sobreEle && segmento !== "outro" && (vale || cancelamento !== "nao"),
    motivo,
    segmento,
    retorno: sobreEle && segmento !== "outro" ? retorno : null,
    corpo: [
      resumo,
      linhaDoCancelamento,
      pendente && !/^nada\.?$/i.test(pendente) ? `Ficou pendente: ${pendente}` : null,
      importantes.length ? `Pontos importantes:\n${importantes.map((x) => `• ${x}`).join("\n")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
