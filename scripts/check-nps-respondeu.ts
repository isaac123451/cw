/**
 * "[NPS] N° Detratores respondentes" (26/10/2026) — quem respondeu ao nosso
 * contato, e a IA lendo a resposta na conversa do WhatsApp.
 *
 *   npm run check:nps-respondeu
 */
import { clienteRespondeu, tentativasRespondidas, type NpsResponseView } from "../lib/models/nps";
import { indicadoresDoGuia } from "../lib/services/nps.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

console.log("\n  DETRATORES QUE RESPONDERAM AO CONTATO\n");

conferir(
  "respondeu: tentativa marcada, pós-contato ou encerrado com retorno",
  [
    clienteRespondeu({ status: "Em tratativa", attempts: [{ resultado: "respondeu" }] }),
    clienteRespondeu({ status: "Em tratativa", postContactAt: "2026-10-20" }),
    clienteRespondeu({ status: "[Encerrado] Resolvido" }),
  ],
  [true, true, true]
);
conferir(
  "não respondeu: só tentativas, encerrado sem retorno ou sem tratativa",
  [
    clienteRespondeu({ status: "[Aguardando Resposta]", attempts: [{ resultado: "aguardando" }, { resultado: "sem-resposta" }] }),
    clienteRespondeu({ status: "[Encerrado] Sem Retorno" }),
    clienteRespondeu({ status: "[Encerrado] Sem tratativa" }),
  ],
  [false, false, false]
);

const t = (id: string, resultado: string, iso: string) => ({ id, resultado, createdAt: new Date(iso) });
const m = (de: string, iso: string) => ({ de, em: new Date(iso) });
conferir(
  "a conversa: a tentativa antes da mensagem do cliente vira respondida",
  tentativasRespondidas([t("a", "sem-resposta", "2026-10-20T12:00:00Z"), t("b", "aguardando", "2026-10-21T12:00:00Z")], [m("nos", "2026-10-20T12:00:00Z"), m("cliente", "2026-10-20T18:00:00Z")]),
  ["a"]
);
conferir("só mensagem nossa: nada muda", tentativasRespondidas([t("a", "aguardando", "2026-10-20T12:00:00Z")], [m("nos", "2026-10-20T12:05:00Z")]), []);
conferir("já respondida não é marcada de novo", tentativasRespondidas([t("a", "respondeu", "2026-10-20T12:00:00Z")], [m("cliente", "2026-10-20T13:00:00Z")]), []);

const base = { comment: "", respondedAt: "2026-10-01", customer: "x", firstContactDueAt: "2026-10-02", reviewAsked: false, testimonialAsked: false, referralAsked: false, source: "Wootric", churnRisk: false, wootricNotes: [], notes: [] };
const nps = (score: number, extra: Partial<NpsResponseView>) => ({ id: String(Math.random()), score, status: "Novo", attempts: [], ...base, ...extra }) as unknown as NpsResponseView;
const guia = indicadoresDoGuia([
  nps(2, { firstContactAt: "2026-10-02", attempts: [{ id: "1", channel: "WhatsApp", note: "", actor: "", createdAt: "2026-10-02", resultado: "respondeu" }] }),
  nps(4, { firstContactAt: "2026-10-02", status: "[Encerrado] Sem Retorno" }),
  nps(5, { firstContactAt: "2026-10-02", postContactAt: "2026-10-03" }),
  nps(6, {}),
  nps(10, { postContactAt: "2026-10-03" }),
]);
conferir(
  "o guia: 4 detratores, 3 contatados, 2 responderam (67% dos contatados); promotor não entra",
  [guia.detratores, guia.detratoresContatados, guia.detratoresResponderam, guia.percentualResponderam],
  [4, 3, 2, 67]
);

/* 26/10: "os contatados são independentes do mês, o importante é a data que foi realizado o contato". */
const setembroContatadoEmOutubro = nps(3, { respondedAt: "2026-09-25", firstContactAt: "2026-10-02T13:00:00Z", attempts: [{ id: "9", channel: "WhatsApp", note: "", actor: "", createdAt: "2026-10-03T13:00:00Z", resultado: "respondeu" }] });
const outubroSemContato = nps(5, { respondedAt: "2026-10-05" });
const outubroContatadoEmSetembro = nps(1, { respondedAt: "2026-09-29", firstContactAt: "2026-09-30T13:00:00Z" });
const todos = [setembroContatadoEmOutubro, outubroSemContato, outubroContatadoEmSetembro];
const emOutubro = (iso: string | undefined) => Boolean(iso) && iso! >= "2026-10-01" && iso! < "2026-11-01";
const outubro = indicadoresDoGuia([outubroSemContato], { todos, dentro: emOutubro });
conferir(
  "outubro: o de setembro contatado em outubro conta; o contatado em setembro não",
  [outubro.detratoresContatados, outubro.detratoresResponderam, outubro.percentualResponderam],
  [1, 1, 100]
);
conferir("o SLA continua sobre quem chegou no mês: 0% dos de outubro com contato", outubro.percentualContatados, 0);

console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  Respondeu é quem falou com a gente — marcado à mão, pela IA lendo o WhatsApp ou no encerramento.\n");
if (falhas) process.exitCode = 1;
