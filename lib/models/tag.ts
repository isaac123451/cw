/**
 * Etiqueta operacional aplicada às reclamações.
 *
 * O tipo morava em `lib/data/padroes/etiquetas.ts`, ao lado de um punhado de
 * etiquetas de exemplo — misturar contrato e amostra faz o contrato
 * parecer descartável, e foi por isso que apagar os dados de exemplo
 * quebrou o `tsc` em quatro arquivos.
 */
/**
 * Tag das reclamações que entraram pela extensão, sem prévia ou com.
 *
 * Mora aqui, e não no serviço do portal, para a tela poder lê-la sem
 * levar o servidor junto: na lista ela vira um ícone, não uma etiqueta.
 */
export const TAG_DA_EXTENSAO = "Capturada pela extensão";

export interface CaseTag {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
  active: boolean;
}
