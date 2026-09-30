import { familiaDaCausa, familiaDoTexto } from "@/lib/models/catalogoDeCausas";

/**
 * O radar de incidente (Fase 31, 1.102).
 *
 * "Várias reclamações sobre o mesmo tema em poucas horas (Reclame Aqui,
 * Redes, NPS e conversas) viram alerta de incidente, com a lista dos
 * afetados." O tema é a família de causa do catálogo (a mesma que sugere a
 * causa raiz): reconhecida pelo texto, ou pela causa já marcada no caso.
 * Três ou mais **clientes diferentes** no mesmo tema dentro da janela
 * (6 horas) é incidente — a mesma pessoa mandando três mensagens não é.
 *
 * Só entram os temas que são **falha da plataforma** (impressão, iFood,
 * WhatsApp, sistema fora do ar, repasse, fiscal, cobrança, cardápio,
 * entrega, cupom). Demora de retorno, pedido de cancelamento, postura,
 * dúvida de uso, promessa da venda e o pedido do consumidor ao restaurante
 * são volume de atendimento, não incidente — medido nos últimos 60 dias,
 * eles acendiam o radar todo dia.
 */

export interface SinalParaRadar {
  frente: "reclame-aqui" | "redes" | "nps" | "conversa";
  /** Quem é — para contar clientes, e não mensagens. */
  cliente: string;
  quando: string;
  texto: string;
  causa?: string;
  href?: string;
  rotulo: string;
}

export interface Incidente {
  tema: string;
  temaId: string;
  clientes: number;
  frentes: SinalParaRadar["frente"][];
  desde: string;
  afetados: { rotulo: string; href?: string; frente: SinalParaRadar["frente"]; quando: string }[];
}

export const JANELA_DO_RADAR_HORAS = 6;
export const MINIMO_DO_RADAR = 3;
const TEMAS_DE_INCIDENTE = new Set(["impressao", "integracao", "whatsapp", "fora-do-ar", "repasse", "fiscal", "cobranca", "cobranca-pos-cancelamento", "cardapio", "entrega", "cupom"]);

export function radarDeIncidente(sinais: SinalParaRadar[], agora = new Date(), janelaHoras = JANELA_DO_RADAR_HORAS): Incidente[] {
  const desde = agora.getTime() - janelaHoras * 3_600_000;
  const grupos = new Map<string, { tema: string; clientes: Set<string>; itens: SinalParaRadar[] }>();

  for (const s of sinais) {
    const t = Date.parse(s.quando);
    if (!Number.isFinite(t) || t < desde || t > agora.getTime()) continue;
    const familia = (s.causa ? familiaDaCausa(s.causa) : undefined) ?? familiaDoTexto(s.texto);
    if (!familia || !TEMAS_DE_INCIDENTE.has(familia.id)) continue;
    const g = grupos.get(familia.id) ?? { tema: familia.nome, clientes: new Set<string>(), itens: [] };
    g.clientes.add(s.cliente.trim().toLowerCase() || s.rotulo);
    g.itens.push(s);
    grupos.set(familia.id, g);
  }

  return [...grupos.entries()]
    .filter(([, g]) => g.clientes.size >= MINIMO_DO_RADAR)
    .map(([temaId, g]) => {
      const itens = [...g.itens].sort((a, b) => a.quando.localeCompare(b.quando));
      return {
        tema: g.tema,
        temaId,
        clientes: g.clientes.size,
        frentes: [...new Set(itens.map((i) => i.frente))],
        desde: itens[0].quando,
        afetados: itens.map((i) => ({ rotulo: i.rotulo, href: i.href, frente: i.frente, quando: i.quando })),
      };
    })
    .sort((a, b) => b.clientes - a.clientes);
}
