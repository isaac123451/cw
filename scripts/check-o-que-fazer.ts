/**
 * "O que fazer em cada reclamação" — a frase de cada situação.
 *
 *   npm run check:o-que-fazer
 *
 * Sem banco. Casos montados à mão, um por situação, passando pela trilha
 * de verdade (`proximoPasso`) e por `oQueFazer`.
 */
import type { Case } from "../lib/models/case";
import { canaisSemResposta, oQueFazer, type ContextoDoConselho } from "../lib/models/oQueFazer";
import { proximoPasso } from "../lib/models/trilha";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(58)} ${String(JSON.stringify(obtido)).slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(58)} ${String(JSON.stringify(esperado)).slice(0, 60)}`);
}

const agora = new Date("2026-09-24T15:00:00Z");

function caso(extra: Partial<Case>): Case {
  return {
    id: "c1",
    protocol: "RA-1",
    source: "Reclame Aqui",
    title: "Pedido não chegou",
    customer: "Ana",
    company: "Loja",
    status: "Em tratativa",
    priority: "Normal",
    createdAt: "2026-09-22",
    ...extra,
  } as Case;
}

function frase(item: Case, contexto: ContextoDoConselho = {}) {
  const passo = proximoPasso(item, { agora, validacao: contexto.validacao, areaAberta: contexto.area });
  return oQueFazer(item, passo, { agora, ...contexto });
}

console.log("\n  O QUE FAZER — uma frase por situação\n");

const triada = { triadaEm: "2026-09-22T12:00:00Z", imersaoEm: "2026-09-22T12:10:00Z" };
const contatada = { ...triada, primeiroContatoEm: "2026-09-22T13:00:00Z", ultimoContatoEm: "2026-09-23T13:00:00Z" };

conferir("sem triagem há 2 dias: urgente", [frase(caso({}))?.frase, frase(caso({}))?.urgente], ["Há 2 dias sem triagem: classifique a urgência", true]);
conferir("triada, sem imersão", frase(caso({ triadaEm: "2026-09-22T12:00:00Z" }))?.acao, "imersao");
conferir("3 tentativas por WhatsApp e telefone: e-mail", frase(caso({ ...contatada, tentativasSemResposta: 3 }), { canaisSemResposta: ["WhatsApp", "Telefone"] }), {
  frase: "Várias tentativas sem sucesso: tente por e-mail",
  porque: "3 tentativas seguidas sem resposta por WhatsApp e Telefone.",
  acao: "tentativa",
  canal: "E-mail",
});
conferir("janela de 7 dias passou (2 tentativas): esgotada", frase(caso({ ...contatada, tentativasSemResposta: 2, primeiraTentativaEm: "2026-09-15T13:00:00Z" }), { canaisSemResposta: ["WhatsApp"] })?.acao, "resposta");
conferir("janela ainda aberta (2 tentativas): e-mail", frase(caso({ ...contatada, tentativasSemResposta: 2, primeiraTentativaEm: "2026-09-19T13:00:00Z" }), { canaisSemResposta: ["WhatsApp"] })?.canal, "E-mail");
conferir("e-mail já tentado: portal do RA", frase(caso({ ...contatada, tentativasSemResposta: 2 }), { canaisSemResposta: ["WhatsApp", "E-mail"] })?.canal, "Portal RA");
conferir("5 tentativas: mensagem transparente, urgente", [frase(caso({ ...contatada, tentativasSemResposta: 5 }))?.acao, frase(caso({ ...contatada, tentativasSemResposta: 5 }))?.urgente], ["resposta", true]);
conferir("contato ontem, sem tentativa: tente de novo", frase(caso(contatada))?.frase, "Sem retorno desde 23/09: tente de novo");
conferir("área com prazo vencido: cobrar", frase(caso({ ...contatada, ultimaRespostaEm: "2026-09-23T14:00:00Z" }), { area: { destino: "Financeiro", vencida: true } })?.frase, "O prazo de Financeiro passou: cobre a área e avise o cliente");
conferir("pendência apontada: resolver", frase(caso({ ...contatada, ultimaRespostaEm: "2026-09-23T14:00:00Z" }), { validacao: { pendencia: { em: "2026-09-23T14:00:00Z", nota: "O cliente: a impressora ainda falha" } } as ContextoDoConselho["validacao"] })?.porque, "a impressora ainda falha");
conferir("validado: responda a reclamação", frase(caso({ ...contatada, ultimaRespostaEm: "2026-09-23T14:00:00Z", validadoEm: "2026-09-24T12:00:00Z" }))?.frase, "O objetivo foi cumprido: responda a reclamação");
conferir("réplica do consumidor: urgente", frase(caso({ ...contatada, status: "Aguardando nossa réplica", publicResponse: "Olá", publicResponseAt: "2026-09-23T12:00:00Z", respondida: true }))?.frase, "O consumidor respondeu no portal: responda a réplica");
conferir("respondida: peça a avaliação", frase(caso({ ...contatada, validadoEm: "2026-09-23T12:00:00Z", status: "Respondida", publicResponse: "Olá", publicResponseAt: "2026-09-23T12:00:00Z", respondida: true }))?.acao, "pedir-avaliacao");
conferir("avaliada: nada a fazer", frase(caso({ ...contatada, status: "Resolvido", evaluated: true, respondida: true, publicResponse: "Olá" })), null);

conferir(
  "canais das tentativas depois da última resposta",
  canaisSemResposta([
    { tipo: "tentativa", canal: "Telefone", resultado: "nao-atendeu", em: "2026-09-20T12:00:00Z" },
    { tipo: "contato", canal: "WhatsApp", resultado: "respondeu", em: "2026-09-21T12:00:00Z" },
    { tipo: "tentativa", canal: "WhatsApp", resultado: "sem-resposta", em: "2026-09-22T12:00:00Z" },
    { tipo: "tentativa", canal: "WhatsApp", resultado: "sem-resposta", em: "2026-09-23T12:00:00Z" },
    { tipo: "tentativa", canal: "E-mail", resultado: "aguardando", em: "2026-09-24T12:00:00Z" },
  ]),
  ["WhatsApp"]
);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
