/**
 * O que a IA aprende das conversas (21/10/2026) — o filtro do sensível e a
 * escolha do que serve. Sem banco.
 *
 *   npm run check:aprendizados
 */
import { chaveDoAprendizado, ehSensivel, relevantes, semDadoSensivel } from "../lib/models/aprendizados";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}
const limpo = semDadoSensivel("CPF 123.456.789-01, CNPJ 12.345.678/0001-90, joao@gmail.com, (11) 98765-4321, cartão 4111 1111 1111 1111");
ok("tira documento, e-mail, telefone e cartão — nenhum número de 4 dígitos sobra", !/\d{4}|@/.test(limpo), limpo);
ok("senha barra a mensagem inteira", ehSensivel("a senha do painel é abc123"));
ok("salário e atestado são privados", ehSensivel("meu salário atrasou") && ehSensivel("mandei o atestado"));
ok("conversa de trabalho passa", !ehSensivel("o iFood está instável desde ontem, o time de integração já sabe"));
ok("mesmo assunto, mesma chave", chaveDoAprendizado("Bloqueio do WhatsApp") === chaveDoAprendizado("bloqueio no whatsapp!"));
const saber = [
  { assunto: "Bloqueio do WhatsApp", texto: "Bloqueio recorrente se resolve migrando para a API oficial da Meta.", vezes: 3 },
  { assunto: "Impressora térmica", texto: "Impressão automática falha quando o app está em segundo plano.", vezes: 1 },
];
ok("conversa sobre bloqueio recebe o aprendizado do bloqueio", relevantes(saber, "meu whatsapp toma bloqueio toda semana, o que faço com a api?").map((a) => a.assunto).join() === "Bloqueio do WhatsApp");
ok("conversa sem nada em comum não recebe nada", relevantes(saber, "bom dia, tudo bem?").length === 0);
console.log(`\n${falhas === 0 ? "tudo certo" : `${falhas} falha(s)`}`);
process.exit(falhas === 0 ? 0 : 1);
