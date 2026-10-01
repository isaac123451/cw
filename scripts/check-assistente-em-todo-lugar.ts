/**
 * O assistente sabe o que está aberto?
 *
 *   npm run check:assistente-em-todo-lugar
 *
 * Sem banco (1.125, Fase 28). O contexto da tela que o botão flutuante
 * manda junto com a pergunta: a mini-janela na frente vence a página; a
 * ficha aberta pelo endereço (reclamação, Redes, NPS); senão, o nome da
 * tela. E a fiação: o botão no layout, a página e o botão usando a mesma
 * conversa, e a extensão respondendo no painel.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import { contextoDaTela } from "../lib/models/contextoDaTela";
import type { NpsResponseView } from "../lib/models/nps";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const caso = { id: "RA-1", dbId: "db1", protocol: "RA-1", source: "Reclame Aqui", status: "Novo", createdAt: "2026-09-19", customer: "Gabriel", title: "Cancelamento" } as unknown as Case;
const outro = { id: "RA-2", dbId: "db2", protocol: "RA-2", source: "Reclame Aqui", status: "Respondido", createdAt: "2026-09-10", customer: "Ana", title: "Impressora" } as unknown as Case;
const nps = { id: "n1", score: 3, comment: "Robô não responde", respondedAt: "2026-09-30T10:00:00Z", customer: "joao", customerName: "João", status: "Novo", firstContactDueAt: "2026-10-01T12:00:00Z" } as unknown as NpsResponseView;

console.log("\n  O CONTEXTO DA TELA\n");

const base = { casos: [caso, outro], nps: [nps], janelas: [] as { frente: string; ref: string; minimizada: boolean; z: number }[] };
const naFicha = contextoDaTela({ ...base, caminho: "/reclame-aqui/RA-1" });
conferir("na ficha da reclamação, o caso é o contexto", [naFicha.tipo, naFicha.rotulo], ["caso", "RA-1 · Gabriel"]);
conferir("e o texto leva o caso inteiro", naFicha.texto.includes("Cancelamento") && naFicha.texto.includes('status "Novo"'), true);
conferir("pelo id do banco também acha", contextoDaTela({ ...base, caminho: "/reclame-aqui/db2" }).rotulo, "RA-2 · Ana");
conferir("telas do módulo não viram caso (Índice)", contextoDaTela({ ...base, caminho: "/reclame-aqui/indice", nomeDaTela: "Reclame Aqui" }).tipo, "tela");
const naJanela = contextoDaTela({ ...base, caminho: "/reclame-aqui/RA-1", janelas: [{ frente: "reclame-aqui", ref: "RA-2", minimizada: false, z: 3 }, { frente: "nps", ref: "n1", minimizada: false, z: 1 }] });
conferir("a mini-janela na frente vence a página", naJanela.rotulo, "RA-2 · Ana");
conferir("janela minimizada não conta", contextoDaTela({ ...base, caminho: "/meu-dia", nomeDaTela: "Meu dia", janelas: [{ frente: "reclame-aqui", ref: "RA-2", minimizada: true, z: 9 }] }).tipo, "tela");
const noNps = contextoDaTela({ ...base, caminho: "/nps/n1" });
conferir("na ficha do NPS, a resposta é o contexto", [noNps.tipo, noNps.rotulo], ["nps", "NPS de João (nota 3)"]);
conferir("as sugestões mudam com o que está aberto", [naFicha.sugestoes[0], noNps.sugestoes[0], contextoDaTela({ ...base, caminho: "/agenda", nomeDaTela: "Agenda" }).sugestoes[0]], ["O que fazer agora neste caso?", "Como abordar este cliente?", "Qual o próximo passo de hoje?"]);

console.log("\n  A FIAÇÃO\n");
const ler = (arquivo: string) => readFileSync(resolve(__dirname, "..", arquivo), "utf8");
conferir("o botão está no layout, em qualquer tela", ler("app/layout.tsx").includes("<AssistenteFlutuante />"), true);
conferir("a página e o botão usam a mesma conversa", ler("app/assistente/page.tsx").includes("useConversaDoAssistente()") && ler("components/assistente/AssistenteFlutuante.tsx").includes("useConversaDoAssistente()"), true);
conferir("o botão manda o contexto da tela junto", ler("components/assistente/AssistenteFlutuante.tsx").includes("perguntar(pergunta, contexto.texto)"), true);
conferir("a rota da extensão exige sessão", ler("app/api/extensao/assistente/route.ts").includes("if (!usuario && !demonstracao) return semSessao(request);"), true);

console.log(falhas === 0 ? "\n  O assistente sabe o que está aberto.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
