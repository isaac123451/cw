import "server-only";

import { PrismaClient } from "@prisma/client";

import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import type { Modulo } from "@/lib/auth/modules";

/**
 * Reexportados de `lib/auth/modules.ts`, que não é `server-only`.
 *
 * As actions continuam importando papel daqui — o vocabulário do guard
 * não mudou. O que mudou é que uma tela pode pegar o rótulo sem arrastar
 * o Prisma para o navegador.
 */
export {
  ROLE_LABELS,
  type Role,
} from "@/lib/auth/modules";

import type { Role } from "@/lib/auth/modules";

/**
 * Papéis em ordem de poder. Comparar por número deixa a regra ser
 * "pelo menos AGENTE" em vez de listar cada papel aceito em cada action.
 */
const NIVEL: Record<Role, number> = {
  LEITURA: 0,
  AGENTE: 1,
  ADMIN: 2,
};

export class SemPermissao extends Error {
  constructor(mensagem = "Você não tem permissão para esta ação.") {
    super(mensagem);
    this.name = "SemPermissao";
  }
}

/**
 * Papel atual, lido do **banco** e não do cookie.
 *
 * O cookie de sessão dura 8 horas. Confiando nele, rebaixar alguém de
 * ADMIN para LEITURA só valeria no próximo login — a pessoa seguiria
 * administrando o resto do dia. O cookie diz *quem* é; o banco diz *o
 * que pode*.
 *
 * Também derruba quem foi desativado (`active: false`) sem esperar a
 * sessão expirar.
 */
export async function currentRole(
  modulo?: Modulo
): Promise<Role | null> {

  const prisma = getPrisma();

  if (!prisma) return null;

  const session = await getSession();

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, active: true },
  });

  if (!user || !user.active) return null;

  return papelNoModulo(
    prisma,
    session.id,
    user.role as Role,
    modulo
  );
}

export interface Autorizado {
  prisma: PrismaClient;
  userId: string;
  /** O papel **efetivo** — o do módulo, quando há exceção gravada. */
  role: Role;
}

/**
 * O papel de alguém dentro de um módulo.
 *
 * Só a exceção é gravada em `UserModuleRole`: sem linha, vale o papel
 * da conta. É o que faz mudar o papel da pessoa continuar valendo em
 * todo módulo onde ninguém mexeu — o contrário congelaria uma cópia do
 * padrão em cada linha.
 */
async function papelNoModulo(
  prisma: PrismaClient,
  userId: string,
  base: Role,
  modulo?: Modulo
): Promise<Role> {

  if (!modulo) return base;

  const excecao = await prisma.userModuleRole.findUnique({
    where: { userId_module: { userId, module: modulo } },
    select: { role: true },
  });

  return (excecao?.role as Role) ?? base;
}

/**
 * Exige sessão válida e papel mínimo.
 *
 * Devolve `null` quando não há banco — é o modo demonstração, em que a
 * aplicação roda aberta e as gravações não têm para onde ir.
 *
 * **Toda server action que grava precisa passar por aqui.** Sem isso, a
 * checagem fica só na interface, e esconder um botão não impede ninguém
 * de chamar a action direto.
 */
export async function requireRole(
  minimo: Role = "AGENTE",
  /**
   * O módulo em que a ação acontece.
   *
   * Sem ele vale o papel da conta, que é o comportamento de sempre —
   * é assim que uma action ainda não classificada continua protegida.
   */
  modulo?: Modulo
): Promise<Autorizado | null> {

  const prisma = getPrisma();

  if (!prisma) return null;

  const session = await getSession();

  if (!session) {
    throw new SemPermissao(
      "Sessão expirada. Entre novamente."
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, active: true },
  });

  if (!user) {
    throw new SemPermissao(
      "Conta não encontrada. Entre novamente."
    );
  }

  if (!user.active) {
    throw new SemPermissao(
      "Esta conta está desativada."
    );
  }

  /**
   * O papel do módulo vence o da conta.
   *
   * Quem é AGENTE em geral pode ser LEITURA no NPS, e vice-versa. Sem
   * exceção gravada, os dois são a mesma coisa.
   */
  const role = await papelNoModulo(
    prisma,
    session.id,
    user.role as Role,
    modulo
  );

  if (NIVEL[role] < NIVEL[minimo]) {
    throw new SemPermissao(
      minimo === "ADMIN"
        ? "Só administradores podem fazer isso."
        : modulo
          ? "Seu acesso a este módulo é somente leitura."
          : "Seu acesso é somente leitura."
    );
  }

  return { prisma, userId: session.id, role };
}

/** Versão booleana, para a interface esconder o que não adianta mostrar. */
export async function can(
  minimo: Role,
  modulo?: Modulo
) {

  const role = await currentRole(modulo);

  return role ? NIVEL[role] >= NIVEL[minimo] : false;
}

/**
 * Como `requireRole`, mas devolve `null` em vez de lançar quando não há
 * sessão.
 *
 * É o certo para **leitura**: os providers de preferências, filtros e
 * agenda montam no layout raiz, então rodam também em `/login` e
 * `/cadastro` — onde não existe sessão por definição. Lançando ali, cada
 * visita à tela de login registrava dois 500 no servidor por algo que é
 * o funcionamento normal.
 *
 * Gravação continua em `requireRole`: ali o silêncio esconderia uma
 * recusa que a pessoa precisa ver.
 */
export async function tryRole(
  minimo: Role = "LEITURA",
  modulo?: Modulo
): Promise<Autorizado | null> {

  const prisma = getPrisma();

  if (!prisma) return null;

  const session = await getSession();

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, active: true },
  });

  if (!user || !user.active) return null;

  const role = await papelNoModulo(
    prisma,
    session.id,
    user.role as Role,
    modulo
  );

  return NIVEL[role] < NIVEL[minimo]
    ? null
    : { prisma, userId: session.id, role };
}
