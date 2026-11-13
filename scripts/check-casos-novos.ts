/**
 * Os casos novos caem para quem foi marcado, e cada um vê o seu dia?
 *
 *   npm run check:casos-novos
 *
 * 13/11/2026 — "hoje os novos casos devem cair para a michele", "o meu dia
 * precisa ser diferente de cada usuário", e "uma notificação diferente de
 * que um caso caiu". Sem banco.
 */
import { readFileSync } from "node:fs";

import type { Case } from "../lib/models/case";
import { ehMeu, separacaoAtiva, type DivisaoDoDia } from "../lib/models/divisaoDoDia";
import { buildNotifications } from "../lib/services/notifications.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)}`);
}

const usuarios = [{ id: "u-carlos", nome: "Carlos Isaac" }, { id: "u-michele", nome: "Thaila Michele Pereira da Silva" }, { id: "u-thais", nome: "Thais Portela" }];
const dia = (eu: string): DivisaoDoDia => ({ eu, pessoas: [{ id: "u-carlos", nome: "Carlos Isaac", frentes: ["reclame-aqui", "redes", "nps", "google"], ausente: false }], usuarios });

console.log("\n  O MEU DIA DE CADA UM\n");
const daMichele = { chave: "c1", dono: "Thaila Michele Pereira da Silva", frente: "reclame-aqui" as const };
const semDono = { chave: "c2", dono: null, frente: "reclame-aqui" as const };
conferir("o caso da Michele está no dia dela", ehMeu(daMichele, dia("u-michele")), true);
conferir("e não no do Carlos", ehMeu(daMichele, dia("u-carlos")), false);
conferir("nem no da Thais", ehMeu(daMichele, dia("u-thais")), false);
conferir("caso sem responsável: no dia de quem abre (divisão desligada)", [ehMeu(semDono, dia("u-carlos")), ehMeu(semDono, dia("u-michele"))], [true, true]);
conferir("responsável que não é conta (texto livre): no dia de todos", ehMeu({ ...semDono, dono: "Fulano de Fora" }, dia("u-thais")), true);
conferir("a separação liga com mais de uma conta", separacaoAtiva(dia("u-carlos")), true);
const ausente: DivisaoDoDia = { eu: "u-carlos", pessoas: [{ id: "u-michele", nome: "Thaila Michele Pereira da Silva", frentes: ["reclame-aqui"], ausente: true }], usuarios };
conferir("Michele ausente: o caso dela volta para o dia de quem abre", ehMeu(daMichele, ausente), true);

console.log("\n  O AVISO\n");
const agora = new Date();
const caso = (extra: Partial<Case>) => ({ id: "3gnD", protocol: "RA-3gnDNHnTdGwX3cVW", idRa: "264222201", source: "Reclame Aqui", customer: "Ana", title: "Repasse atrasado", status: "Novo", priority: "Alta", category: "Financeiro", owner: "Thaila Michele Pereira da Silva", createdAt: new Date(agora.getTime() - 3_600_000).toISOString(), ...extra }) as unknown as Case;
const avisos = (casos: Case[], eu?: string) => buildNotifications(casos, [], undefined, undefined, [], [], undefined, { agora, eu }).filter((n) => n.id.startsWith("caso-novo-"));
const um = avisos([caso({})], "Thaila Michele Pereira da Silva");
conferir("caso novo dela: um aviso, com o ID no título", um.map((n) => n.title), ["Caso novo para você · ID 264222201"]);
conferir("com o resumo: quem, o quê, frente, prioridade, categoria", um[0]?.detail, "Ana: Repasse atrasado — Reclame Aqui · prioridade alta · Financeiro");
conferir("para outra pessoa não aparece", avisos([caso({})], "Carlos Isaac").length, 0);
conferir("já com 1º contato não avisa", avisos([caso({ primeiroContatoEm: agora.toISOString() })], "Thaila Michele Pereira da Silva").length, 0);
conferir("chegou há 3 dias: não avisa mais", avisos([caso({ createdAt: new Date(agora.getTime() - 72 * 3_600_000).toISOString() })], "Thaila Michele Pereira da Silva").length, 0);

console.log("\n  O CASO NASCE COM RESPONSÁVEL\n");
const repo = readFileSync("lib/services/case.repository.ts", "utf8");
conferir("o vigia (criarSeNova) dá o responsável", repo.includes("const dono = colunas.ownerId ? null : await donoDoCasoNovo(prisma, item.protocol);"), true);
conferir("o upsert dá só na criação", repo.includes("...(dados.ownerId ? {} : await donoParaCriar(prisma, item.protocol))") && repo.includes("if (jaExiste) return {};"), true);
conferir("a escolha é pela marca, fixa pelo protocolo", repo.includes("MARCA_DE_NOVOS_CASOS") && repo.includes("hashDoItem(`novo:${protocolo}`)"), true);
conferir("o interruptor está nas Permissões", readFileSync("app/configuracoes/permissoes/page.tsx", "utf8").includes("Recebe os casos novos"), true);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
