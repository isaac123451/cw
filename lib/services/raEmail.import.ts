import type { PrismaClient } from "@prisma/client";

import { Case } from "@/lib/models/case";

import { persistCase } from "@/lib/services/case.repository";

import {
  validAccessToken,
} from "@/lib/services/google.service";

import {
  buscarMensagens,
  lerMensagem,
} from "@/lib/services/gmail.service";

import {
  consultaDeAvisos,
  interpretarAviso,
} from "@/lib/services/raEmail.service";

/**
 * A reclamação chegando sozinha, pelo aviso do Reclame Aqui.
 *
 * **Por que pelo e-mail.** O RA não tem API pública e a página é
 * protegida por Cloudflare: o servidor não tem como perguntar "chegou
 * reclamação nova?". A extensão resolve, mas só com o navegador aberto.
 * O aviso por e-mail é o único sinal que chega de madrugada, no fim de
 * semana, com todo mundo desconectado.
 *
 * **Fica em módulo comum, não em `"use server"`.** Arquivo com essa
 * diretiva exporta cada função como endpoint alcançável pelo navegador,
 * e esta aqui lê caixa de entrada — não é coisa que se deixe chamável
 * de fora. Quem a chama é a rotina agendada, que tem token próprio.
 */

export interface ResultadoDaImportacao {
  /** A conta do Google que foi usada, quando havia uma. */
  conta?: string;
  /** Mensagens que a consulta trouxe. */
  vistas: number;
  /** Avisos reconhecidos como reclamação. */
  reconhecidos: number;
  /** Reclamações criadas agora. */
  criadas: number;
  /** Já existiam — o caminho normal em toda execução depois da primeira. */
  jaExistiam: number;
  /** Mensagens do portal que não eram aviso de reclamação. */
  ignoradas: number;
  erro?: string;
}

const VAZIO: ResultadoDaImportacao = {
  vistas: 0,
  reconhecidos: 0,
  criadas: 0,
  jaExistiam: 0,
  ignoradas: 0,
};

/**
 * A conta que vai ler a caixa.
 *
 * Uma só, e a mais antiga conectada. O aviso do RA chega para a conta
 * corporativa que está cadastrada no portal; ler de várias caixas
 * criaria a mesma reclamação por dois caminhos e faria a rotina
 * depender de quem conectou por último.
 */
async function contaParaLer(prisma: PrismaClient) {

  return prisma.googleAccount.findFirst({
    orderBy: { createdAt: "asc" },
    select: { userId: true, email: true },
  });
}

/**
 * Esta reclamação já existe do nosso lado?
 *
 * Pelo protocolo e pelo `externalId`, porque as duas colunas guardam
 * identificador de portal e um caso importado pode ter só uma delas
 * preenchida. Casar por título seria pior que não casar: dois
 * consumidores reclamam "cobrança indevida" na mesma semana.
 */
async function jaExiste(
  prisma: PrismaClient,
  protocolo: string
) {

  const achado = await prisma.case.findFirst({
    where: {
      OR: [
        { protocol: protocolo },
        { externalId: protocolo },
      ],
    },
    select: { id: true },
  });

  return Boolean(achado);
}

/**
 * Lê os avisos recentes e cria o que ainda não existe.
 *
 * **Idempotente.** Roda de novo sem repetir: cada aviso é conferido
 * contra a base antes de virar caso, então a janela de sete dias pode
 * ser relida quantas vezes for. É o que permite a rotina rodar de hora
 * em hora sem duplicar nada.
 *
 * **Nunca lança.** Uma falha aqui — conta desconectada, escopo negado,
 * Gmail fora do ar — não pode derrubar a rotina agendada, que também
 * encerra NPS, avisa atraso e reenvia webhook. O erro vira campo no
 * resultado e aparece no retorno do cron.
 */
export async function importarAvisosDoRA(
  prisma: PrismaClient,
  opcoes: { dias?: number; teto?: number } = {}
): Promise<ResultadoDaImportacao> {

  try {

    const conta = await contaParaLer(prisma);

    if (!conta) {
      return {
        ...VAZIO,
        erro: "Nenhuma conta do Google conectada — ligue em Configurações → Integrações.",
      };
    }

    const token = await validAccessToken(
      prisma,
      conta.userId
    );

    if (!token) {
      return {
        ...VAZIO,
        conta: conta.email,
        erro: "A conta do Google não devolveu token. Reconecte em Configurações → Integrações.",
      };
    }

    const ids = await buscarMensagens(
      token,
      consultaDeAvisos(opcoes.dias ?? 7),
      opcoes.teto ?? 25
    );

    let reconhecidos = 0;
    let criadas = 0;
    let jaExistiam = 0;
    let ignoradas = 0;

    for (const id of ids) {

      const mensagem = await lerMensagem(token, id);

      if (!mensagem) {
        ignoradas += 1;
        continue;
      }

      const aviso = interpretarAviso(mensagem);

      /*
        Não reconhecido não é erro: a consulta traz tudo do domínio do
        portal, e boa parte é aviso de resposta, newsletter ou
        confirmação. Nada disso deve virar reclamação.
      */
      if (!aviso) {
        ignoradas += 1;
        continue;
      }

      reconhecidos += 1;

      if (await jaExiste(prisma, aviso.protocolo)) {
        jaExistiam += 1;
        continue;
      }

      const quando = aviso.recebidoEm.slice(0, 10);

      /**
       * O caso nasce com o mínimo, e diz isso na etiqueta.
       *
       * O aviso traz protocolo e assunto; raramente traz o relato
       * inteiro, e nunca traz categoria, telefone ou documento. Em vez
       * de preencher com suposição, os campos ficam vazios e a
       * etiqueta "Veio pelo aviso por e-mail" marca de onde saiu — quem
       * abrir a reclamação no portal com a extensão completa o resto
       * pelos leitores que já existem.
       *
       * `category` fica "Não classificado", a mesma palavra que o
       * caminho da extensão usa: duas grafias para o mesmo vazio
       * quebrariam o agrupamento por categoria.
       */
      const novo: Case = {
        id: aviso.protocolo,
        protocol: aviso.protocolo,

        company: aviso.consumidor ?? "Não identificado",
        customer: aviso.consumidor ?? "Não identificado",

        city: aviso.cidade,
        state: aviso.estado,

        source: "Reclame Aqui",

        category: "Não classificado",
        priority: "Média",
        status: "Novo",

        title: aviso.titulo,
        description: aviso.relato ?? "",

        publicResponse: "",

        evaluated: false,
        resolved: false,
        wouldDoBusiness: false,

        responseTime: "-",
        solutionTime: "-",
        sla: "48h",

        raUrl: aviso.url,

        createdAt: quando,
        updatedAt: quando,
        lastInteraction: quando,

        tags: ["Veio pelo aviso por e-mail"],
      };

      await persistCase(prisma, novo);

      criadas += 1;
    }

    return {
      conta: conta.email,
      vistas: ids.length,
      reconhecidos,
      criadas,
      jaExistiam,
      ignoradas,
    };

  } catch (erro) {
    return {
      ...VAZIO,
      erro:
        erro instanceof Error ? erro.message : String(erro),
    };
  }
}
