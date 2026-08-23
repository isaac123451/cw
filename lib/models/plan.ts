/**
 * Planos e módulos vendidos, com o preço vigente.
 *
 * Existe por causa das macros. O texto pronto que explica preço tinha o
 * valor **digitado dentro dele** — e preço digitado em texto envelhece
 * calado: ninguém revisa uma resposta pronta quando a tabela muda, e o
 * consumidor recebe um número que não existe mais.
 *
 * Com o cadastro, a macro escreve `{{planos}}` e a tabela é montada na
 * hora da inserção. O valor errado deixa de ser possível por construção.
 */

export type PlanKind = "plano" | "modulo";

export interface PlanOption {
  id: string;
  name: string;
  description?: string;
  kind: PlanKind;
  /**
   * Preço mensal em **centavos**.
   *
   * Dinheiro em ponto flutuante soma errado, e o erro só aparece no
   * total de um relatório meses depois. A tela converte na borda.
   */
  priceCents: number;
  /** O que está incluído, uma linha por item. */
  features: string[];
  order: number;
  active: boolean;
}

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function precoEmReais(centavos: number) {
  return REAIS.format(centavos / 100);
}

/** "169,99" → 16999. Aceita o que a pessoa digitar. */
export function centavosDoTexto(valor: string) {

  const limpo = valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(limpo);

  return Number.isFinite(numero)
    ? Math.round(numero * 100)
    : 0;
}

/**
 * Os valores de partida, da central de ajuda (agosto de 2026).
 *
 * Estão aqui como **semente**, não como verdade: o dia em que a tabela
 * mudar, quem corrige é a tela, não este arquivo. É a diferença entre um
 * cadastro e uma constante com cara de cadastro.
 */
export const PLANOS_PADRAO: Omit<PlanOption, "id">[] = [
  {
    name: "Mesas",
    kind: "plano",
    priceCents: 16999,
    description:
      "Para quem atende no salão: abre e gere mesas e comandas, e aceita retirada no local.",
    features: [
      "Gestão de mesas e comandas",
      "Retirada no local",
      "Módulo de balcão e caixa",
      "Impressão automática",
      "Gestão de usuários e clientes",
      "Estoque simples",
      "Fiado",
    ],
    order: 1,
    active: true,
  },
  {
    name: "Delivery",
    kind: "plano",
    priceCents: 20999,
    description:
      "Para quem opera entrega: o cliente pede e paga pela plataforma, sem depender de atendente.",
    features: [
      "Delivery, retirada e consumo no local com pagamento imediato",
      "Módulo de balcão e caixa",
      "Entregadores",
      "Campos personalizados",
      "Impressão automática",
      "Gestão de usuários e clientes",
      "Estoque simples",
      "Fidelidade e fiado",
      "Pagamento online",
      "Extensão do WhatsApp e automação de chatbot",
    ],
    order: 2,
    active: true,
  },
  {
    name: "Premium",
    kind: "plano",
    priceCents: 26999,
    description:
      "Mesas, comandas, delivery e retirada — todos os tipos de operação num plano só.",
    features: [
      "Tudo do Mesas e do Delivery",
      "Automação de chatbot e WhatsApp",
    ],
    order: 3,
    active: true,
  },

  {
    name: "Gestão Financeira",
    kind: "modulo",
    priceCents: 6999,
    description:
      "Controle de entrada, saída, categorias e relatórios.",
    features: [],
    order: 1,
    active: true,
  },
  {
    name: "Fiscal",
    kind: "modulo",
    priceCents: 6999,
    description:
      "Emissão de notas fiscais, XML e integração com a Receita.",
    features: [],
    order: 2,
    active: true,
  },
  {
    name: "Gestão de Entregas",
    kind: "modulo",
    priceCents: 5499,
    description:
      "Acompanhamento de entregas e controle de entregadores.",
    features: [],
    order: 3,
    active: true,
  },
  {
    name: "Estoque Avançado",
    kind: "modulo",
    priceCents: 2999,
    description:
      "Gestão detalhada de insumos, perdas e alertas.",
    features: [],
    order: 4,
    active: true,
  },
  {
    name: "Integração com Marketplaces",
    kind: "modulo",
    priceCents: 2999,
    description:
      "Centraliza os pedidos de vários marketplaces no sistema.",
    features: [],
    order: 5,
    active: true,
  },
];

/**
 * A tabela de preços em texto, para entrar numa macro.
 *
 * Uma linha por item, com o preço formatado — é o que a pessoa colaria
 * à mão, montado a partir do que está gravado agora.
 */
export function tabelaDePlanos(
  itens: PlanOption[],
  kind: PlanKind
) {
  return itens
    .filter(
      (item) => item.active && item.kind === kind
    )
    .sort((a, b) => a.order - b.order)
    .map(
      (item) =>
        `• ${item.name}: ${precoEmReais(item.priceCents)}/mês`
    )
    .join("\n");
}
