/**
 * A leitura tenta de novo o que falhou de passagem — e só isso?
 *
 *   npm run check:nova-tentativa
 *
 * A faixa "Os números abaixo não são a sua operação — Recarregar"
 * aparecia em quase toda abertura, por falhas passageiras da primeira
 * leitura. Agora `comNovaTentativa` repete duas vezes antes de avisar.
 * Este check prova a regra sem esperar de verdade (o sono é injetado).
 */
import { comNovaTentativa } from "../lib/context/novaTentativa";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
}

const semDormir = async () => undefined;

async function main() {
  console.log("\n  NOVA TENTATIVA\n");

  {
    let chamadas = 0;
    const r = await comNovaTentativa(async () => (++chamadas < 2 ? "banco-recusou" : "ok"), (x) => x === "banco-recusou", [10, 10], semDormir);
    conferir("falha passageira, depois sucesso: devolve o sucesso", [r, chamadas], ["ok", 2]);
  }
  {
    let chamadas = 0;
    const r = await comNovaTentativa(async () => { chamadas++; return "sem-sessao"; }, (x) => x === "banco-recusou", [10, 10], semDormir);
    conferir("falha que não passa volta na hora, sem repetir", [r, chamadas], ["sem-sessao", 1]);
  }
  {
    let chamadas = 0;
    const r = await comNovaTentativa(async () => { chamadas++; return "banco-recusou"; }, (x) => x === "banco-recusou", [10, 10], semDormir);
    conferir("passageira que não passa: três tentativas e devolve a falha", [r, chamadas], ["banco-recusou", 3]);
  }
  {
    let chamadas = 0;
    const r = await comNovaTentativa(async () => { if (++chamadas === 1) throw new Error("rede"); return "ok"; }, () => false, [10, 10], semDormir);
    conferir("chamada que lança também repete", [r, chamadas], ["ok", 2]);
  }
  {
    const tentativas: number[] = [];
    await comNovaTentativa(async (t) => { tentativas.push(t); return t < 2 ? "x" : "ok"; }, (x) => x === "x", [10, 10], semDormir);
    conferir("a primeira tentativa é a 0 (a da carga inicial)", tentativas, [0, 1, 2]);
  }
  {
    let erro = "";
    try {
      await comNovaTentativa(async () => { throw new Error("fora do ar"); }, () => false, [10, 10], semDormir);
    } catch (e) {
      erro = (e as Error).message;
    }
    conferir("lançando sempre, o erro chega a quem chamou", erro, "fora do ar");
  }

  console.log(falhas === 0 ? "\n  Falha passageira não vira aviso.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
