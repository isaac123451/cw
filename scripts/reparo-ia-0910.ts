/**
 * Reparo de 09/10/2026: o que a conversa misturada e o nome-telefone sujaram.
 *
 *   npx tsx --conditions=react-server scripts/reparo-ia-0910.ts            (só mostra)
 *   npx tsx --conditions=react-server scripts/reparo-ia-0910.ts --aplicar  (corrige)
 *
 * A. Apaga da conversa errada as mensagens gravadas com a tela de outra
 *    conversa — só as que têm cópia na conversa certa (nada se perde).
 * B. Nome e empresa que viraram telefone voltam ao nome que a conversa dá
 *    ("Boa tarde, Eduardo!"), e as anotações e ações da IA que chamaram o
 *    cliente pelo número passam a chamar pelo nome.
 * C. Desfaz o CNPJ que a IA tirou de mensagem alheia (ficha do Jair) e a
 *    anotação da Point Smart na ficha do Eduardo — pelo próprio "Desfazer".
 * D. Acerta o 1º contato do Eduardo: a nossa primeira mensagem a ele, sem
 *    resposta naquele dia.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { nomeDaConversa, pareceTelefone, semMensagensDeOutraConversa } from "../lib/models/identidadeNaConversa";
import { desfazer } from "../lib/services/iaDoDia.service";
import { recalcularResumo } from "../lib/services/tratativa.service";
import { descreverRegistro } from "../lib/services/horasUteis";

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  console.log(APLICAR ? "\n  APLICANDO\n" : "\n  SÓ MOSTRANDO — rode com --aplicar para corrigir\n");

  /* A. As cópias na conversa errada. */
  const conversas = await prisma.conversa.findMany({
    select: { id: true, telefone: true, contatoNome: true, mensagens: { select: { id: true, de: true, autor: true, chave: true, criadoEm: true } } },
  });
  const ondeEsta = new Map<string, Set<string>>();
  for (const c of conversas) for (const m of c.mensagens) ondeEsta.set(m.chave, (ondeEsta.get(m.chave) ?? new Set()).add(c.id));
  const apagar: string[] = [];
  for (const c of conversas) {
    const limpas = new Set(semMensagensDeOutraConversa({ telefone: c.telefone, nome: c.contatoNome }, c.mensagens).map((m) => m.id));
    const fora = c.mensagens.filter((m) => !limpas.has(m.id));
    if (!fora.length) continue;
    const semCopia = fora.filter((m) => (ondeEsta.get(m.chave)?.size ?? 0) < 2);
    if (semCopia.length) {
      console.log(`  A. ${c.id}: ${semCopia.length} sem cópia na conversa certa — fica como está`);
      continue;
    }
    apagar.push(...fora.map((m) => m.id));
  }
  console.log(`  A. mensagens na conversa errada, todas com cópia na certa: ${apagar.length}`);
  if (APLICAR && apagar.length) console.log("     apagadas:", (await prisma.mensagemDaConversa.deleteMany({ where: { id: { in: apagar } } })).count);

  /* B. Nome e empresa que viraram telefone. */
  const casos = await prisma.case.findMany({
    where: { OR: [{ customer: { startsWith: "+" } }, { companyName: { startsWith: "+" } }] },
    select: { id: true, protocol: true, customer: true, companyName: true },
  });
  for (const k of casos.filter((x) => pareceTelefone(x.customer))) {
    const c = await prisma.conversa.findFirst({
      where: { caseId: k.id },
      select: { telefone: true, contatoNome: true, mensagens: { orderBy: { em: "asc" }, select: { de: true, autor: true, chave: true, texto: true, criadoEm: true } } },
    });
    const nome = c ? nomeDaConversa(semMensagensDeOutraConversa({ telefone: c.telefone, nome: c.contatoNome }, c.mensagens)) : "";
    console.log(`  B. ${k.protocol}: "${k.customer}" -> "${nome || "Não informado"}"`);
    if (!APLICAR) continue;
    await prisma.case.update({
      where: { id: k.id },
      data: { customer: nome || "Não informado", companyName: pareceTelefone(k.companyName) ? nome || "Não informado" : k.companyName },
    });
    const comoChamar = nome || "o cliente";
    const comentarios = await prisma.caseComment.findMany({ where: { caseId: k.id, authorName: "Assistente (IA)", body: { contains: k.customer } }, select: { id: true, body: true } });
    for (const cm of comentarios) await prisma.caseComment.update({ where: { id: cm.id }, data: { body: cm.body.split(k.customer).join(comoChamar) } });
    const acoes = await prisma.acaoDaIA.findMany({ where: { OR: [{ titulo: { contains: k.customer } }, { detalhe: { contains: k.customer } }] }, select: { id: true, titulo: true, detalhe: true } });
    for (const a of acoes) {
      await prisma.acaoDaIA.update({ where: { id: a.id }, data: { titulo: a.titulo.split(k.customer).join(comoChamar), detalhe: a.detalhe?.split(k.customer).join(comoChamar) } });
    }
    console.log(`     ${comentarios.length} anotação(ões) e ${acoes.length} ação(ões) passam a chamar pelo nome`);
  }

  /* C. O que a IA tirou de mensagem alheia. */
  const jair = await prisma.case.findFirst({ where: { protocol: "RA-Rc5aN9PW9dfi1xai" }, select: { id: true } });
  const eduardo = await prisma.case.findFirst({ where: { protocol: "RA-vxt7cMxfpL2mg6L6" }, select: { id: true } });
  const desfazerEstas = await prisma.acaoDaIA.findMany({
    where: {
      desfeitaEm: null,
      OR: [
        ...(jair ? [{ chave: `completou:caso:${jair.id}:documento` }] : []),
        { tipo: "anotacao", criadaEm: { lt: new Date("2026-10-09T05:00:00Z") }, titulo: { contains: "RA-vxt7cMxfpL2mg6L6" } },
      ],
    },
    select: { id: true, userId: true, titulo: true },
  });
  for (const a of desfazerEstas) {
    console.log(`  C. desfazer: ${a.titulo}`);
    if (APLICAR) console.log("     ", JSON.stringify(await desfazer(prisma, a.userId, a.id)));
  }

  /* D. O 1º contato do Eduardo. */
  if (eduardo) {
    const contato = await prisma.caseContato.findFirst({ where: { caseId: eduardo.id }, orderBy: { em: "asc" }, select: { id: true, em: true, tipo: true, resultado: true } });
    const c = await prisma.conversa.findFirst({
      where: { caseId: eduardo.id },
      select: { telefone: true, contatoNome: true, mensagens: { orderBy: { em: "asc" }, select: { de: true, autor: true, chave: true, texto: true, em: true, criadoEm: true } } },
    });
    const limpas = (c ? semMensagensDeOutraConversa({ telefone: c.telefone, nome: c.contatoNome }, c.mensagens) : []).filter(
      (m): m is typeof m & { em: Date } => Boolean(m.em)
    );
    const primeira = contato ? limpas.find((m) => m.de === "nos" && m.em >= new Date(contato.em.getTime() - 86_400_000)) : undefined;
    const respondeu = Boolean(primeira && limpas.some((m) => m.de === "cliente" && m.em > primeira.em));
    console.log(
      `  D. 1º contato do Eduardo: ${contato?.em.toISOString()} ${contato?.tipo}/${contato?.resultado} -> ${primeira?.em.toISOString()} ${respondeu ? "contato/respondeu" : "tentativa/aguardando"}`
    );
    if (APLICAR && contato && primeira) {
      await prisma.caseContato.update({
        where: { id: contato.id },
        data: { em: primeira.em, tipo: respondeu ? "contato" : "tentativa", resultado: respondeu ? "respondeu" : "aguardando" },
      });
      await recalcularResumo(prisma, eduardo.id);
      await prisma.acaoDaIA.updateMany({
        where: { chave: `etapa:caso:${eduardo.id}:primeiro-contato` },
        data: { detalhe: `${respondeu ? "Falou com" : "Tentou contato com"} Eduardo pelo WhatsApp em ${descreverRegistro(primeira.em.toISOString())}.` },
      });
    }
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
