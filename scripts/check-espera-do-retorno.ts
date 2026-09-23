/**
 * Sem retorno só depois de 2 horas, e o contato antes da classificação
 * quando o NPS não tem comentário.
 *
 *   npm run check:espera-do-retorno
 *
 * O pedido do Isaac (23/09): "tentativas de contato só podem ser marcadas
 * sem retorno depois de um tempo, algo em torno de 2 horas" e "na maioria
 * dos casos não tem comentário e preciso primeiro fazer o contato". Sem
 * banco: as regras, a trilha, o Meu dia e as travas do servidor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import { persistencia } from "../lib/models/cadencia";
import { contarRotina, etapaDoNps } from "../lib/models/meuDia";
import { podeMarcarSemRetorno, quandoLiberaSemRetorno, resumirContatos } from "../lib/models/tratativa";
import { trilhaDoNps } from "../lib/models/trilhaNps";
import { deveEncerrarSemRetorno, tentativasNaJanela } from "../lib/services/nps.service";
import { marcarSemRetorno, problemaDoContato } from "../lib/services/tratativa.service";
import { instanteDe } from "../lib/services/horasUteis";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)?.slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)?.slice(0, 40)}`);
}

const RAIZ = resolve(__dirname, "..");
const ler = (f: string) => readFileSync(resolve(RAIZ, f), "utf8");

const br = (dia: string, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m);
};
const agora = br("2026-09-23", "14:00");
const iso = (dia: string, hora: string) => br(dia, hora).toISOString();

console.log("\n  ESPERA DO RETORNO E O CONTATO ANTES DA CLASSIFICAÇÃO\n");

/* ---- 1. a regra das 2 horas ---- */
conferir("tentativa de 1h atrás ainda não pode virar sem retorno", podeMarcarSemRetorno(iso("2026-09-23", "13:00"), agora), false);
conferir("de 2h atrás, pode", podeMarcarSemRetorno(iso("2026-09-23", "12:00"), agora), true);
conferir("e a tela diz a partir de quando", quandoLiberaSemRetorno(iso("2026-09-23", "13:00"), agora), "15:00");
conferir("o servidor recusa 'não atendeu' registrado agora", /2 horas/.test(problemaDoContato({ tipo: "tentativa", canal: "Telefone", resultado: "nao-atendeu", em: agora.toISOString() }, agora) ?? ""), true);
conferir("aceita 'não atendeu' de 3h atrás (registro depois do fato)", problemaDoContato({ tipo: "tentativa", canal: "Telefone", resultado: "nao-atendeu", em: iso("2026-09-23", "11:00") }, agora), null);
conferir("e aceita 'aguardando retorno' a qualquer hora", problemaDoContato({ tipo: "tentativa", canal: "WhatsApp", resultado: "aguardando", em: agora.toISOString() }, agora), null);
conferir("sem resultado, a tentativa nasce aguardando (é o padrão)", problemaDoContato({ tipo: "tentativa", canal: "WhatsApp" }, agora), null);

/* ---- 2. aguardando não conta ---- */
const contatos = [
  { tipo: "tentativa" as const, canal: "Telefone", resultado: "nao-atendeu" as const, em: iso("2026-09-22", "10:00"), autor: "x" },
  { tipo: "tentativa" as const, canal: "WhatsApp", resultado: "aguardando" as const, em: iso("2026-09-23", "13:30"), autor: "x" },
];
conferir("o resumo do caso não conta a tentativa aguardando", resumirContatos(contatos).tentativasSemResposta, 1);
conferir("nem a cadência de persistência", persistencia(contatos, agora).tentativas, 1);
conferir("mas ela já conta como 1º contato", resumirContatos([contatos[1]]).primeiroContatoEm, contatos[1].em);

const resposta = (campos: Partial<NpsResponseView>): NpsResponseView => ({
  id: "n1", score: 3, comment: "", respondedAt: iso("2026-09-20", "10:00"), customer: "ana", status: "Em tratativa",
  firstContactDueAt: iso("2026-09-21", "10:00"), reviewAsked: false, testimonialAsked: false, referralAsked: false,
  source: "Wootric", churnRisk: false, attempts: [], wootricNotes: [], notes: [], ...campos,
});
const tentativa = (hora: string, resultado?: "aguardando" | "sem-resposta", dia = "2026-09-23") => ({ id: `${dia}${hora}`, channel: "WhatsApp", note: "mandei", actor: "x", createdAt: iso(dia, hora), resultado });

const tresUmaAguardando = resposta({ firstContactAt: iso("2026-09-21", "10:00"), attempts: [tentativa("10:00", "sem-resposta", "2026-09-21"), tentativa("10:00", undefined, "2026-09-22"), tentativa("13:30", "aguardando")] });
conferir("NPS: a aguardando fica fora das tentativas do guia (as antigas contam)", tentativasNaJanela(tresUmaAguardando, agora).length, 2);
conferir("e o robô não encerra sem retorno por causa dela", deveEncerrarSemRetorno(tresUmaAguardando, agora).deve, false);

/* ---- 3. a trilha sem comentário ---- */
const semComentario = resposta({ firstContactAt: undefined, status: "Novo" });
const ids = (r: NpsResponseView) => trilhaDoNps(r, { agora }).map((p) => p.id);
const atual = (r: NpsResponseView) => trilhaDoNps(r, { agora }).find((p) => p.estado === "atual")?.id;
conferir("sem comentário: contato e conversa antes de classificar", ids(semComentario).slice(0, 4), ["segmento", "contato", "retorno", "classificar"]);
conferir("e o passo da vez é o contato, não classificar", atual(semComentario), "contato");
conferir("com comentário, classificar continua antes", ids(resposta({ comment: "o sistema caiu no sábado", firstContactAt: undefined, status: "Novo" })).slice(0, 3), ["segmento", "classificar", "contato"]);
const tentado = resposta({ firstContactAt: iso("2026-09-23", "13:30"), attempts: [tentativa("13:30", "aguardando")] });
conferir("tentou sem comentário: o da vez é registrar a conversa, não classificar", atual(tentado), "retorno");
conferir("e ele diz que a tentativa aguarda até as 15:30", /aguardando retorno.*15:30/.test(trilhaDoNps(tentado, { agora }).find((p) => p.id === "retorno")?.detalhe ?? ""), true);
conferir("já classificado, a ordem não muda", ids(resposta({ kind: "Reclamação" })).slice(0, 3), ["segmento", "classificar", "contato"]);

/* ---- 4. o Meu dia ---- */
conferir("NPS com tentativa de 30 min: espera (não volta à fila)", etapaDoNps(tentado, undefined, agora).etapa, "esperando");
conferir("passadas 2 horas: é FUP, marcar sem retorno", etapaDoNps(tentado, undefined, br("2026-09-23", "16:00")).etapa, "fup");

const caso = (id: string, campos: Partial<Case>): Case => ({
  id, protocol: `P-${id}`, company: "Cliente", customer: "Ana", source: "Reclame Aqui", category: "Pagamento", priority: "Alta",
  status: "Em tratativa", title: `Caso ${id}`, description: "", resolved: false, wouldDoBusiness: false, sla: "",
  createdAt: "2026-09-20", recebidaEm: iso("2026-09-20", "09:00"), primeiroContatoEm: iso("2026-09-22", "10:00"), ultimoContatoEm: iso("2026-09-22", "10:00"), ...campos,
});
const contagens = contarRotina(
  {
    casos: [caso("c1", {})],
    nps: [],
    google: [],
    movimentos: [],
    tarefas: [],
    regrasSla: [],
    aguardandoRetorno: [{ id: "c1", frente: "reclame-aqui", titulo: "Caso c1", detalhe: "tentativa sem resposta há 2h", href: "/reclame-aqui/P-c1" }],
  },
  agora
);
conferir("caso com tentativa aguardando há 2h: em FUPs", contagens.fups.itens.map((i) => i.id), ["c1"]);
conferir("e só lá (não em 'em aberto')", contagens["em-aberto"].itens.some((i) => i.id === "c1"), false);

/* ---- 5. as travas do servidor ---- */
async function travas() {
  const falso = (em: Date) =>
    ({ caseContato: { findUnique: async () => ({ caseId: "c1", tipo: "tentativa", resultado: "aguardando", em }) } }) as never;
  const cedo = await marcarSemRetorno(falso(br("2026-09-23", "13:30")), "x", "sem-resposta", agora);
  conferir("marcar sem retorno antes das 2h é recusado, com a hora", cedo && "erro" in cedo ? /15:30/.test(cedo.erro) : false, true);
  const errado = await marcarSemRetorno(falso(br("2026-09-23", "10:00")), "x", "respondeu", agora);
  conferir("e só aceita resultado de sem retorno", Boolean(errado && "erro" in errado), true);

  const acoes = ler("lib/actions/nps.ts");
  conferir("a tentativa do NPS confere as 2h no servidor", /input\.semRetorno && !podeMarcarSemRetorno/.test(acoes), true);
  conferir("e marcar depois também", /marcarTentativaNpsSemRetorno[\s\S]{0,900}podeMarcarSemRetorno\(t\.createdAt\)/.test(acoes), true);
  conferir("a tentativa nova nasce aguardando", /resultado: input\.resultado \?\? "aguardando"/.test(ler("lib/services/nps.repository.ts")), true);
  conferir("o robô de encerrar lê o resultado da tentativa", /select: \{ createdAt: true, resultado: true \}/.test(ler("app/api/cron/route.ts")), true);
  conferir("a extensão registra pelo padrão (aguardando)", /resultado: tipo\.resultadoPadrao/.test(ler("app/api/extensao/tratativa/route.ts")), true);
}

travas().then(() => {
  console.log(falhas === 0 ? "\n  Sem retorno só depois da espera, e o contato vem antes quando não há comentário.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
});
