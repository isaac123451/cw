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
import { anotarConversasDoDia, desfazer, leituraDaResposta, seguirPelasConversas, type ConversaParaLer } from "../lib/services/iaDoDia.service";
import { paredeDe } from "../lib/services/horasUteis";

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

  await identidade(prisma, eu.id);

  console.log(falhas === 0 ? "\n  A IA completa e segue a conversa, e o desfazer devolve tudo.\n" : `\n  ${falhas} falha(s).\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

/**
 * O cliente certo, o segmento certo, nada sem sentido (09/10/2026).
 *
 * O caso real: as mensagens do Fabiano gravadas na conversa do Eduardo ao
 * trocar de conversa no WhatsApp; o número gravado como nome; a anotação no
 * cliente errado. A leitura da IA é trocada por respostas prontas — o que
 * se prova aqui é o que a plataforma faz com ela.
 */
async function identidade(prisma: NonNullable<ReturnType<typeof getPrisma>>, euId: string) {
  console.log("\n  IA — CLIENTE CERTO, SEGMENTO CERTO (contra o banco, descartável)\n");
  const marca = `ZZ-IA-ID-${Date.now()}`;
  const agora = new Date();
  const ha = (min: number) => new Date(agora.getTime() - min * 60_000);
  const hoje = paredeDe(agora).dia;
  const casos: string[] = [];
  const npss: string[] = [];
  const conversas: string[] = [];
  const tarefas: string[] = [];

  try {
    const novoCaso = async (sufixo: string) => {
      const c = await prisma.case.create({
        data: { protocol: `RA-${marca}-${sufixo}`, companyName: "Não informado", customer: "Não informado", title: "WhatsApp bloqueado toda semana", status: "Novo", publishedAt: ha(600) },
        select: { id: true },
      });
      casos.push(c.id);
      return c.id;
    };
    const novaConversa = async (dados: { telefone: string; contatoNome: string; caseId?: string; npsResponseId?: string }, mensagens: { de: string; autor: string; texto: string; min: number; lote: number }[]) => {
      const c = await prisma.conversa.create({
        data: {
          ...dados,
          guardadaPor: "check",
          mensagens: {
            create: mensagens.map((m, i) => ({ chave: `wa:${marca}-${conversas.length}-${i}`, de: m.de, autor: m.autor, texto: m.texto, em: ha(m.min), origem: "extensao", criadoEm: ha(m.lote) })),
          },
        },
        select: { id: true, mensagens: { orderBy: { em: "asc" }, select: { id: true, texto: true } } },
      });
      conversas.push(c.id);
      return c;
    };

    /* O Eduardo, com o lote do Fabiano no meio. */
    const casoEduardo = await novoCaso("ED");
    const eduardo = await novaConversa({ telefone: "5585999011757", contatoNome: "+55 85 9901-1757", caseId: casoEduardo }, [
      { de: "cliente", autor: "+55 85 9901-1757", texto: "Meu WhatsApp foi bloqueado de novo", min: 120, lote: 118 },
      { de: "cliente", autor: "+55 66 9925-6119", texto: "Meu CNPJ é 11.222.333/0001-81", min: 110, lote: 100 },
      { de: "nos", autor: "Cardápio Web (Reputação)", texto: "Fabiano, é exatamente como ela explicou", min: 108, lote: 100 },
      { de: "nos", autor: "Cardápio Web (Reputação)", texto: "Boa tarde, Eduardo! Vi a sua reclamação sobre o bloqueio.", min: 99, lote: 98 },
      { de: "cliente", autor: "+55 85 9901-1757", texto: "Isso, toda semana bloqueia", min: 97, lote: 96 },
      { de: "nos", autor: "Cardápio Web (Reputação)", texto: "Entendi. Vou levar para o time de integração.", min: 95, lote: 94 },
    ]);

    await seguirPelasConversas(prisma, euId, agora, [eduardo.id]);
    const ficha = await prisma.case.findUnique({ where: { id: casoEduardo }, select: { customer: true, companyName: true, document: true } });
    conferir("o nome vem de “Boa tarde, Eduardo!”, não do número", [ficha?.customer, ficha?.companyName], ["Eduardo", "Eduardo"]);
    conferir("o CNPJ do lote de outra conversa não entra", ficha?.document ?? null, null);
    const contato = await prisma.caseContato.findFirst({ where: { caseId: casoEduardo }, select: { em: true } });
    conferir("o 1º contato é a nossa primeira mensagem desta conversa (não a da outra)", contato?.em.toISOString(), ha(99).toISOString());

    /* A anotação: o que a IA recebe e o que a plataforma faz com a resposta. */
    let recebido: ConversaParaLer | null = null;
    let leituras = 0;
    const responder = (resposta: Record<string, unknown>) => async (entrada: ConversaParaLer) => {
      recebido = entrada;
      leituras += 1;
      return leituraDaResposta(resposta, [entrada.caso ? "reclamacao" : null, entrada.nps ? "nps" : null].filter((s): s is string => Boolean(s)), hoje);
    };
    const boa = {
      sobre_este_cliente: true,
      segmento: "reclamacao",
      vale_anotar: true,
      motivo: "",
      resumo: "O WhatsApp do Eduardo é bloqueado toda semana; levamos ao time de integração.",
      pendente: "nós: retorno do time de integração",
      importantes: ["Bloqueio do WhatsApp toda semana"],
      retorno: { precisa: true, quem: "nos", oque: "Dar o retorno do time de integração", dia: "" },
    };
    await anotarConversasDoDia(prisma, euId, agora, [eduardo.id], responder(boa));
    const lido = recebido as ConversaParaLer | null;
    conferir("a IA recebe o nome certo e a reclamação ligada", [lido?.nome, lido?.caso?.titulo], ["Eduardo", "WhatsApp bloqueado toda semana"]);
    conferir("e a conversa sem o lote de outra (4 de 6 mensagens)", lido?.mensagens.length, 4);
    const nota = await prisma.caseComment.findFirst({ where: { caseId: casoEduardo }, select: { body: true } });
    conferir("a anotação vai na ficha do Eduardo, com os pontos importantes", [nota?.body.startsWith("Conversa de hoje no WhatsApp com Eduardo:"), nota?.body.includes("Pontos importantes:")], [true, true]);
    const nossa = eduardo.mensagens.find((m) => m.texto.startsWith("Entendi."))!;
    const lembrete = await prisma.agendaTask.findUnique({ where: { id: `auto-promessa-${nossa.id}` }, select: { title: true, done: true, caseId: true } });
    if (lembrete) tarefas.push(`auto-promessa-${nossa.id}`);
    conferir("o retorno vira lembrete, ligado ao caso, que fecha quando respondermos", [lembrete?.title, lembrete?.done, lembrete?.caseId], ["Retornar a Eduardo: Dar o retorno do time de integração", false, casoEduardo]);

    /* NPS: a conversa ligada ao NPS e à reclamação, e a IA diz que é do NPS. */
    const nps = await prisma.npsResponse.create({ data: { score: 4, comment: "Demora no suporte", respondedAt: ha(600), customer: marca, status: "Novo", firstContactDueAt: ha(300) }, select: { id: true } });
    npss.push(nps.id);
    const casoAna = await novoCaso("ANA");
    const ana = await novaConversa({ telefone: "5511988887777", contatoNome: "Ana Paula", caseId: casoAna, npsResponseId: nps.id }, [
      { de: "nos", autor: "Cardápio Web (Reputação)", texto: "Oii, Ana! Vi a sua nota na pesquisa.", min: 90, lote: 89 },
      { de: "cliente", autor: "Ana Paula", texto: "O suporte demorou dois dias para responder", min: 85, lote: 84 },
    ]);
    await anotarConversasDoDia(prisma, euId, agora, [ana.id], responder({ ...boa, segmento: "nps", resumo: "A Ana deu nota 4 pela demora do suporte.", retorno: { precisa: false, quem: "nos", oque: "", dia: "" } }));
    conferir("do NPS: a anotação vai no NPS, não na reclamação", [await prisma.npsNote.count({ where: { responseId: nps.id } }), await prisma.caseComment.count({ where: { caseId: casoAna } })], [1, 0]);

    /* Sem sentido e assunto de outro: nada anotado, e não lê de novo sem mensagem nova. */
    const casoSem = await novoCaso("SEM");
    const sem = await novaConversa({ telefone: "5511977776666", contatoNome: "Bruno", caseId: casoSem }, [
      { de: "nos", autor: "Cardápio Web (Reputação)", texto: "Bom dia, Bruno!", min: 80, lote: 79 },
      { de: "cliente", autor: "Bruno", texto: "ok", min: 75, lote: 74 },
    ]);
    leituras = 0;
    await anotarConversasDoDia(prisma, euId, agora, [sem.id], responder({ ...boa, vale_anotar: false, motivo: "Só cumprimento." }));
    await anotarConversasDoDia(prisma, euId, agora, [sem.id], responder(boa));
    conferir("“bom dia” e “ok” não viram anotação, e a conversa não é lida de novo", [await prisma.caseComment.count({ where: { caseId: casoSem } }), leituras], [0, 1]);
    const casoOutro = await novoCaso("OUT");
    const outro = await novaConversa({ telefone: "5511966665555", contatoNome: "Carla", caseId: casoOutro }, [
      { de: "nos", autor: "Cardápio Web (Reputação)", texto: "Oi, Carla! Sobre o plano novo…", min: 70, lote: 69 },
      { de: "cliente", autor: "Carla", texto: "Quero contratar mais uma loja", min: 65, lote: 64 },
    ]);
    await anotarConversasDoDia(prisma, euId, agora, [outro.id], responder({ ...boa, segmento: "outro" }));
    conferir("conversa que não trata da reclamação ligada não vira anotação nela", await prisma.caseComment.count({ where: { caseId: casoOutro } }), 0);
    leituras = 0;
    await anotarConversasDoDia(prisma, euId, agora, [outro.id], responder(boa));
    conferir("e, lida uma vez, só é lida de novo quando chegar mensagem nova", [await prisma.caseComment.count({ where: { caseId: casoOutro } }), leituras], [0, 0]);
    const invisiveis = await prisma.acaoDaIA.findMany({ where: { userId: euId, chave: { startsWith: `anotacao-lida:conversa:${sem.id}` } }, select: { tipo: true, vistaEm: true } });
    conferir("o “lido, nada anotado” não aparece em lugar nenhum", invisiveis.map((a) => [a.tipo, Boolean(a.vistaEm)]), [["aviso", true]]);
  } finally {
    await prisma.acaoDaIA.deleteMany({
      where: { userId: euId, OR: [...casos, ...npss, ...conversas, ...tarefas].map((id) => ({ chave: { contains: id } })) },
    });
    if (tarefas.length) await prisma.agendaTask.deleteMany({ where: { id: { in: tarefas } } });
    await prisma.agendaTask.deleteMany({ where: { caseId: { in: casos } } });
    if (conversas.length) await prisma.conversa.deleteMany({ where: { id: { in: conversas } } });
    if (casos.length) await prisma.case.deleteMany({ where: { id: { in: casos } } });
    if (npss.length) await prisma.npsResponse.deleteMany({ where: { id: { in: npss } } });
    const sobrou = await prisma.case.count({ where: { protocol: { startsWith: "RA-ZZ-IA-ID-" } } });
    conferir("nada descartável ficou na base (identidade)", sobrou, 0);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
