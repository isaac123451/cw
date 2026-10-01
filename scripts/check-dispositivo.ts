/**
 * O dispositivo lembrado só dispensa o código quando deve?
 *
 *   npm run check:dispositivo
 *
 * Sem banco e sem navegador (1.120): as regras de `dispositivoRegras.ts`,
 * que decidem se um navegador lembrado pula o código. E a fiação: o login
 * só consulta o dispositivo **depois** de conferir a senha, o código só
 * lembra depois de conferido, e trocar a senha esquece todos.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { dispositivoValeAgora, hashDoSegredo, lerValorDoCookie, nomeDoDispositivo } from "../lib/auth/dispositivoRegras";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 40)}`);
}

console.log("\n  DISPOSITIVO LEMBRADO — as regras\n");

const segredo = "Q2hhdmUtZGUtdGVzdGUtY29tLWJhc3RhbnRlLWNhcmFjdGVyZXMtYWxlYXQ";
const agora = new Date("2026-10-01T15:00:00Z");
const linha = {
  userId: "u1",
  segredoHash: hashDoSegredo(segredo),
  criadoEm: new Date("2026-09-20T15:00:00Z"),
  validoAte: new Date("2026-10-20T15:00:00Z"),
  revogadoEm: null as Date | null,
};

conferir("dono, dentro do prazo, segredo certo: dispensa", dispositivoValeAgora(linha, segredo, "u1", 30, agora), true);
conferir("de outra pessoa: não dispensa", dispositivoValeAgora(linha, segredo, "u2", 30, agora), false);
conferir("segredo errado: não dispensa", dispositivoValeAgora(linha, segredo.replace("Q", "R"), "u1", 30, agora), false);
conferir("esquecido: não dispensa", dispositivoValeAgora({ ...linha, revogadoEm: new Date("2026-09-30T00:00:00Z") }, segredo, "u1", 30, agora), false);
conferir("vencido: não dispensa", dispositivoValeAgora(linha, segredo, "u1", 30, new Date("2026-10-21T00:00:00Z")), false);
conferir("prazo encurtado para 7 dias vale na hora (lembrado há 11)", dispositivoValeAgora(linha, segredo, "u1", 7, agora), false);
conferir("prazo 0 desliga todos", dispositivoValeAgora(linha, segredo, "u1", 0, agora), false);
conferir("sem linha no banco: não dispensa", dispositivoValeAgora(null, segredo, "u1", 30, agora), false);

conferir("cookie bem formado", lerValorDoCookie(`cmupn4hn70001qotq1yr5ft0m.${segredo}`)?.id, "cmupn4hn70001qotq1yr5ft0m");
conferir("cookie sem ponto, vazio ou forjado curto: nada", [lerValorDoCookie("abc"), lerValorDoCookie(""), lerValorDoCookie("abc.def")], [null, null, null]);
conferir("o banco guarda o hash, não o segredo", linha.segredoHash !== segredo && linha.segredoHash.length === 64, true);

conferir(
  "nomes reconhecíveis",
  [
    nomeDoDispositivo("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"),
    nomeDoDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
    nomeDoDispositivo("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0"),
    nomeDoDispositivo(undefined),
  ],
  ["Chrome no Windows", "Safari no iPhone", "Edge no Windows", "Navegador"]
);

console.log("\n  A FIAÇÃO\n");

const ler = (arquivo: string) => readFileSync(resolve(__dirname, "..", arquivo), "utf8");
const acoes = ler("lib/auth/actions.ts");
const senhaConferida = acoes.indexOf("await limparFalhas(email);");
const consultaDispositivo = acoes.indexOf("esteDispositivoDispensaOCodigo(user.id)");
conferir("o login só consulta o dispositivo depois de conferir a senha", senhaConferida > 0 && consultaDispositivo > senhaConferida, true);
const codigoConferido = acoes.indexOf("const conferido = await conferirCodigo(");
const lembra = acoes.indexOf("await lembrarEsteDispositivo(user.id)");
conferir("lembra só depois de o código conferir", codigoConferido > 0 && lembra > codigoConferido, true);
conferir("trocar a senha esquece os dispositivos", /dispositivoConfiavel\.updateMany\(\{\s*where: \{ userId: user\.id, revogadoEm: null \}/.test(ler("lib/auth/account.ts")), true);
const dispositivo = ler("lib/auth/dispositivo.ts");
conferir("o cookie é httpOnly e lax", /httpOnly: true,\s*sameSite: "lax"/.test(dispositivo), true);
conferir("a caixa vem desmarcada", !/name="lembrar"[^>]*defaultChecked/.test(ler("components/auth/CodeForm.tsx")), true);

console.log(falhas === 0 ? "\n  O dispositivo lembrado dispensa o código só quando deve.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
