/** Único domínio autorizado a acessar a plataforma. */
export const ALLOWED_DOMAIN = "cardapioweb.com";

/**
 * Contas liberadas quando ainda não há banco configurado. Em produção a
 * liberação vem da tabela `AllowedEmail`.
 */
export const BOOTSTRAP_EMAILS = [
  "carlos.isaac@cardapioweb.com",
];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hasAllowedDomain(email: string) {
  return normalizeEmail(email).endsWith(
    `@${ALLOWED_DOMAIN}`
  );
}

export interface AccessCheck {
  ok: boolean;
  reason?: string;
}

/** Regra de cadastro: domínio correto **e** e-mail liberado. */
export function checkSignupAccess(
  email: string,
  allowList: string[]
): AccessCheck {

  const value = normalizeEmail(email);

  if (!hasAllowedDomain(value)) {
    return {
      ok: false,
      reason: `Apenas e-mails @${ALLOWED_DOMAIN} podem se cadastrar.`,
    };
  }

  if (!allowList.map(normalizeEmail).includes(value)) {
    return {
      ok: false,
      reason:
        "Este e-mail ainda não foi liberado. Peça a liberação ao administrador.",
    };
  }

  return { ok: true };
}
