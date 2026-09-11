/**
 * O checklist do dia sai mesmo sem IA — e na ordem certa?
 *
 *   npm run check:checklist
 *
 * **O defeito que isto existe para não repetir.** Em 11/09/2026 o card
 * mostrava só "O Gemini está congestionado", com todos os números já
 * contados no servidor e jogados fora. Agora, quando a IA não responde,
 * a lista sai pelas regras de `checklistPelasRegras`.
 *
 * A regra que mais importa é a mesma que se pede ao modelo:
 * **consequência, não tamanho**. Dois detratores sem contato vêm antes de
 * trinta reclamações sem resposta.
 */
import {
  checklistPelasRegras,
  type RetratoDoDia,
} from "../lib/services/checklist.service";

let falhas = 0;

function conferir(titulo: string, ok: boolean, detalhe = "") {
  if (!ok) falhas += 1;
  console.log(`${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(58)} ${detalhe}`);
}

function retrato(parcial: {
  reclameAqui?: Partial<RetratoDoDia["reclameAqui"]>;
  redesSociais?: Partial<RetratoDoDia["redesSociais"]>;
  nps?: Partial<RetratoDoDia["nps"]>;
  agenda?: Partial<RetratoDoDia["agenda"]>;
}): RetratoDoDia {
  return {
    dia: "2026-09-11",
    reclameAqui: {
      emAberto: 0,
      semRespostaPublica: 0,
      semResponsavel: 0,
      foraDoPrazo: 0,
      riscoDeCancelamento: 0,
      avaliadosComoNaoResolvido: 0,
      semRegraDeSla: false,
      ...parcial.reclameAqui,
    },
    redesSociais: { emAberto: 0, semResponsavel: 0, ...parcial.redesSociais },
    nps: {
      emTratativa: 0,
      foraDoPrazoDePrimeiroContato: 0,
      detratoresSemPrimeiroContato: 0,
      semCausaRaiz: 0,
      ...parcial.nps,
    },
    agenda: { tarefasPendentes: 0, atrasadas: 0, ...parcial.agenda },
  };
}

console.log("\n  CHECKLIST — a lista das regras\n");

const limpo = checklistPelasRegras(retrato({}));

conferir("dia limpo não inventa trabalho", limpo.itens.length === 0, limpo.abertura);

const cheio = checklistPelasRegras(
  retrato({
    reclameAqui: { emAberto: 40, semRespostaPublica: 30, semResponsavel: 4 },
    nps: { detratoresSemPrimeiroContato: 2, emTratativa: 9 },
  })
);

conferir(
  "consequência antes de tamanho: detrator na frente",
  cheio.itens[0]?.frente === "nps" && cheio.itens[0]?.quantos === 2,
  cheio.itens.map((i) => `${i.frente}:${i.quantos}`).join(" ")
);

conferir(
  "cada número é o do retrato, sem conta nova",
  cheio.itens.find((i) => /sem resposta pública/.test(i.titulo))?.quantos === 30
);

conferir(
  "só entra o que tem o que fazer",
  cheio.itens.every((i) => i.quantos > 0)
);

const semSla = checklistPelasRegras(
  retrato({ reclameAqui: { foraDoPrazo: 5, semRegraDeSla: true } })
);

conferir(
  "sem regra de SLA, 'fora do prazo' não aparece como item",
  !semSla.itens.some((i) => /fora do prazo/.test(i.titulo))
);

conferir(
  "e a falta da regra vira o aviso",
  /regra de SLA/.test(semSla.atencao ?? "")
);

const tudo = checklistPelasRegras(
  retrato({
    reclameAqui: {
      semRespostaPublica: 1,
      semResponsavel: 1,
      foraDoPrazo: 1,
      riscoDeCancelamento: 1,
    },
    redesSociais: { semResponsavel: 1 },
    nps: {
      foraDoPrazoDePrimeiroContato: 1,
      detratoresSemPrimeiroContato: 1,
      semCausaRaiz: 1,
    },
    agenda: { atrasadas: 1 },
  })
);

conferir("no máximo oito itens, como se pede ao modelo", tudo.itens.length <= 8, `${tudo.itens.length}`);

console.log(
  falhas === 0
    ? "\n  Sem IA, o checklist sai com os números do banco e na ordem de consequência.\n"
    : `\n  ${falhas} regra(s) do checklist quebrada(s).\n`
);

process.exitCode = falhas === 0 ? 0 : 1;
