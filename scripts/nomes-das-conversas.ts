/**
 * Conversa guardada sem nome — só o telefone — ganha o nome do cliente
 * (21/10/2026): o da ficha ligada (caso, NPS ou restaurante) ou o do
 * cumprimento ("Boa tarde, Eduardo!"), pela mesma regra da IA do dia
 * (`nomeDoCliente`). Nunca troca um nome que já existe.
 *
 *   npx tsx --conditions=react-server scripts/nomes-das-conversas.ts            (só mostra)
 *   npx tsx --conditions=react-server scripts/nomes-das-conversas.ts --aplicar
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { nomeDePessoa, nomeDoCliente, pareceTelefone } from "../lib/models/identidadeNaConversa";

(async () => {
  const p = getPrisma();
  if (!p) throw new Error("Sem banco.");
  const aplicar = process.argv.includes("--aplicar");
  const conversas = await p.conversa.findMany({
    select: {
      id: true,
      telefone: true,
      contatoNome: true,
      case: { select: { customer: true } },
      npsResponse: { select: { customerName: true } },
      establishment: { select: { name: true } },
      mensagens: { select: { de: true, texto: true }, orderBy: { em: "asc" }, take: 200 },
    },
  });
  /* O nome de quem atende nunca vira o do cliente ("Sou o Carlos Isaac"). */
  const primeiro = (nome: string) => nome.trim().split(/\s+/)[0].toLowerCase();
  const doTime = new Set((await p.user.findMany({ select: { name: true } })).map((u) => primeiro(u.name ?? "")).filter(Boolean));
  let n = 0;
  for (const c of conversas) {
    if (c.contatoNome && !pareceTelefone(c.contatoNome) && nomeDePessoa(c.contatoNome)) continue;
    const ficha = c.case?.customer ?? c.npsResponse?.customerName ?? c.establishment?.name;
    const nome = nomeDoCliente({ contatoNome: null, telefone: c.telefone }, ficha, c.mensagens);
    if (!nome || doTime.has(primeiro(nome))) continue;
    console.log(`  ${c.contatoNome || "(vazio)"} -> ${nome}`);
    n += 1;
    if (aplicar) await p.conversa.update({ where: { id: c.id }, data: { contatoNome: nome.slice(0, 120) } });
  }
  console.log(`\n  ${n} ${aplicar ? "nomeadas" : "a nomear (use --aplicar)"}.`);
  process.exit(0);
})();
