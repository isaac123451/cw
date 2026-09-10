import "server-only";

/**
 * Freio de tentativas de login.
 *
 * Sem isto, `signIn` aceita quantas tentativas o atacante quiser: com a
 * lista de e-mails da empresa (que é previsível — nome.sobrenome@) dá
 * para varrer senhas fracas sem obstáculo. O bcrypt encarece cada
 * tentativa, mas não limita quantas.
 *
 * **Em memória — e isso é mais fraco do que parecia.** A premissa
 * original era "a aplicação roda em uma instância na Vercel", e ela não
 * vale: as funções da Vercel escalam em várias instâncias e nascem
 * frias com frequência, cada uma com este mapa vazio. O limite vale por
 * instância e some a cada instância nova.
 *
 * O que segura a porta hoje é o código de duas etapas, exigido para
 * todas as contas desde 02/09/2026 (`SecurityConfig.twoFactorRequired`):
 * acertar a senha só leva até o código, e o código tem validade de dez
 * minutos e três tentativas **gravadas no banco**. O passo certo para
 * este freio é o mesmo — guardar as falhas no banco —, e está anotado
 * como pendência da revisão de 10/09/2026.
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
