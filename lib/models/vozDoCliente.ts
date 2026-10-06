import { familiaDoTexto } from "@/lib/models/catalogoDeCausas";
import { pluralDe } from "@/lib/plural";

/**
 * A voz do cliente para o Produto (Fase 31, 1.104).
 *
 * "Todo mês, as causas que mais pesaram, com citações reais e o efeito na
 * nota, pronto para a reunião com Produto." Por causa raiz, somando o
 * Reclame Aqui, as Redes e o NPS do mês: quantas vezes apareceu em cada
 * frente, duas ou três frases de quem reclamou (as mais curtas que ainda
 * dizem algo), e o efeito — a nota média das avaliações do Reclame Aqui
 * dessa causa contra a geral, e quantos detratores do NPS ela trouxe.
 *
 * Sem causa marcada, vale o tema reconhecido pelo texto (a família de causa
 * do catálogo) — em setembro/2026 só 11 registros tinham a causa marcada.
 * "Outro" não entra no topo: não é assunto para o Produto.
 */

export interface RegistroDaVoz {
  frente: "reclame-aqui" | "redes" | "nps";
  /** A causa marcada; vazia, o texto decide o tema. */
  causa?: string;
  em: string;
  texto: string;
  /** A frase para citar: o título da reclamação, o começo do comentário do NPS. */
  citacao?: string;
  /** Nota da avaliação (RA, 0–10) ou do NPS (0–10). */
  nota?: number;
  /** Avaliação do Reclame Aqui. */
  avaliada?: boolean;
  resolvida?: boolean;
}

export interface CausaDaVoz {
  causa: string;
  total: number;
  porFrente: Record<RegistroDaVoz["frente"], number>;
  citacoes: string[];
  /** Nota média das avaliações do RA dessa causa (no mês), e quantas. */
  notaDoRA: number | null;
  avaliacoes: number;
  detratores: number;
}

export interface VozDoMes {
  mes: string;
  total: number;
  notaGeralDoRA: number | null;
  causas: CausaDaVoz[];
}

function citacao(texto: string) {
  const frases = texto
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 25 && f.length <= 180 && !/@|\d{4,}/.test(f));
  return frases.sort((a, b) => a.length - b.length)[0] ?? null;
}

export function vozDoMes(registros: RegistroDaVoz[], mes: string, top = 5): VozDoMes {
  const doMes = registros
    .filter((r) => r.em.slice(0, 7) === mes)
    .map((r) => ({ ...r, causa: r.causa && !/^(n[ãa]o (definid|classificad)|outro)/i.test(r.causa) ? r.causa : familiaDoTexto(r.texto)?.nome }))
    .filter((r): r is RegistroDaVoz & { causa: string } => Boolean(r.causa));
  const avaliadasRA = doMes.filter((r) => r.frente === "reclame-aqui" && r.avaliada && r.nota != null);
  const notaGeral = avaliadasRA.length ? avaliadasRA.reduce((s, r) => s + (r.nota ?? 0), 0) / avaliadasRA.length : null;

  const grupos = new Map<string, (RegistroDaVoz & { causa: string })[]>();
  for (const r of doMes) grupos.set(r.causa, [...(grupos.get(r.causa) ?? []), r]);

  const causas = [...grupos.entries()]
    .map(([causa, rs]) => {
      const av = rs.filter((r) => r.frente === "reclame-aqui" && r.avaliada && r.nota != null);
      const citacoes = [...new Set(rs.map((r) => (r.citacao && r.citacao.length >= 15 ? r.citacao : citacao(r.texto))).filter((c): c is string => Boolean(c)))].slice(0, 3);
      return {
        causa,
        total: rs.length,
        porFrente: {
          "reclame-aqui": rs.filter((r) => r.frente === "reclame-aqui").length,
          redes: rs.filter((r) => r.frente === "redes").length,
          nps: rs.filter((r) => r.frente === "nps").length,
        },
        citacoes,
        notaDoRA: av.length ? av.reduce((s, r) => s + (r.nota ?? 0), 0) / av.length : null,
        avaliacoes: av.length,
        detratores: rs.filter((r) => r.frente === "nps" && (r.nota ?? 10) <= 6).length,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, top);

  return { mes, total: doMes.length, notaGeralDoRA: notaGeral, causas };
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** O texto para a reunião (e para colar no Slack). */
export function textoDaVoz(v: VozDoMes) {
  const [a, m] = v.mes.split("-").map(Number);
  const um = (n: number) => n.toFixed(1).replace(".", ",");
  const linhas = [`*Voz do cliente — ${MESES[m - 1]} de ${a}*`, `${v.total} registros com causa no mês (marcada ou pelo texto)${v.notaGeralDoRA != null ? ` · nota média das avaliações do RA: ${um(v.notaGeralDoRA)}` : ""}.`, ""];
  v.causas.forEach((c, i) => {
    const frentes = [c.porFrente["reclame-aqui"] ? `${c.porFrente["reclame-aqui"]} no RA` : null, c.porFrente.redes ? `${c.porFrente.redes} nas Redes` : null, c.porFrente.nps ? `${c.porFrente.nps} no NPS` : null].filter(Boolean).join(", ");
    const efeito = [c.notaDoRA != null ? `nota do RA ${um(c.notaDoRA)} em ${c.avaliacoes} ${pluralDe(c.avaliacoes, "avaliação", "avaliações")}` : null, c.detratores ? `${c.detratores} ${pluralDe(c.detratores, "detrator", "detratores")}` : null].filter(Boolean).join(" · ");
    linhas.push(`${i + 1}. *${c.causa}* — ${c.total} (${frentes})${efeito ? ` · ${efeito}` : ""}`);
    for (const q of c.citacoes) linhas.push(`   “${q}”`);
  });
  return linhas.join("\n");
}
