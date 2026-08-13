"use server";

import { redirect } from "next/navigation";

import bcrypt from "bcryptjs";

import { getPrisma, hasDatabase } from "@/lib/prisma";

import {
  HASH_CORROMPIDO,
  isBcryptHash,
} from "@/lib/auth/hash";

import {
  BOOTSTRAP_EMAILS,
  checkSignupAccess,
  hasAllowedDomain,
  normalizeEmail,
} from "@/lib/auth/access";

import {
  createSession,
  destroySession,
} from "@/lib/auth/session";

export interface FormState {
  error?: string;
  success?: string;
}

/** Lista de e-mails liberados: banco quando existe, bootstrap quando não. */
async function allowList(): Promise<string[]> {

  const prisma = getPrisma();

  if (!prisma) return BOOTSTRAP_EMAILS;

  const rows = await prisma.allowedEmail.findMany({
    select: { email: true },
  });

  return rows.length > 0
    ? rows.map((row) => row.email)
    : BOOTSTRAP_EMAILS;
}

export async function signUp(
  _state: FormState,
  formData: FormData
): Promise<FormState> {

  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(
    String(formData.get("email") ?? "")
  );
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) {
    return { error: "Informe seu nome completo." };
  }

  if (password.length < 8) {
    return {
      error: "A senha precisa ter ao menos 8 caracteres.",
    };
  }

  const access = checkSignupAccess(
    email,
    await allowList()
  );

  if (!access.ok) {
    return { error: access.reason };
  }

  const prisma = getPrisma();

  if (!prisma) {
    return {
      error:
        "Banco de dados não configurado. Defina DATABASE_URL para habilitar o cadastro.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return {
      error: "Já existe uma conta com este e-mail.",
    };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      // Primeiro usuário da base assume a administração.
      role:
        (await prisma.user.count()) === 0
          ? "ADMIN"
          : "AGENTE",
    },
  });

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function signIn(
  _state: FormState,
  formData: FormData
): Promise<FormState> {

  const email = normalizeEmail(
    String(formData.get("email") ?? "")
  );
  const password = String(formData.get("password") ?? "");

  if (!hasAllowedDomain(email)) {
    return {
      error:
        "Acesso restrito a e-mails corporativos @cardapioweb.com.",
    };
  }

  const prisma = getPrisma();

  if (!prisma) {
    return {
      error:
        "Banco de dados não configurado. Defina DATABASE_URL para habilitar o login.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Mensagem única: não revela se o e-mail existe na base.
  const invalid = { error: "E-mail ou senha inválidos." };

  if (!user) return invalid;

  /**
   * Hash inválido recusaria toda senha silenciosamente, e a pessoa
   * ficaria tentando adivinhar a própria. Melhor dizer o que houve —
   * quem chega aqui já provou conhecer o e-mail, e a mensagem não
   * revela nada sobre a senha.
   */
  if (!isBcryptHash(user.passwordHash)) {
    return { error: HASH_CORROMPIDO };
  }

  const ok = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!ok) return invalid;

  if (!user.active) {
    return {
      error: "Esta conta está desativada.",
    };
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function databaseReady() {
  return hasDatabase();
}
