/**
 * A captura das Redes lê a planilha e o Slack do jeito que a operação escreve?
 *
 *   npm run check:captura-redes
 *
 * **O pedido.** "Identificados os casos de uma planilha … e também casos
 * do Slack." A extensão manda o CSV da aba aberta (ou o texto da
 * mensagem) e a aplicação decide o resto. O que este check segura, sem
 * banco:
 *
 * 1. **o CSV de verdade**: aspas, vírgula dentro do relato, quebra de
 *    linha na célula, ponto e vírgula como separador;
 * 2. **as colunas pelos nomes que se usam** ("Link do perfil" é link, e
 *    não perfil; "Instagram do cliente" é perfil);
 * 3. **os valores**: rede pelo nome ou pelo link, @ pelo link do perfil,
 *    "18,4 mil" seguidores, data brasileira em Brasília;
 * 4. **a chave estável**: reordenar a planilha não transforma nada em
 *    novo; a mesma linha duas vezes é repetida; sem rede não grava;
 * 5. **o Slack**: rede, perfil, link e seguidores saem do texto;
 * 6. **a fiação**: nada grava sem o clique, e a rota existe na extensão.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classificarItens,
  dataDaCelula,
  itemDoSlack,
  itensDaPlanilha,
  lerCsv,
  mapearColunas,
  perfilDoTexto,
  protocoloDaCaptura,
  redeDoTexto,
  seguidoresDoTexto,
  tituloDaCaptura,
} from "../lib/models/capturaDasRedes";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  CAPTURA DAS REDES\n");

/* ---- 1. CSV ---- */

const csv = [
  '"Carimbo de data/hora","Rede","Instagram do cliente","Seguidores","Link do perfil","Mensagem"',
  '"17/09/2026 14:30","Instagram","@maria.silva","18,4 mil","https://instagram.com/maria.silva/","Pedido não chegou, e o suporte não responde"',
  '"17/09/2026 15:02","","","","https://www.facebook.com/joao.p","Linha 1',
  'linha 2 do relato"',
  '"17/09/2026 14:30","Instagram","@maria.silva","18,4 mil","https://instagram.com/maria.silva/","Pedido não chegou, e o suporte não responde"',
  '"18/09","TikTok","@alguem","","","Sem rede do módulo"',
].join("\r\n");

const linhas = lerCsv(csv);
conferir("5 linhas (cabeçalho + 4), quebra dentro da célula", linhas.length, 5);
conferir("vírgula dentro do relato fica no relato", linhas[1][5], "Pedido não chegou, e o suporte não responde");
conferir("quebra de linha dentro da célula", linhas[2][5], "Linha 1\nlinha 2 do relato");
conferir("ponto e vírgula como separador", lerCsv("Data;Relato\n17/09;oi, tudo bem")[1], ["17/09", "oi, tudo bem"]);

/* ---- 2. colunas ---- */

const mapa = mapearColunas(linhas[0]);
conferir("Carimbo de data/hora é a data", mapa.quando, 0);
conferir("Instagram do cliente é o perfil", mapa.perfil, 2);
conferir("Link do perfil é o link", mapa.link, 4);
conferir("Mensagem é o relato", mapa.texto, 5);

/* ---- 3. valores ---- */

conferir("rede pelo nome", redeDoTexto("insta"), "Instagram");
conferir("rede pelo link", redeDoTexto("https://wa.me/5511999999999"), "WhatsApp");
conferir("TikTok não é rede do módulo", redeDoTexto("TikTok"), null);
conferir("@ pelo link do perfil", perfilDoTexto("", "https://www.instagram.com/maria.silva/"), "maria.silva");
conferir("link de post não vira perfil", perfilDoTexto("", "https://www.instagram.com/p/Cx123/"), "");
conferir("seguidores: 18,4 mil / 18.400 / 1,2 mi / 18k", ["18,4 mil", "18.400", "1,2 mi", "18k", "2 milhões"].map(seguidoresDoTexto), [18400, 18400, 1200000, 18000, 2000000]);
conferir("data brasileira em Brasília", dataDaCelula("17/09/2026 14:30"), "2026-09-17T17:30:00.000Z");
conferir("sem hora, meio-dia", dataDaCelula("17/09/2026"), "2026-09-17T15:00:00.000Z");
conferir("data inválida fica vazia", dataDaCelula("31/13/2026"), "");

/* ---- 4. chave estável ---- */

const planilha = { id: "1AbCdEfGhIjKlMnOpQrStUvWxYz", gid: "0" };
const { itens } = itensDaPlanilha(linhas, planilha, 2026);
conferir("4 itens (nenhuma linha vazia)", itens.length, 4);
conferir("a 2ª linha lê rede pelo link", itens[1].rede, "Facebook");
conferir("seguidores lidos", itens[0].seguidores, 18400);

const reordenada = itensDaPlanilha([linhas[0], linhas[4], linhas[2], linhas[1], linhas[3]], planilha, 2026).itens;
conferir("reordenar mantém as chaves", new Set(reordenada.map((i) => i.chave)).size === new Set(itens.map((i) => i.chave)).size && reordenada.every((i) => itens.some((j) => j.chave === i.chave)), true);

const estados = classificarItens(itens, { chaves: new Set(), links: new Set() }).map((x) => x.estado);
conferir("nova, nova, repetida, sem rede", estados, ["nova", "nova", "duplicada", "sem-rede"]);
conferir(
  "já no CW pela chave ou pelo link",
  classificarItens(itens.slice(0, 2), { chaves: new Set([itens[0].chave]), links: new Set(["https://www.facebook.com/joao.p"]) }).map((x) => x.estado),
  ["existente", "existente"]
);
conferir("protocolo pela rede e estável", [protocoloDaCaptura(itens[0]).slice(0, 3), protocoloDaCaptura(itens[1]).slice(0, 3), protocoloDaCaptura(itens[0]) === protocoloDaCaptura(reordenada.find((i) => i.chave === itens[0].chave)!)], ["IG-", "FB-", true]);
conferir("título é a primeira frase, curta", tituloDaCaptura({ texto: "Pedido não chegou. Estou esperando há 2h.", perfil: "", rede: "Instagram" }), "Pedido não chegou.");

/* ---- 5. Slack ---- */

const slack = itemDoSlack({
  canal: "C0123",
  ts: "1726590000.000100",
  texto: "Nova menção no Instagram: @joana.doces (12,3 mil seguidores) reclamou do atraso https://www.instagram.com/p/Cx9/ cliente: Joana Souza",
});
conferir("Slack: rede", slack.rede, "Instagram");
conferir("Slack: perfil", slack.perfil, "joana.doces");
conferir("Slack: seguidores", slack.seguidores, 12300);
conferir("Slack: link", slack.link, "https://www.instagram.com/p/Cx9/");
conferir("Slack: nome", slack.nome, "Joana Souza");
conferir("Slack: chave pelo canal e ts", slack.chave, "slack:C0123:1726590000.000100");
conferir("Slack: referência em Brasília", itemDoSlack({ canal: "C1", ts: "1.000001", texto: "oi", quando: "2026-09-17T13:05:00.000Z" }).referencia, "mensagem de 17/09, 10:05");

/* ---- 6. fiação ---- */

const rota = ler("app/api/extensao/captura-redes/route.ts");
conferir("a prévia não grava", rota.indexOf("previaDaCaptura") < rota.indexOf("gravarCaptura(prisma"), true);
conferir("somente leitura não grava", rota.includes('acao === "gravar" && usuario.papel === "LEITURA"'), true);
conferir("a extensão chama a rota", ler("extensao/fundo/service-worker.js").includes('capturaRedes: "/api/extensao/captura-redes"'), true);
conferir("a planilha só grava no clique", /aoClicar: async[\s\S]{0,200}acao: "gravar"/.test(ler("extensao/conteudo/planilha.js")), true);
conferir("o manifesto carrega a planilha e o Slack", ler("extensao/manifest.json").includes('"conteudo/planilha.js"') && ler("extensao/manifest.json").includes('"conteudo/slack.js"'), true);
conferir("o Slack só grava no clique", /aoClicar: async[\s\S]{0,200}acao: "gravar"/.test(ler("extensao/conteudo/slack.js")), true);
conferir("a gravação avisa a tela das Redes", ler("app/api/extensao/captura-redes/route.ts").includes("revalidateTag(CASES_TAG"), true);

console.log(falhas === 0 ? "\n  A captura lê a planilha e o Slack como a operação escreve.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
