/**
 * A cadeia de modelos segura uma fila do Gemini?
 *
 *   npm run check:cadeia
 *
 * **O defeito que isto existe para não repetir.** Em 11/09/2026 o
 * checklist do dia só devolvia "O Gemini está congestionado". A
 * instalação estava no perfil "Rápido", em que o modelo principal e o
 * rápido tinham o mesmo nome — e a corrida entre os dois se desligava
 * sozinha. Era uma chamada, a um apelido em fila, sem reserva nenhuma,
 * enquanto três outros modelos respondiam em um segundo.
 *
 * Sem rede, de propósito: a fila de verdade muda de modelo a cada
 * minuto (medido no mesmo dia — o apelido travou às 10h e respondeu em
 * 1,7 s às 10h20), e não serve de prova. As chamadas aqui travam,
 * falham e recusam na hora que o roteiro manda.
 */
import {
  cadeiaDeModelos,
  emCadeia,
  type RespostaDeIA,
} from "../lib/services/ia.service";

import type { ConfigDeIA } from "../lib/services/iaConfig.service";

let falhas = 0;

function conferir(titulo: string, ok: boolean, detalhe = "") {
  if (!ok) falhas += 1;
  console.log(`${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(60)} ${detalhe}`);
}

const PEDIDO = { sistema: "", prompt: "", esquema: {} };

type Passo =
  | "trava"
  | { ms: number; status?: number; erro?: string };

/**
 * Um Gemini de mentira, que obedece a um roteiro por modelo.
 *
 * "trava" é o que o congestionamento faz de verdade: nada volta, e o
 * que encerra a chamada é o prazo dela.
 */
function roteiro(passos: Record<string, Passo>) {

  const inicio = Date.now();
  const chamados: { modelo: string; em: number }[] = [];

  const chamar = (
    _pedido: unknown,
    modelo: string,
    prazoMs: number
  ): Promise<RespostaDeIA> => {

    chamados.push({ modelo, em: Date.now() - inicio });

    const passo = passos[modelo] ?? "trava";

    return new Promise((resolver) => {

      if (passo === "trava") {
        setTimeout(
          () =>
            resolver({
              provedor: "gemini",
              status: 503,
              erro: "não respondeu",
            }),
          prazoMs
        );
        return;
      }

      setTimeout(
        () =>
          resolver(
            passo.erro
              ? { provedor: "gemini", status: passo.status, erro: passo.erro }
              : { provedor: "gemini", dados: { ok: true } }
          ),
        passo.ms
      );
    });
  };

  return { chamar, chamados, decorrido: () => Date.now() - inicio };
}

const RAPIDO = { hedgeMs: 300, prazoMs: 3000 };

async function regras() {

  console.log("\n  A CADEIA — com um Gemini de roteiro\n");

  {
    const r = roteiro({ A: "trava", B: { ms: 100 } });
    const saida = await emCadeia(PEDIDO, ["A", "B", "C"], RAPIDO, r.chamar);

    conferir(
      "o primeiro trava, o segundo responde",
      saida.modelo === "B" && !saida.erro,
      `respondeu ${saida.modelo} em ${r.decorrido()} ms`
    );

    conferir(
      "o segundo parte no relógio da corrida, sem esperar o prazo",
      (r.chamados[1]?.em ?? 9999) < 600,
      `partiu aos ${r.chamados[1]?.em} ms`
    );
  }

  {
    const r = roteiro({
      A: { ms: 50, status: 503, erro: "fila" },
      B: { ms: 50 },
    });
    await emCadeia(PEDIDO, ["A", "B"], RAPIDO, r.chamar);

    conferir(
      "falha rápida passa adiante na hora, sem esperar o relógio",
      (r.chamados[1]?.em ?? 9999) < 250,
      `o segundo partiu aos ${r.chamados[1]?.em} ms`
    );
  }

  {
    const r = roteiro({
      A: { ms: 30, status: 503, erro: "fila" },
      B: { ms: 30, status: 429, erro: "cota" },
      C: { ms: 30, status: 503, erro: "fila" },
    });
    const saida = await emCadeia(PEDIDO, ["A", "B", "C"], RAPIDO, r.chamar);

    conferir(
      "todos em fila: o erro diz quantos foram tentados",
      /3 modelos tentados/.test(saida.erro ?? ""),
      saida.erro?.slice(0, 60) ?? ""
    );
  }

  {
    const r = roteiro({
      A: { ms: 30, status: 422, erro: "recusado" },
      B: { ms: 30 },
    });
    const saida = await emCadeia(PEDIDO, ["A", "B"], RAPIDO, r.chamar);

    conferir(
      "recusa do modelo não passa adiante",
      saida.status === 422 && r.chamados.length === 1,
      `${r.chamados.length} chamada(s)`
    );
  }

  {
    const r = roteiro({});
    await emCadeia(
      PEDIDO,
      ["A", "B", "C", "D"],
      { hedgeMs: 300, prazoMs: 1200 },
      r.chamar
    );

    conferir(
      "o prazo é da chamada inteira, não de cada modelo",
      r.decorrido() < 2200,
      `quatro travados, desistiu em ${r.decorrido()} ms (prazo 1200)`
    );
  }

  {
    const r = roteiro({ A: { ms: 500 }, B: { ms: 10 } });
    const saida = await emCadeia(
      PEDIDO,
      ["A", "B"],
      { hedgeMs: 0, prazoMs: 3000 },
      r.chamar
    );

    conferir(
      "sem corrida (Profundo), quem demora não é atropelado",
      saida.modelo === "A" && r.chamados.length === 1,
      `${r.chamados.length} chamada(s)`
    );
  }

  {
    const r = roteiro({
      A: { ms: 50, status: 503, erro: "fila" },
      B: { ms: 10 },
    });
    const saida = await emCadeia(
      PEDIDO,
      ["A", "B"],
      { hedgeMs: 0, prazoMs: 3000 },
      r.chamar
    );

    conferir(
      "sem corrida, a falha ainda passa adiante",
      saida.modelo === "B",
      `respondeu ${saida.modelo}`
    );
  }
}

function ordem() {

  console.log("\n  A ORDEM — quem entra na cadeia\n");

  /* A configuração que estava em produção em 11/09, gravada pela tela. */
  const producao = {
    modelo: "gemini-flash-lite-latest",
    modeloRapido: "gemini-flash-lite-latest",
    modeloReserva: "gemini-flash-latest",
    hedgeMs: 4000,
    prazoMs: 20000,
  } as ConfigDeIA;

  const cadeia = cadeiaDeModelos(producao, true);

  conferir(
    "principal igual ao rápido não deixa a cadeia de um modelo só",
    cadeia.length >= 3 && new Set(cadeia).size === cadeia.length,
    cadeia.join(" → ")
  );

  conferir(
    "o que a tela escolheu é tentado primeiro",
    cadeia[0] === "gemini-flash-lite-latest"
  );

  /* "A" ficou de castigo lá em cima, quando travou. */
  const comCastigo = cadeiaDeModelos(
    { ...producao, modelo: "A", modeloRapido: "A" } as ConfigDeIA,
    false
  );

  conferir(
    "quem falhou há pouco sai da frente",
    comCastigo[0] !== "A",
    comCastigo.join(" → ")
  );
}

async function main() {
  await regras();
  ordem();

  console.log(
    falhas === 0
      ? "\n  Fila num modelo não derruba a chamada.\n"
      : `\n  ${falhas} regra(s) da cadeia quebrada(s).\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
