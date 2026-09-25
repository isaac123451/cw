/**
 * Etiquetas na lista de conversas do WhatsApp (1.84).
 *
 * "Que ela deixe algo parecido também informando que é 'redes sociais',
 * 'detrator - NPS', coisas assim." Ao lado do nome de cada conversa, o
 * que o CW sabe daquele contato: reclamação aberta no Reclame Aqui, caso
 * aberto nas Redes, e a última nota do NPS. A regra é pura — o índice vem
 * do banco (`app/api/extensao/etiquetas-lista`).
 *
 * Quem é quem: pelo telefone (os 8 últimos dígitos, que sobrevivem ao
 * nono dígito e ao DDI) ou pelo nome **completo e exato**, com duas
 * palavras ou mais — "João" sozinho não etiqueta ninguém.
 */

export type TomDaEtiqueta = "perigo" | "atencao" | "ok" | "neutro";

export interface EtiquetaDaLista {
  rotulo: string;
  tom: TomDaEtiqueta;
}

export interface FichaDoIndice {
  tipo: "ra" | "redes" | "nps";
  /** Urgente, Alta, Normal (casos) ou a nota (NPS). */
  prioridade?: string;
  nota?: number;
  /** ISO: o mais recente vence entre fichas do mesmo tipo. */
  quando: string;
}

export const DIAS_DO_NPS = 180;

export function chaveDoTelefone(bruto?: string | null) {
  const d = String(bruto ?? "").replace(/\D/g, "");
  return d.length >= 10 && !String(bruto ?? "").includes("•") ? d.slice(-8) : null;
}

export function chaveDoNome(bruto?: string | null) {
  const n = String(bruto ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return n.split(" ").filter((p) => p.length >= 2).length >= 2 ? n : null;
}

/** As etiquetas de um contato, pelas fichas que o índice achou para ele. */
export function etiquetasDasFichas(fichas: FichaDoIndice[]): EtiquetaDaLista[] {
  const saida: EtiquetaDaLista[] = [];
  const ra = fichas.filter((f) => f.tipo === "ra");
  if (ra.length) saida.push({ rotulo: ra.length > 1 ? `Reclame Aqui (${ra.length})` : "Reclame Aqui", tom: ra.some((f) => f.prioridade === "Urgente") ? "perigo" : "atencao" });
  if (fichas.some((f) => f.tipo === "redes")) saida.push({ rotulo: "Redes sociais", tom: "atencao" });
  const nps = fichas.filter((f) => f.tipo === "nps").sort((a, b) => b.quando.localeCompare(a.quando))[0];
  if (nps && typeof nps.nota === "number") {
    saida.push(
      nps.nota <= 6
        ? { rotulo: `Detrator · NPS ${nps.nota}`, tom: "perigo" }
        : nps.nota >= 9
          ? { rotulo: `Promotor · NPS ${nps.nota}`, tom: "ok" }
          : { rotulo: `Neutro · NPS ${nps.nota}`, tom: "neutro" }
    );
  }
  return saida.slice(0, 3);
}
