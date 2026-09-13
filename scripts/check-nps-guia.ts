/**
 * Prova do que a Fase 4 fechou no NPS — sem banco.
 *
 * O "vence hoje" pelo dia de Brasília (e não 24 horas corridas), as 5
 * tentativas da Falta de Retorno, a tabela de indicadores do guia e a
 * ordem da triagem do que está parado: detratores críticos primeiro.
 *
 *   npm run check:nps-guia
 */
import type { NpsResponseView } from "../lib/models/nps";
import {
  deveEncerrarSemRetorno,
  filaDeTriagem,
  indicadoresDoGuia,
  slaState,
} from "../lib/services/nps.service";
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
    score: 5,
    comment: "",
    respondedAt: br("2026-09-10 10:00"),
    customer: `cliente${seq}`,
    status: "Novo",
    firstContactDueAt: br("2026-09-11 10:00"),
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

console.log("\n— Vence hoje é o dia de Brasília —");
const amanha10h = resposta({ firstContactDueAt: br("2026-09-15 10:00") });
confere("prazo amanhã às 10h, visto hoje às 11h: no prazo (eram 23h corridas)", slaState(amanha10h, new Date(br("2026-09-14 11:00"))), "no-prazo");
confere("prazo hoje às 17h, visto às 11h: vence hoje", slaState(resposta({ firstContactDueAt: br("2026-09-14 17:00") }), new Date(br("2026-09-14 11:00"))), "vence-hoje");
confere("sexta 16h, prazo segunda 9h: no prazo", slaState(resposta({ firstContactDueAt: br("2026-09-21 09:00") }), new Date(br("2026-09-18 16:00"))), "no-prazo");
confere("23h30 de hoje, prazo 23h50: ainda é hoje (em UTC já seria amanhã)", slaState(resposta({ firstContactDueAt: br("2026-09-14 23:50") }), new Date(br("2026-09-14 23:30"))), "vence-hoje");
confere("prazo passou: estourado", slaState(amanha10h, new Date(br("2026-09-15 10:01"))), "estourado");

console.log("\n— Tentativas antes de encerrar sem retorno —");
const tres = [1, 2, 3].map((i) => ({ id: `a${i}`, channel: "WhatsApp", note: "", actor: "", createdAt: br(`2026-09-1${i} 10:00`) }));
const agora = new Date(br("2026-09-14 12:00"));
confere("Reclamação: 3 tentativas bastam", deveEncerrarSemRetorno(resposta({ kind: "Reclamação", attempts: tres, respondedAt: br("2026-09-10 09:00") }), agora).deve, true);
confere("Falta de Retorno: 3 não bastam, o guia pede 5", deveEncerrarSemRetorno(resposta({ kind: "Falta de Retorno", attempts: tres, respondedAt: br("2026-09-10 09:00") }), agora).deve, false);
const cinco = [...tres, ...[4, 5].map((i) => ({ id: `b${i}`, channel: "E-mail", note: "", actor: "", createdAt: br("2026-09-14 09:00") }))];
confere("Falta de Retorno: com 5, encerra", deveEncerrarSemRetorno(resposta({ kind: "Falta de Retorno", attempts: cinco, respondedAt: br("2026-09-10 09:00") }), agora).deve, true);

console.log("\n— Indicadores do guia —");
const base = [
  resposta({ score: 2, firstContactAt: br("2026-09-10 11:00"), moodAfter: 4 }),
  resposta({ score: 5, firstContactAt: br("2026-09-10 12:00"), moodAfter: 2 }),
  resposta({ score: 6 }),
  resposta({ score: 6 }),
  resposta({ score: 8 }),
  resposta({ score: 10, reviewAsked: true, reviewFeita: true, referralAsked: true, indicacoes: 3, testimonialAsked: true, aceitaCase: true }),
  resposta({ score: 9, reviewAsked: true, reviewFeita: false, referralAsked: true, indicacoes: 0 }),
  resposta({ score: 9, reviewAsked: true }),
];
const g = indicadoresDoGuia(base);
confere("% de detratores contatados: 2 de 4", [g.detratoresContatados, g.detratores, g.percentualContatados], [2, 4, 50]);
confere("humor do detrator: média de quem registrou (4 e 2)", [g.detratoresComHumor, g.humorMedioDoDetrator, g.detratoresRecuperados], [2, 3, 1]);
confere("indicações somam o que voltou, não o pedido", [g.indicacoes, g.indicacoesPedidas], [3, 2]);
confere("avaliações no Google: só as publicadas", [g.reviewsNoGoogle, g.reviewsPedidas], [1, 3]);
confere("case: quem aceitou", [g.aceitaramCase, g.casesPedidos], [1, 1]);
confere("sem detrator, sem percentual inventado", indicadoresDoGuia([]).percentualContatados, null);

console.log("\n— Triagem: a ordem da rotina —");
const hoje = new Date(br("2026-09-14 12:00"));
const fila = filaDeTriagem(
  [
    resposta({ id: "promotor", score: 10, comment: "ótimo", firstContactDueAt: br("2026-09-01 10:00") }),
    resposta({ id: "neutro", score: 7, firstContactDueAt: br("2026-09-05 10:00") }),
    resposta({ id: "detrator-no-prazo", score: 6, firstContactDueAt: br("2026-09-15 10:00") }),
    resposta({ id: "detrator-atrasado", score: 5, firstContactDueAt: br("2026-09-09 10:00") }),
    resposta({ id: "critico-cancelar", score: 6, comment: "vou cancelar se continuar assim", firstContactDueAt: br("2026-09-15 15:00") }),
    resposta({ id: "critico-nota", score: 1, firstContactDueAt: br("2026-09-12 10:00") }),
    resposta({ id: "critico-inativo", score: 0, establishmentId: "e1", firstContactDueAt: br("2026-09-01 10:00") }),
    resposta({ id: "ja-contatado", score: 0, firstContactAt: br("2026-09-10 10:00") }),
    resposta({ id: "encerrado", score: 0, status: "[Encerrado] Sem Retorno" }),
  ],
  { agora: hoje, situacaoDaConta: (id) => (id === "e1" ? "Cancelado" : undefined) }
);
confere(
  "críticos (o mais atrasado primeiro, conta inativa no fim), depois detratores, neutros, promotores",
  fila.map((f) => f.item.id),
  ["critico-nota", "critico-cancelar", "critico-inativo", "detrator-atrasado", "detrator-no-prazo", "neutro", "promotor"]
);
confere("contatado e encerrado não estão parados", fila.some((f) => ["ja-contatado", "encerrado"].includes(f.item.id)), false);
confere("o motivo do crítico aparece", fila.find((f) => f.item.id === "critico-cancelar")?.motivos, ["fala em cancelar ou trocar"]);
confere("nota baixa e conta inativa, os dois motivos", fila.find((f) => f.item.id === "critico-inativo")?.motivos, ["nota 0", "conta cancelado"]);
confere("a folga é em tempo útil: atrasado desde quarta 10h é negativo", (fila.find((f) => f.item.id === "detrator-atrasado")?.folgaMin ?? 0) < 0, true);
{
  /* Domingo, prazo vencido no sábado: zero minuto útil entre os dois, e mesmo assim estourado. */
  const domingo = new Date(br("2026-09-20 15:00"));
  const [f] = filaDeTriagem([resposta({ score: 2, firstContactDueAt: br("2026-09-19 10:00") })], { agora: domingo });
  confere("vencido no fim de semana é estourado, mesmo com folga zero", [f.estourado, f.folgaMin], [true, 0]);
  const [g2] = filaDeTriagem([resposta({ score: 2, firstContactDueAt: br("2026-09-21 10:00") })], { agora: domingo });
  confere("e o que vence na segunda ainda não", g2.estourado, false);
}
confere("'pedi o cancelamento' em detrator de nota 6 o faz crítico", filaDeTriagem([resposta({ score: 6, comment: "já pedi o cancelamento duas vezes" })], { agora: hoje })[0].nivel, "detrator-critico");
confere("detrator de nota 6 sem sinal fica no nível comum", filaDeTriagem([resposta({ score: 6, comment: "o suporte demora" })], { agora: hoje })[0].nivel, "detrator");

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
