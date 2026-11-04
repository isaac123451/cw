/**
 * A fala do cliente vira a atividade certa?
 *
 *   npm run check:fala-do-cliente
 *
 * Sem banco (04/11/2026). Os casos vêm das 1.253 mensagens reais de 90
 * dias: os sete "funcionou" verdadeiros e os falsos que a primeira versão
 * da regra pegava (relato longo, negação distante, condição, ressalva).
 */
import { sinaisDaConversa, sinalNaMensagem } from "../lib/models/falaDoCliente";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 40)}`);
}
const sinal = (t: string) => sinalNaMensagem(t)?.sinal ?? null;

console.log("\n-- funcionou (verdadeiros, das conversas reais)");
for (const t of ["Consegui", "Olá boa tarde! Foi resolvida sim", "Deu certo obrigado", "Deu certo agora", "Deu certo aqui! Obrigado! Será que consigo restringir o chatbot para algumas pessoas?", "Deu certo", "Funcionou, muito obrigada!", "já está funcionando normal"]) conferir(t, sinal(t), "funcionou");

console.log("\n-- não é funcionou");
for (const t of [
  "nenhuma das tentativas do suporte deu certo",
  "Veja se deu certo",
  "não funcionou de novo",
  "ainda não resolveu",
  "funcionou?",
  "o que demonstrou que o problema poderia ter sido resolvido antes",
  "Acredito não ser necessário, uma vez que foi resolvido o problema. Porém é insustentável",
  "Sendo que o segundo em 30 minutos resolveu o problema",
  "resolvi cancelar",
  "x".repeat(150) + " deu certo depois de três dias de espera e muita conversa sem retorno de ninguém do suporte",
]) conferir(t.slice(0, 60), sinal(t), null);

console.log("\n-- alerta");
for (const t of ["Vou no Procon amanhã", "meu advogado vai entrar em contato", "vou entrar na justiça", "isso dá danos morais", "abri no consumidor.gov"]) conferir(t, sinal(t), "alerta");
for (const t of ["o processo de cadastro travou", "qual o processo para trocar a impressora?", "já abri no reclame aqui"]) conferir(t, sinal(t), null);

console.log("\n-- a conversa");
const d = (h: number) => new Date(Date.UTC(2026, 10, 4, h));
conferir("funcionou e depois reclamou de novo: não vale",
  sinaisDaConversa([{ de: "cliente", texto: "Deu certo", em: d(12) }, { de: "cliente", texto: "parou de novo", em: d(14) }], d(0)).map((s) => s.sinal), []);
conferir("funcionou depois do problema: vale",
  sinaisDaConversa([{ de: "cliente", texto: "não está imprimindo", em: d(11) }, { de: "cliente", texto: "Deu certo, obrigado", em: d(13) }], d(0)).map((s) => s.sinal), ["funcionou"]);
conferir("antes do recorte não conta",
  sinaisDaConversa([{ de: "cliente", texto: "Deu certo", em: d(1) }], d(5)).map((s) => s.sinal), []);
conferir("nossa fala não conta",
  sinaisDaConversa([{ de: "nos", texto: "Deu certo?", em: d(12) }, { de: "nos", texto: "Funcionou, então", em: d(12) }], d(0)).map((s) => s.sinal), []);
conferir("alerta e funcionou na mesma conversa: os dois",
  sinaisDaConversa([{ de: "cliente", texto: "vou no Procon", em: d(10) }, { de: "cliente", texto: "Consegui", em: d(13) }], d(0)).map((s) => s.sinal), ["alerta", "funcionou"]);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
