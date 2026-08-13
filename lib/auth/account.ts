"use server";

import { revalidatePath } from "next/cache";

import bcrypt from "bcryptjs";

import { getPrisma } from "@/lib/prisma";

import {
  HASH_CORROMPIDO,
  isBcryptHash,
} from "@/lib/auth/hash";

import {
  hasAllowedDomain,
  normalizeEmail,
} from "@/lib/auth/access";

import {
  createSession,
  getSession,
} from "@/lib/auth/session";

export interface ActionState {
  error?: string;
  success?: string;
}

/** Mensagem única quando a tela depende do banco. */
const SEM_BANCO =
  "Banco de dados não configurado. Defina DATABASE_URL para habilitar esta ação.";

export async function updateProfile(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {

  const session = await getSession();

  if (!session) {
    return { error: "Faça login para editar o perfil." };
  }

  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    return { error: "Informe seu nome completo." };
  }

  const prisma = getPrisma();

  if (!prisma) return { error: SEM_BANCO };

  const user = await prisma.user.update({
    where: { id: session.id },
    data: { name },
  });

  // A sessão carrega o nome — sem recriar, o topo continuaria com o antigo.
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  revalidatePath("/conta");

  return { success: "Perfil atualizado." };
}

export async function changePassword(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {

  const session = await getSession();

  if (!session) {
    return { error: "Faça login para trocar a senha." };
  }

  const atual = String(formData.get("current") ?? "");
  const nova = String(formData.get("password") ?? "");
  const confirma = String(formData.get("confirm") ?? "");

  if (nova.length < 8) {
    return {
      error: "A nova senha precisa ter ao menos 8 caracteres.",
    };
  }

  if (nova !== confirma) {
    return { error: "A confirmação não confere." };
  }

  if (nova === atual) {
    return {
      error: "A nova senha precisa ser diferente da atual.",
    };
  }

  const prisma = getPrisma();

  if (!prisma) return { error: SEM_BANCO };

  const user = await prisma.user.findUnique({
    where: { id: session.id },
  });

  if (!user) return { error: "Conta não encontrada." };

  // Sem isto, hash inválido vira "senha atual incorreta" para sempre.
  if (!isBcryptHash(user.passwordHash)) {
    return { error: HASH_CORROMPIDO };
  }

  const ok = await bcrypt.compare(
    atual,
    user.passwordHash
  );

  if (!ok) return { error: "Senha atual incorreta." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(nova, 10),
    },
  });

  return { success: "Senha alterada." };
}

/** Só ADMIN administra acessos. */
async function requireAdmin() {

  const session = await getSession();

  if (!session) return null;
  if (session.role !== "ADMIN") return null;

  return session;
}

export async function allowEmail(
  _state: ActionState,
  formData: FormData
): Promise<ActionState> {

  if (!(await requireAdmin())) {
    return {
      error: "Apenas administradores liberam acessos.",
    };
  }

  const email = normalizeEmail(
    String(formData.get("email") ?? "")
  );

  const note = String(formData.get("note") ?? "").trim();

  if (!hasAllowedDomain(email)) {
    return {
      error:
        "Só é possível liberar e-mails @cardapioweb.com.",
    };
  }

  const prisma = getPrisma();

  if (!prisma) return { error: SEM_BANCO };

  const existing = await prisma.allowedEmail.findUnique({
    where: { email },
  });

  if (existing) {
    return { error: "Este e-mail já está liberado." };
  }

  await prisma.allowedEmail.create({
    data: { email, note: note || null },
  });

  revalidatePath("/conta");

  return { success: `${email} liberado.` };
}

export async function revokeEmail(id: string) {

  if (!(await requireAdmin())) return;

  const prisma = getPrisma();

  if (!prisma) return;

  await prisma.allowedEmail.delete({ where: { id } });

  revalidatePath("/conta");
}

export async function setUserRole(
  id: string,
  role: "ADMIN" | "AGENTE" | "LEITURA"
) {

  const session = await requireAdmin();

  if (!session) return;

  // Evita a base ficar sem nenhum administrador.
  if (session.id === id && role !== "ADMIN") return;

  const prisma = getPrisma();

  if (!prisma) return;

  await prisma.user.update({
    where: { id },
    data: { role },
  });

  revalidatePath("/conta");
}

export async function toggleUserActive(id: string) {

  const session = await requireAdmin();

  if (!session) return;

  // Ninguém desativa a própria conta e se tranca para fora.
  if (session.id === id) return;

  const prisma = getPrisma();

  if (!prisma) return;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return;

  await prisma.user.update({
    where: { id },
    data: { active: !user.active },
  });

  revalidatePath("/conta");
}

export interface AccessData {
  allowed: {
    id: string;
    email: string;
    note: string | null;
  }[];
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
  }[];
}

/** Dados da aba de administração. Vazio quando não há banco. */
export async function getAccessData(): Promise<AccessData> {

  const prisma = getPrisma();

  if (!prisma) return { allowed: [], users: [] };

  const [allowed, users] = await Promise.all([
    prisma.allowedEmail.findMany({
      select: { id: true, email: true, note: true },
      orderBy: { email: "asc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return { allowed, users };
}
