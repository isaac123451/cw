/**
 * Disparos em lote (1.78) — o que a tela e o servidor dividem.
 *
 * O serviço (`lib/services/disparos.service.ts`) grava; aqui ficam as
 * regras puras, que a tela usa sem levar o servidor junto.
 */

export const POR_LOTE = 10;
/** O intervalo entre um envio e a próxima conversa, em segundos: sorteado nesta faixa. */
export const INTERVALO_S: [number, number] = [35, 50];
export const TETO_DE_ITENS = 200;

export type OrigemDoDisparo = "premio" | "avaliacao";

export interface ItemNovo {
  nome: string;
  telefone: string;
  mensagem: string;
  ref?: string;
}

export interface LoteView {
  id: string;
  nome: string;
  origem: OrigemDoDisparo;
  situacao: string;
  criadoEm: string;
  total: number;
  enviados: number;
  pulados: number;
  pendentes: number;
}

/** Só dígitos, com o 55 na frente; `null` quando não é um telefone do Brasil (ou está mascarado). */
export function telefoneDoDisparo(bruto: string): string | null {
  if (String(bruto ?? "").includes("•")) return null;
  let d = String(bruto ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d.startsWith("55") && (d.length === 12 || d.length === 13) ? d : null;
}

/** Os itens que valem: telefone bom, mensagem escrita, uma vez por telefone. */
export function itensValidos(itens: ItemNovo[]): (ItemNovo & { telefone: string })[] {
  const vistos = new Set<string>();
  const saida: (ItemNovo & { telefone: string })[] = [];
  for (const i of itens) {
    const telefone = telefoneDoDisparo(i.telefone);
    const mensagem = String(i.mensagem ?? "").trim();
    if (!telefone || !mensagem || vistos.has(telefone)) continue;
    vistos.add(telefone);
    saida.push({ nome: String(i.nome ?? "").trim().slice(0, 200) || "Cliente", telefone, mensagem: mensagem.slice(0, 4000), ref: i.ref?.slice(0, 200) });
    if (saida.length >= TETO_DE_ITENS) break;
  }
  return saida;
}
