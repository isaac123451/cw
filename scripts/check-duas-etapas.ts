/**
 * A verificação em duas etapas segura o que promete?
 *
 *   npm run check:duas-etapas
 *
 * Um recurso de segurança que "parece funcionar" é pior do que não ter
 * recurso nenhum: dá confiança sem dar proteção. Então não basta provar
 * que o código certo entra — é preciso provar que **cada uma das
 * defesas recusa** o que deve recusar.
 *
 * Onze perguntas, todas contra o banco real, com um usuário de teste
 * criado e apagado no fim:
 *
 *   1. O código certo entra.
 *   2. O código errado não entra.
 *   3. O código serve **uma vez só** — o segundo uso é recusado.
 *   4. Código vencido não entra, nem que seja o certo.
 *   5. Esgotadas as tentativas, o código morre — inclusive para o
 *      palpite certo que vier depois.
 *   6. Cada palpite é contado, mesmo o errado (senão o limite é
 *      decorativo).
 *   7. Pedir código novo **mata** o anterior.
 *   8. Há espera entre pedidos, ou o botão vira máquina de encher caixa
 *      de entrada alheia.
 *   9. O código **não** está no banco em texto claro.
 *  10. Dois códigos seguidos são diferentes — a fonte é aleatória de
 *      verdade, não um contador.
 *  11. A faxina apaga o que passou do prazo e **não** apaga o que ainda
 *      vale.
 *
 * O envio de e-mail roda no modo "console" (sem RESEND_API_KEY), então
 * nada sai para caixa de entrada de ninguém durante a conferência.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import bcrypt from "bcryptjs";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? "  ·  " + detalhe : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

function conferir(
  titulo: string,
  condicao: boolean,
  detalheDaFalha: string,
  detalheDoAcerto = ""
) {
  if (condicao) ok(titulo, detalheDoAcerto);
  else falhar(titulo, detalheDaFalha);
}

const EMAIL_DE_TESTE =
  "verificacao-duas-etapas@cardapioweb.com";

/**
 * O código é lido do que o módulo grava, não inventado aqui.
 *
 * `criarDesafio` gera e guarda só o hash — de propósito. Para conferir,
 * o script gera o seu próprio código e monta o desafio à mão, exercendo
 * exatamente o mesmo `conferirCodigo` que a tela usa. Assim a
 * conferência testa a **porta**, e não uma segunda implementação dela.
 */
async function montarDesafio(
  userId: string,
  codigo: string,
  opcoes: {
    minutos?: number;
    attempts?: number;
    consumido?: boolean;
    idadeEmDias?: number;
  } = {}
) {

  const minutos = opcoes.minutos ?? 10;

  const criadoEm = opcoes.idadeEmDias
    ? new Date(
        Date.now() -
          opcoes.idadeEmDias * 24 * 60 * 60 * 1000
      )
    : new Date();

  return prisma.loginChallenge.create({
    data: {
      userId,
      codeHash: await bcrypt.hash(codigo, 10),
      expiresAt: new Date(
        Date.now() + minutos * 60 * 1000
      ),
      attempts: opcoes.attempts ?? 0,
      consumedAt: opcoes.consumido ? new Date() : null,
      createdAt: criadoEm,
    },
  });
}

async function main() {

  console.log(
    "\n  DUAS ETAPAS — cada defesa recusa o que deve?\n"
  );

  const {
    conferirCodigo,
    criarDesafio,
    gerarCodigo,
    lerConfiguracao,
    limparDesafiosVelhos,
  } = await import("../lib/auth/two-factor");

  const config = await lerConfiguracao();

  console.log(
    `  configuração: código vale ${config.codeTtlMinutes} min · ${config.maxAttempts} palpites · exigido de todos: ${config.twoFactorRequired ? "sim" : "não"}\n`
  );

  /* ----------------------------------------------------------
     O usuário de teste. Criado agora, apagado no fim.
  ---------------------------------------------------------- */

  await prisma.user.deleteMany({
    where: { email: EMAIL_DE_TESTE },
  });

  const usuario = await prisma.user.create({
    data: {
      email: EMAIL_DE_TESTE,
      name: "Conferência Duas Etapas",
      passwordHash: await bcrypt.hash(
        "senha-de-conferencia",
        10
      ),
      role: "AGENTE",
      active: true,
    },
  });

  try {

    /* ---- 1. o código certo entra ---- */

    const d1 = await montarDesafio(usuario.id, "123456");

    const r1 = await conferirCodigo(d1.id, "123456");

    conferir(
      "1. o código certo entra",
      r1.ok && r1.userId === usuario.id,
      `recusou o código certo: ${r1.erro}`,
      "sessão liberada para o usuário do desafio"
    );

    /* ---- 3. e serve uma vez só ---- */

    const r1b = await conferirCodigo(d1.id, "123456");

    conferir(
      "3. o mesmo código não serve duas vezes",
      !r1b.ok,
      "o código aceitou o segundo uso — um código visto por cima do ombro serviria de novo",
      `recusado: "${r1b.erro}"`
    );

    /* ---- 2. o código errado não entra ---- */

    const d2 = await montarDesafio(usuario.id, "111111");

    const r2 = await conferirCodigo(d2.id, "222222");

    conferir(
      "2. o código errado não entra",
      !r2.ok,
      "aceitou um código que não era o gerado",
      `recusado: "${r2.erro}"`
    );

    /* ---- 6. e o palpite errado foi contado ---- */

    const depoisDoPalpite =
      await prisma.loginChallenge.findUnique({
        where: { id: d2.id },
      });

    conferir(
      "6. cada palpite é contado",
      (depoisDoPalpite?.attempts ?? 0) === 1,
      `attempts ficou em ${depoisDoPalpite?.attempts} depois de um palpite — o limite seria decorativo`,
      "1 palpite registrado"
    );

    /* ---- 4. código vencido não entra ---- */

    const d3 = await montarDesafio(
      usuario.id,
      "333333",
      { minutos: -1 }
    );

    const r3 = await conferirCodigo(d3.id, "333333");

    conferir(
      "4. código vencido não entra, nem sendo o certo",
      !r3.ok && Boolean(r3.recomecar),
      "aceitou um código fora do prazo",
      `recusado: "${r3.erro}"`
    );

    /* ---- 5. esgotadas as tentativas, morre ---- */

    const d4 = await montarDesafio(
      usuario.id,
      "444444",
      { attempts: config.maxAttempts }
    );

    const r4 = await conferirCodigo(d4.id, "444444");

    conferir(
      "5. sem palpites restantes, nem o código certo entra",
      !r4.ok,
      "entrou mesmo com o limite de palpites esgotado",
      `recusado: "${r4.erro}"`
    );

    const d4Depois =
      await prisma.loginChallenge.findUnique({
        where: { id: d4.id },
      });

    conferir(
      "5b. e o desafio esgotado é marcado como gasto",
      Boolean(d4Depois?.consumedAt),
      "o desafio esgotado continua aberto no banco",
      "consumedAt preenchido"
    );

    /* ---- 9. o código não está em claro ---- */

    const linhas =
      await prisma.loginChallenge.findMany({
        where: { userId: usuario.id },
        select: { codeHash: true },
      });

    const emClaro = linhas.filter((linha) =>
      /^\d{6}$/.test(linha.codeHash)
    );

    conferir(
      "9. o código não fica em texto claro no banco",
      emClaro.length === 0 &&
        linhas.every((l) =>
          l.codeHash.startsWith("$2")
        ),
      `${emClaro.length} código(s) legíveis no banco — um vazamento viraria vazamento de sessões`,
      `${linhas.length} desafios, todos com hash bcrypt`
    );

    /* ---- 7 e 8. reenvio mata o anterior, e tem espera ---- */

    await prisma.loginChallenge.deleteMany({
      where: { userId: usuario.id },
    });

    const pedido1 = await criarDesafio(usuario);

    conferir(
      "7a. o primeiro pedido de código funciona",
      pedido1.ok && Boolean(pedido1.challengeId),
      `não criou o desafio: ${pedido1.erro}`,
      "desafio criado e e-mail despachado"
    );

    const pedido2 = await criarDesafio(usuario);

    conferir(
      "8. há espera entre pedidos de código",
      !pedido2.ok && (pedido2.esperar ?? 0) > 0,
      "o segundo pedido saiu na mesma hora — o botão de reenviar vira máquina de encher caixa de entrada",
      `recusado, faltam ${pedido2.esperar}s`
    );

    /**
     * Para provar o 7 sem esperar um minuto, o desafio é envelhecido à
     * mão. É o mesmo caminho de código — só o relógio muda.
     */
    if (pedido1.challengeId) {

      await prisma.loginChallenge.update({
        where: { id: pedido1.challengeId },
        data: {
          createdAt: new Date(Date.now() - 120_000),
        },
      });

      const pedido3 = await criarDesafio(usuario);

      const antigo =
        await prisma.loginChallenge.findUnique({
          where: { id: pedido1.challengeId },
        });

      conferir(
        "7b. pedir código novo mata o anterior",
        pedido3.ok && Boolean(antigo?.consumedAt),
        "o código antigo continuou válido — a caixa de entrada viraria um chaveiro de códigos vivos",
        "o anterior foi marcado como gasto"
      );

      const usarOAntigo = await conferirCodigo(
        pedido1.challengeId,
        "000000"
      );

      conferir(
        "7c. e o desafio morto recusa qualquer palpite",
        !usarOAntigo.ok,
        "o desafio invalidado ainda aceita palpites",
        `recusado: "${usarOAntigo.erro}"`
      );
    }

    /* ---- 10. dois códigos seguidos são diferentes ---- */

    await prisma.loginChallenge.deleteMany({
      where: { userId: usuario.id },
    });

    const hashes: string[] = [];

    for (let i = 0; i < 6; i++) {

      await prisma.loginChallenge.deleteMany({
        where: { userId: usuario.id },
      });

      const pedido = await criarDesafio(usuario);

      if (!pedido.challengeId) continue;

      const linha =
        await prisma.loginChallenge.findUnique({
          where: { id: pedido.challengeId },
        });

      if (linha) hashes.push(linha.codeHash);
    }

    conferir(
      "10a. cada pedido grava um desafio próprio",
      hashes.length >= 5 &&
        new Set(hashes).size === hashes.length,
      `${hashes.length} desafios com só ${new Set(hashes).size} hashes distintos`,
      `${hashes.length} desafios, ${new Set(hashes).size} hashes distintos`
    );

    /**
     * O gerador é conferido direto, e não pelos hashes.
     *
     * bcrypt tem sal por linha: dois hashes seriam diferentes mesmo se
     * o código fosse sempre o mesmo. Ou seja, hashes distintos **não
     * provam** códigos distintos — provariam só que o sal funciona.
     * Quem responde a pergunta é o gerador, e é nele que se olha.
     */
    const amostras = Array.from(
      { length: 2000 },
      () => gerarCodigo()
    );

    const formatoErrado = amostras.filter(
      (c) => !/^\d{6}$/.test(c)
    );

    conferir(
      "10b. todo código tem seis dígitos",
      formatoErrado.length === 0,
      `${formatoErrado.length} de 2000 fora do formato — ex.: "${formatoErrado[0]}". Sem o zero à esquerda, um em cada dez códigos sai com cinco dígitos`,
      `2000 amostras, todas com seis dígitos${
        amostras.filter((c) => c.startsWith("0")).length > 0
          ? ` (${amostras.filter((c) => c.startsWith("0")).length} começam com zero, preservado)`
          : ""
      }`
    );

    const distintos = new Set(amostras).size;

    conferir(
      "10c. a fonte é aleatória, não um contador",
      distintos > 1900,
      `só ${distintos} códigos distintos em 2000 sorteios — a fonte está repetindo`,
      `${distintos} distintos em 2000 (o esperado por acaso é ~1998)`
    );

    /* ---- 11. a faxina apaga o velho e poupa o novo ---- */

    await prisma.loginChallenge.deleteMany({
      where: { userId: usuario.id },
    });

    const velho = await montarDesafio(
      usuario.id,
      "555555",
      { idadeEmDias: 5 }
    );

    const novo = await montarDesafio(
      usuario.id,
      "666666"
    );

    const apagados = await limparDesafiosVelhos(2);

    const velhoAinda =
      await prisma.loginChallenge.findUnique({
        where: { id: velho.id },
      });

    const novoAinda =
      await prisma.loginChallenge.findUnique({
        where: { id: novo.id },
      });

    conferir(
      "11. a faxina apaga o vencido e poupa o que vale",
      !velhoAinda && Boolean(novoAinda),
      `velho ${velhoAinda ? "sobreviveu" : "apagado"}, novo ${novoAinda ? "sobreviveu" : "APAGADO — a faxina está levando código em uso"}`,
      `${apagados} apagado(s), o de hoje intacto`
    );

  } finally {

    /**
     * O usuário de teste sai sempre, inclusive se algo acima estourar.
     * Deixar uma conta de conferência no banco de produção seria criar
     * exatamente o tipo de porta que este script existe para fechar.
     */
    await prisma.loginChallenge.deleteMany({
      where: { userId: usuario.id },
    });

    await prisma.user.delete({
      where: { id: usuario.id },
    });

    const sobrou = await prisma.user.count({
      where: { email: EMAIL_DE_TESTE },
    });

    conferir(
      "12. o usuário de conferência não fica no banco",
      sobrou === 0,
      "sobrou uma conta de teste no banco de produção",
      "removido"
    );
  }

  console.log(
    falhas === 0
      ? "\n  Cada defesa recusou o que devia recusar.\n"
      : `\n  ${falhas} problema(s) na verificação em duas etapas.\n`
  );
}

main()
  .catch((erro) => {
    console.error("\n  Erro:", erro);
    falhas += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(falhas === 0 ? 0 : 1);
  });
