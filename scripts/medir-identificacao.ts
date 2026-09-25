/**
 * Identificação que acerta mais — quantos casos sem vínculo ganham
 * sugestão de estabelecimento, e por qual pista. Só leitura.
 *
 *   npx tsx scripts/medir-identificacao.ts
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { candidatosPelasPistas, nomeSustentaSugestao, pistasDoTexto } from "../lib/services/contatoConhecido.service";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const casos = await prisma.case.findMany({
    where: { establishmentId: null },
    select: {
      protocol: true, customer: true, socialHandle: true, title: true, description: true, email: true, document: true, channel: true,
      conversas: { select: { mensagens: { where: { de: "cliente" }, select: { texto: true }, take: 200 } } },
    },
  });
  let com = 0;
  const motivos = new Map<string, number>();
  const exemplos: string[] = [];
  for (const c of casos) {
    const doTexto = pistasDoTexto([c.title, c.description ?? "", ...c.conversas.flatMap((v) => v.mensagens.map((m) => m.texto))].join("\n"));
    const cand = (
      await candidatosPelasPistas(prisma, {
        nome: c.customer,
        perfil: c.socialHandle ?? undefined,
        documentos: [...(c.document ? [c.document] : []), ...doTexto.documentos],
        emails: [...(c.email && !c.email.includes("•") ? [c.email] : []), ...doTexto.emails],
        slugs: doTexto.slugs,
      }, 10)
    )
      .filter((x) => x.tipo === "conta")
      .filter((x) => x.motivo !== "parecido com o nome" || nomeSustentaSugestao(c.customer, x.titulo));
    if (cand.length) {
      com += 1;
      motivos.set(cand[0].motivo, (motivos.get(cand[0].motivo) ?? 0) + 1);
      if (exemplos.length < 8) exemplos.push(`${c.protocol} "${c.customer}" → ${cand[0].titulo} (${cand[0].motivo}, ${cand[0].semelhanca.toFixed(2)})`);
    }
  }
  console.log(`\n  ${casos.length} casos sem estabelecimento · ${com} ganham sugestão\n`);
  for (const [m, n] of motivos) console.log(`  ${String(n).padStart(4)}  ${m}`);
  console.log("");
  for (const e of exemplos) console.log(`  ${e}`);
  console.log("");
  process.exit(0);
}

main();
