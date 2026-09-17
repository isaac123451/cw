/**
 * Segmentos das Redes: de onde veio, qual rede, o assunto, a gravidade,
 * o alcance e o estabelecimento.
 *
 * **O pedido.** Com a planilha e o Slack trazendo casos, a pergunta
 * deixa de ser "quantos" e vira "quantos de quê": quantos vieram do Slack,
 * quantos perfis grandes, qual estabelecimento concentra menções.
 *
 * **Filtros facetados.** Cada dimensão conta os casos que passam pelos
 * filtros **das outras** dimensões: com "Instagram" escolhido, a contagem
 * de Rede continua mostrando o Facebook (para trocar), e a de Gravidade
 * já conta só o Instagram. É o jeito de o número ao lado do filtro dizer
 * o que acontece ao clicar nele.
 *
 * Sem React, para a conferência provar sem tela.
 */
import type { Case } from "@/lib/models/case";
import { prioridadeNormalizada } from "@/lib/models/case";
import { SEGUIDORES_DE_ALCANCE } from "@/lib/models/redes";

export type DimensaoDasRedes = "origem" | "rede" | "tipo" | "gravidade" | "alcance" | "estabelecimento";

export const DIMENSOES_DAS_REDES: { id: DimensaoDasRedes; nome: string }[] = [
  { id: "origem", nome: "Origem" },
  { id: "rede", nome: "Rede" },
  { id: "tipo", nome: "Assunto" },
  { id: "gravidade", nome: "Gravidade" },
  { id: "alcance", nome: "Alcance" },
  { id: "estabelecimento", nome: "Estabelecimento" },
];

/** A ordem de exibição dos valores que têm ordem natural. */
const ORDEM: Partial<Record<DimensaoDasRedes, string[]>> = {
  origem: ["Planilha", "Slack", "Registro manual"],
  rede: ["Instagram", "Facebook", "WhatsApp", "ManyChat"],
  gravidade: ["Urgente", "Alta", "Normal"],
  alcance: ["10 mil ou mais", "1 a 10 mil", "Até 1 mil", "Sem o dado"],
};

export type Filtros = Partial<Record<DimensaoDasRedes, string[]>>;

/** A origem sai da chave externa que a captura grava: `planilha:` e `slack:`. */
export function origemDoCaso(c: Pick<Case, "id">) {
  if (c.id.startsWith("planilha:")) return "Planilha";
  if (c.id.startsWith("slack:")) return "Slack";
  return "Registro manual";
}

export function alcanceDoCaso(c: Pick<Case, "followers">) {
  const n = c.followers;
  if (n == null) return "Sem o dado";
  if (n >= SEGUIDORES_DE_ALCANCE) return "10 mil ou mais";
  if (n >= 1_000) return "1 a 10 mil";
  return "Até 1 mil";
}

export function segmentoDoCaso(
  c: Pick<Case, "id" | "source" | "category" | "priority" | "followers" | "establishmentId">,
  nomeDoEstabelecimento: (id: string) => string | undefined
): Record<DimensaoDasRedes, string> {
  return {
    origem: origemDoCaso(c),
    rede: c.source,
    tipo: c.category && !/^n[ãa]o classificad/i.test(c.category) ? c.category : "Sem assunto",
    gravidade: prioridadeNormalizada(c.priority),
    alcance: alcanceDoCaso(c),
    estabelecimento: c.establishmentId ? nomeDoEstabelecimento(c.establishmentId) ?? "Estabelecimento sem nome" : "Sem vínculo",
  };
}

function passa(seg: Record<DimensaoDasRedes, string>, filtros: Filtros, ignorar?: DimensaoDasRedes) {
  return DIMENSOES_DAS_REDES.every(({ id }) => {
    if (id === ignorar) return true;
    const escolhidos = filtros[id];
    return !escolhidos || escolhidos.length === 0 || escolhidos.includes(seg[id]);
  });
}

export interface Faceta {
  valor: string;
  total: number;
  ativo: boolean;
}

/**
 * Os casos filtrados e, para cada dimensão, os valores com a contagem.
 *
 * Um valor escolhido que zerou continua na lista (com 0): sumir com ele
 * esconderia o filtro que está zerando a tela.
 */
export function segmentar<T extends Pick<Case, "id" | "source" | "category" | "priority" | "followers" | "establishmentId">>(
  casos: T[],
  filtros: Filtros,
  nomeDoEstabelecimento: (id: string) => string | undefined,
  limitePorDimensao = 8
): { casos: T[]; facetas: Record<DimensaoDasRedes, Faceta[]> } {
  const segs = casos.map((c) => ({ c, s: segmentoDoCaso(c, nomeDoEstabelecimento) }));
  const filtrados = segs.filter(({ s }) => passa(s, filtros)).map(({ c }) => c);

  const facetas = {} as Record<DimensaoDasRedes, Faceta[]>;
  for (const { id } of DIMENSOES_DAS_REDES) {
    const conta = new Map<string, number>();
    for (const { s } of segs) if (passa(s, filtros, id)) conta.set(s[id], (conta.get(s[id]) ?? 0) + 1);
    for (const v of filtros[id] ?? []) if (!conta.has(v)) conta.set(v, 0);

    const ordem = ORDEM[id];
    const lista = [...conta.entries()]
      .map(([valor, total]) => ({ valor, total, ativo: Boolean(filtros[id]?.includes(valor)) }))
      .sort((a, b) =>
        ordem
          ? (ordem.indexOf(a.valor) + 1 || 99) - (ordem.indexOf(b.valor) + 1 || 99)
          : b.total - a.total || a.valor.localeCompare(b.valor, "pt-BR")
      );
    /* Os escolhidos sempre aparecem, mesmo fora dos mais frequentes. */
    const primeiros = lista.slice(0, limitePorDimensao);
    facetas[id] = [...primeiros, ...lista.slice(limitePorDimensao).filter((f) => f.ativo)];
  }
  return { casos: filtrados, facetas };
}

export function alternarFiltro(filtros: Filtros, dimensao: DimensaoDasRedes, valor: string): Filtros {
  const atuais = filtros[dimensao] ?? [];
  const novos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];
  const resultado = { ...filtros, [dimensao]: novos };
  if (novos.length === 0) delete resultado[dimensao];
  return resultado;
}

export function filtrosAtivos(filtros: Filtros) {
  return Object.values(filtros).reduce((n, v) => n + (v?.length ?? 0), 0);
}

/** `?rede=Instagram,Facebook&origem=Slack` ⇄ filtros — o recorte vira link. */
export function filtrosDoEndereco(params: URLSearchParams): Filtros {
  const filtros: Filtros = {};
  for (const { id } of DIMENSOES_DAS_REDES) {
    const v = params.get(id);
    if (v) filtros[id] = v.split(",").map((x) => x.trim()).filter(Boolean);
  }
  /* O link antigo dos gráficos (`?categoria=`) continua valendo. */
  const categoria = params.get("categoria");
  if (categoria && !filtros.tipo) filtros.tipo = [categoria];
  return filtros;
}

export function enderecoDosFiltros(filtros: Filtros) {
  const p = new URLSearchParams();
  for (const { id } of DIMENSOES_DAS_REDES) if (filtros[id]?.length) p.set(id, filtros[id]!.join(","));
  return p.toString();
}
