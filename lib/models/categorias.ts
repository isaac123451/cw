/**
 * Categorias parecidas, para unificar — com prévia e decisão de quem usa.
 *
 * A base chegou com três "Financeiro" ("Financeiro", "Financeiro E
 * Cobranças", "Financeiro E Faturamento"), dois "Atendimento" e cinco
 * jeitos de dizer "Sistema". Cada gráfico por categoria dividia o mesmo
 * assunto em fatias que ninguém somava de cabeça.
 *
 * Isto só **sugere**: agrupa por palavra forte em comum. Quem decide o
 * que junta, e em qual nome, é a pessoa — o mesmo "Sistema" pode ser bug
 * para uns e limitação de produto para outros.
 */

export interface CategoriaContada {
  id: string;
  nome: string;
  ativa: boolean;
  casos: number;
  subcategorias: number;
  macros: number;
  regras: number;
}

export interface GrupoSugerido {
  /** A palavra que une o grupo — "financeiro", "sistema". */
  chave: string;
  /** Sugestão de destino: o membro com mais casos. */
  destinoId: string;
  membros: CategoriaContada[];
  casos: number;
}

const VAZIAS = new Set([
  "e", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "o", "a", "os", "as",
  "com", "em", "por", "para", "uso", "sugestoes", "sugestao", "geral", "outros", "outro",
]);

/** Palavras diferentes para o mesmo assunto. */
const SINONIMOS: Record<string, string> = {
  cobranca: "financeiro",
  faturamento: "financeiro",
  pagamento: "financeiro",
  suporte: "atendimento",
  bug: "sistema",
  bugs: "sistema",
  integracao: "marketplace",
};

/** As palavras fortes de um nome: sem acento, sem as vazias, no singular. */
export function palavrasDaCategoria(nome: string): string[] {
  const palavras = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !VAZIAS.has(p))
    .map((p) => (p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p))
    .map((p) => SINONIMOS[p] ?? p);

  return [...new Set(palavras)];
}

/**
 * Os grupos que valem uma olhada, do que mais pesa ao que menos.
 *
 * Um grupo é uma palavra forte presente em duas ou mais categorias
 * ativas. Grupos com exatamente os mesmos membros aparecem uma vez só.
 * A mesma categoria pode aparecer em mais de um grupo ("Limitação do
 * Sistema" em "sistema" e em "limitacao") — escolher entre eles é
 * justamente a decisão que a tela deixa para a pessoa.
 */
export function sugerirGrupos(categorias: CategoriaContada[]): GrupoSugerido[] {

  const ativas = categorias.filter((c) => c.ativa);
  const porPalavra = new Map<string, CategoriaContada[]>();

  for (const c of ativas) {
    for (const p of palavrasDaCategoria(c.nome)) {
      porPalavra.set(p, [...(porPalavra.get(p) ?? []), c]);
    }
  }

  const vistos = new Set<string>();
  const grupos: GrupoSugerido[] = [];

  for (const [chave, membros] of porPalavra) {

    if (membros.length < 2) continue;

    const assinatura = membros.map((m) => m.id).sort().join("|");
    if (vistos.has(assinatura)) continue;
    vistos.add(assinatura);

    const ordenados = [...membros].sort((a, b) => b.casos - a.casos || a.nome.localeCompare(b.nome));

    grupos.push({
      chave,
      destinoId: ordenados[0].id,
      membros: ordenados,
      casos: ordenados.reduce((s, m) => s + m.casos, 0),
    });
  }

  return grupos.sort((a, b) => b.casos - a.casos || b.membros.length - a.membros.length);
}

/** O que a unificação vai fazer, em frases — a prévia antes de salvar. */
export function previaDaUnificacao(destino: CategoriaContada, origens: CategoriaContada[]): string[] {

  const casos = origens.reduce((s, o) => s + o.casos, 0);
  const subcategorias = origens.reduce((s, o) => s + o.subcategorias, 0);
  const macros = origens.reduce((s, o) => s + o.macros, 0);
  const regras = origens.reduce((s, o) => s + o.regras, 0);
  const nomes = origens.map((o) => `"${o.nome}"`).join(", ");

  return [
    `${casos} caso(s) passam de ${nomes} para "${destino.nome}" — que fica com ${destino.casos + casos}.`,
    subcategorias > 0
      ? `${subcategorias} subcategoria(s) vão para "${destino.nome}"; as de mesmo nome se juntam.`
      : null,
    macros > 0 ? `${macros} resposta(s) pronta(s) passam a ser de "${destino.nome}".` : null,
    regras > 0 ? `${regras} regra(s) de prazo passam a valer para "${destino.nome}".` : null,
    `${nomes} ficam desativadas, sem casos — dá para reativar ou excluir depois.`,
  ].filter((f): f is string => Boolean(f));
}
