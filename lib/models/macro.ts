/**
 * Resposta pronta para o Reclame Aqui.
 *
 * A Base de Conhecimento era uma lista estática que repetia o que a
 * Documentação já faz. O que faltava de verdade era isto: textos
 * aprovados que o time insere na resposta pública sem reescrever do zero.
 */
/**
 * Os dois destinos de um texto pronto.
 *
 * "Reclame Aqui" é a resposta pública, que o portal formata sozinho.
 * "WhatsApp" é a conversa direta, onde `*negrito*` funciona e emoji é
 * esperado — e é por lá que a operação cobra avaliação, porque o portal
 * não deixa cobrar dentro da própria reclamação.
 */
export const MACRO_CHANNELS = [
  "Reclame Aqui",
  "WhatsApp",
] as const;

export type MacroChannel =
  (typeof MACRO_CHANNELS)[number];

export interface Macro {
  id: string;

  title: string;

  /** Texto inserido na resposta. Aceita as variáveis abaixo. */
  body: string;

  /** Categoria de caso em que faz sentido usar. */
  category: string;

  /**
   * Onde este texto é usado.
   *
   * Não é etiqueta: são formatos diferentes. O WhatsApp entende
   * `*negrito*` e emoji; a resposta pública do Reclame Aqui mostra os
   * asteriscos crus, na frente do consumidor. Por isso o seletor da
   * resposta pública só oferece os do portal.
   */
  channel: MacroChannel;

  /** Quem aprovou o texto. */
  owner: string;

  tags: string[];

  /** Quantas vezes foi inserida em uma resposta. */
  uses: number;

  updatedAt: string;
}

/** Variáveis substituídas na hora de inserir. */
export const MACRO_VARS = [
  {
    token: "{{cliente}}",
    label: "Nome do consumidor",
  },
  {
    token: "{{protocolo}}",
    label: "Protocolo da reclamação",
  },
  {
    token: "{{responsavel}}",
    label: "Quem está atendendo",
  },
  {
    token: "{{estabelecimento}}",
    label: "Estabelecimento vinculado",
  },
  {
    token: "{{planos}}",
    label: "Tabela de planos, com os preços de hoje",
  },
  {
    token: "{{modulos}}",
    label: "Tabela de módulos adicionais",
  },
];

/**
 * Troca as variáveis pelos valores do caso.
 *
 * **Preço não entra digitado.** `{{planos}}` e `{{modulos}}` são
 * montados a partir do cadastro na hora da inserção — é o que impede
 * uma resposta pronta de sair com um valor que não existe mais. Texto
 * com preço dentro envelhece calado: ninguém revisa uma macro quando a
 * tabela de preços muda.
 *
 * As chaves vão escapadas na expressão: `{` sem quantificador válido é
 * literal por acidente hoje, e erro de sintaxe no dia em que alguém
 * ligar o modo unicode.
 */
export function applyMacro(
  body: string,
  values: {
    cliente: string;
    protocolo: string;
    responsavel: string;
    estabelecimento: string;
    planos?: string;
    modulos?: string;
  }
) {
  return body
    .replace(/\{\{cliente\}\}/g, values.cliente)
    .replace(/\{\{protocolo\}\}/g, values.protocolo)
    .replace(/\{\{responsavel\}\}/g, values.responsavel)
    .replace(
      /\{\{estabelecimento\}\}/g,
      values.estabelecimento
    )
    .replace(/\{\{planos\}\}/g, values.planos ?? "")
    .replace(/\{\{modulos\}\}/g, values.modulos ?? "");
}
