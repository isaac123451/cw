/**
 * Um hash bcrypt tem 60 caracteres e começa com `$2a$`, `$2b$` ou `$2y$`.
 *
 * A checagem existe porque `bcrypt.compare` devolve `false` — em vez de
 * erro — quando o valor guardado não é um hash. O sintoma disso é uma
 * conta que recusa toda senha sem dizer por quê, e a causa costuma ser
 * alguém editando `passwordHash` direto no banco.
 */
export function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

export const HASH_CORROMPIDO =
  "A senha desta conta está gravada em formato inválido no banco. " +
  "Redefina com: npm run db:password -- <e-mail>";
