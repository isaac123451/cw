import { PrismaClient } from "@prisma/client";

import { Case } from "@/lib/models/case";

import {
  pedirEstruturado,
  provedorDeIA,
} from "@/lib/services/ia.service";

import {
  CATALOGO,
  escolherMedicoesLocalmente,
  type DadosDaOperacao,
  type Escolha,
} from "./assistant.catalogo";

/**
 * O agente: a metade que depende do servidor.
 *
 * **Por que este arquivo foi partido em dois.** O catálogo, as contas e
 * o seletor local vivem em `assistant.catalogo.ts`, que não importa
 * Prisma nem o serviço de IA. Aqui ficam as duas peças que precisam do
 * servidor: a escolha pelo modelo e a leitura do banco.
 *
 * A separação não é estética. `assistant.service` é importado pela tela
 * do assistente, que é um componente de cliente — e quando ele passou a
 * usar o seletor local, a cadeia de imports arrastou `ia.service` →
 * `iaConfig.service` → `lib/prisma` → `pg` para dentro do pacote do
 * navegador. O `pg` pede `dns`, `net`, `tls` e `fs`, que não existem no
 * navegador, e **21 telas passaram a responder 500**. Um import a mais
 * derrubou metade da aplicação, e nem o TypeScript nem o `tsc` viram —
 * quem viu foi abrir a tela.
 *
 * A regra que sobra: o que a tela usa não pode tocar em Prisma.
 */

/* Reexportado para quem já importava daqui não precisar mudar. */
export * from "./assistant.catalogo";

const ESQUEMA = {
  type: "object",
  properties: {
    medicoes: {
      type: "array",
      description:
        "As medições necessárias para responder. Vazio se a pergunta não for sobre a operação.",
      items: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            enum: CATALOGO.map((m) => m.nome),
          },
          argumento: {
            type: "string",
            description:
              "Só quando a medição aceita um. Vazio caso contrário.",
          },
        },
        required: ["nome"],
      },
    },
  },
  required: ["medicoes"],
};


/**
 * Quais medições respondem esta pergunta?
 *
 * Uma chamada curta e barata: o modelo vê só os nomes e as descrições,
 * nunca os dados. Ele escolhe; quem calcula somos nós.
 *
 * **Teto de quatro.** Sem limite, o modelo pede o catálogo inteiro
 * "por garantia", e a resposta vira um despejo de números em que a
 * pergunta se perde.
 */
export async function escolherMedicoes(
  pergunta: string
): Promise<Escolha[]> {

  /*
    Sem provedor, o agente **não** desiste: escolhe aqui mesmo.

    Antes esta linha era `return []`, e com ela o agente inteiro
    dependia de uma API externa para um passo que nunca precisou de
    uma — classificar uma frase entre nove opções. O efeito prático era
    que, sem chave, o assistente só respondia as perguntas
    pré-escritas.
  */
  if (!provedorDeIA()) {
    return escolherMedicoesLocalmente(pergunta);
  }

  const catalogo = CATALOGO.map(
    (m) =>
      `- ${m.nome}: ${m.descricao}${m.argumento ? ` (argumento: ${m.argumento})` : ""}`
  ).join("\n");

  const r = await pedirEstruturado({
    sistema:
      "Você escolhe quais medições rodar para responder a uma pergunta sobre a operação de Customer Experience da Cardápio Web. Não responda a pergunta; apenas escolha. Escolha no máximo 4, só as que a pergunta realmente precisa. Se a pergunta não for sobre a operação, devolva lista vazia.",
    prompt: `Medições disponíveis:\n${catalogo}\n\nPergunta: "${pergunta}"`,
    esquema: ESQUEMA,

    /*
      Via rápida: escolher entre nove opções é classificação, não
      julgamento. O modelo menor acerta igual e responde em cerca de um
      segundo — e este passo acontece **antes** de a pessoa ver
      qualquer texto, então ele é espera pura.
    */
    rapido: true,
  });

  /*
    Modelo fora do ar cai no seletor local, não no vazio.

    Cota estourada, 503 de congestionamento, rede caída: nada disso é
    motivo para o assistente deixar de responder, já que as contas são
    locais. O que **não** cai para o local é a lista vazia com resposta
    bem-sucedida — ali o modelo disse "isto não é sobre a operação", e
    essa é uma resposta legítima que precisa ser respeitada.
  */
  if (r.erro || !r.dados) {
    return escolherMedicoesLocalmente(pergunta);
  }

  const bruto = (r.dados.medicoes ?? []) as Escolha[];

  const validas = CATALOGO.map((m) => m.nome);

  return bruto
    .filter((e) => validas.includes(e.nome))
    .slice(0, 4);
}

/* ============================================================
   OS DADOS, DO BANCO
============================================================ */

/**
 * A base para as medições, lida no servidor.
 *
 * **Não vem do cliente.** O retrato que a tela manda é montado lá, e
 * para um texto de apoio isso é aceitável. Um número que o assistente
 * afirma como fato, não: ele tem de sair do banco, pelo mesmo caminho
 * que as telas usam.
 */
export async function dadosParaMedir(
  prisma: PrismaClient,
  cases: Case[]
): Promise<DadosDaOperacao> {

  const nps = await prisma.npsResponse.findMany({
    select: {
      score: true,
      status: true,
      churnRisk: true,
      respondedAt: true,
      kind: true,
      rootCause: true,
    },
  });

  return {
    cases,
    nps: nps.map((n) => ({
      score: n.score,
      status: n.status,
      churnRisk: n.churnRisk,
      respondedAt: n.respondedAt.toISOString(),
      kind: n.kind,
      rootCause: n.rootCause,
    })),
  };
}
