/**
 * Um texto aprovado, pronto para colar na caixa de mensagem.
 *
 * **Por que isto é serviço e não código da rota.** A conta que importa
 * aqui é a substituição de variáveis, e ela tem uma regra que só se
 * prova rodando: *variável que não dá para preencher continua
 * aparecendo*. O caminho fácil — trocar `{{protocolo}}` por string
 * vazia quando não há caso — produz a pior falha possível nesta tela:
 * uma mensagem gramaticalmente inteira, sem nenhum aviso, enviada ao
 * consumidor com um buraco no meio ("Reclamação: ").
 *
 * Aqui não existe substituição por vazio. Ou o valor existe, ou o
 * marcador fica na tela e a resposta entra na lista com o aviso do que
 * falta. Quem escolhe vê antes de colar.
 *
 * `npm run check:atalho` roda tudo isto contra as macros de verdade.
 */
import {
  applyMacro,
  MacroChannel,
  MACRO_VARS,
  Macro,
} from "@/lib/models/macro";

/** O que se sabe do atendimento no momento da inserção. */
export interface ContextoDaResposta {
  /** Nome do consumidor. */
  cliente?: string;

  /**
   * Quem está atendendo — **a pessoa logada**, não a dona do caso.
   *
   * Difere de propósito da resposta pública do portal, onde o texto sai
   * assinado por quem responde o caso. No WhatsApp o texto fala em
   * primeira pessoa ("Sou {{responsavel}}"), e quem está digitando é
   * quem está falando. Preencher com a dona do caso poria a operadora
   * se apresentando com o nome de outra pessoa.
   */
  responsavel?: string;

  protocolo?: string;
  estabelecimento?: string;

  /** Tabela de planos, montada do cadastro na hora. */
  planos?: string;

  /** Tabela de módulos adicionais, idem. */
  modulos?: string;
}

export interface RespostaPronta {
  id: string;
  titulo: string;
  canal: string;
  categoria: string;
  usos: number;

  /** O corpo com o que deu para preencher já preenchido. */
  texto: string;

  /**
   * Variáveis que sobraram — `{{protocolo}}`, `{{planos}}`…
   *
   * Sobrar é o comportamento correto, não o defeito. O defeito seria
   * sumir com elas.
   */
  faltando: string[];

  /**
   * Os trechos entre colchetes, que são pedidos de escrita.
   *
   * Oito das macros usam `[NOME]`, `[SEU NOME]`, `[NOTA]` e
   * `[O QUE FOI FEITO, EM PASSOS CONCRETOS]` — são instruções para
   * quem vai escrever, e nenhum sistema pode preenchê-las. A lista
   * existe para o atalho avisar "faltam 2 trechos", em vez de deixar a
   * pessoa descobrir depois de enviar.
   */
  preencher: string[];
}

/**
 * A ordem dos canais, vista de cada página.
 *
 * **O NPS logo depois do WhatsApp não é chute.** Os seis textos
 * cadastrados como "NPS" são mensagens de WhatsApp — falam "me chama
 * por aqui", "pode ser por áudio", e a pesquisa fala com o cliente por
 * um WhatsApp próprio (é o que o rodapé de canais do painel já
 * separa). Deixá-los no fim esconderia, atrás de uma busca, metade do
 * que se manda por WhatsApp num dia.
 *
 * O Reclame Aqui vai por último em toda página que não é ele: são
 * textos de resposta pública, escritos para o portal formatar.
 */
export const AFINIDADE: Record<MacroChannel, MacroChannel[]> = {
  WhatsApp: ["WhatsApp", "NPS", "Instagram", "Reclame Aqui"],
  NPS: ["NPS", "WhatsApp", "Instagram", "Reclame Aqui"],
  Instagram: ["Instagram", "WhatsApp", "NPS", "Reclame Aqui"],
  "Reclame Aqui": [
    "Reclame Aqui",
    "WhatsApp",
    "NPS",
    "Instagram",
  ],
};

/**
 * Um pedido de escrita entre colchetes.
 *
 * A marca é o **maiúsculo**: `[NOME]`, `[O QUE PRECISA: CNPJ...]`. Um
 * colchete com minúscula dentro é texto normal do autor, e cobrá-lo
 * como pendência faria o aviso perder o sentido de tanto aparecer.
 */
const PEDIDO_ESCRITO = /\[[^\][]{2,90}\]/g;

function ehPedido(trecho: string) {
  const dentro = trecho.slice(1, -1);

  return (
    !/\p{Ll}/u.test(dentro) && /\p{Lu}/u.test(dentro)
  );
}

export function pedidosDeEscrita(texto: string) {
  return (texto.match(PEDIDO_ESCRITO) ?? []).filter(
    ehPedido
  );
}

/** Minúsculas e sem acento, para a busca não depender de digitação. */
export function achatar(valor: string) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Substitui o que dá, mantém o resto à vista.
 *
 * O truque é passar o **próprio marcador** como valor quando não se
 * sabe: `applyMacro` continua sendo a única implementação da
 * substituição — a mesma que a resposta pública usa — e o que ela não
 * tinha como preencher sai de lá idêntico ao que entrou.
 */
function preencher(
  corpo: string,
  contexto: ContextoDaResposta
) {
  const ou = (valor: string | undefined, token: string) =>
    valor && valor.trim() !== "" ? valor.trim() : token;

  return applyMacro(corpo, {
    cliente: ou(contexto.cliente, "{{cliente}}"),
    protocolo: ou(contexto.protocolo, "{{protocolo}}"),
    responsavel: ou(
      contexto.responsavel,
      "{{responsavel}}"
    ),
    estabelecimento: ou(
      contexto.estabelecimento,
      "{{estabelecimento}}"
    ),
    planos: ou(contexto.planos, "{{planos}}"),
    modulos: ou(contexto.modulos, "{{modulos}}"),
  });
}

export function prepararResposta(
  macro: Macro,
  contexto: ContextoDaResposta
): RespostaPronta {
  const texto = preencher(macro.body, contexto);

  return {
    id: macro.id,
    titulo: macro.title,
    canal: macro.channel,
    categoria: macro.category,
    usos: macro.uses,
    texto,

    faltando: MACRO_VARS.filter((item) =>
      texto.includes(item.token)
    ).map((item) => item.token),

    preencher: pedidosDeEscrita(texto),
  };
}

/**
 * A lista inteira, na ordem em que serve para escolher.
 *
 * Ordem: afinidade com a página, depois o mais usado, depois o título.
 * "Mais usado primeiro" é o que faz o atalho melhorar sozinho — e é o
 * motivo de a inserção contar o uso no banco em vez de só colar.
 */
export function prepararRespostas(
  macros: Macro[],
  canalDaPagina: string,
  contexto: ContextoDaResposta,
  busca = ""
): RespostaPronta[] {
  const ordem =
    AFINIDADE[canalDaPagina as MacroChannel] ??
    AFINIDADE.WhatsApp;

  /**
   * Canal que a lista não conhece cai para o fim, e não estoura.
   *
   * O campo é texto no banco: alguém pode cadastrar "TikTok" amanhã, e
   * uma resposta pronta a menos na tela é muito melhor do que a tela
   * inteira falhando.
   */
  const peso = (canal: string) => {
    const posicao = (ordem as string[]).indexOf(canal);
    return posicao < 0 ? ordem.length : posicao;
  };

  const termo = achatar(busca).trim();

  const preparadas = macros
    .map((macro) => prepararResposta(macro, contexto))
    .filter((item) => {
      if (termo === "") return true;

      return achatar(
        [
          item.titulo,
          item.texto,
          item.canal,
          item.categoria,
        ].join(" ")
      ).includes(termo);
    });

  return preparadas.sort(
    (a, b) =>
      peso(a.canal) - peso(b.canal) ||
      b.usos - a.usos ||
      a.titulo.localeCompare(b.titulo, "pt-BR")
  );
}
