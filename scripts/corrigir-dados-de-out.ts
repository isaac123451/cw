/**
 * Correções dos dados de produção achados na revisão de out/2026.
 *
 *   npm run corrigir:dados-out            simula (não grava)
 *   npm run corrigir:dados-out -- --gravar  grava
 *
 * Grava antes `backup-correcao-dados-<data e hora>.json` com as linhas que
 * vai mexer. Faz: mensalidade do Kantinho Burger (×100 → R$ 209,99); três
 * reclamações do dono de teste "Conferência" para o Carlos; três
 * atendimentos de Redes com cliente "@Carlos"; causa raiz "a"; duas
 * anotações de teste; título de atividade com texto do WhatsApp; conta sem
 * acesso (Carla Campos) sem nenhuma referência.
 *
 * Plano "Essencial" (238 contas, fora da tabela de planos): fica sem plano,
 * por decisão dele em 07/10. **Não faz** a data da resposta de
 * RA-I5w9VRnF0693mv9g — fica para depois.
 */
import { writeFileSync } from "node:fs";
import { getPrisma } from "../lib/prisma";
import { itemDoSlack, tituloDaCaptura } from "../lib/models/capturaDasRedes";

const GRAVAR = process.argv.includes("--gravar");

async function main() {
  const p = getPrisma()!;
  const backup: Record<string, unknown> = {};
  const plano: string[] = [];

  /* A. mensalidade ×100 */
  const kant = await p.establishment.findFirst({ where: { name: "Kantinho Burger" }, select: { id: true, mrrCents: true, plan: true } });
  backup.kantinho = kant;
  if (kant?.mrrCents === 2099900) plano.push("Kantinho Burger: 2099900 -> 20999");

  /* B. reclamações com dono de teste */
  const carlos = await p.user.findFirst({ where: { email: "carlos.isaac@cardapioweb.com" }, select: { id: true } });
  const conf = await p.case.findMany({ where: { owner: { name: "Conferência" } }, select: { id: true, protocol: true, ownerId: true } });
  backup.conferencia = conf;
  plano.push(`${conf.length} reclamações Conferência -> Carlos Isaac`);

  /* C. redes */
  const redes = await p.case.findMany({ where: { protocol: { in: ["IG-6E758CB6", "IG-86B57A69", "IG-65CA381F"] } } });
  backup.redes = redes;
  const novosRedes = redes.map((c) => {
    const corpo = (c.description ?? "").split(/\n\nCapturado do Slack/)[0];
    const rodape = (c.description ?? "").slice(corpo.length).trim();
    const it = itemDoSlack({ canal: "x", ts: "0", texto: corpo, mencoes: ["@Carlos Isaac"] });
    const cliente = it.nome || (c.email ? c.email.split("@")[0] : "Não identificado");
    return { id: c.id, protocol: c.protocol, customer: cliente, title: tituloDaCaptura(it), description: [it.texto, "", rodape].join("\n").trim(), socialHandle: it.perfil || null };
  });
  plano.push(...novosRedes.map((n) => `${n.protocol}: cliente "${n.customer}" · título "${n.title}" · handle ${n.socialHandle}`));

  /* D. causa "a" e anotações de teste */
  const causa = await p.npsRootCause.findFirst({ where: { name: "a" } });
  const notas = await p.caseComment.findMany({ where: { OR: [{ body: "aaa" }, { body: "o gustavo é lindo" }] } });
  backup.causa = causa; backup.notas = notas;
  plano.push(`causa "a": ${causa ? "apagar" : "não existe"}; anotações de teste: ${notas.length}`);

  /* E. tarefa com texto do WhatsApp */
  const tarefa = await p.agendaTask.findUnique({ where: { id: "auto-conversa-cmuv8x9zf000g04kxbj7344ii" } });
  backup.tarefa = tarefa;
  const novoTitulo = tarefa?.title.replace("com clique para mostrar os dados do contato", "com o cliente");
  plano.push(`tarefa: "${novoTitulo}"`);

  /* F. conta sem acesso, sem nenhuma referência */
  const carla = await p.user.findFirst({ where: { email: "carla-campos@sem-acesso.local" }, include: { _count: { select: { ownedCases: true, comments: true, tasks: true, npsResponses: true, npsNotes: true, caseContatos: true, moduleRoles: true } } } });
  backup.carla = carla;
  const refs = carla ? Object.values(carla._count).reduce((a, b) => a + b, 0) : -1;
  plano.push(`Carla Campos (sem acesso): referências ${refs} -> ${refs === 0 ? "apagar" : "MANTER"}`);

  const essencial = await p.establishment.count({ where: { plan: "Essencial" } });
  plano.push(`plano Essencial -> sem plano: ${essencial} estabelecimentos`);

  console.log(plano.join("\n"));
  if (!GRAVAR) { console.log("\n(simulação — nada gravado; use --gravar)"); return; }

  writeFileSync(`backup-correcao-dados-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(backup, null, 2));
  if (kant?.mrrCents === 2099900) await p.establishment.update({ where: { id: kant.id }, data: { mrrCents: 20999 } });
  if (carlos && conf.length) await p.case.updateMany({ where: { id: { in: conf.map((c) => c.id) } }, data: { ownerId: carlos.id } });
  for (const n of novosRedes) await p.case.update({ where: { id: n.id }, data: { customer: n.customer, title: n.title, description: n.description, socialHandle: n.socialHandle } });
  if (causa) await p.npsRootCause.delete({ where: { id: causa.id } });
  if (notas.length) await p.caseComment.deleteMany({ where: { id: { in: notas.map((n) => n.id) } } });
  if (tarefa && novoTitulo) await p.agendaTask.update({ where: { id: tarefa.id }, data: { title: novoTitulo } });
  if (essencial) await p.establishment.updateMany({ where: { plan: "Essencial" }, data: { plan: "" } });
  if (carla && refs === 0) await p.user.delete({ where: { id: carla.id } });
  console.log("\ngravado.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e.message).slice(0, 800)); process.exit(1); });
