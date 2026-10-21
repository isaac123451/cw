/**
 * As tags que a IA põe e tira (21/10/2026). Sem banco.
 *
 *   npm run check:tags-automaticas
 */
import { mudancasDeTags, TAG_CANCELAMENTO, TAG_POSITIVA, TAG_REINCIDENTE, TAG_RESPOSTA_ATE_30, TAG_RISCO, type CasoParaTags } from "../lib/models/tagsAutomaticas";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}
const caso = (id: string, x: Partial<CasoParaTags>): CasoParaTags => ({ id, protocolo: `RA-${id}`, status: "Aguardando avaliação", avaliado: false, respondido: true, criadoEm: "2026-10-01", tags: [], ...x });
const vazio = { naRetencao: new Set<string>(), riscoAlto: new Set<string>(), termometro: new Map() };
const tem = (m: ReturnType<typeof mudancasDeTags>, id: string, tag: string, acao: "por" | "tirar") => m.some((x) => x.caseId === id && x.tag === tag && x.acao === acao);

const m1 = mudancasDeTags([caso("A", { avaliado: true, status: "Resolvido", tags: [TAG_POSITIVA, TAG_RISCO] })], vazio);
ok("avaliada: tira as tags de previsão", tem(m1, "A", TAG_POSITIVA, "tirar") && tem(m1, "A", TAG_RISCO, "tirar"));

const m2 = mudancasDeTags([caso("B", { documento: "123.456.789-01", criadoEm: "2026-09-01" }), caso("C", { documento: "12345678901", criadoEm: "2026-10-15" })], vazio);
ok("mesmo CPF em 90 dias: a segunda é reincidente", tem(m2, "C", TAG_REINCIDENTE, "por") && !tem(m2, "B", TAG_REINCIDENTE, "por"));

const m3 = mudancasDeTags([caso("D", { documento: "12345678901", criadoEm: "2026-01-01" }), caso("E", { documento: "12345678901", criadoEm: "2026-10-15" })], vazio);
ok("mais de 90 dias depois: não é reincidente", !tem(m3, "E", TAG_REINCIDENTE, "por"));

const m4 = mudancasDeTags([caso("F", {})], { ...vazio, naRetencao: new Set(["RA-F"]) });
ok("na Retenção: Cancelamento de plano", tem(m4, "F", TAG_CANCELAMENTO, "por"));

const m5 = mudancasDeTags([caso("G", {})], { ...vazio, termometro: new Map([["G", { satisfacao: 9, notaPrevista: 9, chanceResolvido: 80 }]]) });
ok("termômetro favorável e respondida: possível avaliação positiva", tem(m5, "G", TAG_POSITIVA, "por"));

const m6 = mudancasDeTags([caso("H", { tags: [TAG_POSITIVA] })], { ...vazio, riscoAlto: new Set(["RA-H"]) });
ok("risco alto: põe risco e tira a positiva", tem(m6, "H", TAG_RISCO, "por") && tem(m6, "H", TAG_POSITIVA, "tirar"));

const m7 = mudancasDeTags([caso("I", { tags: [TAG_RESPOSTA_ATE_30] })], vazio);
ok("respondida: tira 'Resposta até o dia 30'", tem(m7, "I", TAG_RESPOSTA_ATE_30, "tirar"));

const m8 = mudancasDeTags([caso("J", { tags: [TAG_CANCELAMENTO, TAG_REINCIDENTE], avaliado: true, status: "Resolvido" })], vazio);
ok("fatos não saem quando o caso fecha", m8.length === 0, JSON.stringify(m8));

console.log(`\n${falhas === 0 ? "tudo certo" : `${falhas} falha(s)`}`);
process.exit(falhas === 0 ? 0 : 1);
