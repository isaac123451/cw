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

export type TipoDeAcao = "lembrete" | "anotacao" | "feito" | "aviso";
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
  aviso: "Aviso",
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
export function ehParaMim(m: MensagemDoSlack, meuNome: string): boolean {
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
  reuniao: (eventoId: string) => `agenda:depois:${eventoId}`,
};
