/**
 * A sessão se renova com o uso e o "manter conectado" dura 30 dias?
 *
 *   npm run check:sessao-renovada
 *
 * Sem banco e sem segredo de verdade (05/11/2026): assina sessões de
 * mentira com uma chave de teste e confere quando a renovação acontece.
 */
import { decodeJwt } from "jose";
import { OITO_HORAS, TRINTA_DIAS, sessaoRenovada } from "../lib/auth/renovacao";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

const SEGREDO = new TextEncoder().encode("chave-de-teste-so-desta-conferencia");
const AGORA = Date.parse("2026-11-05T12:00:00Z");
const s = (seg: number) => Math.floor(AGORA / 1000) + seg;

async function main() {
  const base = { id: "u1", email: "teste@cardapioweb.com", name: "Teste", role: "AGENTE" };

  conferir("8 h com 6 h restando: não renova ainda", await sessaoRenovada({ ...base, exp: s(6 * 3600) }, SEGREDO, AGORA), null);
  const oito = await sessaoRenovada({ ...base, exp: s(3 * 3600), iat: s(-5 * 3600) }, SEGREDO, AGORA);
  conferir("8 h com 3 h restando: renova por mais 8 h", oito?.duracao, OITO_HORAS);
  const p = oito ? decodeJwt(oito.token) : null;
  conferir("a nova vence 8 h depois de agora", p ? (p.exp as number) - s(0) : null, OITO_HORAS);
  conferir("e leva a mesma pessoa", [p?.id, p?.email, p?.role], ["u1", "teste@cardapioweb.com", "AGENTE"]);

  conferir("30 dias com 20 restando: não renova", await sessaoRenovada({ ...base, manter: true, exp: s(20 * 86400) }, SEGREDO, AGORA), null);
  const trinta = await sessaoRenovada({ ...base, manter: true, exp: s(10 * 86400) }, SEGREDO, AGORA);
  conferir("30 dias com 10 restando: renova por mais 30", trinta?.duracao, TRINTA_DIAS);
  conferir("e continua marcada como manter conectado", trinta ? decodeJwt(trinta.token).manter : null, true);

  conferir("vencida não renova", await sessaoRenovada({ ...base, exp: s(-10) }, SEGREDO, AGORA), null);
  conferir("sem vencimento não renova", await sessaoRenovada({ ...base }, SEGREDO, AGORA), null);

  /* O token gerado é aceito pela mesma verificação do proxy. */
  const { jwtVerify } = await import("jose");
  const valido = oito ? await jwtVerify(oito.token, SEGREDO, { currentDate: new Date(AGORA) }).then(() => true, () => false) : false;
  conferir("a renovada passa na verificação", valido, true);

  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
}
main();
