/**
 * As partes escritas do dossiê e a conferência antes de usar (Fase 26).
 *
 *   npm run check:dossie-escrito
 *
 * Sem banco: um dossiê montado de exemplo, o rascunho sem IA, o que a
 * conferência acusa e o texto do pedido de moderação.
 */
import type { DossieMontado } from "../lib/services/dossie.service";
import { aplicarPartes, conferenciaAntesDeUsar, PARTES_VAZIAS, rascunhoSemIA, textoParaModeracao } from "../lib/models/dossieEscrito";
import { montarDossie, renderizarDossie } from "../lib/services/dossie.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const d: DossieMontado = {
  identificacao: { titulo: "Cobrança em dobro", protocolo: "RA-1", canal: "Reclame Aqui", abertoEm: "2026-09-10T15:00:00Z", montadoPor: "Isaac", montadoEm: "2026-09-24T12:00:00Z", destinatario: "Moderação do Reclame Aqui", pedido: "" },
  partes: { consumidor: "Ana Souza", contato: ["11 98765-4321"], estabelecimento: "Bar da Ana", setoresAcionados: ["Financeiro"] },
  linhaDoTempo: [
    { numero: 1, quando: "2026-09-10T15:00:00Z", evento: "Reclamação publicada", canal: "Reclame Aqui", evidencia: "Anexo 01", origem: "case" },
    { numero: 2, quando: "2026-09-11T13:00:00Z", evento: "Estorno solicitado ao Financeiro", canal: "Interno", evidencia: "Anexo 02", origem: "movement:1" },
    { numero: 3, quando: "2026-09-12T18:00:00Z", evento: "Cliente confirma o estorno no WhatsApp", canal: "WhatsApp", evidencia: "", origem: "contato:1" },
  ],
  anexos: [
    { numero: 1, nome: "2026-09-10_reclame-aqui_ra-1_anexo-01_reclamacao", descricao: "A reclamação", noSistema: true, conteudo: "…" },
    { numero: 2, nome: "2026-09-11_interno_ra-1_anexo-02_estorno", descricao: "Pedido ao Financeiro", noSistema: true, conteudo: "…" },
    { numero: 3, nome: "print_whatsapp", descricao: "Print da confirmação", noSistema: false },
  ],
  versao: { numero: 1, geradoEm: "2026-09-24T12:00:00Z", base: "banco" },
  lacunas: ["Anexo 03 — print da conversa do WhatsApp com a confirmação do estorno"],
};

console.log("\n  O rascunho sem IA\n");
const r = rascunhoSemIA(d);
conferir("o sumário diz quem, quando e quantos eventos", r.sumario?.startsWith("Ana Souza abriu a reclamação RA-1 (Reclame Aqui) em 10/09/2026. O sistema registra 3 evento(s)"), true);
conferir("e a peça que falta", r.sumario?.endsWith("Faltam 1 peça(s) de fora do sistema."), true);
conferir("verificado: só o fato com peça no sistema", r.verificado, ["10/09/2026: Reclamação publicada (Anexo 01)", "11/09/2026: Estorno solicitado ao Financeiro (Anexo 02)"]);
conferir("o que é julgamento fica para quem conhece o caso", [r.sustentado.length, r.alegado.length, r.enquadramento ?? null], [0, 0, null]);

console.log("\n  A conferência antes de usar\n");
const vazio = conferenciaAntesDeUsar(d, PARTES_VAZIAS);
conferir("sem sumário e sem pedido, acusa os dois", vazio.includes("Falta o sumário executivo.") && vazio.includes("Falta o pedido: o que se quer do destinatário."), true);
const semRegra = conferenciaAntesDeUsar(d, { ...r, pedido: "Pedimos a moderação da reclamação." });
conferir("pedido sem regra do regulamento", semRegra.includes("O pedido não cita a regra (do regulamento, dos termos ou da política) que o sustenta."), true);
const comRegra = conferenciaAntesDeUsar(d, { ...r, pedido: "Pedimos a moderação pelo item 4.2 do regulamento: o problema foi resolvido." });
conferir("com a regra citada, não acusa", comRegra.some((x) => x.startsWith("O pedido não cita")), false);
conferir("evidência sem data no nome", comRegra.includes("1 evidência(s) sem data no nome do arquivo."), true);
conferir("peça de fora do sistema por anexar", comRegra.includes("1 peça(s) de fora do sistema ainda por anexar."), true);
conferir("alegação sem prova", conferenciaAntesDeUsar(d, { ...r, alegado: ["Diz que foi cobrado três vezes"] }).includes("1 alegação(ões) sem prova: junte a evidência ou tire do pedido."), true);
conferir("anexo citado que não existe (da conferência do documento)", conferenciaAntesDeUsar(d, { ...r, sumario: "Ver Anexo 09." }).some((x) => x.includes("Anexo 09")), true);

console.log("\n  O documento e o pedido\n");
const texto = renderizarDossie(aplicarPartes(d, { ...r, pedido: "Moderação pelo item 4.2 do regulamento." }));
conferir("o documento leva o sumário escrito", texto.includes("Ana Souza abriu a reclamação RA-1"), true);
const mod = textoParaModeracao(d, { ...r, pedido: "Pedimos a moderação pelo item 4.2 do regulamento." });
conferir("o pedido de moderação abre pelo pedido", mod.split("\n")[0], "Pedimos a moderação pelo item 4.2 do regulamento.");
conferir("e fecha com o anexo e o protocolo", mod.endsWith("Dossiê completo em anexo (3 peça(s)). Protocolo RA-1."), true);

console.log("\n  A montagem dos registros\n");
const montagem = (async () => {
  /* Um caso com anotação, contatos e uma conversa guardada — em ordem trocada de propósito. */
  const caso = {
    id: "c1", protocol: "RA-9", title: "Estorno", channel: "RECLAME_AQUI", customer: "Ana", email: null, phone: null, city: null, state: null,
    createdAt: new Date("2026-09-10T15:00:00Z"), publishedAt: new Date("2026-09-10T15:00:00Z"), publicResponse: null, publicResponseAt: null,
    evaluated: false, evaluatedAt: null, score: null, externalUrl: "https://www.reclameaqui.com.br/x", description: "Relato", establishment: null, category: null,
    movements: [], tasks: [],
    comments: [{ id: "k1", body: "Cliente pediu retorno à tarde", createdAt: new Date("2026-09-14T12:00:00Z"), author: { name: "Isaac" }, authorName: null }],
    contatos: [
      { id: "t1", tipo: "tentativa", canal: "Telefone", resultado: "nao-atendeu", nota: null, em: new Date("2026-09-11T13:00:00Z") },
      { id: "t2", tipo: "contato", canal: "WhatsApp", resultado: "respondeu", nota: "Confirmou o problema e mandou o extrato", em: new Date("2026-09-11T17:00:00Z") },
    ],
    conversas: [
      { id: "v1", canal: "whatsapp", contatoNome: "Ana", mensagens: [
        { de: "cliente", autor: null, texto: "Oi, fui cobrada duas vezes", em: new Date("2026-09-11T16:50:00Z") },
        { de: "nos", autor: "Isaac", texto: "Vou verificar e te retorno hoje", em: new Date("2026-09-11T17:00:00Z") },
      ] },
    ],
  };
  const prismaDeTeste = { case: { findFirst: async () => caso } } as never;
  const m = await montarDossie(prismaDeTeste, "RA-9", { montadoPor: "check" });
  conferir("contatos e conversa entram na linha do tempo", m?.linhaDoTempo.map((e) => e.origem.split(".")[0]), ["Case", "CaseContato", "Conversa", "CaseContato", "CaseComment"]);
  conferir("a tentativa diz o resultado", m?.linhaDoTempo.find((e) => e.origem === "CaseContato.t1")?.evento, "Tentativa de contato por Telefone — não atendeu");
  conferir("anexos na ordem da cronologia (01, 02, 03… de cima para baixo)", m?.linhaDoTempo.map((e) => e.evidencia).filter(Boolean), ["Anexo 01", "Anexo 02", "Anexo 03", "Anexo 04"]);
  conferir("o nome do arquivo acompanha o número", m?.anexos.map((a) => a.nome.match(/_anexo-(\d{2})_/)?.[1]), ["01", "02", "03", "04"]);
  conferir("a conversa vira anexo com a transcrição", m?.anexos.find((a) => a.descricao === "conversa guardada")?.conteudo?.includes("Isaac: Vou verificar e te retorno hoje"), true);
})();

montagem.then(() => {
  console.log(falhas === 0 ? "\n  O dossiê se sustenta antes de sair.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exit(falhas === 0 ? 0 : 1);
});
