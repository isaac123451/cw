/**
 * Etiqueta operacional aplicada às reclamações.
 *
 * O tipo morava em `lib/data/padroes/etiquetas.ts`, ao lado de um punhado de
 * etiquetas de exemplo — misturar contrato e amostra faz o contrato
 * parecer descartável, e foi por isso que apagar os dados de exemplo
 * quebrou o `tsc` em quatro arquivos.
 */
export interface CaseTag {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
  active: boolean;
}
