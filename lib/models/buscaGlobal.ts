import type { Case } from "@/lib/models/case";
import type { Establishment } from "@/lib/models/establishment";
import type { FrenteDaJanela } from "@/lib/models/janelas";
import { segmentOf, type NpsResponseView } from "@/lib/models/nps";

/**
 * A busca global (Ctrl+K) — Fase 11 do roadmap 2.0.
 *
 * **Por que no navegador.** Casos, NPS, clientes e estabelecimentos já
 * estão em memória desde a abertura (a carga inicial). Procurar ali é
 * instantâneo e não custa uma ida ao servidor por tecla — e o Next
 * executa server actions em fila, então uma busca no servidor ainda
 * esperaria qualquer gravação em andamento. Só as conversas, que não
 * ficam em memória, vão ao servidor.
 *
 * **Como pontua.** Protocolo exato vale mais que tudo; depois o começo do
 * nome; depois o começo de qualquer palavra; depois o meio. Números
 * (telefone, CPF/CNPJ) casam pelos dígitos, com ou sem pontuação, a
 * partir de 4 dígitos. Acento e maiúscula não importam: "joao" acha
 * "João".
 */

export type TipoDoResultado = "tela" | "acao" | "caso" | "rede" | "nps" | "cliente" | "estabelecimento" | "conversa";

/** A leitura do dado, sem cor nenhuma: a tela decide como pintar. */
export type TomDoResultado = "neutro" | "bom" | "atencao" | "ruim";

export interface ResultadoDaBusca {
  tipo: TipoDoResultado;
  id: string;
  /** O nome de quem se procura — sozinho na primeira linha. */
  titulo: string;
  /**
   * A linha de apoio em texto corrido. Continua existindo por causa dos
   * recentes já guardados no navegador (que só têm título e subtítulo) e
   * de quem quiser uma linha só; a tela prefere os campos separados
   * abaixo, que ela sabe desenhar como etiqueta e código.
   */
  subtitulo?: string;
  /** Protocolo, nota do NPS: o código curto, à parte do nome. */
  marca?: string;
  /** Status — vira etiqueta colorida. */
  etiqueta?: string;
  /** A frase que explica o item: título da reclamação, cidade, empresa. */
  detalhe?: string;
  /** Só para a `marca` que tem leitura própria (a nota do NPS). */
  tom?: TomDoResultado;
  href: string;
  /** Quando dá para abrir numa mini-janela (Shift+Enter). */
  janela?: { frente: FrenteDaJanela; ref: string; titulo: string };
  pontos: number;
}

export interface TelaDaBusca {
  titulo: string;
  href: string;
  /** Outros nomes pelos quais as pessoas procuram esta tela. */
  sinonimos?: string[];
  grupo?: string;
}

/*
  Cache dos textos já normalizados: a busca roda a cada tecla sobre
  milhares de campos que não mudam. Com teto, para não crescer sem fim.
*/
const JA_NORMALIZADOS = new Map<string, string>();

export function normalizar(texto?: string | null) {
  const bruto = String(texto ?? "");
  const guardado = JA_NORMALIZADOS.get(bruto);
  if (guardado !== undefined) return guardado;
  const pronto = bruto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (JA_NORMALIZADOS.size > 20_000) JA_NORMALIZADOS.clear();
  JA_NORMALIZADOS.set(bruto, pronto);
  return pronto;
}

const digitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "");

/** A nota de um texto contra o termo — 0 quando não casa. */
export function pontuar(campo: string | undefined | null, termo: string, peso = 1): number {
  const c = normalizar(campo);
  if (!c || !termo) return 0;
  if (c === termo) return 100 * peso;
  if (c.startsWith(termo)) return 80 * peso;
  if (c.includes(` ${termo}`)) return 60 * peso;
  /* No meio da palavra só com 4 letras ou mais: "sla" não pode achar "treSLAgoas". */
  if (termo.length >= 4 && c.includes(termo)) return 40 * peso;
  return 0;
}

/** Os números casam pelos dígitos: "(11) 98765-4321" acha "11987654321". */
export function pontuarDigitos(campo: string | undefined | null, termoDigitos: string, peso = 1): number {
  if (termoDigitos.length < 4) return 0;
  const c = digitos(campo);
  if (!c) return 0;
  if (c === termoDigitos) return 90 * peso;
  if (c.includes(termoDigitos)) return 70 * peso;
  return 0;
}

/** Todos os termos têm de casar em algum campo: "joao pizzaria" acha o João da Pizzaria. */
function pontuarCampos(campos: (string | undefined | null)[], termo: string): number {
  const palavras = termo.split(" ").filter(Boolean);
  let total = 0;
  for (const p of palavras) {
    const melhor = Math.max(0, ...campos.map((c) => pontuar(c, p)));
    if (melhor === 0) return 0;
    total += melhor;
  }
  /* A frase inteira num campo só vale mais que as palavras espalhadas. */
  const inteira = Math.max(0, ...campos.map((c) => pontuar(c, termo)));
  return Math.max(total / palavras.length, inteira + 10);
}

export interface EntradaDaBusca {
  termo: string;
  telas?: TelaDaBusca[];
  casos?: Case[];
  nps?: NpsResponseView[];
  clientes?: { slug: string; name: string; email?: string; phone?: string; document?: string; city?: string; total?: number }[];
  estabelecimentos?: Pick<Establishment, "id" | "slug" | "name" | "document" | "phone" | "email" | "city" | "npsWhatsapp">[];
  limitePorTipo?: number;
}

export function buscarNaPlataforma(entrada: EntradaDaBusca): ResultadoDaBusca[] {
  const termo = normalizar(entrada.termo);
  if (!termo) return [];
  const numeros = digitos(entrada.termo);
  const limite = entrada.limitePorTipo ?? 6;
  const saida: ResultadoDaBusca[] = [];

  const guardar = (lista: ResultadoDaBusca[]) =>
    saida.push(...lista.filter((r) => r.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, limite));

  /* ---------- telas ---------- */
  guardar(
    (entrada.telas ?? []).map((t) => ({
      tipo: "tela" as const,
      id: t.href,
      titulo: t.titulo,
      subtitulo: t.grupo,
      detalhe: t.grupo,
      href: t.href,
      /* Tela ganha peso extra: quem digita "relatorio" quer ir para lá. */
      pontos: pontuarCampos([t.titulo, ...(t.sinonimos ?? [])], termo) * 1.2,
    }))
  );

  /* ---------- casos (Reclame Aqui e Redes) ---------- */
  guardar(
    (entrada.casos ?? []).map((c) => {
      const social = c.source !== "Reclame Aqui";
      const protocolo = normalizar(c.protocol);
      const pontos = Math.max(
        protocolo === termo ? 200 : protocolo.includes(termo) && termo.length >= 4 ? 120 : 0,
        pontuarCampos([c.customer, c.company, c.title, c.email, c.category], termo),
        pontuarDigitos(c.document, numeros, 1.1),
        pontuarDigitos(c.phone, numeros)
      );
      return {
        /* Redes e Reclame Aqui são o mesmo registro, mas quem procura quer
           saber em qual das duas frentes o caso está: viram dois grupos. */
        tipo: social ? ("rede" as const) : ("caso" as const),
        id: c.id,
        titulo: c.customer || c.protocol,
        subtitulo: [social ? "Redes" : "Reclame Aqui", c.status, c.title].filter(Boolean).join(" · "),
        marca: c.protocol,
        etiqueta: c.status,
        detalhe: c.title,
        href: social ? `/redes-sociais/${c.id}` : `/reclame-aqui/${c.id}`,
        janela: { frente: social ? ("redes" as const) : ("reclame-aqui" as const), ref: c.id, titulo: `${c.protocol} · ${c.customer}` },
        pontos,
      };
    })
  );

  /* ---------- NPS ---------- */
  guardar(
    (entrada.nps ?? []).map((r) => {
      const nome = r.customerName?.trim() || r.customer;
      const faixa = segmentOf(r.score).label;
      return {
        tipo: "nps" as const,
        id: r.id,
        titulo: nome,
        subtitulo: [r.company, r.status].filter(Boolean).join(" · "),
        marca: `NPS ${r.score}`,
        tom: faixa === "Detrator" ? ("ruim" as const) : faixa === "Passivo" ? ("atencao" as const) : ("bom" as const),
        etiqueta: r.status,
        detalhe: r.company,
        href: `/nps/${r.id}`,
        janela: { frente: "nps" as const, ref: r.id, titulo: `NPS ${r.score} · ${nome}` },
        pontos: Math.max(pontuarCampos([r.customerName, r.customer, r.email, r.company], termo), pontuarDigitos(r.phone, numeros)),
      };
    })
  );

  /* ---------- clientes ---------- */
  guardar(
    (entrada.clientes ?? []).map((c) => ({
      tipo: "cliente" as const,
      id: c.slug,
      titulo: c.name,
      subtitulo: [c.city, c.total ? `${c.total} reclamação(ões)` : null].filter(Boolean).join(" · "),
      etiqueta: c.total ? `${c.total} reclamação(ões)` : undefined,
      detalhe: c.city,
      href: `/clientes/${c.slug}`,
      pontos: Math.max(pontuarCampos([c.name, c.email], termo), pontuarDigitos(c.phone, numeros), pontuarDigitos(c.document, numeros, 1.1)),
    }))
  );

  /* ---------- estabelecimentos ---------- */
  guardar(
    (entrada.estabelecimentos ?? []).map((e) => ({
      tipo: "estabelecimento" as const,
      id: e.id,
      titulo: e.name,
      subtitulo: e.city,
      detalhe: e.city,
      href: `/estabelecimentos/${e.slug}`,
      pontos: Math.max(
        pontuarCampos([e.name, e.email], termo),
        pontuarDigitos(e.document, numeros, 1.1),
        pontuarDigitos(e.phone, numeros),
        pontuarDigitos(e.npsWhatsapp, numeros)
      ),
    }))
  );

  return saida;
}

/** A ordem dos grupos na lista: o que tem o melhor resultado vem primeiro. */
export function agruparResultados(resultados: ResultadoDaBusca[]) {
  const grupos = new Map<TipoDoResultado, ResultadoDaBusca[]>();
  for (const r of resultados) grupos.set(r.tipo, [...(grupos.get(r.tipo) ?? []), r]);
  return [...grupos.entries()]
    .map(([tipo, itens]) => ({ tipo, itens, melhor: Math.max(...itens.map((i) => i.pontos)) }))
    .sort((a, b) => b.melhor - a.melhor);
}

export const ROTULO_DO_TIPO: Record<TipoDoResultado, string> = {
  tela: "Telas",
  acao: "Ações",
  caso: "Reclame Aqui",
  rede: "Redes sociais",
  nps: "NPS",
  cliente: "Clientes",
  estabelecimento: "Estabelecimentos",
  conversa: "Conversas do WhatsApp",
};
