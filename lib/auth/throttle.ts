import "server-only";

/**
 * Freio de tentativas de login.
 *
 * Sem isto, `signIn` aceita quantas tentativas o atacante quiser: com a
 * lista de e-mails da empresa (que é previsível — nome.sobrenome@) dá
 * para varrer senhas fracas sem obstáculo. O bcrypt encarece cada
 * tentativa, mas não limita quantas.
 *
 * **Em memória, de propósito.** A aplicação roda em uma instância na
 * Vercel; um contador compartilhado exigiria Redis, que ainda não
 * existe aqui. Numa frota de instâncias o limite passa a valer por
 * instância — continua reduzindo muito a taxa, mas está registrado no
 * ROADMAP como o próximo passo se o volume crescer.
 */

const TENTATIVAS_MAX = 5;

/** Janela de contagem e de bloqueio. */
const JANELA_MS = 15 * 60 * 1000;

interface Registro {
  falhas: number;
  primeiraEm: number;
}

const porChave = new Map<string, Registro>();

/** Evita a memória crescer sem limite com chaves antigas. */
function limpar(agora: number) {

  if (porChave.size < 5000) return;

  for (const [chave, reg] of porChave) {
    if (agora - reg.primeiraEm > JANELA_MS) {
      porChave.delete(chave);
    }
  }
}

export interface Bloqueio {
  bloqueado: boolean;
  /** Minutos que faltam, para a mensagem da tela. */
  minutos: number;
}

export function checarBloqueio(chave: string): Bloqueio {

  const reg = porChave.get(chave);

  if (!reg) return { bloqueado: false, minutos: 0 };

  const agora = Date.now();

  // Janela vencida: o histórico não conta mais.
  if (agora - reg.primeiraEm > JANELA_MS) {
    porChave.delete(chave);
    return { bloqueado: false, minutos: 0 };
  }

  if (reg.falhas < TENTATIVAS_MAX) {
    return { bloqueado: false, minutos: 0 };
  }

  return {
    bloqueado: true,
    minutos: Math.max(
      Math.ceil(
        (JANELA_MS - (agora - reg.primeiraEm)) / 60000
      ),
      1
    ),
  };
}

export function registrarFalha(chave: string) {

  const agora = Date.now();

  limpar(agora);

  const reg = porChave.get(chave);

  if (!reg || agora - reg.primeiraEm > JANELA_MS) {
    porChave.set(chave, {
      falhas: 1,
      primeiraEm: agora,
    });
    return;
  }

  reg.falhas += 1;
}

/** Acertou a senha: o histórico de falhas deixa de valer. */
export function limparFalhas(chave: string) {
  porChave.delete(chave);
}
