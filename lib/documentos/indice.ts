/**
 * Os endereços dos nove documentos do time, sem o texto.
 *
 * A tela precisa saber quais já foram importados e em que ordem
 * mostrá-los; o texto inteiro (`documentosDoTime.ts`, 55 mil
 * caracteres) só o servidor carrega, na importação. `check:documentos`
 * confere que as duas listas não se separam.
 */
export const SLUGS_DOS_DOCUMENTOS_DO_TIME = [
  "cintcw-entendendo-a-reputacao",
  "cintcw-rotina-do-agente",
  "cintcw-reclame-aqui",
  "cintcw-tratativa-interna",
  "cintcw-ofertas",
  "cintcw-redes-sociais",
  "cintcw-nps",
  "cintcw-google",
  "cintcw-ferramentas-e-acessos",
] as const;

export type SlugDoTime = (typeof SLUGS_DOS_DOCUMENTOS_DO_TIME)[number];

/** A marca que a importação grava em `Playbook.origem` — igual a `ORIGEM_DOS_DOCUMENTOS`. */
export const ORIGEM_DOS_DOCUMENTOS_DO_TIME = "documentos-agosto-2026";

/** A ordem dos grupos na lista — a mesma dos documentos; o que não for do time vem depois, em ordem alfabética. */
export const ORDEM_DOS_ESCOPOS = ["Reputação", "Rotina", "Reclame Aqui", "Ofertas", "Redes Sociais", "NPS", "Google", "Ferramentas"];
