/**
 * Resposta pronta para o Reclame Aqui.
 *
 * A Base de Conhecimento era uma lista estática que repetia o que a
 * Documentação já faz. O que faltava de verdade era isto: textos
 * aprovados que o time insere na resposta pública sem reescrever do zero.
 */
export interface Macro {
  id: string;

  title: string;

  /** Texto inserido na resposta. Aceita as variáveis abaixo. */
  body: string;

  /** Categoria de caso em que faz sentido usar. */
  category: string;

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
];

/** Troca as variáveis pelos valores do caso. */
export function applyMacro(
  body: string,
  values: {
    cliente: string;
    protocolo: string;
    responsavel: string;
    estabelecimento: string;
  }
) {
  return body
    .replace(/\{\{cliente\}\}/g, values.cliente)
    .replace(/\{\{protocolo\}\}/g, values.protocolo)
    .replace(/\{\{responsavel\}\}/g, values.responsavel)
    .replace(
      /\{\{estabelecimento\}\}/g,
      values.estabelecimento
    );
}
