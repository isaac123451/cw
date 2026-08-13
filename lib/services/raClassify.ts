/**
 * Classificação das reclamações importadas.
 *
 * O export completo do portal traz "Problema RA", que é a classificação
 * do próprio Reclame Aqui — quando existe, ela manda. Exports antigos
 * vinham sem nada, e nesses a categoria é inferida do título por
 * palavra-chave. A ordem das regras importa: o primeiro padrão que
 * casar vence, do mais específico para o mais genérico.
 */

interface Subcategoria {
  nome: string;
  termos: string[];
}

interface Regra {
  categoria: string;
  subcategorias: Subcategoria[];
}

export const REGRAS: Regra[] = [
  {
    categoria: "Cancelamento",
    subcategorias: [
      {
        nome: "Cancelamento não efetivado",
        termos: [
          "cancelamento nao|cancelamento não|nao consigo cancelar|não consigo cancelar|dificuldade.*cancel",
        ],
      },
      {
        nome: "Cobrança após cancelamento",
        termos: [
          "cobran.*ap[oó]s.*cancel|cancel.*mas.*cobr|cobrad[oa].*mesmo.*cancel",
        ],
      },
      {
        nome: "Solicitação de cancelamento",
        termos: ["cancel"],
      },
    ],
  },
  {
    categoria: "Financeiro",
    subcategorias: [
      {
        nome: "Estorno / reembolso",
        termos: [
          "estorno|reembols|devolu[cç][aã]o do valor",
        ],
      },
      {
        nome: "Cobrança indevida",
        termos: [
          "cobran[cç]a indevida|cobrado indevida|cobran[cç]a duplicada|duplicidade",
        ],
      },
      {
        nome: "Cobrança",
        termos: [
          "cobran|cobrad|fatura|boleto|mensalidade|assinatura",
        ],
      },
      {
        nome: "Pagamento",
        termos: [
          "pagamento|pix|cart[aã]o|maquininha|repasse",
        ],
      },
    ],
  },
  {
    categoria: "Sistema",
    subcategorias: [
      {
        nome: "Indisponibilidade",
        termos: [
          "fora do ar|instabilidade|inst[aá]vel|sistema caiu|indisponib",
        ],
      },
      {
        nome: "Lentidão",
        termos: ["lentid|lento|demorando para carregar"],
      },
      {
        nome: "Impressão",
        termos: ["impressora|impress[aã]o"],
      },
      {
        nome: "Erro / bug",
        termos: [
          "bug|erro|falha t[eé]cnica|n[aã]o funciona",
        ],
      },
      { nome: "Sistema", termos: ["sistema|plataforma"] },
    ],
  },
  {
    categoria: "Atendimento",
    subcategorias: [
      {
        nome: "Suporte sem retorno",
        termos: [
          "sem retorno|nenhum retorno|n[aã]o respond|sem resposta|falta de resposta|incomunic|fui ignorad|me ajudem|ate agora *n[aã]o|at[eé] agora *n[aã]o",
        ],
      },
      {
        nome: "Demora no atendimento",
        termos: [
          "demora|lento|dias.*sem|aguardando.*dias|ainda n[aã]o consigo",
        ],
      },
      {
        nome: "Postura no atendimento",
        termos: [
          "descaso|desprepar|incompet|imcompet|pessim|p[eé]ssim|falta de preparo|assist[eê]ncia|insatisfa|aten[cç][aã]o|reclama[cç][aã]o$|nao contratem|n[aã]o contratem|m[aá] comunica",
        ],
      },
      {
        nome: "Qualidade do atendimento",
        termos: ["suporte|atendimento|atendente"],
      },
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
      {
        nome: "Entrega",
        termos: ["entrega|frete|taxa de entrega"],
      },
    ],
  },
  {
    categoria: "Marketplace e integrações",
    subcategorias: [
      { nome: "iFood", termos: ["ifood"] },
      { nome: "WhatsApp", termos: ["whatsapp|whats"] },
      {
        nome: "Integração",
        termos: ["integra|delivery|api"],
      },
    ],
  },
  {
    categoria: "Aplicativo",
    subcategorias: [
      {
        nome: "Acesso e login",
        termos: ["login|senha|acesso"],
      },
      { nome: "App", termos: ["\\bapp\\b|aplicativo"] },
    ],
  },
  {
    categoria: "Comercial",
    subcategorias: [
      {
        nome: "Plano e contrato",
        termos: ["plano|contrato|renova"],
      },
      {
        nome: "Propaganda enganosa",
        termos: [
          "propaganda|an[uú]ncio|prometido|promessa",
        ],
      },
    ],
  },
  {
    categoria: "Implantação",
    subcategorias: [
      {
        nome: "Ativação",
        termos: [
          "ativa[cç][aã]o|ativar|filial|nova loja",
        ],
      },
      {
        nome: "Treinamento",
        termos: ["treinamento|capacita"],
      },
      { nome: "Migração", termos: ["migra"] },
    ],
  },
  {
    categoria: "Fiscal",
    subcategorias: [
      {
        nome: "Nota fiscal",
        termos: ["nota fiscal|nfe|nf-e|sped|fiscal"],
      },
    ],
  },
];

/** Devolve categoria e subcategoria a partir do título. */
export function classificar(titulo: string) {

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

/**
 * Categoria a partir do "Problema RA".
 *
 * A ordem importa: "Falha na parametrização fiscal" tem que cair em
 * Fiscal antes de bater em "falha" e virar Sistema, e "Assistência
 * técnica indisponível" é Atendimento, não indisponibilidade de sistema.
 */
const PROBLEMA_CATEGORIA: {
  categoria: string;
  re: RegExp;
}[] = [
  { categoria: "Cancelamento", re: /cancel/i },
  { categoria: "Fiscal", re: /fiscal|nota fiscal|sped/i },
  {
    categoria: "Financeiro",
    re: /estorno|reembols|cobran|valores|valor pago|pagamento|financ|divergência/i,
  },
  {
    categoria: "Implantação",
    re: /cadastro|reativa|implanta|migra|ativa[cç][aã]o/i,
  },
  {
    categoria: "Comercial",
    re: /propaganda|promessa|enganos|venda casada/i,
  },
  {
    categoria: "Atendimento",
    re: /atendimento|sac\b|suporte|assist[eê]ncia|prestador|qualidade|demora/i,
  },
  {
    categoria: "Sistema",
    re: /sistema|falha|bug|defeito|funcionalidade|privacidade|reparo|indisponi|instabil/i,
  },
  {
    categoria: "Cardápio e pedidos",
    re: /pedido|card[aá]pio|entrega|produto/i,
  },
];

/**
 * Classificação preferindo o dado real do portal.
 *
 * "Problema RA" vira a subcategoria como veio — é vocabulário do próprio
 * Reclame Aqui, melhor que qualquer chute nosso. A categoria agrupa esse
 * problema na taxonomia da operação. Sem problema informado, cai no
 * classificador por título.
 */
export function classificarPorProblema(
  problemaRa: string,
  titulo: string
) {

  const problema = String(problemaRa || "").trim();

  if (
    problema === "" ||
    /^outro problema$/i.test(problema)
  ) {
    return classificar(titulo);
  }

  const regra = PROBLEMA_CATEGORIA.find((item) =>
    item.re.test(problema)
  );

  return {
    categoria: regra
      ? regra.categoria
      : classificar(titulo).categoria,
    subcategoria: problema,
  };
}
