import type { ItemDaRotina } from "@/lib/models/meuDia";

/**
 * Conversas sem resposta (Fase 28, 1.108).
 *
 * "A lista de conversas do WhatsApp lida pelo navegador: quem mandou a
 * última mensagem e há quanto tempo. Viram atividade no Meu dia ('4
 * clientes esperando há mais de 1 h'), na ordem da prioridade."
 *
 * A extensão já punha o selo de espera na lista (1.81); agora manda o
 * retrato a cada minuto — só o nome que a lista mostra (ou o número do
 * contato não salvo), os minutos e as etiquetas que o próprio CW deu.
 * Mensagem nenhuma sai do WhatsApp.
 *
 * **A ordem da prioridade** é a das etiquetas, e depois a espera: quem tem
 * reclamação aberta ou é detrator (tom "perigo") vem antes de quem só está
 * esperando há mais tempo.
 */

export type TomDaEtiqueta = "perigo" | "atencao" | "ok" | "neutro";

export interface ConversaEsperando {
  /** `tel:<dígitos>` ou `nome:<nome>` — a mesma chave das etiquetas da lista. */
  chave: string;
  nome: string;
  telefone: string;
  minutos: number;
  etiquetas: { rotulo: string; tom: TomDaEtiqueta }[];
}

export interface RetratoDaEspera {
  conversas: ConversaEsperando[];
  lidoEm: string;
}

/** Retrato mais velho que isto é de um WhatsApp que fechou: não vale mais. */
export const VALIDADE_DO_RETRATO_MIN = 15;

/** A partir daqui a espera vira "há mais de 1 h" no aviso. */
export const ESPERA_LONGA_MIN = 60;

/** Abaixo disso é conversa em andamento, não espera. */
export const ESPERA_MINIMA_MIN = 5;

const TONS = new Set<TomDaEtiqueta>(["perigo", "atencao", "ok", "neutro"]);
const PESO: Record<TomDaEtiqueta, number> = { perigo: 0, atencao: 1, neutro: 2, ok: 3 };

/** O que a extensão mandou, conferido campo a campo. */
export function validarConversas(bruto: unknown): ConversaEsperando[] {
  if (!Array.isArray(bruto)) return [];
  const vistas = new Set<string>();
  const saida: ConversaEsperando[] = [];
  for (const b of bruto.slice(0, 100)) {
    if (!b || typeof b !== "object") continue;
    const c = b as Record<string, unknown>;
    const chave = String(c.chave ?? "").slice(0, 120);
    const minutos = Math.round(Number(c.minutos));
    if (!/^(tel|nome):.+/.test(chave) || !Number.isFinite(minutos) || minutos < ESPERA_MINIMA_MIN || minutos > 60 * 24 * 60 || vistas.has(chave)) continue;
    vistas.add(chave);
    const etiquetas = (Array.isArray(c.etiquetas) ? c.etiquetas : [])
      .slice(0, 4)
      .map((e) => ({ rotulo: String((e as Record<string, unknown>)?.rotulo ?? "").slice(0, 40), tom: String((e as Record<string, unknown>)?.tom ?? "neutro") as TomDaEtiqueta }))
      .filter((e) => e.rotulo)
      .map((e) => ({ ...e, tom: TONS.has(e.tom) ? e.tom : ("neutro" as const) }));
    saida.push({
      chave,
      nome: String(c.nome ?? "").trim().slice(0, 80),
      telefone: String(c.telefone ?? "").replace(/[^\d+]/g, "").slice(0, 20),
      minutos,
      etiquetas,
    });
  }
  return saida;
}

function pesoDaConversa(c: ConversaEsperando) {
  return Math.min(...c.etiquetas.map((e) => PESO[e.tom]), 2);
}

/** Na ordem da prioridade: a etiqueta mais séria primeiro, depois quem espera há mais tempo. */
export function ordenarEspera(conversas: ConversaEsperando[]) {
  return [...conversas].sort((a, b) => pesoDaConversa(a) - pesoDaConversa(b) || b.minutos - a.minutos);
}

/** O retrato só vale enquanto o WhatsApp está aberto e mandando. */
export function retratoValido(r: RetratoDaEspera | null, agora: Date): r is RetratoDaEspera {
  return !!r && agora.getTime() - Date.parse(r.lidoEm) <= VALIDADE_DO_RETRATO_MIN * 60_000;
}

export function rotuloDaEspera(minutos: number) {
  if (minutos < 60) return `espera ${minutos} min`;
  if (minutos < 1440) return `espera ${Math.floor(minutos / 60)} h${minutos % 60 >= 30 ? " e meia" : ""}`;
  if (minutos < 2880) return "espera desde ontem";
  return `espera há ${Math.floor(minutos / 1440)} dias`;
}

export const nomeDe = (c: ConversaEsperando) => c.nome || c.telefone || "Contato";

/**
 * Onde abrir a conversa (1.121): com telefone, direto nela; com só o nome
 * (contato salvo, que a lista mostra sem número), o WhatsApp Web.
 */
export function linkDaConversa(c: ConversaEsperando) {
  const digitos = c.telefone.replace(/\D/g, "");
  return digitos.length >= 10 ? `https://web.whatsapp.com/send?phone=${digitos}` : "https://web.whatsapp.com/";
}

/** Quantas esperam agora — o número do menu (1.121). Zero com o retrato vencido. */
export function quantasEsperando(r: RetratoDaEspera | null, agora: Date) {
  return retratoValido(r, agora) ? r.conversas.length : 0;
}

/** As conversas como itens da atividade "casos em aberto" do Meu dia. */
export function itensDaEspera(r: RetratoDaEspera | null, agora: Date): ItemDaRotina[] {
  if (!retratoValido(r, agora)) return [];
  return ordenarEspera(r.conversas).map((c) => {
    const serio = pesoDaConversa(c) === 0;
    const longa = c.minutos >= ESPERA_LONGA_MIN;
    return {
      id: `whatsapp:${c.chave}`,
      titulo: `${nomeDe(c)} espera resposta no WhatsApp`,
      detalhe: [rotuloDaEspera(c.minutos), ...c.etiquetas.map((e) => e.rotulo)].join(" · "),
      href: linkDaConversa(c),
      atrasado: longa,
      urgencia: serio || longa ? 0 : 1,
      critico: serio,
    };
  });
}

/** O aviso do "Pede ação agora": quantos esperam há mais de 1 h, e quem. */
export function resumoDaEspera(r: RetratoDaEspera | null, agora: Date) {
  if (!retratoValido(r, agora) || r.conversas.length === 0) return null;
  const ordenadas = ordenarEspera(r.conversas);
  const longas = ordenadas.filter((c) => c.minutos >= ESPERA_LONGA_MIN).length;
  const serias = ordenadas.filter((c) => pesoDaConversa(c) === 0).length;
  return {
    tom: (longas > 0 || serias > 0 ? "atencao" : "neutro") as "atencao" | "neutro",
    titulo:
      longas > 0
        ? `${longas} ${longas === 1 ? "cliente esperando" : "clientes esperando"} há mais de 1 h no WhatsApp`
        : `${ordenadas.length} ${ordenadas.length === 1 ? "cliente esperando" : "clientes esperando"} resposta no WhatsApp`,
    detalhe:
      serias > 0
        ? `${serias} com reclamação aberta ou detrator — na frente da lista`
        : `a mais antiga: ${rotuloDaEspera(ordenadas[0].minutos).replace("espera ", "")}`,
    quantidade: ordenadas.length,
    itens: ordenadas.slice(0, 15).map((c) => ({
      titulo: nomeDe(c),
      detalhe: [rotuloDaEspera(c.minutos), ...c.etiquetas.map((e) => e.rotulo)].join(" · "),
      href: linkDaConversa(c),
    })),
  };
}
