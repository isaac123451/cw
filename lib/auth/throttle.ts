import "server-only";

import { getPrisma } from "@/lib/prisma";

/**
 * Freio de tentativas de login.
 *
 * Sem isto, `signIn` aceita quantas tentativas o atacante quiser: com a
 * lista de e-mails da empresa (que é previsível — nome.sobrenome@) dá
 * para varrer senhas fracas sem obstáculo. O bcrypt encarece cada
 * tentativa, mas não limita quantas.
 *
 * **No banco, e não mais em memória.** A primeira versão guardava as
 * falhas num `Map`, com o comentário "a aplicação roda em uma instância
 * na Vercel". Não roda: as funções escalam em várias instâncias e
 * nascem frias com frequência, cada uma com o mapa vazio. O limite de
 * cinco valia por instância e sumia a cada instância nova — quem
 * batesse na porta rápido o bastante espalhava as tentativas e nunca
 * era freado. Corrigido em 10/09/2026, na revisão crítica.
 *
 * Agora a conta é da tabela `TentativaDeLogin`, e vale para a conta
 * atacada onde quer que a tentativa caia. O código de duas etapas,
 * exigido para todos desde 02/09, continua sendo a segunda porta: este
 * freio protege a primeira.
 *
 * **Sem banco, em memória.** É o modo demonstração, que não tem conta
 * de verdade para proteger — o mapa só mantém o comportamento igual.
 *
 * **Falha do banco não tranca ninguém.** Se a consulta ao freio cair, o
 * login segue: quem decide se entra continua sendo a senha e o código,
 * e um pooler oscilando por dez segundos não pode virar "ninguém entra".
 */

const TENTATIVAS_MAX = 5;

/** Janela de contagem e de bloqueio. */
const JANELA_MS = 15 * 60 * 1000;

export interface Bloqueio {
  bloqueado: boolean;
  /** Minutos que faltam, para a mensagem da tela. */
  minutos: number;
}

const LIVRE: Bloqueio = { bloqueado: false, minutos: 0 };

/* ------------------------------------------------------------
   Modo demonstração: o mesmo freio, em memória.
------------------------------------------------------------ */

const emMemoria = new Map<
  string,
  { falhas: number; primeiraEm: number }
>();

function avaliar(
  registro: { falhas: number; primeiraEm: number } | null,
  agora: number
): Bloqueio {

  if (!registro) return LIVRE;

  /* Janela vencida: o histórico não conta mais. */
  if (agora - registro.primeiraEm > JANELA_MS) return LIVRE;

  if (registro.falhas < TENTATIVAS_MAX) return LIVRE;

  return {
    bloqueado: true,
    minutos: Math.max(
      Math.ceil(
        (JANELA_MS - (agora - registro.primeiraEm)) / 60000
      ),
      1
    ),
  };
}

/* ------------------------------------------------------------
   A porta
------------------------------------------------------------ */

export async function checarBloqueio(
  chave: string
): Promise<Bloqueio> {

  const agora = Date.now();

  const prisma = getPrisma();

  if (!prisma) {
    return avaliar(emMemoria.get(chave) ?? null, agora);
  }

  try {
    const linha = await prisma.tentativaDeLogin.findUnique({
      where: { chave },
      select: { falhas: true, primeiraEm: true },
    });

    return avaliar(
      linha
        ? {
            falhas: linha.falhas,
            primeiraEm: linha.primeiraEm.getTime(),
          }
        : null,
      agora
    );
  } catch (erro) {
    console.error("[login] freio indisponível", erro);
    return LIVRE;
  }
}

/**
 * Soma uma falha — numa instrução só, sem ler antes.
 *
 * Ler, somar e gravar deixaria duas tentativas simultâneas contarem
 * uma: as duas leriam "3" e gravariam "4". O `ON CONFLICT` faz a conta
 * dentro do banco, e reinicia a janela quando a anterior já venceu.
 */
export async function registrarFalha(chave: string) {

  const agora = new Date();

  const prisma = getPrisma();

  if (!prisma) {
    const atual = emMemoria.get(chave);

    if (!atual || agora.getTime() - atual.primeiraEm > JANELA_MS) {
      emMemoria.set(chave, { falhas: 1, primeiraEm: agora.getTime() });
    } else {
      atual.falhas += 1;
    }

    return;
  }

  const inicioDaJanela = new Date(agora.getTime() - JANELA_MS);

  try {
    await prisma.$executeRaw`
      INSERT INTO "TentativaDeLogin" ("chave", "falhas", "primeiraEm", "updatedAt")
      VALUES (${chave}, 1, ${agora}, ${agora})
      ON CONFLICT ("chave") DO UPDATE SET
        "falhas" = CASE
          WHEN "TentativaDeLogin"."primeiraEm" < ${inicioDaJanela} THEN 1
          ELSE "TentativaDeLogin"."falhas" + 1
        END,
        "primeiraEm" = CASE
          WHEN "TentativaDeLogin"."primeiraEm" < ${inicioDaJanela} THEN ${agora}
          ELSE "TentativaDeLogin"."primeiraEm"
        END,
        "updatedAt" = ${agora}
    `;
  } catch (erro) {
    console.error("[login] não consegui registrar a falha", erro);
  }
}

/** Acertou a senha: o histórico de falhas deixa de valer. */
export async function limparFalhas(chave: string) {

  const prisma = getPrisma();

  if (!prisma) {
    emMemoria.delete(chave);
    return;
  }

  try {
    await prisma.tentativaDeLogin.deleteMany({ where: { chave } });
  } catch (erro) {
    console.error("[login] não consegui limpar as falhas", erro);
  }
}

/**
 * Apaga o que já não conta — para a rotina diária.
 *
 * Uma linha por e-mail que errou a senha, e que depois de quinze
 * minutos não serve para nada. Sem faxina a tabela guardaria para
 * sempre a lista de endereços que alguém tentou — que é, ela mesma, uma
 * informação que não precisa existir.
 */
export async function limparTentativasVelhas() {

  const prisma = getPrisma();

  if (!prisma) return 0;

  const r = await prisma.tentativaDeLogin.deleteMany({
    where: {
      primeiraEm: { lt: new Date(Date.now() - JANELA_MS) },
    },
  });

  return r.count;
}
