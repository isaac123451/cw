/**
 * O "respondeu" do NPS fica registrado e aparece?
 *
 *   npm run check:respondeu-nps
 *
 * Sem banco (10/11/2026): a fala do cliente depois da tentativa marca a
 * última tentativa antes dela; fala de antes do contato não conta; quem
 * respondeu não fecha como Sem Retorno; o cartão diz "Respondeu · dd/mm".
 */
import { contatoDoCiclo, tentativaRespondida } from "../lib/models/contatoDoNps";
import { deveEncerrarSemRetorno } from "../lib/services/nps.service";
import type { NpsResponseView } from "../lib/models/nps";
import { ehAvisoDoWhatsApp } from "../lib/models/conversa";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

const t1 = { id: "a", createdAt: "2026-11-03T13:00:00.000Z", resultado: "sem-resposta" };
const t2 = { id: "b", createdAt: "2026-11-04T13:00:00.000Z", resultado: "sem-resposta" };
const t3 = { id: "c", createdAt: "2026-11-06T13:00:00.000Z", resultado: "sem-resposta" };

console.log("\n  A TENTATIVA QUE O CLIENTE RESPONDEU\n");
conferir("fala entre a 2ª e a 3ª marca a 2ª", tentativaRespondida([t3, t1, t2], ["2026-11-05T10:00:00.000Z"]), "b");
conferir("fala logo depois da 1ª marca a 1ª", tentativaRespondida([t1, t2], ["2026-11-03T14:00:00.000Z"]), "a");
conferir("fala só antes do contato não conta", tentativaRespondida([t1], ["2026-11-01T10:00:00.000Z"]), null);
conferir("já tem respondeu: não mexe", tentativaRespondida([t1, { ...t2, resultado: "respondeu" }], ["2026-11-05T10:00:00.000Z"]), null);
conferir("sem tentativa: nada", tentativaRespondida([], ["2026-11-05T10:00:00.000Z"]), null);
conferir("conta a primeira fala depois do contato", tentativaRespondida([t1, t2, t3], ["2026-11-07T10:00:00.000Z", "2026-11-03T20:00:00.000Z"]), "a");

conferir("aviso de mensagens temporárias não é fala do cliente", ehAvisoDoWhatsApp("+55 44 9907-1270 usa uma duração padrão para mensagens temporárias em conversas novas."), true);
conferir("aviso de criptografia não é fala do cliente", ehAvisoDoWhatsApp("As mensagens e ligações são protegidas com a criptografia de ponta a ponta."), true);

console.log("\n  O QUE O CARTÃO E A LISTA DIZEM\n");
conferir("respondeu, com o dia (Brasília)", contatoDoCiclo({ status: "[Aguardando Resposta]", attempts: [{ ...t1, resultado: "respondeu" }] }), { texto: "Respondeu · 03/11", respondeu: true });
conferir("tentativas e o dia da última", contatoDoCiclo({ status: "[Aguardando Resposta]", attempts: [t1, t2] }), { texto: "2 tentativas · 04/11", respondeu: false });
conferir("Falei com o cliente conta como resposta", contatoDoCiclo({ status: "[Em tratativa]", postContactAt: "2026-11-08T15:00:00.000Z", attempts: [t1] }), { texto: "Respondeu · 08/11", respondeu: true });
conferir("encerrado Sem Retorno não é resposta", contatoDoCiclo({ status: "[Encerrado] Sem Retorno", closedAt: "2026-11-09T03:00:00.000Z", attempts: [t1] })?.respondeu, false);
conferir("sem contato nenhum: nada", contatoDoCiclo({ status: "[Novo]", attempts: [] }), null);

console.log("\n  A ROTINA DA NOITE NÃO FECHA QUEM RESPONDEU\n");
const agora = new Date("2026-11-07T12:00:00.000Z");
const ciclo = (attempts: object[], respondedAt = "2026-11-01T12:00:00.000Z") => ({ status: "[Aguardando Resposta]", respondedAt, attempts } as unknown as NpsResponseView);
conferir("3 tentativas sem resposta: fecha", deveEncerrarSemRetorno(ciclo([t1, t2, t3]), agora).deve, true);
conferir("3 tentativas, uma respondida: não fecha", deveEncerrarSemRetorno(ciclo([t1, { ...t2, resultado: "respondeu" }, t3]), agora).deve, false);
conferir("30 dias contam da resposta, não da pesquisa", deveEncerrarSemRetorno(ciclo([{ ...t1, resultado: "respondeu" }], "2026-10-01T12:00:00.000Z"), agora).deve, false);
conferir("30 dias sem fala nenhuma: fecha", deveEncerrarSemRetorno(ciclo([], "2026-10-01T12:00:00.000Z"), agora).deve, true);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
