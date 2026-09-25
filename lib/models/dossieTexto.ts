import type { DossieMontado } from "@/lib/services/dossie.service";
import { diaNaOperacao } from "@/lib/services/reputation.service";

/**
 * O dossiê em texto único (Fase 32, 1.77).
 *
 * "Campo livre para acrescentar fatos e imagens; um texto bem escrito com
 * as situações do caso, sem etapas, que serve também às outras frentes."
 *
 * O dossiê de oito partes serve a um leitor — o moderador do Reclame
 * Aqui. Quem lê o caso por dentro (outra área, a liderança, a próxima
 * pessoa do turno) precisa de um texto corrido: quem reclamou, do quê, o
 * que aconteceu em ordem, onde está agora. Este é esse texto, escrito do
 * registro — a mesma linha do tempo do dossiê, que ninguém digita — mais
 * os fatos que só a pessoa sabe. Depois de escrito, é editável.
 */

export interface FatoDoDossie {
  id: string;
  /** AAAA-MM-DD, quando o fato aconteceu — sem data vai para o fim. */
  quando?: string;
  texto: string;
  autor?: string;
  /** Quando foi acrescentado (ISO). */
  em: string;
}

export interface ImagemDoDossieView {
  id: string;
  nome: string;
  legenda?: string;
  bytes: number;
  criadoEm: string;
}

/* O dia em Brasília: 21h de 30/08 é 30/08, e não o 31/08 do UTC. */
const dia = (iso: string) => {
  const d = (iso.length > 10 ? diaNaOperacao(iso) : iso).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
};

/** Primeira letra minúscula para caber depois de "Em 17/09/2026,". */
function emFrase(evento: string) {
  const limpo = evento.trim().replace(/\.$/, "");
  return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]/.test(limpo) ? limpo.charAt(0).toLowerCase() + limpo.slice(1) : limpo;
}

/**
 * O texto corrido, do registro e dos fatos acrescentados.
 *
 * Quatro parágrafos, sem título de seção: o caso, o que aconteceu (em
 * ordem, dia a dia, com os fatos acrescentados no lugar certo), onde está
 * agora e o que se pede — este só quando há pedido. As imagens entram
 * no fim, numeradas pela legenda.
 */
export function textoCorridoDoDossie(
  d: DossieMontado,
  entrada: { fatos?: FatoDoDossie[]; imagens?: Pick<ImagemDoDossieView, "legenda" | "nome">[]; situacao?: string } = {}
): string {
  const fatos = entrada.fatos ?? [];
  const imagens = entrada.imagens ?? [];
  const id = d.identificacao;
  const [registro, ...resto] = d.linhaDoTempo;

  const quem = d.partes.consumidor || "O consumidor";
  const onde = d.partes.estabelecimento ? `, cliente do estabelecimento ${d.partes.estabelecimento},` : "";
  const paragrafos: string[] = [
    `${quem}${onde} registrou a reclamação ${id.protocolo} (${id.canal}) em ${dia(id.abertoEm)}: "${id.titulo.trim().replace(/[.!]+$/, "")}".` +
      (d.partes.setoresAcionados.length ? ` O caso passou por ${d.partes.setoresAcionados.join(", ")}.` : ""),
  ];

  /* A linha do tempo e os fatos datados, juntos e em ordem. */
  const passos = [
    ...resto.map((e) => ({ quando: diaNaOperacao(e.quando), frase: emFrase(e.evento) })),
    ...fatos.filter((f) => f.quando).map((f) => ({ quando: f.quando!, frase: emFrase(f.texto) })),
  ].sort((a, b) => a.quando.localeCompare(b.quando));

  if (passos.length) {
    const porDia = new Map<string, string[]>();
    for (const p of passos) porDia.set(p.quando, [...(porDia.get(p.quando) ?? []), p.frase]);
    const frases = [...porDia].map(([q, lista]) => `Em ${dia(q)}, ${lista.join("; ")}.`);
    paragrafos.push(frases.join(" "));
  } else if (registro) {
    paragrafos.push("Depois do registro, ainda não há contato, área acionada nem resposta registrados.");
  }

  const semData = fatos.filter((f) => !f.quando);
  if (semData.length) paragrafos.push(`Também se sabe que ${semData.map((f) => emFrase(f.texto)).join("; ")}.`);

  if (entrada.situacao) paragrafos.push(entrada.situacao);

  const pedido = id.pedido?.trim();
  if (pedido && !/^pedido —|a definir/i.test(pedido)) paragrafos.push(`O que se pede: ${emFrase(pedido)}.`);

  if (imagens.length) {
    paragrafos.push(`Imagens anexadas: ${imagens.map((im, i) => `${i + 1}) ${im.legenda?.trim() || im.nome}`).join("; ")}.`);
  }

  return paragrafos.join("\n\n");
}

/** O fato como a pessoa escreveu, limpo — ou `null` quando não há o que guardar. */
export function fatoValido(entrada: { quando?: string; texto: string }): { quando?: string; texto: string } | null {
  const texto = entrada.texto.replace(/\s+/g, " ").trim().slice(0, 600);
  if (texto.length < 3) return null;
  const quando = /^\d{4}-\d{2}-\d{2}$/.test(entrada.quando ?? "") ? entrada.quando : undefined;
  return { quando, texto };
}

export const IMAGENS_POR_CASO = 10;
export const BYTES_POR_IMAGEM = 900_000;
export const TIPOS_DE_IMAGEM = ["image/jpeg", "image/png", "image/webp"];

/** Onde o caso está agora, numa frase — o último parágrafo antes do pedido. */
export function situacaoDoCaso(c: {
  status: string;
  publicResponseAt?: Date | string | null;
  respondida?: boolean;
  evaluated?: boolean | null;
  score?: number | null;
  resolved?: boolean | null;
  wouldDoBusiness?: boolean | null;
}): string {
  const partes = [`Hoje o caso está em "${c.status}"`];
  if (c.respondida) {
    const em = c.publicResponseAt ? (typeof c.publicResponseAt === "string" ? c.publicResponseAt : c.publicResponseAt.toISOString()) : "";
    partes.push(em ? `a resposta pública foi publicada em ${dia(em)}` : "a resposta pública foi publicada");
  } else {
    partes.push("ainda sem resposta pública");
  }
  if (c.evaluated) {
    partes.push(`o consumidor avaliou com nota ${c.score ?? "—"}, ${c.resolved ? "resolvido" : "não resolvido"}${c.wouldDoBusiness ? ", e voltaria a fazer negócio" : ""}`);
  }
  return `${partes.join("; ")}.`;
}
