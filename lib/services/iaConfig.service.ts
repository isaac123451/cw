import { getPrisma } from "@/lib/prisma";

/**
 * Qual IA responde, e quão rápido.
 *
 * Antes isso vivia só em variável de ambiente, o que tem dois problemas
 * na prática: mudar exige deploy, e o valor fica invisível para quem usa
 * a ferramenta. "A IA está demorando" é uma reclamação da operação — e a
 * resposta estava num arquivo que a operação não abre.
 *
 * **Precedência: banco > ambiente > código.** Quem escolheu na tela
 * escolheu; o ambiente é o padrão de uma instalação sem banco, e o
 * código é o último recurso. A ordem inversa faria a tela mentir.
 */

export type Perfil =
  | "rapido"
  | "equilibrado"
  | "profundo";

export interface PerfilDeVelocidade {
  id: Perfil;
  nome: string;
  /** O que a pessoa ganha e o que perde — em uma frase. */
  resumo: string;
  /** O que foi medido, para a escolha não ser no escuro. */
  medido: string;
  modelo: string;
  modeloRapido: string;
  /** Segundos até a reserva partir em paralelo. Zero desliga a corrida. */
  hedgeSegundos: number;
  timeoutSegundos: number;
  /** Esforço pedido à Anthropic, quando é ela quem responde. */
  esforco: "low" | "medium" | "high";
}

/**
 * Os três perfis, com os números que os justificam.
 *
 * Medidos no mesmo minuto, com o mesmo pedido de 52 tokens, na camada
 * gratuita do Gemini:
 *
 * | modelo                     | tempo    |
 * | -------------------------- | -------- |
 * | `gemini-flash-latest`      | estourou |
 * | `gemini-3.6-flash`         | 10,4 s   |
 * | `gemini-flash-lite-latest` | 0,98 s   |
 *
 * O apelido (`-latest` do flash) não entra como principal em perfil
 * nenhum: ele concentra a demanda de quem não fixou versão e é o
 * primeiro a entrar em fila. Ele é a **reserva contra o 404**, que é o
 * defeito que só ele nunca tem.
 */
export const PERFIS: PerfilDeVelocidade[] = [
  {
    id: "rapido",
    nome: "Rápido",
    resumo:
      "Responde quase na hora. Julga menos — bom para resumir, raso para decidir.",
    medido: "~1 s no pedido de referência.",
    modelo: "gemini-flash-lite-latest",
    modeloRapido: "gemini-flash-lite-latest",
    hedgeSegundos: 4,
    timeoutSegundos: 20,
    esforco: "low",
  },
  {
    id: "equilibrado",
    nome: "Equilibrado",
    resumo:
      "O padrão. Modelo maior para decidir, menor para resumir, e um corre atrás do outro quando demora.",
    medido: "~10 s para triagem, ~1 s para resumo.",
    modelo: "gemini-3.6-flash",
    modeloRapido: "gemini-flash-lite-latest",
    hedgeSegundos: 6,
    timeoutSegundos: 30,
    esforco: "medium",
  },
  {
    id: "profundo",
    nome: "Profundo",
    resumo:
      "Deixa o modelo pensar até o fim, sem correr atrás. Mais lento, e é o que se quer quando a decisão custa caro.",
    medido: "Sem teto de corrida; até 60 s de espera.",
    modelo: "gemini-3.6-flash",
    modeloRapido: "gemini-3.6-flash",
    // Zero desliga a corrida: aqui a pressa é o que atrapalha.
    hedgeSegundos: 0,
    timeoutSegundos: 60,
    esforco: "high",
  },
];

export function perfilPorId(id?: string | null) {
  return (
    PERFIS.find((p) => p.id === id) ??
    PERFIS.find((p) => p.id === "equilibrado")!
  );
}

export interface ConfigDeIA {
  /** "auto" deixa a chave decidir; os outros forçam. */
  provedorPreferido: "auto" | "anthropic" | "gemini";
  perfil: Perfil;
  modelo: string;
  modeloRapido: string;
  modeloReserva: string;
  hedgeMs: number;
  prazoMs: number;
  esforco: "low" | "medium" | "high";
  /** De onde vieram os valores — a tela mostra isso. */
  origem: "banco" | "ambiente";
}

function doAmbiente(nome: string) {
  const valor = (process.env[nome] ?? "").trim();
  return valor === "" ? undefined : valor;
}

function numeroDoAmbiente(nome: string) {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) ? valor : undefined;
}

/**
 * A configuração, guardada por pouco tempo.
 *
 * Cada chamada de IA precisaria de uma consulta ao Postgres para
 * descobrir qual modelo usar — e são chamadas que já custam segundos.
 * Trinta segundos de cache é curto o bastante para trocar o perfil na
 * tela e sentir na chamada seguinte, e longo o bastante para uma rajada
 * de triagens não virar uma rajada de consultas.
 */
let guardado: { em: number; valor: ConfigDeIA } | null =
  null;

const VALIDADE_MS = 30_000;

/** Descarta o guardado — chamado ao salvar na tela. */
export function invalidarConfigDeIA() {
  guardado = null;
}

export async function lerConfigDeIA(): Promise<ConfigDeIA> {

  if (
    guardado &&
    Date.now() - guardado.em < VALIDADE_MS
  ) {
    return guardado.valor;
  }

  const valor = await montar();

  guardado = { em: Date.now(), valor };

  return valor;
}

async function montar(): Promise<ConfigDeIA> {

  const prisma = getPrisma();

  const linha = prisma
    ? await prisma.iaConfig
        .findUnique({ where: { id: "unico" } })
        .catch(() => null)
    : null;

  /**
   * O perfil vem do banco, do ambiente, ou é o equilibrado.
   *
   * `IA_PERFIL` existe para quem roda isto sem banco — um script, um
   * ambiente de teste. Com banco, quem manda é a tela.
   */
  const perfil = perfilPorId(
    linha?.speed ?? doAmbiente("IA_PERFIL")
  );

  const provedorPreferido = (
    linha?.provider ??
    doAmbiente("IA_PROVEDOR") ??
    "auto"
  ).toLowerCase();

  return {
    provedorPreferido:
      provedorPreferido === "anthropic" ||
      provedorPreferido === "gemini"
        ? provedorPreferido
        : "auto",

    perfil: perfil.id,

    /**
     * O modelo fixado à mão vence o perfil.
     *
     * É a saída de emergência: quando a família se renova e um nome
     * some, dá para apontar o novo sem esperar deploy.
     */
    modelo:
      linha?.model ||
      doAmbiente("GEMINI_MODELO") ||
      perfil.modelo,

    modeloRapido:
      linha?.modelFast ||
      doAmbiente("GEMINI_MODELO_RAPIDO") ||
      perfil.modeloRapido,

    modeloReserva:
      linha?.modelFallback ||
      doAmbiente("GEMINI_MODELO_RESERVA") ||
      "gemini-flash-latest",

    hedgeMs:
      (linha?.hedgeSeconds ??
        (numeroDoAmbiente("IA_HEDGE_MS") !== undefined
          ? numeroDoAmbiente("IA_HEDGE_MS")! / 1000
          : perfil.hedgeSegundos)) * 1000,

    prazoMs:
      (linha?.timeoutSeconds ??
        (numeroDoAmbiente("IA_PRAZO_MS") !== undefined
          ? numeroDoAmbiente("IA_PRAZO_MS")! / 1000
          : perfil.timeoutSegundos)) * 1000,

    esforco: perfil.esforco,

    origem: linha ? "banco" : "ambiente",
  };
}
