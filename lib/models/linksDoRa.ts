/**
 * Os dois endereços de uma reclamação no Reclame Aqui.
 *
 * O Isaac: "é preciso direcionar tanto para a reclamação como o portal
 * do Reclame Aqui nas reclamações". São duas páginas com papéis
 * diferentes:
 *
 * - a **página pública** — o que o consumidor e o mercado leem; é o
 *   endereço que a leitura do portal grava (`raUrl`, 321 das 363);
 * - a **área da empresa** — onde se responde, se pede moderação e onde
 *   aparecem nome, telefone e CPF/CNPJ do RA Forms. Sai do protocolo, e
 *   por isso existe para as 363.
 *
 * Medido em 23/09/2026. Nas Redes Sociais, `raUrl` é o link da interação
 * e não há área da empresa.
 */

export interface LinkDoRa {
  tipo: "publica" | "empresa";
  rotulo: string;
  titulo: string;
  href: string;
}

/** A reclamação na área da empresa; `null` quando o protocolo não é do Reclame Aqui. */
export function enderecoNaAreaDaEmpresa(protocolo: string) {
  const codigo = protocolo.replace(/^RA-/, "");

  return /^RA-/.test(protocolo) && /^[A-Za-z0-9_-]{16}$/.test(codigo)
    ? `https://www.reclameaqui.com.br/area-da-empresa/reclamacoes/${codigo}/`
    : null;
}

export function linksDoRa(caso: { protocol: string; raUrl?: string | null }): LinkDoRa[] {
  const empresa = enderecoNaAreaDaEmpresa(caso.protocol);
  const publica = caso.raUrl && /^https:\/\/(www\.)?reclameaqui\.com\.br\//.test(caso.raUrl) ? caso.raUrl : null;

  return [
    ...(publica ? [{ tipo: "publica" as const, rotulo: "Página pública", titulo: "Abrir a reclamação como o consumidor vê, no Reclame Aqui", href: publica }] : []),
    ...(empresa ? [{ tipo: "empresa" as const, rotulo: "Área da empresa", titulo: "Abrir na área da empresa do Reclame Aqui — responder, moderar, ver os dados do RA Forms", href: empresa }] : []),
  ];
}
