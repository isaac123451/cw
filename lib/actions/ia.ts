"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import {
  invalidarConfigDeIA,
  lerConfigDeIA,
  type Perfil,
  PERFIS,
  perfilPorId,
} from "@/lib/services/iaConfig.service";

import {
  pedirEstruturado,
  provedorDeIA,
} from "@/lib/services/ia.service";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "configuracoes";

/**
 * A escolha de IA e de velocidade, pela tela.
 *
 * Configurar exige **ADMIN**: mexer no perfil muda o custo e a qualidade
 * de tudo que o assistente e a extensão respondem, para todo mundo.
 */

export interface RetratoDaIA {
  /** Há alguma chave válida configurada neste ambiente? */
  disponivel: boolean;
  provedor: "anthropic" | "gemini" | null;
  perfil: Perfil;
  provedorPreferido: "auto" | "anthropic" | "gemini";
  modelo: string;
  modeloRapido: string;
  modeloReserva: string;
  hedgeSegundos: number;
  timeoutSegundos: number;
  origem: "banco" | "ambiente";
  /** Quais chaves existem — sem revelar nenhuma. */
  chaves: { anthropic: boolean; gemini: boolean };
  permitido: boolean;
}

export async function getIaConfig(): Promise<RetratoDaIA> {

  const ctx = await tryRole("LEITURA", MODULO);

  const config = await lerConfigDeIA();

  const provedor = provedorDeIA(
    config.provedorPreferido
  );

  /**
   * As chaves aparecem como sim/não, nunca como valor.
   *
   * Saber que a chave da Anthropic não está preenchida é o que explica
   * por que o seletor de provedor não obedece — e é a informação que
   * mais faltou aqui. O valor em si não acrescenta nada na tela e é
   * segredo.
   */
  return {
    disponivel: provedor !== null,
    provedor,
    perfil: config.perfil,
    provedorPreferido: config.provedorPreferido,
    modelo: config.modelo,
    modeloRapido: config.modeloRapido,
    modeloReserva: config.modeloReserva,
    hedgeSegundos: Math.round(config.hedgeMs / 1000),
    timeoutSegundos: Math.round(config.prazoMs / 1000),
    origem: config.origem,
    chaves: {
      anthropic: provedorDeIA("anthropic") === "anthropic",
      gemini: provedorDeIA("gemini") === "gemini",
    },
    permitido: ctx?.role === "ADMIN",
  };
}

export interface RascunhoDaIA {
  perfil: Perfil;
  provedorPreferido: "auto" | "anthropic" | "gemini";
  /** Vazio devolve o valor do perfil. */
  modelo?: string;
  modeloRapido?: string;
  modeloReserva?: string;
  hedgeSegundos?: number;
  timeoutSegundos?: number;
}

export async function saveIaConfig(
  input: RascunhoDaIA
): Promise<{ erro?: string }> {

  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — a escolha precisa de onde ser gravada.",
    };
  }

  const perfil = perfilPorId(input.perfil);

  const limpo = (valor?: string) =>
    (valor ?? "").trim() || null;

  /**
   * Um prazo de dois segundos desliga a IA sem dizer que desligou.
   *
   * O piso não é capricho: a chamada mais rápida medida leva ~1 s, e
   * abaixo de cinco segundos qualquer congestionamento vira "falhou"
   * para tudo. O teto de 120 s é o outro lado — acima disso a pessoa
   * conclui que travou.
   */
  const dentro = (
    valor: number | undefined,
    padrao: number,
    minimo: number,
    maximo: number
  ) =>
    valor === undefined || Number.isNaN(valor)
      ? padrao
      : Math.min(Math.max(valor, minimo), maximo);

  const dados = {
    provider: input.provedorPreferido,
    speed: perfil.id,
    model: limpo(input.modelo),
    modelFast: limpo(input.modeloRapido),
    modelFallback: limpo(input.modeloReserva),

    // Zero é válido: desliga a corrida de propósito.
    hedgeSeconds: dentro(
      input.hedgeSegundos,
      perfil.hedgeSegundos,
      0,
      60
    ),

    timeoutSeconds: dentro(
      input.timeoutSegundos,
      perfil.timeoutSegundos,
      5,
      120
    ),
  };

  await ctx.prisma.iaConfig.upsert({
    where: { id: "unico" },
    update: dados,
    create: { id: "unico", ...dados },
  });

  /**
   * O cache de 30 segundos some agora.
   *
   * Sem isto, salvar e testar em seguida mediria a configuração
   * anterior — e a conclusão seria que a tela não faz nada.
   */
  invalidarConfigDeIA();

  return {};
}

export interface MedicaoDaIA {
  erro?: string;
  ms?: number;
  provedor?: string;
  amostra?: string;
  entrada?: number;
  saida?: number;
}

/**
 * Mede de verdade, com a configuração que está valendo.
 *
 * É o botão que responde a pergunta que a tela levanta: "escolhi
 * rápido — ficou rápido?". Sem ele, a escolha é no escuro, e foi o
 * escuro que produziu uma instalação rodando 39 segundos por chamada
 * sem ninguém saber.
 *
 * Usa o mesmo pedido do `npm run check:ia`, para os dois números serem
 * comparáveis.
 */
export async function medirIa(
  rapido = false
): Promise<MedicaoDaIA> {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) {
    return { erro: "Sem permissão para medir." };
  }

  const marca = Date.now();

  const resultado = await pedirEstruturado({
    sistema:
      "Você classifica mensagens curtas de clientes de um sistema para restaurantes. Responda em português do Brasil.",
    prompt:
      'Mensagem do cliente: "o pedido não chegou e ninguém me responde há dois dias".',
    esquema: {
      type: "object",
      properties: {
        assunto: {
          type: "string",
          description: "O tema em até cinco palavras.",
        },
        urgente: { type: "boolean" },
      },
      required: ["assunto", "urgente"],
    },
    rapido,
  });

  const ms = Date.now() - marca;

  if (resultado.erro) {
    return { erro: resultado.erro, ms };
  }

  return {
    ms,
    provedor: resultado.provedor,
    amostra: String(
      (resultado.dados as { assunto?: string })
        ?.assunto ?? ""
    ),
    entrada: resultado.uso?.entrada,
    saida: resultado.uso?.saida,
  };
}

/** Os perfis, para a tela desenhar as opções com os números medidos. */
export async function listIaPerfis() {
  return PERFIS;
}
