/**
 * Os assuntos da documentação e as categorias antigas que cabem neles.
 *
 * A base tem duas listas misturadas: as doze categorias da documentação
 * (Atendimento, Sistema, Financeiro…) e as que vieram da planilha do
 * portal ("Qualidade Do Atendimento", "Financeiro E Cobranças",
 * "Limitação No Sistema / Produto"…). Para a sugestão, as antigas contam
 * como a família delas: sem isso, "Atendimento" e "Qualidade Do
 * Atendimento" disputam o mesmo relato e a sugestão erra por sinônimo.
 *
 * Nada aqui muda o que está gravado nos casos.
 */

const FAMILIAS: Record<string, string> = {
  "qualidade do atendimento": "Atendimento",
  "financeiro e cobrancas": "Financeiro",
  "financeiro e faturamento": "Financeiro",
  cobranca: "Financeiro",
  pagamento: "Financeiro",
  "limitacao no sistema / produto": "Sistema",
  "limitacao do sistema/sugestoes": "Sistema",
  "configuracoes e uso do sistema": "Sistema",
  "confiabilidade operacional": "Sistema",
  "bug's do sistema": "Sistema",
  "cardapio e pedidos": "Sistema",
  aplicativo: "Sistema",
  "marketplace e integracoes": "Marketplace",
  "cliente final": "Outros",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function familiaDoAssunto(categoria: string) {
  return FAMILIAS[semAcento(categoria)] ?? categoria;
}
