/**
 * Classificação derivada do título da reclamação.
 *
 * O export do Reclame Aqui vem sem categoria (todos os registros como
 * "Outros"), então a categoria é inferida por palavra-chave. A ordem
 * importa: o primeiro padrão que casar vence, do mais específico para o
 * mais genérico.
 */

const REGRAS = [
  {
    categoria: "Cancelamento",
    subcategorias: [
      { nome: "Cancelamento não efetivado", termos: ["cancelamento nao|cancelamento não|nao consigo cancelar|não consigo cancelar|dificuldade.*cancel"] },
      { nome: "Cobrança após cancelamento", termos: ["cobran.*ap[oó]s.*cancel|cancel.*mas.*cobr|cobrad[oa].*mesmo.*cancel"] },
      { nome: "Solicitação de cancelamento", termos: ["cancel"] },
    ],
  },
  {
    categoria: "Financeiro",
    subcategorias: [
      { nome: "Estorno / reembolso", termos: ["estorno|reembols|devolu[cç][aã]o do valor"] },
      { nome: "Cobrança indevida", termos: ["cobran[cç]a indevida|cobrado indevida|cobran[cç]a duplicada|duplicidade"] },
      { nome: "Cobrança", termos: ["cobran|cobrad|fatura|boleto|mensalidade|assinatura"] },
      { nome: "Pagamento", termos: ["pagamento|pix|cart[aã]o|maquininha|repasse"] },
    ],
  },
  {
    categoria: "Sistema",
    subcategorias: [
      { nome: "Indisponibilidade", termos: ["fora do ar|instabilidade|inst[aá]vel|sistema caiu|indisponib"] },
      { nome: "Lentidão", termos: ["lentid|lento|demorando para carregar"] },
      { nome: "Impressão", termos: ["impressora|impress[aã]o"] },
      { nome: "Erro / bug", termos: ["bug|erro|falha t[eé]cnica|n[aã]o funciona"] },
      { nome: "Sistema", termos: ["sistema|plataforma"] },
    ],
  },
  {
    categoria: "Atendimento",
    subcategorias: [
      { nome: "Suporte sem retorno", termos: ["sem retorno|nenhum retorno|n[aã]o respond|sem resposta|falta de resposta|incomunic|fui ignorad|me ajudem|ate agora *n[aã]o|at[eé] agora *n[aã]o"] },
      { nome: "Demora no atendimento", termos: ["demora|lento|dias.*sem|aguardando.*dias|ainda n[aã]o consigo"] },
      {
        nome: "Postura no atendimento",
        termos: [
          "descaso|desprepar|incompet|imcompet|pessim|p[eé]ssim|falta de preparo|assist[eê]ncia|insatisfa|aten[cç][aã]o|reclama[cç][aã]o$|nao contratem|n[aã]o contratem|m[aá] comunica",
        ],
      },
      { nome: "Qualidade do atendimento", termos: ["suporte|atendimento|atendente"] },
    ],
  },
  {
    categoria: "Comercial",
    subcategorias: [
      {
        nome: "Propaganda enganosa",
        termos: [
          "propaganda|an[uú]ncio|anunciad|prometido|promessa|venda casada|pre[cç]o diferente|valor anunciado|produto diferente",
        ],
      },
      {
        nome: "Abordagem comercial",
        termos: [
          "parem de me mandar|n[aã]o quero comprar|vendedores|dificuldade de contato para contrata",
        ],
      },
    ],
  },
  {
    categoria: "Cardápio e pedidos",
    subcategorias: [
      { nome: "Cardápio digital", termos: ["card[aá]pio"] },
      { nome: "Pedidos", termos: ["pedido"] },
      { nome: "Entrega", termos: ["entrega|frete|taxa de entrega"] },
    ],
  },
  {
    categoria: "Marketplace e integrações",
    subcategorias: [
      { nome: "iFood", termos: ["ifood"] },
      { nome: "WhatsApp", termos: ["whatsapp|whats"] },
      { nome: "Integração", termos: ["integra|delivery|api"] },
    ],
  },
  {
    categoria: "Aplicativo",
    subcategorias: [
      { nome: "Acesso e login", termos: ["login|senha|acesso"] },
      { nome: "App", termos: ["\\bapp\\b|aplicativo"] },
    ],
  },
  {
    categoria: "Comercial",
    subcategorias: [
      { nome: "Plano e contrato", termos: ["plano|contrato|renova"] },
      { nome: "Propaganda enganosa", termos: ["propaganda|an[uú]ncio|prometido|promessa"] },
    ],
  },
  {
    categoria: "Implantação",
    subcategorias: [
      { nome: "Ativação", termos: ["ativa[cç][aã]o|ativar|filial|nova loja"] },
      { nome: "Treinamento", termos: ["treinamento|capacita"] },
      { nome: "Migração", termos: ["migra"] },
    ],
  },
  {
    categoria: "Fiscal",
    subcategorias: [
      { nome: "Nota fiscal", termos: ["nota fiscal|nfe|nf-e|sped|fiscal"] },
    ],
  },
];

/** Devolve { categoria, subcategoria } a partir do título. */
function classificar(titulo) {

  const texto = String(titulo || "").toLowerCase();

  for (const regra of REGRAS) {
    for (const sub of regra.subcategorias) {
      for (const termo of sub.termos) {
        if (new RegExp(termo, "i").test(texto)) {
          return {
            categoria: regra.categoria,
            subcategoria: sub.nome,
          };
        }
      }
    }
  }

  return {
    categoria: "Outros",
    subcategoria: "Não classificado",
  };
}

module.exports = { classificar, REGRAS };
