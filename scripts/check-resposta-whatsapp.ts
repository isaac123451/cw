/**
 * A taxa de resposta no WhatsApp do NPS conta certo?
 *
 *   npm run check:resposta-whatsapp
 *
 * Sem banco (09/11/2026): só tentativas pelo WhatsApp (maiúscula ou não),
 * dentro do período; cada resposta de NPS uma vez; separada por segmento.
 */
import { respostaNoWhatsapp } from "../lib/services/nps.service";
import type { NpsResponseView } from "../lib/models/nps";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${JSON.stringify(esperado)}`);
}
const t = (channel: string, resultado: string, createdAt = "2026-11-05T12:00:00Z") => ({ id: Math.random().toString(), channel, resultado, createdAt, note: "", actor: "" });
const nps = (score: number, attempts: ReturnType<typeof t>[]) => ({ id: Math.random().toString(), score, attempts }) as unknown as NpsResponseView;

const itens = [
  nps(2, [t("WhatsApp", "sem-resposta"), t("whatsapp", "respondeu")]),
  nps(3, [t("WhatsApp", "aguardando")]),
  nps(5, [t("E-mail", "respondeu")]),
  nps(10, [t("WhatsApp", "respondeu")]),
  nps(1, [t("WhatsApp", "respondeu", "2026-09-01T12:00:00Z")]),
];
const r = respostaNoWhatsapp(itens, (iso) => Boolean(iso) && iso! >= "2026-11-01");
conferir("só quem recebeu pelo WhatsApp no período (3)", r.contatados, 3);
conferir("responderam: o detrator com 2 tentativas conta uma vez, e o promotor", r.responderam, 2);
conferir("taxa 67%", r.percentual, 67);
conferir("e-mail não entra", r.porSegmento.Passivo.contatados, 0);
conferir("detratores: 1 de 2", [r.porSegmento.Detrator.responderam, r.porSegmento.Detrator.contatados], [1, 2]);
conferir("sem ninguém: sem taxa", respostaNoWhatsapp([]).percentual, null);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
