/**
 * O vocabulário da tratativa: os contatos com o cliente de um caso.
 *
 * Mora em `lib/models` porque a tela, a extensão e o servidor falam a
 * mesma língua — um "tentei, sem sucesso" que a extensão grava tem de ser
 * o mesmo que a tela conta na cadência de persistência.
 */

export type TipoDeContato =
  | "contato"
  | "tentativa"
  | "atualizacao"
  | "pedido-avaliacao"
  | "validacao";

export type ResultadoDoContato =
  | "respondeu"
  | "sem-resposta"
  | "nao-atendeu"
  | "caixa-postal"
  | "enviado";

export interface TipoDeContatoInfo {
  id: TipoDeContato;
  rotulo: string;
  /** Frase curta que explica quando usar. */
  quando: string;
  resultadoPadrao: ResultadoDoContato;
  /** Resultados que fazem sentido para este tipo. */
  resultados: ResultadoDoContato[];
}

export const TIPOS_DE_CONTATO: TipoDeContatoInfo[] = [
  {
    id: "contato",
    rotulo: "Falei com o cliente",
    quando: "Conversa de verdade — por mensagem ou por voz.",
    resultadoPadrao: "respondeu",
    resultados: ["respondeu"],
  },
  {
    id: "tentativa",
    rotulo: "Tentei, sem sucesso",
    quando: "Liguei ou mandei mensagem e não houve resposta.",
    resultadoPadrao: "nao-atendeu",
    resultados: ["nao-atendeu", "caixa-postal", "sem-resposta"],
  },
  {
    id: "atualizacao",
    rotulo: "Mandei uma atualização",
    quando: "Notícia ao cliente enquanto a solução anda — o documento pede para não deixá-lo no vácuo.",
    resultadoPadrao: "enviado",
    resultados: ["enviado", "respondeu"],
  },
  {
    id: "pedido-avaliacao",
    rotulo: "Pedi a avaliação",
    quando: "Lembrete para avaliar no Reclame Aqui, depois da solução.",
    resultadoPadrao: "enviado",
    resultados: ["enviado", "respondeu"],
  },
  {
    id: "validacao",
    rotulo: "Cliente confirmou a solução",
    quando: "O Passo 6: tudo voltou a funcionar e não restou pendência.",
    resultadoPadrao: "respondeu",
    resultados: ["respondeu"],
  },
];

export const ROTULO_DO_RESULTADO: Record<ResultadoDoContato, string> = {
  respondeu: "Respondeu",
  "sem-resposta": "Sem resposta",
  "nao-atendeu": "Não atendeu",
  "caixa-postal": "Caixa postal",
  enviado: "Enviado",
};

export const CANAIS_DE_CONTATO = [
  "WhatsApp",
  "Telefone",
  "E-mail",
  "Crisp",
  "Instagram",
  "Google Meet",
  "Portal RA",
] as const;

export function tipoDeContato(id?: string | null) {
  return TIPOS_DE_CONTATO.find((t) => t.id === id);
}

export interface ContatoView {
  id: string;
  tipo: TipoDeContato;
  canal: string;
  resultado?: ResultadoDoContato;
  nota?: string;
  em: string;
  autor: string;
}

/** O que o caso guarda de resumo dos contatos, para o quadro não carregar a lista. */
export interface ResumoDosContatos {
  primeiroContatoEm?: string;
  primeiroContatoCanal?: string;
  primeiroContatoPor?: string;
  ultimoContatoEm?: string;
  ultimaRespostaEm?: string;
  tentativasSemResposta: number;
  /** O Passo 6 registrado: a última validação do cliente. */
  validadoEm?: string;
  /** Passo 8: o pedido de avaliação mais recente, e quantos foram. */
  ultimoPedidoAvaliacaoEm?: string;
  pedidosDeAvaliacao: number;
}

/**
 * O resumo a partir da lista inteira — a lista é a fonte da verdade.
 *
 * Recalculado a cada gravação e a cada remoção, e não somado aos poucos:
 * um contato apagado ou registrado com data retroativa desfaria um
 * contador incremental sem ninguém perceber.
 */
export function resumirContatos(
  contatos: Pick<ContatoView, "tipo" | "canal" | "resultado" | "em" | "autor">[]
): ResumoDosContatos {

  const ordenados = [...contatos].sort((a, b) => a.em.localeCompare(b.em));

  if (ordenados.length === 0) {
    return { tentativasSemResposta: 0, pedidosDeAvaliacao: 0 };
  }

  /*
    O pedido de avaliação não é o 1º contato.

    Numa reclamação antiga, respondida antes de a plataforma registrar
    contatos, o primeiro registro costuma ser justamente o lembrete de
    avaliar — meses depois. Contá-lo como 1º contato poria meses no
    "tempo até o 1º contato" de um caso que foi atendido no dia.
  */
  const primeiro = ordenados.find((c) => c.tipo !== "pedido-avaliacao");
  const ultimo = ordenados[ordenados.length - 1];

  const respostas = ordenados.filter((c) => c.resultado === "respondeu");
  const ultimaResposta = respostas[respostas.length - 1];

  const tentativasSemResposta = ordenados.filter(
    (c) =>
      c.tipo === "tentativa" &&
      c.resultado !== "respondeu" &&
      (!ultimaResposta || c.em > ultimaResposta.em)
  ).length;

  const validacoes = ordenados.filter((c) => c.tipo === "validacao");
  const pedidos = ordenados.filter((c) => c.tipo === "pedido-avaliacao");

  return {
    primeiroContatoEm: primeiro?.em,
    primeiroContatoCanal: primeiro?.canal,
    primeiroContatoPor: primeiro?.autor,
    ultimoContatoEm: ultimo.em,
    ultimaRespostaEm: ultimaResposta?.em,
    tentativasSemResposta,
    validadoEm: validacoes[validacoes.length - 1]?.em,
    ultimoPedidoAvaliacaoEm: pedidos[pedidos.length - 1]?.em,
    pedidosDeAvaliacao: pedidos.length,
  };
}

/** O resumo como campos do caso — para a tela acompanhar o que o servidor gravou. */
export function patchDoResumo(r: ResumoDosContatos) {
  return {
    primeiroContatoEm: r.primeiroContatoEm,
    primeiroContatoCanal: r.primeiroContatoCanal,
    primeiroContatoPor: r.primeiroContatoPor,
    ultimoContatoEm: r.ultimoContatoEm,
    ultimaRespostaEm: r.ultimaRespostaEm,
    tentativasSemResposta: r.tentativasSemResposta,
    validadoEm: r.validadoEm,
    ultimoPedidoAvaliacaoEm: r.ultimoPedidoAvaliacaoEm,
    pedidosDeAvaliacao: r.pedidosDeAvaliacao,
  };
}
