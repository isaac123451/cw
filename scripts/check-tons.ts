/**
 * As respostas em três tons (Fase 28).
 *
 *   npm run check:tons
 *
 * Sem banco e sem IA: os três tons com o nome e a pendência real, o
 * prazo só quando a conversa o registra (e a promessa vencida vira
 * desculpa, não data nova), o estilo aprendido das edições e o aviso de
 * promessa sem registro.
 */
import { situarSemIA } from "../lib/models/resumoQueSitua";
import { aplicarEstilo, estiloAprendido, exemplosParaIA, prometeSemRegistro, tonsSemIA } from "../lib/models/tonsDaResposta";
import { instanteDe } from "../lib/services/horasUteis";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)?.slice(0, 70)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)?.slice(0, 70)}`);
}

const agora = instanteDe("2026-09-24", 11 * 60);
const conversa = [
  { de: "cliente" as const, texto: "A impressora parou de imprimir os pedidos.", carimbo: "09:00, 24/09/2026" },
  { de: "nos" as const, texto: "Oi, Ana! Já verifiquei a sua conta. Te retorno amanhã às 10h.", carimbo: "09:10, 24/09/2026" },
  { de: "cliente" as const, texto: "Preciso que volte a imprimir hoje, por favor.", carimbo: "10:30, 24/09/2026" },
];
const situacao = situarSemIA(conversa, agora);

console.log("\n  Os três tons, sem IA\n");
const tons = tonsSemIA({ nome: "ana souza", assunto: "Impressão de pedidos", situacao });
conferir("três tons, na ordem", tons.map((t) => t.tom), ["acolhedora", "objetiva", "tecnica"]);
conferir("todos começam pelo nome", tons.every((t) => t.texto.startsWith("Oi, Ana!")), true);
conferir("acolhedora reconhece o transtorno", tons[0].texto.includes("sinto muito pelo transtorno"), true);
conferir("objetiva cita o que foi feito", tons[1].texto.includes("já verifiquei a sua conta"), true);
conferir("técnica cita o pedido real e o que está verificando", tons[2].texto.includes('"Preciso que volte a imprimir hoje, por favor"') && tons[2].texto.includes("Agora estou verificando impressão de pedidos a fundo"), true);
conferir("os três validam o que o cliente sente (a conferência do documento)", tons.every((t) => /sinto|entendo/i.test(t.texto)), true);
conferir("prazo só o registrado: 25/09 às 10:00", tons.every((t) => t.texto.includes("até 25/09 às 10:00")), true);
const vencida = situarSemIA([conversa[0], { ...conversa[1], carimbo: "09:10, 22/09/2026" }, conversa[2]], agora);
conferir("promessa vencida vira desculpa, sem data nova", tonsSemIA({ nome: "Ana", assunto: "Impressão", situacao: vencida })[1].texto.includes("desculpe o atraso"), true);
const semPromessa = situarSemIA([conversa[0], { de: "nos" as const, texto: "Oi, Ana! Já verifiquei a sua conta." }, conversa[2]], agora);
conferir("sem promessa registrada, nenhum prazo", tonsSemIA({ nome: "Ana", assunto: "Impressão", situacao: semPromessa }).every((t) => !prometeSemRegistro(t.texto, semPromessa) && t.texto.includes("assim que tiver a posição")), true);
conferir("nome 'Não informado' não vira saudação", tonsSemIA({ nome: "Não informado", assunto: "x", situacao })[0].texto.startsWith("Oi! "), true);

console.log("\n  Não prometer o que não está registrado\n");
conferir("repetir a data registrada pode", prometeSemRegistro("Como combinamos, te retorno até 25/09 às 10:00.", situacao), false);
conferir("data nova é promessa sem registro", prometeSemRegistro("Resolvo até sexta.", situacao), true);
conferir("'em 2 horas' sem registro", prometeSemRegistro("Em 2 horas está resolvido.", semPromessa), true);
conferir("sem prazo nenhum", prometeSemRegistro("Estou cuidando disso e te dou notícia.", semPromessa), false);

console.log("\n  O estilo aprendido das edições\n");
const edicoes = [
  { original: "Oi, Ana! Estou vendo isso.", editada: "Olá, Ana! Estou vendo isso.\nQualquer coisa, estou por aqui!" },
  { original: "Oi, Bia! Já ajustei.", editada: "Olá, Bia! Já ajustei.\nQualquer coisa, estou por aqui!" },
  { original: "Oi! Pode testar?", editada: "Oi! Pode testar agora?" },
];
const estilo = estiloAprendido(edicoes);
conferir("saudação trocada em 2 de 3 vira estilo", estilo.saudacao, "Olá");
conferir("despedida acrescentada em 2 de 3 vira estilo", estilo.despedida, "Qualquer coisa, estou por aqui!");
conferir("uma edição sozinha não vira estilo", estiloAprendido([edicoes[0]]).saudacao, undefined);
conferir("edição igual ao original não conta", estiloAprendido([{ original: "Oi, a", editada: "Oi, a" }, { original: "Oi, b", editada: "Oi, b" }]).exemplos.length, 0);
conferir("aplicar: troca a saudação e acrescenta a despedida", aplicarEstilo("Oi, Ana! Já vi.", estilo), "Olá, Ana! Já vi.\n\nQualquer coisa, estou por aqui!");
conferir("aplicar não repete a despedida", aplicarEstilo("Olá! Já vi.\n\nQualquer coisa, estou por aqui!", estilo), "Olá! Já vi.\n\nQualquer coisa, estou por aqui!");
conferir("os tons das regras saem no estilo", tonsSemIA({ nome: "Ana", assunto: "x", situacao, estilo })[0].texto.startsWith("Olá, Ana!"), true);
conferir("a IA recebe os exemplos", exemplosParaIA(estilo).includes('Enviado: "Olá, Ana! Estou vendo isso.'), true);
conferir("sem edições, nada para a IA", exemplosParaIA(estiloAprendido([])), "");

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
