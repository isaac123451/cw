/**
 * Prova da trilha do NPS e das travas de encerramento — sem banco.
 *
 * A ficha nova diz o passo da vez e só encerra com o que o guia pede. Aqui
 * cada situação do guia vira um caso: sem tipo, sem causa, prazo
 * estourado, tentativa sem retorno, conversa sem confirmação, promotor,
 * engano, falta de retorno, ciclo fechado, promotor calado.
 *
 *   npm run check:trilha-nps
 */
import type { NpsResponseView } from "../lib/models/nps";
import { mensagemDeReengajamento, trilhaDoNps, venceEm } from "../lib/models/trilhaNps";
import { deveEncerrarSemRetorno, motivoParaNaoEncerrar } from "../lib/services/nps.service";
import { instanteDe } from "../lib/services/horasUteis";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

function br(texto: string) {
  const [dia, hora] = texto.split(" ");
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m).toISOString();
}

let seq = 0;
function resposta(campos: Partial<NpsResponseView>): NpsResponseView {
  seq += 1;
  return {
    id: `r${seq}`,
    score: 3,
    comment: "O sistema caiu no sábado.",
    respondedAt: br("2026-09-14 09:00"),
    customer: `cliente${seq}`,
    status: "Novo",
    firstContactDueAt: br("2026-09-15 09:00"),
    reviewAsked: false,
    testimonialAsked: false,
    referralAsked: false,
    source: "Wootric",
    churnRisk: false,
    attempts: [],
    wootricNotes: [],
    notes: [],
    ...campos,
  };
}

const tentativa = (quando: string, i = 0) => ({ id: `t${i}-${quando}`, channel: "WhatsApp", note: "caixa postal", actor: "Isaac", createdAt: br(quando) });

const agora = new Date(br("2026-09-14 15:00"));
const atual = (item: NpsResponseView, quando = agora) => trilhaDoNps(item, { agora: quando }).find((p) => p.estado === "atual");
const passo = (item: NpsResponseView, id: string, quando = agora) => trilhaDoNps(item, { agora: quando }).find((p) => p.id === id);

console.log("\n— O passo da vez —");
const novo = resposta({});
confere("sem tipo: classificar", atual(novo)?.id, "classificar");
confere("o contato mostra quanto falta do prazo", passo(novo, "contato")?.detalhe?.startsWith("Vence em"), true);

const semCausa = resposta({ kind: "Reclamação" });
confere("Reclamação sem causa: ainda classificar", atual(semCausa)?.id, "classificar");
confere("e diz que falta a causa", atual(semCausa)?.detalhe, "Reclamação pede a causa raiz — é ela que mostra a tendência.");

const estourado = resposta({ kind: "Reclamação", rootCause: "Bug" });
const depoisDoPrazo = new Date(br("2026-09-15 11:00"));
confere("classificado e sem contato: 1º contato", atual(estourado, depoisDoPrazo)?.id, "contato");
confere("fora do prazo, o passo acende", atual(estourado, depoisDoPrazo)?.alerta, true);
confere("e diz há quanto tempo", atual(estourado, depoisDoPrazo)?.detalhe?.startsWith("Fora do prazo há 2h"), true);

const tentado = resposta({ kind: "Reclamação", rootCause: "Bug", firstContactAt: br("2026-09-14 10:00"), attempts: [tentativa("2026-09-14 10:00")] });
confere("tentou (conta como 1º contato): registrar o retorno", atual(tentado)?.id, "retorno");
confere("1º contato no prazo", passo(tentado, "contato")?.detalhe, "Em 14/09 10:00 — no prazo.");

const conversado = resposta({ ...tentado, id: "conv", postContactAt: br("2026-09-14 11:00"), moodAfter: 4, status: "Em tratativa" });
confere("falou, sem confirmação: confirmação do cliente", atual(conversado)?.id, "confirmacao");
confere("Resolvido ainda não pode", motivoParaNaoEncerrar(conversado, "[Encerrado] Resolvido", undefined, agora), "Falta: cliente confirmou que resolveu.");

const confirmado = resposta({ ...conversado, id: "conf", confirmedAt: br("2026-09-14 12:00") });
confere("confirmado: encerrar", atual(confirmado)?.id, "encerrar");
confere("Resolvido liberado", motivoParaNaoEncerrar(confirmado, "[Encerrado] Resolvido", undefined, agora), null);

const soTentou = resposta({ ...tentado, id: "so", confirmedAt: br("2026-09-14 12:00") });
confere("confirmação sem retorno registrado não basta para Resolvido", motivoParaNaoEncerrar(soTentou, "[Encerrado] Resolvido", undefined, agora), "Falta: solução ou retorno registrado.");

console.log("\n— Cada tipo, a sua trilha —");
const sugestao = resposta({ score: 8, kind: "Sugestão" });
confere("Sugestão não tem passo de confirmação", passo(sugestao, "confirmacao"), undefined);
confere("Sugestão: o retorno pede o link de acompanhamento", passo(sugestao, "retorno")?.detalhe, "Registre a sugestão, vincule ao cliente e envie o link de acompanhamento.");

const engano = resposta({ kind: "Engano" });
confere("Engano: contato e retorno são opcionais, a vez é do encerramento", atual(engano)?.id, "encerrar");
confere("Engano encerra só com o tipo", motivoParaNaoEncerrar(engano, "[Encerrado] Engano", undefined, agora), null);

const promotor = resposta({ score: 10, kind: "Elogio", comment: "Adoro!" });
confere("Promotor tem as ações do promotor, opcionais", passo(promotor, "promotor")?.estado, "opcional");
const promotorFeito = resposta({ ...promotor, id: "pf", reviewAsked: true, testimonialAsked: true, referralAsked: true, reviewFeita: true, indicacoes: 2 });
confere("e mostram o que voltou", passo(promotorFeito, "promotor")?.detalhe, "review publicada · 2 indicação(ões)");
confere("Detrator não tem ações do promotor", passo(novo, "promotor"), undefined);

console.log("\n— Sem retorno —");
const faltaTres = resposta({
  kind: "Falta de Retorno",
  firstContactAt: br("2026-09-10 10:00"),
  respondedAt: br("2026-09-10 09:00"),
  attempts: [tentativa("2026-09-10 10:00", 1), tentativa("2026-09-11 10:00", 2), tentativa("2026-09-14 10:00", 3)],
});
confere("Falta de Retorno com 3: a vez é tentar de novo", atual(faltaTres)?.acao, "tentativa");
confere("e diz quantas faltam", atual(faltaTres)?.detalhe, "Faltam 2 tentativa(s) em 7 dias para encerrar sem retorno.");
confere("Sem Retorno ainda travado, com o número", motivoParaNaoEncerrar(faltaTres, "[Encerrado] Sem Retorno", undefined, agora)?.endsWith("Até agora: 3."), true);

const faltaCinco = resposta({ ...faltaTres, id: "f5", attempts: [...faltaTres.attempts, tentativa("2026-09-14 11:00", 4), tentativa("2026-09-14 14:00", 5)] });
confere("com 5: encerrar, aceso", [atual(faltaCinco)?.id, atual(faltaCinco)?.alerta], ["encerrar", true]);
confere("Sem Retorno liberado", motivoParaNaoEncerrar(faltaCinco, "[Encerrado] Sem Retorno", undefined, agora), null);

const reclamacaoTres = resposta({ kind: "Reclamação", rootCause: "Bug", firstContactAt: br("2026-09-10 10:00"), respondedAt: br("2026-09-10 09:00"), attempts: faltaTres.attempts });
confere("Reclamação com 3 sem resposta: o critério pula a trilha para o encerramento", atual(reclamacaoTres)?.id, "encerrar");

const falouAntes = resposta({ ...reclamacaoTres, id: "fa", postContactAt: br("2026-09-14 12:00") });
confere("tentativas de antes da conversa não são falta de retorno", deveEncerrarSemRetorno(falouAntes, agora).deve, false);
const falouETentou = resposta({ ...falouAntes, id: "ft", attempts: [...falouAntes.attempts, tentativa("2026-09-14 13:00", 7), tentativa("2026-09-14 14:00", 8), tentativa("2026-09-14 14:30", 9)] });
confere("três depois da conversa, sem resposta, são", deveEncerrarSemRetorno(falouETentou, agora).deve, true);

console.log("\n— Ciclo fechado —");
const fechado = resposta({ ...confirmado, id: "fe", status: "[Encerrado] Resolvido", closedAt: br("2026-09-14 13:00") });
confere("encerrado não tem passo da vez", atual(fechado), undefined);
confere("o último passo diz como terminou", passo(fechado, "encerrar")?.detalhe, "Resolvido em 14/09 13:00.");

const calado = resposta({ score: 10, comment: "", status: "[Encerrado] Sem tratativa", closedAt: br("2026-09-14 09:00") });
confere("promotor calado: classificar é opcional, nada é da vez", [passo(calado, "classificar")?.estado, atual(calado)], ["opcional", undefined]);
confere("\"Sem tratativa\" não é final que se aplica à mão", motivoParaNaoEncerrar(novo, "[Encerrado] Sem tratativa", undefined, agora)?.startsWith("\"Sem tratativa\""), true);
confere("sem tipo, nenhum final", motivoParaNaoEncerrar(novo, "[Encerrado] Resolvido", undefined, agora), "Classifique o tipo antes de encerrar.");
confere("etapa de andamento não passa pela trava", motivoParaNaoEncerrar(novo, "[Aguardando Resposta]", undefined, agora), null);

console.log("\n— O prazo dito em palavras —");
confere("no domingo, prazo de segunda 8h: a data (e não \"0min\")", venceEm(new Date(br("2026-09-13 15:00")), new Date(br("2026-09-14 08:00"))), "Vence 14/09 08:00");
confere("no expediente, a duração útil", venceEm(new Date(br("2026-09-14 15:20")), new Date(br("2026-09-14 18:00"))), "Vence em 2h40 (14/09 18:00)");

console.log("\n— A pergunta de reengajamento —");
confere("com nome, o primeiro nome", mensagemDeReengajamento({ customerName: "Maria Souza" }).startsWith("Oi, Maria! Tudo bem?"), true);
confere("sem nome, sem inventar", mensagemDeReengajamento({}).startsWith("Oi! Tudo bem?"), true);

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
