import { SignJWT, type JWTPayload } from "jose";

/*
  A sessão se renova com o uso (05/11/2026). Era fixa: 8 horas depois do
  login, caía no meio do trabalho, e o Isaac entrava de novo todo dia. Agora,
  passada a metade da validade, a próxima página leva uma sessão nova com a
  mesma duração — 8 horas, ou 30 dias para quem marcou "Manter conectado"
  (`lib/auth/session.ts`). Parada além disso, ela vence como antes.

  Sem `server-only`: quem chama é o `proxy.ts`, e a conferência roda em
  script.
*/
export const OITO_HORAS = 60 * 60 * 8;
export const TRINTA_DIAS = 60 * 60 * 24 * 30;

export async function sessaoRenovada(
  payload: JWTPayload,
  segredo: Uint8Array,
  agora = Date.now()
): Promise<{ token: string; duracao: number } | null> {
  if (typeof payload.exp !== "number") return null;
  const duracao = payload.manter === true ? TRINTA_DIAS : OITO_HORAS;
  const agoraS = Math.floor(agora / 1000);
  const resta = payload.exp - agoraS;
  if (resta <= 0 || resta > duracao / 2) return null;
  const { exp: _exp, iat: _iat, ...resto } = payload;
  const token = await new SignJWT(resto)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(agoraS)
    .setExpirationTime(agoraS + duracao)
    .sign(segredo);
  return { token, duracao };
}
