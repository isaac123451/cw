/**
 * A IA completa a ficha e registra o 1º contato pela conversa — contra o
 * banco, só com dado descartável (09/10/2026).
 *
 *   npm run check:ia-seguir-banco
 *
 * Cria uma reclamação, um ciclo de NPS e duas conversas descartáveis; roda
 * `seguirPelasConversas` **só nelas** (as conversas reais não são lidas) e
 * confere: o campo vazio é preenchido e o cheio não é trocado; o 1º contato
 * nasce como "falei com o cliente" quando ele respondeu; rodar de novo não
 * repete; desfazer devolve tudo. No fim apaga o que criou.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { desfazer, seguirPelasConversas } from "../lib/services/iaDoDia.service";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(66)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)}`);
}

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const eu = await prisma.user.findFirst({ where: { active: true, role: "ADMIN" }, select: { id: true, name: true } });
  if (!eu) throw new Error("Sem conta ADMIN ativa.");

  const marca = `ZZ-IA-SEGUIR-${Date.now()}`;
  const agora = new Date();
  const ha = (min: number) => new Date(agora.getTime() - min * 60_000);
  let caseId = "";
  let npsId = "";
  const conversas: string[] = [];

  try {
    console.log("\n  IA — COMPLETAR E SEGUIR PELA CONVERSA (contra o banco, descartável)\n");

    const caso = await prisma.case.create({
      data: {
        protocol: `RA-${marca}`,
        companyName: "Consumidor",
        customer: "Não informado",
        title: "Reclamação descartável da IA",
        status: "Novo",
        email: "ja-tinha@exemplo.com",
        publishedAt: ha(600),
      },
      select: { id: true, createdAt: true },
    });
    caseId = caso.id;

    const nps = await prisma.npsResponse.create({
      data: { score: 3, comment: "Descartável da IA.", respondedAt: ha(600), customer: marca, status: "Novo", firstContactDueAt: ha(300) },
      select: { id: true },
    });
    npsId = nps.id;

    const conversaDoCaso = await prisma.conversa.create({
      data: {
        telefone: "5511960599984",
        contatoNome: "Mariana Descartável",
        caseId,
        guardadaPor: "check",
        mensagens: {
          create: [
            { chave: `${marca}-1`, de: "nos", texto: "Oi Mariana, aqui é da Cardápio Web sobre a sua reclamação.", em: ha(60), origem: "check" },
            { chave: `${marca}-2`, de: "cliente", texto: "Oi! Meu CNPJ é 11.222.333/0001-81 e o e-mail outro@exemplo.com", em: ha(50), origem: "check" },
          ],
        },
      },
      select: { id: true },
    });
    conversas.push(conversaDoCaso.id);

    const conversaDoNps = await prisma.conversa.create({
      data: {
        telefone: "5511900000000",
        contatoNome: "Cliente NPS",
        npsResponseId: npsId,
        guardadaPor: "check",
        mensagens: { create: [{ chave: `${marca}-3`, de: "nos", texto: "Olá! Vi sua nota na pesquisa, posso ajudar?", em: ha(40), origem: "check" }] },
      },
      select: { id: true },
    });
    conversas.push(conversaDoNps.id);

    const feitas = await seguirPelasConversas(prisma, eu.id, agora, conversas);
    conferir("três ações: ficha completada, 1º contato do caso e do NPS", feitas, 3);

    const depois = await prisma.case.findUnique({ where: { id: caseId }, select: { customer: true, email: true, phone: true, document: true, primeiroContatoEm: true } });
    conferir("o nome vazio vem do contato do WhatsApp", depois?.customer, "Mariana Descartável");
    conferir("o e-mail que já tinha não é trocado", depois?.email, "ja-tinha@exemplo.com");
    conferir("o telefone vazio vem da conversa (sem o 55, como a plataforma guarda)", depois?.phone, "11960599984");
    conferir("o CNPJ escrito pelo cliente entra", depois?.document, "11222333000181");
    const contato = await prisma.caseContato.findFirst({ where: { caseId }, select: { tipo: true, resultado: true, canal: true } });
    conferir("1º contato do caso: falei com o cliente, ele respondeu", [contato?.tipo, contato?.resultado, contato?.canal], ["contato", "respondeu", "WhatsApp"]);
    conferir("e o caso passa a ter o 1º contato", Boolean(depois?.primeiroContatoEm), true);
    const ciclo = await prisma.npsResponse.findUnique({ where: { id: npsId }, select: { firstContactAt: true, _count: { select: { attempts: true } } } });
    conferir("1º contato do NPS: a tentativa e a data", [ciclo?._count.attempts, Boolean(ciclo?.firstContactAt)], [1, true]);

    conferir("rodar de novo não repete nada", await seguirPelasConversas(prisma, eu.id, agora, conversas), 0);

    const acoes = await prisma.acaoDaIA.findMany({
      where: { userId: eu.id, OR: [{ chave: { contains: caseId } }, { chave: { contains: npsId } }] },
      select: { id: true, tipo: true },
    });
    conferir("as três ações estão registradas para desfazer", acoes.map((a) => a.tipo).sort(), ["completou", "etapa", "etapa"]);
    for (const a of acoes) await desfazer(prisma, eu.id, a.id);

    const desfeito = await prisma.case.findUnique({ where: { id: caseId }, select: { customer: true, email: true, phone: true, document: true, primeiroContatoEm: true } });
    conferir("desfazer devolve a ficha como estava", [desfeito?.customer, desfeito?.email, desfeito?.phone, desfeito?.document], ["Não informado", "ja-tinha@exemplo.com", null, null]);
    conferir("e tira o 1º contato do caso", [await prisma.caseContato.count({ where: { caseId } }), Boolean(desfeito?.primeiroContatoEm)], [0, false]);
    const cicloDesfeito = await prisma.npsResponse.findUnique({ where: { id: npsId }, select: { firstContactAt: true, _count: { select: { attempts: true } } } });
    conferir("e o do NPS", [cicloDesfeito?._count.attempts, cicloDesfeito?.firstContactAt], [0, null]);
    conferir("desfeito não volta na próxima rodada", await seguirPelasConversas(prisma, eu.id, agora, conversas), 0);
  } finally {
    await prisma.acaoDaIA.deleteMany({ where: { userId: eu.id, OR: [{ chave: { contains: caseId || "nada" } }, { chave: { contains: npsId || "nada" } }] } });
    if (conversas.length) await prisma.conversa.deleteMany({ where: { id: { in: conversas } } });
    if (caseId) await prisma.case.deleteMany({ where: { id: caseId } });
    if (npsId) await prisma.npsResponse.deleteMany({ where: { id: npsId } });
    const sobrou = await prisma.case.count({ where: { protocol: { startsWith: "RA-ZZ-IA-SEGUIR-" } } });
    conferir("nada descartável ficou na base", sobrou, 0);
  }

  console.log(falhas === 0 ? "\n  A IA completa e segue a conversa, e o desfazer devolve tudo.\n" : `\n  ${falhas} falha(s).\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
