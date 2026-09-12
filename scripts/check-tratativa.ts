/**
 * A tratativa da documentação, provada: relógio, triagem e contatos.
 *
 *   npm run check:tratativa
 *
 * Três partes.
 *
 * 1. **O relógio do caso**, sem banco: cada situação que a tela mostra
 *    — "1º contato em 2h", atrasado, "não registrado" para o legado,
 *    solução, encerrado — a partir de uma reclamação de roteiro e das
 *    regras da documentação.
 * 2. **A regra da planilha** que completa a hora da publicação e nunca a
 *    troca.
 * 3. **Contra o banco**, num caso descartável (`RA-ZzTratativa`): a
 *    triagem grava criticidade e critérios; cada contato recalcula o
 *    resumo do caso; apagar recalcula de novo.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { Case } from "../lib/models/case";
import { PRAZOS_DA_DOCUMENTACAO, SlaRule } from "../lib/models/sla";
import { mudancasDoPortal } from "../lib/services/atualizacaoDoPortal";
import { instanteDe, instanteDeParede } from "../lib/services/horasUteis";
import { resolveRule, slaStatus } from "../lib/services/sla.service";
import {
  gravarContato,
  problemaDoContato,
  removerContato,
  triar,
} from "../lib/services/tratativa.service";

let falhas = 0;

function confere(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`${" ".repeat(7)}${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const br = (dia: string, hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m);
};

const REGRAS: SlaRule[] = PRAZOS_DA_DOCUMENTACAO.map((p, i) => ({
  ...p,
  id: `doc-${i}`,
  active: true,
}));

function caso(extra: Partial<Case>): Case {
  return {
    id: "x",
    protocol: "RA-ROTEIRO",
    company: "",
    customer: "Cliente",
    source: "Reclame Aqui",
    category: "Financeiro",
    priority: "Urgente",
    status: "Novo",
    title: "Roteiro",
    description: "",
    resolved: false,
    wouldDoBusiness: false,
    sla: "—",
    createdAt: "2026-09-15",
    recebidaEm: br("2026-09-15", "16:00").toISOString(),
    ...extra,
  };
}

function relogio() {

  console.log("\n  RELÓGIO DO CASO — regras da documentação\n");

  const urgente = caso({});

  confere(
    "Urgente às 16h, olhado às 17h: 1º contato em 3h",
    slaStatus(urgente, REGRAS, { agora: br("2026-09-15", "17:00") }).label,
    "1º contato em 3h"
  );

  confere(
    "…olhado no dia seguinte às 11h: atrasado 1h",
    slaStatus(urgente, REGRAS, { agora: br("2026-09-16", "11:00") }).label,
    "1º contato atrasado 1h"
  );

  confere(
    "…e a situação é estourado",
    slaStatus(urgente, REGRAS, { agora: br("2026-09-16", "11:00") }).situation,
    "estourado"
  );

  const contatado = caso({ primeiroContatoEm: br("2026-09-15", "17:30").toISOString() });

  confere(
    "Com o 1º contato feito, o relógio passa para a solução (48h úteis)",
    slaStatus(contatado, REGRAS, { agora: br("2026-09-16", "16:00") }).label,
    "Solução em 1 dia útil"
  );

  confere(
    "Solução vencida qui 16h, olhada sex 09h: atrasada 3h úteis",
    slaStatus(contatado, REGRAS, { agora: br("2026-09-18", "09:00") }).label,
    "Solução atrasada 3h"
  );

  confere(
    "Resposta pública publicada encerra o relógio",
    slaStatus(caso({ ...contatado, publicResponse: "Olá!" }), REGRAS, { agora: br("2026-09-18", "09:00") }).situation,
    "concluido"
  );

  confere(
    "Legado sem registro de contato não vira atraso",
    slaStatus(caso({ createdAt: "2026-08-20", recebidaEm: undefined }), REGRAS, { agora: br("2026-09-15", "10:00") }).situation,
    "sem-registro"
  );

  confere(
    "Sem hora gravada, o relógio parte da abertura do dia e avisa",
    slaStatus(caso({ recebidaEm: undefined }), REGRAS, { agora: br("2026-09-15", "10:00") }).horaEstimada,
    true
  );

  confere(
    "Normal numa sexta às 10h: 1º contato vence terça às 10h (48h úteis)",
    slaStatus(caso({ priority: "Normal", createdAt: "2026-09-11", recebidaEm: br("2026-09-11", "10:00").toISOString() }), REGRAS, {
      agora: br("2026-09-11", "10:00"),
    }).prazo,
    br("2026-09-15", "10:00").toISOString()
  );

  const social = caso({ source: "Instagram", priority: "Alta", followers: 25_000 });

  confere(
    "Rede social com 25 mil seguidores cai na regra de 1h",
    resolveRule(social, REGRAS)?.responseHours,
    1
  );

  confere(
    "Rede social com 800 seguidores cai na de 4h úteis",
    resolveRule(caso({ source: "Instagram", followers: 800 }), REGRAS)?.responseHours,
    4
  );

  confere(
    "Regra gravada com 'Crítica' ainda casa com Urgente",
    resolveRule(caso({}), [{ ...REGRAS[0], id: "velha", priority: "Crítica" as never }])?.id,
    "velha"
  );

  confere(
    "Regra de categoria específica vence a da documentação",
    resolveRule(caso({}), [...REGRAS, { ...REGRAS[2], id: "fin", category: "Financeiro", priority: undefined, responseHours: 2 }])?.id,
    "fin"
  );

  confere(
    "Contato no futuro é recusado",
    problemaDoContato({ tipo: "contato", canal: "WhatsApp", em: new Date(Date.now() + 3_600_000).toISOString() }) !== null,
    true
  );

  confere(
    "Resultado que não combina com o tipo é recusado",
    problemaDoContato({ tipo: "contato", canal: "WhatsApp", resultado: "nao-atendeu" }) !== null,
    true
  );
}

function planilha() {

  console.log("\n  HORA DA PUBLICAÇÃO — a planilha completa e não troca\n");

  confere("'10/09/2026 21:43' vira 21h43 de Brasília", instanteDeParede("10/09/2026 21:43")?.toISOString(), "2026-09-11T00:43:00.000Z");
  confere("o '2026-09-10T21:43:37' do portal também", instanteDeParede("2026-09-10T21:43:37")?.toISOString(), "2026-09-11T00:43:00.000Z");
  confere("dia sem hora não inventa 00:00", instanteDeParede("10/09/2026"), null);

  const doArquivo = caso({ recebidaEm: "2026-09-11T00:43:00.000Z" });

  const base = {
    status: "Novo",
    publicResponse: null,
    publicResponseAt: null,
    evaluated: false,
    score: null,
    resolved: false,
    wouldDoBusiness: false,
    evaluatedAt: null,
    email: null,
    phone: null,
    city: null,
    state: null,
  };

  confere(
    "banco sem hora recebe a da planilha",
    Boolean(mudancasDoPortal(doArquivo, { ...base, recebidaEm: null }).dados.recebidaEm),
    true
  );

  confere(
    "banco com hora não é trocado",
    mudancasDoPortal(doArquivo, { ...base, recebidaEm: new Date("2026-09-11T00:40:00Z") }).dados.recebidaEm,
    undefined
  );
}

const PROTOCOLO = "RA-ZzTratativa";

async function limpar(prisma: PrismaClient) {
  await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });
}

async function contra(prisma: PrismaClient) {

  console.log("\n  CONTRA O BANCO — caso descartável\n");

  const criado = await prisma.case.create({
    data: {
      protocol: PROTOCOLO,
      companyName: "Consumidor",
      customer: "Consumidor",
      title: "Reclamação descartável da tratativa",
      status: "Novo",
      publishedAt: new Date("2026-09-15T00:00:00Z"),
      recebidaEm: br("2026-09-15", "16:00"),
    },
  });

  const triagem = await triar(prisma, {
    caseId: criado.id,
    prioridade: "Urgente",
    criterios: ["juridico", "inventado", "juridico"],
    autorNome: "Check da tratativa",
  });

  confere("triagem grava Urgente como CRITICA", (await prisma.case.findUnique({ where: { id: criado.id } }))?.priority, "CRITICA");
  confere("critério desconhecido e repetido são descartados", triagem.criterios, ["juridico"]);

  const tentativa = await gravarContato(prisma, {
    caseId: criado.id,
    entrada: { tipo: "tentativa", canal: "Telefone", resultado: "nao-atendeu", em: br("2026-09-15", "17:00").toISOString() },
    autorId: null,
    autorNome: "Check da tratativa",
  });

  confere("a tentativa conta como 1º contato", tentativa.resumo.primeiroContatoEm, br("2026-09-15", "17:00").toISOString());
  confere("uma tentativa seguida sem resposta", tentativa.resumo.tentativasSemResposta, 1);

  await gravarContato(prisma, {
    caseId: criado.id,
    entrada: { tipo: "tentativa", canal: "Telefone", resultado: "caixa-postal", em: br("2026-09-16", "09:00").toISOString() },
    autorId: null,
    autorNome: "Check da tratativa",
  });

  const falou = await gravarContato(prisma, {
    caseId: criado.id,
    entrada: { tipo: "contato", canal: "WhatsApp", em: br("2026-09-16", "10:00").toISOString() },
    autorId: null,
    autorNome: "Check da tratativa",
  });

  confere("quando o cliente responde, zera as tentativas", falou.resumo.tentativasSemResposta, 0);

  const atualizou = await gravarContato(prisma, {
    caseId: criado.id,
    entrada: { tipo: "atualizacao", canal: "WhatsApp", em: br("2026-09-16", "15:00").toISOString() },
    autorId: null,
    autorNome: "Check da tratativa",
  });

  confere("atualização enviada não conta como tentativa sem resposta", atualizou.resumo.tentativasSemResposta, 0);
  confere("mas move o último contato", atualizou.resumo.ultimoContatoEm, br("2026-09-16", "15:00").toISOString());
  await removerContato(prisma, atualizou.contato.id);
  confere("e a última resposta é a da conversa", falou.resumo.ultimaRespostaEm, br("2026-09-16", "10:00").toISOString());

  /* Registrado depois, com hora de antes: o 1º contato recua. */
  const retroativo = await gravarContato(prisma, {
    caseId: criado.id,
    entrada: { tipo: "contato", canal: "WhatsApp", em: br("2026-09-15", "16:30").toISOString() },
    autorId: null,
    autorNome: "Check da tratativa",
  });

  confere("contato registrado com hora anterior vira o 1º", retroativo.resumo.primeiroContatoEm, br("2026-09-15", "16:30").toISOString());

  await removerContato(prisma, retroativo.contato.id);

  const noBanco = await prisma.case.findUnique({ where: { id: criado.id } });

  confere("apagar recalcula o 1º contato", noBanco?.primeiroContatoEm?.toISOString(), br("2026-09-15", "17:00").toISOString());
  confere("o caso guarda o canal do 1º contato", noBanco?.primeiroContatoCanal, "Telefone");
  confere("e o último contato", noBanco?.ultimoContatoEm?.toISOString(), br("2026-09-16", "10:00").toISOString());
}

async function main() {

  relogio();
  planilha();

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log("\n  --   sem banco: a parte contra o banco depende dele\n");
  } else {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

    try {
      await limpar(prisma);
      await contra(prisma);
    } finally {
      await limpar(prisma);
      await prisma.$disconnect();
    }
  }

  console.log(falhas === 0 ? "\n  A tratativa segue a documentação.\n" : `\n  ${falhas} falha(s).\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
