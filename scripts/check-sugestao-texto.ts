/**
 * A sugestão pelo texto acha o parecido certo, e não afirma o que não mede?
 *
 *   npm run check:sugestao-texto
 *
 * **O pedido.** "A parte de triagem dos casos achei interessante, você
 * pode enxergar margens que possa melhorar" — e o roadmap pede que a
 * sugestão aprenda com a correção e mostre a taxa de acerto. Este check
 * roda só sobre exemplos fabricados (a medição real, sobre os 356
 * relatos do Reclame Aqui, é `npm run medir:sugestao`); prova:
 *
 * 1. **tokenização e radical** aguentam acento, plural e maiúscula;
 * 2. **o vizinho mais parecido vence**, e o cosseno não confunde textos
 *    sem palavra em comum;
 * 3. **regra e vizinhos se somam**, e a confiança cai quando os dois
 *    discordam;
 * 4. **medirAcerto não inventa**: tira o próprio exemplo da conta, e sem
 *    nenhum exemplo classificado não sugere nada;
 * 5. **as regras do Reclame Aqui e do NPS** batem no texto certo e não
 *    disparam à toa;
 * 6. **o trecho apontado** existe no texto original, no lugar certo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { familiaDoAssunto } from "../lib/models/assuntos";
import {
  CRITERIOS_NO_TEXTO,
  REGRAS_DE_ASSUNTO,
  criarIndice,
  criteriosPeloTexto,
  medirAcerto,
  normalizarTexto,
  parecidos,
  regrasDeCausa,
  regrasDeTipoNps,
  sugerir,
  tokensDoTexto,
  trechoDoPadrao,
  type Exemplo,
} from "../lib/models/sugestaoPorTexto";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  SUGESTÃO PELO TEXTO\n");

/* ---- 1. tokenização ---- */

conferir("acento some, maiúscula some", tokensDoTexto("NÃO consigo ACESSAR o SISTEMA"), tokensDoTexto("nao consigo acessar o sistema"));
conferir("plural vira o mesmo radical", tokensDoTexto("cobranças indevidas")[0], tokensDoTexto("cobrança indevida")[0]);
conferir("palavra parada some", tokensDoTexto("o sistema não funciona"), tokensDoTexto("sistema funciona"));

/* ---- 2. vizinho mais parecido ---- */

const exemplos: Exemplo[] = [
  { id: "1", texto: "O sistema trava toda hora e não consigo lançar pedido", rotulo: "Sistema" },
  { id: "2", texto: "A impressora não imprime os pedidos, sistema travando", rotulo: "Sistema" },
  { id: "3", texto: "Fui cobrado duas vezes no cartão, quero o estorno do valor", rotulo: "Financeiro" },
  { id: "4", texto: "A cobrança veio duplicada na fatura deste mês", rotulo: "Financeiro" },
  { id: "5", texto: "O atendente não me respondeu, faz três dias sem retorno", rotulo: "Atendimento" },
];
const indice = criarIndice(exemplos);

conferir("acha o vizinho do mesmo assunto", parecidos(indice, "o sistema não abre e trava direto")[0]?.rotulo, "Sistema");
conferir("texto sem palavra em comum não vira vizinho", parecidos(indice, "xpto glub floo blarg"), []);
conferir("sugere pelo vizinho, sem regra", sugerir("meu sistema trava e não funciona mais nada", { indice })?.valor, "Sistema");
conferir("exclui o próprio exemplo da vizinhança", parecidos(indice, exemplos[0].texto, 5, "1").some((p) => p.id === "1"), false);

/* ---- 3. regra + vizinhos ---- */

const comRegra = sugerir("preciso saber por que fui cobrado duas vezes", {
  indice,
  regras: [{ rotulo: "Financeiro", padrao: /cobrad[oa]/, motivo: "fala em cobrança" }],
});
conferir("regra e vizinhos concordam: sugere e explica os dois", comRegra?.valor, "Financeiro");
conferir("o motivo cita o vizinho e a regra", comRegra!.motivo.includes("parecido") && comRegra!.motivo.includes("fala em cobrança"), true);

const discordam = sugerir("o sistema travou de novo, muito ruim", {
  indice,
  regras: [{ rotulo: "Atendimento", padrao: /ruim/, peso: 0.2, motivo: "" }],
});
conferir("quando um lado é bem mais forte, ele vence", discordam?.valor, "Sistema");
conferir("mas a confiança cai por causa do discordante", discordam!.confianca < 1, true);

conferir("sem índice nem regra, não sugere nada", sugerir("qualquer coisa", {}), null);
conferir("texto vazio não sugere", sugerir("   ", { indice }), null);
conferir("valoresValidos filtra o que não existe mais", sugerir("sistema trava direto", { indice, valoresValidos: ["Financeiro"] }), null);

/* ---- 4. medirAcerto não inventa ---- */

const m = medirAcerto(exemplos);
conferir("tira o próprio exemplo da conta (não é 100%)", m.acertos <= m.sugeridos && m.sugeridos <= m.base, true);
conferir("sem exemplo nenhum, não mede nada", medirAcerto([]), { base: 0, sugeridos: 0, acertos: 0, taxa: null, cobertura: null });
conferir("taxa e cobertura ficam entre 0 e 1", m.taxa === null || (m.taxa >= 0 && m.taxa <= 1), true);

/* ---- 5. as regras da documentação ---- */

conferir("Financeiro pelo relato do RA", REGRAS_DE_ASSUNTO.find((r) => r.padrao.test(normalizarTexto("fui cobrado indevidamente no cartão")))?.rotulo, "Financeiro");
conferir("Sistema pelo relato do RA", REGRAS_DE_ASSUNTO.find((r) => r.padrao.test(normalizarTexto("o aplicativo não sincroniza os pedidos")))?.rotulo, "Sistema");
conferir("família agrupa as categorias antigas do portal", [familiaDoAssunto("Qualidade Do Atendimento"), familiaDoAssunto("Financeiro E Cobranças"), familiaDoAssunto("Atendimento")], ["Atendimento", "Financeiro", "Atendimento"]);

conferir("critério jurídico no relato", criteriosPeloTexto("vou entrar com uma ação no Procon").map((c) => c.criterio), ["juridico"]);
conferir("critério de operação parada", criteriosPeloTexto("o sistema está totalmente parado, não consigo vender nada hoje").some((c) => c.criterio === "operacao-parada"), true);
conferir("relato neutro não acende nenhum critério grave", criteriosPeloTexto("gostaria de saber como configurar o horário de entrega"), []);
conferir("todo critério da tabela tem regra de texto (juridico/exposicao/operacao-parada/cancelamento/financeiro/funcionalidade/prazo-descumprido)", CRITERIOS_NO_TEXTO.length, 7);

conferir("NPS: Erro no Sistema pelo comentário", regrasDeTipoNps(5).find((r) => r.padrao.test(normalizarTexto("o app trava toda hora")))?.rotulo, "Erro no Sistema");
conferir("NPS: elogio só entra com nota alta", regrasDeTipoNps(9).some((r) => r.rotulo === "Elogio") && !regrasDeTipoNps(4).some((r) => r.rotulo === "Elogio"), true);
conferir("causa raiz pelo nome cadastrado", regrasDeCausa(["Bug", "Atendimento"]).find((r) => r.padrao.test(normalizarTexto("deu erro ao salvar")))?.rotulo, "Bug");
conferir("causa sem palavra-chave conhecida não gera regra", regrasDeCausa(["Um Nome Bem Estranho Sem Sentido"]), []);

/* ---- 6. o trecho ---- */

const texto = "Bom dia, gostaria de registrar que fui cobrado em duplicidade no cartão de crédito este mês.";
const trecho = trechoDoPadrao(texto, /cobrad[oa] em duplicidade/, 15);
conferir("o trecho existe no texto original", texto.includes(trecho.replace(/^…/, "").replace(/…$/, "")), true);
conferir("o trecho contém o que casou", /cobrad[oa] em duplicidade/i.test(trecho), true);
conferir("sem padrão achado, trecho vazio", trechoDoPadrao(texto, /nao existe isso aqui/), "");

/* ---- fiação ---- */

conferir("a ação de sugestão do RA não confia em texto do cliente sem checar tamanho", ler("lib/actions/sugestoes.ts").includes('texto.length < 8) return { sugestao: null, acerto: null }'), true);
/*
  Achado ao conferir na tela: `tryRole` lê `cookies()`, e o Next recusa
  ler `cookies()` dentro de uma função passada a `unstable_cache` — o
  cache vale para qualquer requisição, não para uma sessão. A função
  cacheada só pode usar `getPrisma()`; a permissão se checa fora, uma
  vez, em `sugerirAssuntoDoRelato`.
*/
{
  const acao = ler("lib/actions/sugestoes.ts");
  const cacheado = acao.slice(acao.indexOf("async function lerExemplosRA"), acao.indexOf("const exemplosCacheados"));
  conferir("a função cacheada não chama tryRole (cookies dentro de unstable_cache quebra)", cacheado.includes("tryRole"), false);
  conferir("a permissão é checada antes de usar o cache", acao.indexOf("await tryRole(") < acao.indexOf("await exemplosCacheados()"), true);
}
conferir("a taxa só aparece com base mínima", ler("lib/actions/sugestoes.ts").includes("BASE_MINIMA_PARA_TAXA"), true);
conferir("a sugestão do RA só mostra categoria que existe de verdade", ler("components/reclame-aqui/detail/InvestigationTab.tsx").includes("categories.some((c) => c.name === sugestao.sugestao!.valor)"), true);
conferir("a sugestão do NPS só mostra tipo/causa ativos", ler("components/nps/ficha/ClassificarNpsModal.tsx").includes("ativos.some((k) => k.name === sugestao.tipo!.valor)"), true);
conferir("nada marca sozinho: sempre um clique em Usar", ler("components/shared/SugestaoDoTexto.tsx").includes("onClick={onUsar}"), true);

console.log(falhas === 0 ? "\n  A sugestão acha o parecido certo e não afirma o que não mede.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
