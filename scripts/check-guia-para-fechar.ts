/**
 * O modo um por vez leva a fila até o fim sem pular nem repetir?
 *
 *   npm run check:guia-para-fechar
 *
 * **O pedido.** "Guia para finalizar as atividades." O Meu dia ganhou o
 * modo um por vez: os itens das atividades abertas, um de cada vez, com
 * os passos que faltam em cada um. Este check prova, sem tela:
 *
 * 1. **a fila**: o mesmo caso em duas atividades é um item só; o fora do
 *    prazo vem primeiro; atividade marcada sai;
 * 2. **o lugar na fila**: resolver o item 3 leva ao que ocupou o lugar
 *    dele, e não de volta ao 1;
 * 3. **os passos** de Redes e Google saem do registro, e o atual é o
 *    primeiro que falta;
 * 4. **a fiação**: a agenda só confirma depois do banco, e a tela chega
 *    ao modo pela Agenda.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import type { AvaliacaoGoogleView } from "../lib/actions/avaliacoesGoogle";

import { filaDoDia, passosParaFechar, posicaoNaFila, resumoDosPassos } from "../lib/models/guiaParaFechar";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  GUIA PARA FECHAR — MODO UM POR VEZ\n");

/* ---- 1. a fila ---- */

const atividades = [
  { id: "a1", titulo: "Novos", chave: "novos" as const },
  { id: "a2", titulo: "FUPs", chave: "fups" as const },
  { id: "a3", titulo: "Pendências", chave: "pendencias" as const },
];

const contagens = {
  novos: { itens: [
    { id: "c1", frente: "reclame-aqui" as const, titulo: "Caso 1", href: "/reclame-aqui/c1" },
    { id: "n1", frente: "nps" as const, titulo: "Nota 3", href: "/nps/n1" },
  ] },
  fups: { itens: [
    { id: "c1", frente: "reclame-aqui" as const, titulo: "Caso 1", href: "/reclame-aqui/c1", atrasado: true },
    { id: "c2", frente: "redes" as const, titulo: "Caso 2", href: "/redes-sociais/c2" },
  ] },
  pendencias: { itens: [{ id: "t1", titulo: "Ligar para o cliente", href: "/agenda" }] },
};

const fila = filaDoDia(atividades, contagens);
conferir("o mesmo caso em duas atividades é um item só", fila.length, 4);
conferir("e leva as duas atividades", fila.find((i) => i.chave === "reclame-aqui:c1")?.atividades, ["Novos", "FUPs"]);
conferir("e as duas chaves — marcar feito tira das duas", fila.find((i) => i.chave === "reclame-aqui:c1")?.chaves, ["novos", "fups"]);
conferir("o Reclame Aqui vem primeiro", fila[0].chave, "reclame-aqui:c1");
conferir("depois, a prioridade do documento: agenda, Redes, NPS", fila.map((i) => i.chave).slice(1), ["pendencias:t1", "redes:c2", "nps:n1"]);
conferir("a ficha abre em janela; a agenda, não", fila.map((i) => Boolean(i.janela)), [true, false, true, true]);
{
  /* O NPS vencido não passa na frente do Reclame Aqui no prazo; dentro da frente, o vencido e o crítico primeiro. */
  const f = filaDoDia([{ id: "b1", titulo: "Novos", chave: "novos" as const }], {
    novos: { itens: [
      { id: "n2", frente: "nps" as const, titulo: "Nota 8", href: "/nps/n2", atrasado: true, urgencia: 5 },
      { id: "n3", frente: "nps" as const, titulo: "Nota 0", href: "/nps/n3", urgencia: 1 },
      { id: "c3", frente: "reclame-aqui" as const, titulo: "Caso 3", href: "/reclame-aqui/c3" },
      { id: "c4", frente: "reclame-aqui" as const, titulo: "Caso 4", href: "/reclame-aqui/c4", atrasado: true },
    ] },
  });
  conferir("NPS vencido não fura o RA; no RA, o vencido antes; no NPS, o crítico antes do neutro vencido", f.map((i) => i.ref), ["c4", "c3", "n3", "n2"]);
}
conferir("atividade marcada sai da fila", filaDoDia(atividades, contagens, new Set(["a1", "a2"])).map((i) => i.chave), ["pendencias:t1"]);

/* ---- 2. o lugar na fila ---- */

conferir("o item atual continua onde está", posicaoNaFila(fila, "redes:c2", 0), 2);
const semAgenda = fila.filter((i) => i.chave !== "pendencias:t1");
conferir("resolvido o 2º, segue no 2º lugar (e não no 1º)", semAgenda[posicaoNaFila(semAgenda, "pendencias:t1", 1)].chave, "redes:c2");
conferir("resolvido o último, fica no novo último", posicaoNaFila(fila.slice(0, 3), "nps:n1", 3), 2);
conferir("fila vazia não tem posição", posicaoNaFila([], "x", 2), -1);

/* ---- 3. os passos ---- */

const redes = (c: Partial<Case>) => ({ id: "c2", source: "Instagram", status: "Recebido", priority: "Média", ...c }) as Case;

conferir(
  "Redes recém-chegado: triar é o atual",
  passosParaFechar({ frente: "redes", item: redes({}) }).map((p) => p.estado),
  ["atual", "pendente", "pendente", "pendente"]
);
conferir(
  "Redes contatado: validar é o atual",
  resumoDosPassos(passosParaFechar({ frente: "redes", item: redes({ triadaEm: "2026-09-17", primeiroContatoEm: "2026-09-17" }) })).texto,
  "Próximo: validar com o cliente"
);
const esgotado = passosParaFechar({ frente: "redes", item: redes({ triadaEm: "x", tentativasSemResposta: 3 }) });
conferir("três tentativas sem resposta acendem o alerta", esgotado.find((p) => p.id === "contato")?.alerta, true);
conferir(
  "Sem contato encerra: validação vira opcional",
  passosParaFechar({ frente: "redes", item: redes({ status: "Sem contato" }) }).map((p) => p.estado),
  ["feito", "feito", "opcional", "feito"]
);

const google = (a: Partial<AvaliacaoGoogleView>) => ({ id: "g1", estrelas: 1, classificacao: "negativa", status: "aberta", identificado: false, ...a }) as AvaliacaoGoogleView;
conferir("Google negativa tem a tratativa privada", passosParaFechar({ frente: "google", item: google({}) }).map((p) => p.id), ["resposta", "tratativa", "encerrar"]);
conferir("Google positiva, não", passosParaFechar({ frente: "google", item: google({ classificacao: "positiva", estrelas: 5 }) }).map((p) => p.id), ["resposta", "encerrar"]);
conferir(
  "negativa respondida: a tratativa é o atual",
  resumoDosPassos(passosParaFechar({ frente: "google", item: google({ respondidaEm: "2026-09-17" }) })).atual?.id,
  "tratativa"
);
conferir("o resumo não conta o opcional", resumoDosPassos(passosParaFechar({ frente: "redes", item: redes({ status: "Resolvido", validadoEm: "x" }) })).total, 4);

/* ---- 4. a fiação ---- */

const modo = ler("components/rotina/ModoProximo.tsx");
conferir("a agenda confirma só depois do banco", /await toggleTask\(tarefa\.id\)[\s\S]{0,120}if \(r\.ok\)/.test(modo), true);
conferir("e desfaz quando o banco recusa", (ler("lib/context/AgendaContext.tsx").match(/return sincronizar\(\s*\(\) => saveAgendaTask\((alterada|movida)\),\s*\(\) => setTasks/g) ?? []).length, 2);
conferir("os passos vêm da ficha, não do id do item", modo.includes("passosDe(ficha.frente, ficha.ref)"), true);
conferir("a lista da atividade mostra o que falta", ler("components/rotina/ItensDaAtividade.tsx").includes("resumoDosPassos(passos).atual"), true);
conferir("e a Rotina de hoje usa essa lista", ler("components/rotina/RotinaDoDia.tsx").includes("<ItensDaAtividade"), true);
conferir("marcar item só muda a tela depois do banco", /await marcarItensDaRotina[\s\S]{0,80}if \(r\.ok\)/.test(ler("components/rotina/useMeuDia.ts")), true);
conferir("o modo guarda o lugar de cada item (não segue o item que mudou de atividade)", modo.includes("lugar.get(x.chave)"), true);
conferir("a Agenda chega ao modo", ler("components/rotina/RotinaDoDia.tsx").includes('href="/meu-dia?um-por-vez"') && ler("app/meu-dia/page.tsx").includes('has("um-por-vez")'), true);

console.log(falhas === 0 ? "\n  O modo um por vez leva a fila até o fim.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
