/**
 * A lista oficial de categorias das reclamações (1.131).
 *
 * O pedido, de 05/10/2026: "ajeite também a parte de categorias de
 * reclamações, os dados estão incorretos". A base misturava duas listas —
 * as doze categorias da documentação e as que a planilha do portal trouxe
 * ("Qualidade Do Atendimento", "Financeiro E Cobranças", "Limitação No
 * Sistema / Produto"…) —, e o mesmo assunto aparecia em três a seis fatias
 * em todo gráfico. A decisão dele: unificar nas da documentação, e a IA
 * propõe a categoria certa de cada reclamação para ele aprovar.
 *
 * A lista oficial é a da documentação, mais as duas que a 1.74 tirou da
 * própria base (Impressão de pedidos e WhatsApp e robô, que caíam
 * espalhadas em Atendimento, Sistema e Limitação), mais "Outros".
 *
 * As definições abaixo são as que a IA lê para decidir. Por isso dizem o
 * que separa uma categoria da vizinha — a confusão mais comum da base era
 * pôr em "Atendimento" toda reclamação que menciona o suporte, quando o
 * que o cliente reclama é o sistema que parou.
 */

export interface CategoriaOficial {
  nome: string;
  definicao: string;
}

export const CATEGORIAS_OFICIAIS: CategoriaOficial[] = [
  { nome: "Atendimento", definicao: "O problema principal é o atendimento em si: demora, falta de retorno, ninguém responde, atendente despreparado ou grosseiro, promessa de retorno não cumprida. Se o cliente reclama de um defeito e cita o suporte de passagem, a categoria é a do defeito." },
  { nome: "Sistema", definicao: "Falha, instabilidade, lentidão, bug ou funcionalidade que não funciona como deveria na plataforma (PDV, cardápio digital, KDS, painel), e limitações do produto — recurso que falta ou não atende." },
  { nome: "Financeiro", definicao: "Cobrança indevida ou duplicada, boleto, reajuste, renovação automática cobrada, valores divergentes, estorno e reembolso." },
  { nome: "Cancelamento", definicao: "Pedido de cancelar o plano ou contrato, dificuldade ou demora para cancelar, multa ou fidelidade na saída. Se a queixa principal é a cobrança depois de cancelar, é Financeiro." },
  { nome: "Implantação", definicao: "Onboarding, migração, configuração inicial e treinamento; prazo de implantação não cumprido." },
  { nome: "Comercial", definicao: "Proposta e promessa de venda não cumpridas, plano diferente do contratado, condições da contratação, programa de fidelidade e cupons do sistema." },
  { nome: "Impressão de pedidos", definicao: "Impressora que não imprime, imprime atrasado, perde a conexão ou falha no horário de pico." },
  { nome: "WhatsApp e robô", definicao: "Robô de atendimento do WhatsApp, número bloqueado ou banido, disparo de mensagens e conexão do WhatsApp." },
  { nome: "Marketplace", definicao: "Integrações com aplicativos de delivery (iFood e outros): pedidos que não chegam, cardápio que não sincroniza." },
  { nome: "Pagamento", definicao: "Pagamento online do consumidor: Pix, cartão, repasse do valor das vendas para a loja." },
  { nome: "Fiscal", definicao: "Nota fiscal, NFC-e, SPED e obrigações fiscais." },
  { nome: "Entrega", definicao: "Entregas e logística dos pedidos: atraso, pedido errado, taxa de entrega." },
  { nome: "Aplicativo", definicao: "Falhas no aplicativo do consumidor final." },
  { nome: "Cadastro", definicao: "Cadastro de produtos, adicionais, cardápio e configurações da loja feitas pelo próprio cliente." },
  { nome: "Outros", definicao: "Nada acima descreve a reclamação — uso de dados, reclamação de consumidor final de uma loja, assunto fora do produto." },
];

export const NOMES_OFICIAIS = CATEGORIAS_OFICIAIS.map((c) => c.nome);

/**
 * As categorias que não são da lista e onde cada uma cai na unificação.
 *
 * É só o ponto de partida: depois, a IA lê cada relato e propõe a
 * categoria certa — "Limitação No Sistema / Produto" vira Sistema aqui,
 * mas uma reclamação dela que fala de cobrança vai para Financeiro na
 * revisão.
 */
export const MAPA_DE_UNIFICACAO: Record<string, string> = {
  "qualidade do atendimento": "Atendimento",
  "financeiro e cobrancas": "Financeiro",
  "financeiro e faturamento": "Financeiro",
  cobranca: "Financeiro",
  "limitacao no sistema / produto": "Sistema",
  "limitacao do sistema/sugestoes": "Sistema",
  "configuracoes e uso do sistema": "Sistema",
  "confiabilidade operacional": "Sistema",
  "bug's do sistema": "Sistema",
  "cardapio e pedidos": "Sistema",
  "marketplace e integracoes": "Marketplace",
  "cliente final": "Outros",
};

/** Minúsculas, sem acento e com espaço único — a chave de comparação de nomes. */
export function chaveDoNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const OFICIAIS_POR_CHAVE = new Map(NOMES_OFICIAIS.map((n) => [chaveDoNome(n), n]));

export function ehOficial(nome: string) {
  return OFICIAIS_POR_CHAVE.has(chaveDoNome(nome));
}

/**
 * O nome oficial de uma categoria — o mesmo se já for, o do mapa se for
 * uma das antigas, e o próprio nome se ninguém souber (categoria criada
 * à mão fica como está).
 */
export function categoriaOficial(nome: string | null | undefined): string | undefined {
  if (!nome) return undefined;
  const chave = chaveDoNome(nome);
  return OFICIAIS_POR_CHAVE.get(chave) ?? MAPA_DE_UNIFICACAO[chave] ?? nome;
}

/** Erros de digitação que a base já tem e que separavam a mesma subcategoria. */
const GRAFIAS: Record<string, string> = {
  domora: "demora",
};

/**
 * A chave de uma subcategoria, para achar as gêmeas dentro da mesma
 * categoria: "Demora No Atendimento" e "Demora no atendimento" são uma só.
 */
export function chaveDaSubcategoria(nome: string) {
  return chaveDoNome(nome)
    .split(" ")
    .map((p) => GRAFIAS[p] ?? p)
    .join(" ");
}

/**
 * Entre gêmeas, a que fica: a com mais casos; no empate, a que não está
 * toda em maiúsculas de título ("Demora no atendimento" e não "Demora No
 * Atendimento"), e por fim a ordem alfabética, para ser estável.
 */
export function escolherGemea<T extends { nome: string; casos: number }>(gemeas: T[]): T {
  const titulo = (n: string) => n.split(" ").filter((p) => p.length > 3).every((p) => p[0] === p[0].toUpperCase());
  return [...gemeas].sort((a, b) => b.casos - a.casos || Number(titulo(a.nome)) - Number(titulo(b.nome)) || a.nome.localeCompare(b.nome))[0];
}

/* ============================================================
   A UNIFICAÇÃO — calculada sem banco, para a prévia e a gravação
   serem a mesma conta
============================================================ */

export interface SubcategoriaDoCadastro {
  id: string;
  nome: string;
  ativa: boolean;
  casos: number;
}

export interface CategoriaDoCadastro {
  id: string;
  nome: string;
  ativa: boolean;
  casos: number;
  subcategorias: SubcategoriaDoCadastro[];
}

export interface CasoParaUnificar {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
}

export interface TrocaDeCategoria {
  caseId: string;
  deCategoriaId: string | null;
  deSubcategoriaId: string | null;
  /** Nome oficial — o id sai do cadastro na hora de gravar (pode ser criada agora). */
  paraCategoria: string;
  paraSubcategoriaId: string | null;
}

export interface Unificacao {
  /** Para a prévia: cada categoria fora da lista, quantos casos tem e para onde vai. */
  movimentos: { id: string; nome: string; casos: number; para: string }[];
  /** Para a prévia: as subcategorias gêmeas que se juntam numa só. */
  fusoes: { categoria: string; fica: string; saem: { nome: string; casos: number }[] }[];
  /** Oficiais que não existem no cadastro e serão criadas. */
  criar: string[];
  /** Subcategorias que mudam de categoria junto com a sua (a gêmea que fica). */
  moverSubcategorias: { id: string; paraCategoria: string }[];
  desativarSubcategorias: string[];
  desativarCategorias: string[];
  trocas: TrocaDeCategoria[];
}

/**
 * O que a unificação faz com cada categoria, subcategoria e reclamação.
 *
 * 1. Toda categoria fora da lista que o mapa conhece vai para a oficial
 *    dela; a de origem fica desativada (nada é excluído).
 * 2. Dentro de cada oficial, as subcategorias com o mesmo nome (sem olhar
 *    maiúscula, acento ou o erro de digitação conhecido) viram uma só. Fica
 *    a que já era da oficial; entre as de fora, a com mais casos.
 * 3. Cada reclamação dessas categorias passa para a oficial e para a
 *    subcategoria que ficou. Categoria criada à mão, fora do mapa, fica
 *    como está.
 */
export function calcularUnificacao(cadastro: CategoriaDoCadastro[], casos: CasoParaUnificar[]): Unificacao {
  const destinoDe = (c: CategoriaDoCadastro): string | null => {
    if (ehOficial(c.nome)) return OFICIAIS_POR_CHAVE.get(chaveDoNome(c.nome))!;
    const d = MAPA_DE_UNIFICACAO[chaveDoNome(c.nome)];
    return d ?? null;
  };

  const criar: string[] = [];
  const moverSubcategorias: Unificacao["moverSubcategorias"] = [];
  const desativarSubcategorias: string[] = [];
  const desativarCategorias: string[] = [];
  const movimentos: Unificacao["movimentos"] = [];
  const fusoes: Unificacao["fusoes"] = [];
  /** subcategoria antiga → a que fica. */
  const subPara = new Map<string, string>();
  /** categoria antiga → oficial. */
  const catPara = new Map<string, string>();

  for (const oficial of NOMES_OFICIAIS) {
    const membros = cadastro.filter((c) => destinoDe(c) === oficial);
    const propria = membros.find((c) => ehOficial(c.nome));
    const deFora = membros.filter((c) => c !== propria);
    if (!propria && deFora.length > 0) criar.push(oficial);

    for (const c of membros) catPara.set(c.id, oficial);
    for (const c of deFora) {
      movimentos.push({ id: c.id, nome: c.nome, casos: c.casos, para: oficial });
      if (c.ativa) desativarCategorias.push(c.id);
    }

    /* As gêmeas, entre todas as subcategorias que vão morar na oficial. */
    const grupos = new Map<string, { sub: SubcategoriaDoCadastro; daOficial: boolean }[]>();
    for (const c of membros) {
      for (const sub of c.subcategorias) {
        if (!sub.ativa && sub.casos === 0) continue;
        const chave = chaveDaSubcategoria(sub.nome);
        grupos.set(chave, [...(grupos.get(chave) ?? []), { sub, daOficial: c === propria }]);
      }
    }
    for (const grupo of grupos.values()) {
      const daOficial = grupo.filter((g) => g.daOficial).map((g) => ({ ...g.sub }));
      const candidatas = daOficial.length ? daOficial : grupo.map((g) => ({ ...g.sub }));
      const fica = escolherGemea(candidatas);
      const ficaEhDeFora = !grupo.find((g) => g.sub.id === fica.id)!.daOficial;
      if (ficaEhDeFora) moverSubcategorias.push({ id: fica.id, paraCategoria: oficial });
      const saem = grupo.map((g) => g.sub).filter((s) => s.id !== fica.id);
      for (const s of grupo.map((g) => g.sub)) subPara.set(s.id, fica.id);
      for (const s of saem) if (s.ativa) desativarSubcategorias.push(s.id);
      if (saem.length) fusoes.push({ categoria: oficial, fica: fica.nome, saem: saem.map((s) => ({ nome: s.nome, casos: s.casos })) });
    }
  }

  const nomeDaCategoria = new Map(cadastro.map((c) => [c.id, c.nome]));
  const trocas: TrocaDeCategoria[] = [];
  for (const caso of casos) {
    if (!caso.categoryId) continue;
    const oficial = catPara.get(caso.categoryId);
    if (!oficial) continue;
    const novaSub = caso.subcategoryId ? (subPara.get(caso.subcategoryId) ?? caso.subcategoryId) : null;
    const mudaCategoria = chaveDoNome(nomeDaCategoria.get(caso.categoryId) ?? "") !== chaveDoNome(oficial);
    if (!mudaCategoria && novaSub === caso.subcategoryId) continue;
    trocas.push({ caseId: caso.id, deCategoriaId: caso.categoryId, deSubcategoriaId: caso.subcategoryId, paraCategoria: oficial, paraSubcategoriaId: novaSub });
  }

  return {
    movimentos: movimentos.sort((a, b) => b.casos - a.casos),
    fusoes: fusoes.sort((a, b) => b.saem.reduce((s, x) => s + x.casos, 0) - a.saem.reduce((s, x) => s + x.casos, 0)),
    criar,
    moverSubcategorias,
    desativarSubcategorias,
    desativarCategorias,
    trocas,
  };
}
