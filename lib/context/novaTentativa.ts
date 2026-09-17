/**
 * Tenta de novo o que falhou de passagem, antes de avisar alguém.
 *
 * Duas novas tentativas, com espera crescente (1,5 s e 4 s). Repete
 * quando a chamada lança (rede, função encerrada no meio) ou quando o
 * resultado diz que a falha é passageira. Falha que não passa — sem
 * sessão, sem permissão — volta na hora: esperar não muda nada.
 */
export const ESPERAS_MS = [1500, 4000];

export async function comNovaTentativa<T>(
  chamar: (tentativa: number) => Promise<T>,
  ehPassageira: (resultado: T) => boolean,
  esperas: number[] = ESPERAS_MS,
  dormir: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      const resultado = await chamar(tentativa);
      if (!ehPassageira(resultado) || tentativa >= esperas.length) return resultado;
    } catch (erro) {
      if (tentativa >= esperas.length) throw erro;
    }
    await dormir(esperas[tentativa]);
  }
}
