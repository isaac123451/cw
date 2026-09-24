import { CRITERIOS_NO_TEXTO, normalizarTexto } from "@/lib/models/sugestaoPorTexto";
import { instanteDe, paredeDe } from "@/lib/services/horasUteis";

/**
 * O que fazer agora na conversa (Fase 28).
 *
 * "O que é melhor fazer no momento: só escutar, enviar áudio, um
 * momento no Meet." A leitura é a de quem atende há anos: o cliente que
 * mandou cinco mensagens seguidas quer ser ouvido, não corrigido; o que
 * aponta um erro nosso quer que alguém assuma; a explicação que já foi
 * e voltou duas vezes cabe melhor num áudio de um minuto ou em quinze
 * minutos de tela compartilhada; e a ameaça de Procon não é mais uma
 * conversa do atendimento.
 *
 * Sem IA: regras sobre o que a conversa mostra, sempre com o porquê e um
 * roteiro curto — é sugestão para quem decide, nunca uma ordem.
 */

export type AcaoDoMomento = "escalar" | "escutar" | "assumir" | "esperar-area" | "meet" | "audio" | "responder";

export interface MensagemDoMomento {
  de: "cliente" | "nos";
  texto: string;
  /** "10:32, 14/09/2026" — o carimbo do WhatsApp, quando há. */
  carimbo?: string;
}

export interface EntradaDoMomento {
  mensagens: MensagemDoMomento[];
  /** 1 irritado … 5 encantado — a régua do NPS, do motor próprio. */
  humor: 1 | 2 | 3 | 4 | 5;
  agora: Date;
  /** O que a base sabe: reclamações e casos abertos do contato, e a área que está com o caso. */
  historico?: { casosAbertos?: number; reclamacoes?: number; areaAcionada?: string; areaVenceEm?: string };
}

export interface Momento {
  acao: AcaoDoMomento;
  titulo: string;
  porque: string[];
  roteiro: string[];
  /** Fora do horário: responda curto e marque o retorno. */
  foraDoHorario?: boolean;
}

const TITULOS: Record<AcaoDoMomento, string> = {
  escalar: "Escalar para a liderança",
  escutar: "Só escutar e acolher",
  assumir: "Assumir o erro",
  "esperar-area": "Esperar a área — e dizer quando volta",
  meet: "Propor 15 minutos no Meet",
  audio: "Mandar um áudio curto",
  responder: "Responder com o próximo passo",
};

/** Mensagens seguidas do cliente, no fim, sem resposta nossa no meio. */
export function rajadaDoCliente(mensagens: MensagemDoMomento[]) {
  let n = 0;
  for (let i = mensagens.length - 1; i >= 0 && mensagens[i].de === "cliente"; i--) n += 1;
  return n;
}

/** "10:32, 14/09/2026" → instante, no fuso de Brasília (UTC−3). */
export function instanteDoCarimbo(carimbo?: string): Date | null {
  const m = carimbo?.match(/(\d{1,2}):(\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, h, min, d, mes, a] = m.map(Number);
  const dia = `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const t = instanteDe(dia, h * 60 + min);
  return Number.isFinite(t.getTime()) ? t : null;
}

const ERRO_NOSSO =
  /voces (errar|erraram|cobraram errado|nao cumpriram|prometeram)|cobrad[oa]s? (errado|a mais|duas vezes|indevid)|prometeram e nao|nao cumpriram|falha de voces|erro de voces|culpa de voces|o erro foi (de )?voces|me enganaram|ninguem (me )?avisou|sumiram (os|com)|apagaram|perdi (vendas|pedidos|dinheiro) por causa/;

const NAO_ENTENDEU = /nao entendi|nao entendo|nao consegui (fazer|achar|entender)|como assim|continuo sem entender|ainda nao (consegui|entendi)|onde fica|qual (botao|tela|menu)|passo a passo/;

const ASSUNTO_DE_TELA = /configur|integrac|impressora|implantac|treinamento|cardapio|cadastr|taxa de entrega|cupom|relatorio|fiscal|nfc|certificado/;

const PERGUNTA_DE_STATUS = /(alguma )?novidade|e ai\b|e agora|tem previsao|previsao|quando (vai|vao|fica)|ja (resolveram|resolveu|tem retorno)|retorno\?|e o meu caso|ate quando/;

/** Fora do expediente de Brasília: antes das 8h, depois das 18h e no fim de semana. */
export function foraDoExpediente(agora: Date) {
  const { dia, min } = paredeDe(agora);
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return semana === 0 || semana === 6 || min < 8 * 60 || min >= 18 * 60;
}

export function oQueFazerAgora(e: EntradaDoMomento): Momento | null {
  const doCliente = e.mensagens.filter((m) => m.de === "cliente");
  if (doCliente.length === 0) return null;

  const recentes = doCliente.slice(-5).map((m) => normalizarTexto(m.texto)).join("\n");
  const tudoDoCliente = doCliente.map((m) => normalizarTexto(m.texto)).join("\n");
  const rajada = rajadaDoCliente(e.mensagens);
  const nossas = e.mensagens.filter((m) => m.de === "nos");
  const longasNossas = nossas.slice(-3).filter((m) => m.texto.length > 450).length;
  const fora = foraDoExpediente(e.agora);
  const h = e.historico ?? {};
  const porque: string[] = [];
  const nome = (acao: AcaoDoMomento, roteiro: string[]): Momento => ({ acao, titulo: TITULOS[acao], porque, roteiro, ...(fora ? { foraDoHorario: true } : {}) });

  /* 1. Ameaça jurídica ou de exposição, ou o cliente no limite e reincidente: não é mais conversa do atendimento. */
  const juridico = CRITERIOS_NO_TEXTO.filter((c) => c.criterio === "juridico" || c.criterio === "exposicao").find((c) => c.padrao.test(recentes));
  const reincidente = (h.reclamacoes ?? 0) >= 2 || (h.casosAbertos ?? 0) >= 2;
  if (juridico || (e.humor === 1 && reincidente)) {
    if (juridico) porque.push(`o cliente ${juridico.motivo}`);
    if (e.humor === 1) porque.push("o humor está no limite");
    if (reincidente) porque.push(`${Math.max(h.reclamacoes ?? 0, h.casosAbertos ?? 0)} reclamações ou casos abertos deste contato`);
    return nome("escalar", [
      "Não discuta o mérito agora; diga que o caso subiu para a liderança.",
      "Dê um prazo de retorno que você consegue cumprir (hoje, com hora).",
      "Registre a ameaça no caso e avise a liderança antes de responder de novo.",
    ]);
  }

  /* 2. Desabafo: várias mensagens seguidas e irritado — responder com solução agora parece não ter lido. */
  if (rajada >= 3 && e.humor <= 2) {
    porque.push(`${rajada} mensagens seguidas do cliente sem resposta`, "o humor está baixo");
    return nome("escutar", [
      "Uma mensagem curta: você leu tudo e entende a frustração — com as palavras dele.",
      "Não explique nem justifique ainda; pergunte o que é mais urgente para ele agora.",
      "Só depois da resposta dele, o próximo passo.",
    ]);
  }

  /* 3. O cliente aponta um erro nosso. */
  if (ERRO_NOSSO.test(recentes) && e.humor <= 3) {
    porque.push("o cliente aponta um erro nosso", ...(e.humor <= 2 ? ["o humor está baixo"] : []));
    return nome("assumir", [
      "Reconheça o erro sem \"infelizmente\" e sem culpar sistema ou outra área.",
      "Diga o que já está sendo feito para corrigir, com quem e até quando.",
      "Se houve prejuízo, pergunte qual foi — é o que decide a reparação.",
    ]);
  }

  /* 4. O caso está com uma área e o cliente pergunta do andamento. */
  if (h.areaAcionada && PERGUNTA_DE_STATUS.test(recentes)) {
    porque.push(`o caso está com ${h.areaAcionada}`, "o cliente pergunta do andamento");
    return nome("esperar-area", [
      `Diga que o caso está com ${h.areaAcionada} e o que já foi feito.`,
      h.areaVenceEm ? `Dê a data do retorno: ${h.areaVenceEm}.` : "Dê a data em que você volta com notícia, mesmo sem solução.",
      "Cobre a área agora, antes de o cliente perguntar de novo.",
    ]);
  }

  /* 5. A explicação foi e voltou: tela compartilhada resolve mais rápido. */
  const idasEVoltas = e.mensagens.length >= 16 && NAO_ENTENDEU.test(tudoDoCliente);
  if ((idasEVoltas || (e.mensagens.length >= 24 && ASSUNTO_DE_TELA.test(tudoDoCliente))) && e.humor <= 3) {
    porque.push(`${e.mensagens.length} mensagens na conversa`, ...(NAO_ENTENDEU.test(tudoDoCliente) ? ["o cliente diz que não entendeu"] : []), ...(ASSUNTO_DE_TELA.test(tudoDoCliente) ? ["é assunto de tela e configuração"] : []));
    return nome("meet", [
      "Proponha 15 minutos com tela compartilhada, com dois horários para ele escolher.",
      "Mande o link já com o horário; peça que esteja no computador da loja.",
      "No fim da chamada, resuma por escrito o que foi feito.",
    ]);
  }

  /* 6. Texto longo que não pegou, ou o cliente não entendeu: um áudio curto. */
  if (NAO_ENTENDEU.test(recentes) || longasNossas >= 2) {
    porque.push(...(NAO_ENTENDEU.test(recentes) ? ["o cliente diz que não entendeu"] : []), ...(longasNossas >= 2 ? ["as nossas últimas mensagens são textos longos"] : []));
    return nome("audio", [
      "Um áudio de até um minuto, com o nome dele e uma coisa por vez.",
      "Diga o passo a passo devagar, como se estivesse ao lado dele.",
      "Termine perguntando se ficou claro, e mande o resumo em texto logo depois.",
    ]);
  }

  porque.push(e.humor >= 4 ? "o cliente está bem" : "nenhum sinal pede outra abordagem");
  return nome("responder", [
    "Responda o que ele perguntou, com o nome dele e o que você vai fazer.",
    "Se depende de algo dele, peça uma coisa só e diga para quê.",
    "Combine quando volta com notícia.",
  ]);
}

/** A linha que o painel mostra quando está fora do expediente. */
export const AVISO_FORA_DO_HORARIO = "Fora do expediente: responda curto agora, diga quando volta e marque o retorno na agenda.";
