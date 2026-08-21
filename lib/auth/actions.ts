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

import {
  checarBloqueio,
  limparFalhas,
  registrarFalha,
} from "@/lib/auth/throttle";

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

  /**
   * Cadastro sobre uma pessoa que já existe **sem senha**.
   *
   * O cadastro de Times cria a pessoa antes de ela ter login, para que
   * possa receber caso e tarefa (`passwordHash` vazio). Quando ela
   * enfim se cadastra, adotar a linha existente é o que preserva tudo
   * que já estava no nome dela — casos, tarefas, anotações. Criar uma
   * segunda conta com o mesmo e-mail é impossível (o campo é único), e
   * recusar deixaria a pessoa para sempre sem acesso.
   */
  if (existing && isBcryptHash(existing.passwordHash)) {
    return {
      error: "Já existe uma conta com este e-mail.",
    };
  }

  if (existing) {

    const adotado = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        passwordHash: await bcrypt.hash(password, 10),
        active: true,
      },
    });

    await createSession({
      id: adotado.id,
      email: adotado.email,
      name: adotado.name,
      role: adotado.role,
    });

    redirect("/dashboard");
  }

  /**
   * Toda conta criada por autocadastro nasce **somente leitura**.
   *
   * Antes o primeiro usuário da base virava ADMIN sozinho: quem
   * chegasse primeiro a uma instalação nova — ou a uma base recriada —
   * ganhava a administração inteira sem ninguém autorizar. E os demais
   * nasciam AGENTE, com poder de gravar em toda a operação.
   *
   * O administrador inicial vem do `db:seed`, que roda com acesso ao
   * banco. Promover alguém é ato explícito de um ADMIN, em
   * `/conta` → Acessos.
   */
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "LEITURA",
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

  /**
   * Freio antes de tocar no banco.
   *
   * A chave é o e-mail: protege a conta alvo mesmo quando as tentativas
   * vêm de IPs diferentes, que é o caso do ataque distribuído.
   */
  const trava = checarBloqueio(email);

  if (trava.bloqueado) {
    return {
      error: `Muitas tentativas. Tente de novo em ${trava.minutos} minuto(s).`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Mensagem única: não revela se o e-mail existe na base.
  const invalid = { error: "E-mail ou senha inválidos." };

  if (!user) {
    registrarFalha(email);
    return invalid;
  }

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

  if (!ok) {
    registrarFalha(email);
    return invalid;
  }

  /**
   * Conta desativada só é revelada **depois** de a senha bater. Antes
   * disso a resposta seria um oráculo: quem chutasse e-mails saberia
   * quais existem na base sem precisar acertar a senha.
   */
  if (!user.active) {
    return {
      error: "Esta conta está desativada.",
    };
  }

  limparFalhas(email);

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
