/**
 * As mini-janelas abrem, empilham, voltam do F5 e ficam na tela?
 *
 *   npm run check:janelas
 *
 * **O pedido.** "Em cada frente seja possível abrir uma mini janela para
 * preencher as informações ou mudar status. Quero que seja possível
 * abrir mais de uma e navegar entre as páginas enquanto faço isso."
 *
 * Duas metades, as duas sem servidor:
 *
 * 1. **a regra** (`lib/models/janelas.ts`): a mesma ficha não vira duas
 *    janelas, o teto de oito não fecha nada sozinho, a janela nunca some
 *    da tela e o que volta do armazenamento é saneado;
 * 2. **a fiação**: o provider mora no layout raiz (é o que faz a janela
 *    sobreviver à troca de página), cada frente tem o botão de abrir, e
 *    cada ficha grava pelo caminho que devolve o que aconteceu.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  abrirJanela,
  alternarCompleta,
  janelaDoEndereco,
  organizarJanelas,
  focarJanela,
  idDaJanela,
  lerJanelasGuardadas,
  limitarNaTela,
  MAXIMO_DE_JANELAS,
  type Janela,
} from "../lib/models/janelas";

const RAIZ = resolve(__dirname, "..");
const TELA = { largura: 1440, altura: 900 };

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  MINI-JANELAS — várias fichas abertas enquanto se navega\n");
console.log("— A regra —\n");

{
  let janelas: Janela[] = [];

  const a = abrirJanela(janelas, { frente: "reclame-aqui", ref: "caso-1", titulo: "RA-1" }, TELA);
  janelas = a.janelas;
  conferir("abrir cria a janela", [a.tipo, janelas.length], ["aberta", 1]);

  const b = abrirJanela(janelas, { frente: "nps", ref: "nps-1", titulo: "NPS 3" }, TELA);
  janelas = b.janelas;
  conferir("abrir outra frente empilha a segunda", janelas.length, 2);
  conferir("a nova fica na frente", janelas[1].z > janelas[0].z, true);
  conferir(
    "e nasce deslocada da anterior, não em cima dela",
    [janelas[1].x !== janelas[0].x, janelas[1].y !== janelas[0].y],
    [true, true]
  );

  /* A mesma ficha duas vezes: duas cópias com dois rascunhos apagariam uma à outra. */
  const minimizada = janelas.map((j) => (j.ref === "caso-1" ? { ...j, minimizada: true } : j));
  const c = abrirJanela(minimizada, { frente: "reclame-aqui", ref: "caso-1", titulo: "RA-1" }, TELA);
  conferir("abrir a mesma ficha não duplica", [c.tipo, c.janelas.length], ["focada", 2]);
  conferir(
    "e traz a existente para a frente, fora da bandeja",
    (() => {
      const j = c.janelas.find((x) => x.id === idDaJanela("reclame-aqui", "caso-1"))!;
      return [j.minimizada, j.z === Math.max(...c.janelas.map((x) => x.z))];
    })(),
    [false, true]
  );

  conferir("mesma referência em frentes diferentes são janelas diferentes", idDaJanela("redes", "x") !== idDaJanela("reclame-aqui", "x"), true);

  const focada = focarJanela(janelas, janelas[0].id);
  conferir("focar traz para a frente", focada[0].z > focada[1].z, true);
}

{
  let janelas: Janela[] = [];
  for (let i = 0; i < MAXIMO_DE_JANELAS; i++) {
    janelas = abrirJanela(janelas, { frente: "nps", ref: `r${i}`, titulo: `r${i}` }, TELA).janelas;
  }
  const cheia = abrirJanela(janelas, { frente: "nps", ref: "a-mais", titulo: "a mais" }, TELA);
  conferir(`a ${MAXIMO_DE_JANELAS + 1}ª não abre e avisa`, cheia.tipo, "cheia");
  conferir("e nenhuma das abertas é fechada sozinha", cheia.janelas.length, MAXIMO_DE_JANELAS);
}

{
  const longe = limitarNaTela({ x: 5000, y: -300 }, TELA);
  conferir("arrastada para fora, volta com o cabeçalho à mão", [longe.x <= TELA.largura - 120, longe.y >= 8], [true, true]);

  const celular = abrirJanela([], { frente: "reclame-aqui", ref: "c", titulo: "c" }, { largura: 375, altura: 812 });
  const nova = celular.tipo === "aberta" ? celular.janelas[0] : null;
  conferir("no celular (375 px) a janela nasce inteira na tela", [nova!.x >= 8, nova!.x + Math.min(380, 375 - 16) <= 375 - 8 + 1], [true, true]);

  const notebook = limitarNaTela({ x: 1800, y: 1000 }, { largura: 1280, altura: 720 });
  conferir("posição de monitor grande cabe no notebook", [notebook.x <= 1160, notebook.y <= 672], [true, true]);
}

console.log("\n— Ficha completa e links (Fase 12) —\n");

{
  const [j] = abrirJanela([], { frente: "reclame-aqui", ref: "c1", titulo: "c1" }, TELA).janelas;
  const larga = alternarCompleta([{ ...j, x: 1300 }], j.id, TELA)[0];
  conferir("alternar para a ficha completa marca e traz a janela para dentro", [larga.completa, larga.x + 720 <= TELA.largura - 8], [true, true]);
  conferir("e alternar de novo volta ao essencial", alternarCompleta([larga], j.id, TELA)[0].completa, false);
  conferir("ficha completa volta do F5", lerJanelasGuardadas(JSON.stringify([{ ...larga }]), TELA)[0]?.completa, true);

  conferir("link de caso abre janela", janelaDoEndereco("/reclame-aqui/abc", "t"), { frente: "reclame-aqui", ref: "abc", titulo: "t" });
  conferir("link das Redes", janelaDoEndereco("/redes-sociais/x1", "t")?.frente, "redes");
  conferir("link de NPS (e não a análise)", [janelaDoEndereco("/nps/n1", "t")?.frente, janelaDoEndereco("/nps/analise", "t")], ["nps", null]);
  conferir("link do Google pela avaliação", janelaDoEndereco("/google?avaliacao=g9", "t")?.ref, "g9");
  conferir("link de tela não abre janela", [janelaDoEndereco("/reclame-aqui/analytics", "t"), janelaDoEndereco("/meu-dia", "t"), janelaDoEndereco("/reclame-aqui", "t")], [null, null, null]);

  const fontes: [string, RegExp][] = [
    /* A lista de cada atividade saiu da RotinaDoDia para ItensDaAtividade na 1.31. */
    ["components/rotina/ItensDaAtividade.tsx", /<JanelaDoLink href=\{item\.href\}/],
    ["app/agenda/page.tsx", /casoDoProtocolo\.get\(item\.relatedCase\)/],
    ["components/clientes/ClientDetail.tsx", /<BotaoAbrirEmJanela/],
    ["components/estabelecimentos/EstablishmentDetail.tsx", /<BotaoAbrirEmJanela/],
    ["components/janelas/JanelasHost.tsx", /<FichaCompletaNaJanela/],
  ];
  for (const [arquivo, marca] of fontes) conferir(`abre em janela: ${arquivo.split("/").slice(-2).join("/")}`, marca.test(ler(arquivo)), true);
}

{
  let js: Janela[] = [];
  for (const ref of ["a", "b", "c", "d"]) js = abrirJanela(js, { frente: "reclame-aqui", ref, titulo: ref }, TELA).janelas;
  js = js.map((j) => (j.ref === "d" ? { ...j, minimizada: true } : j));
  const lado = organizarJanelas(js, "lado-a-lado", TELA);
  conferir("lado a lado: as abertas não se sobrepõem na fileira", lado.filter((j) => !j.minimizada).map((j) => j.x), [8, 396, 784]);
  conferir("e a minimizada não muda de lugar", lado.find((j) => j.ref === "d")?.x, js.find((j) => j.ref === "d")?.x);
  const cascata = organizarJanelas(js, "cascata", TELA).filter((j) => !j.minimizada);
  conferir("em cascata, cada uma deslocada da anterior", cascata.map((j) => [j.x, j.y]), [[80, 64], [108, 92], [136, 120]]);
  conferir("rascunho: retrato novo a cada mudança (o Compiler não memoriza o Set)", /retrato = new Set\(comRascunho\)/.test(ler("lib/context/rascunhosDasJanelas.ts")), true);
  conferir("fechar com rascunho pede Descartar? antes", /if \(!temRascunho \|\| confirmarFechar\) return fechar/.test(ler("components/janelas/JanelasHost.tsx")), true);
  conferir("os três formulários avisam o rascunho", ["JanelaDoCaso", "JanelaDoNps", "JanelaDoGoogle"].every((n) => /useRascunhoNaJanela\(/.test(ler(`components/janelas/${n}.tsx`))), true);
}

console.log("\n— O que volta do F5 —\n");

{
  const guardado = JSON.stringify([
    { frente: "reclame-aqui", ref: "caso-9", titulo: "RA-9", x: 99999, y: 20, z: 3, minimizada: true },
    { frente: "inventada", ref: "x", titulo: "não existe" },
    { frente: "google", ref: "", titulo: "sem referência" },
  ]);

  const voltou = lerJanelasGuardadas(guardado, TELA);
  conferir("só voltam as de frente e referência válidas", voltou.map((j) => j.id), ["reclame-aqui:caso-9"]);
  conferir("minimizada continua minimizada", voltou[0]?.minimizada, true);
  conferir("e a posição é trazida para dentro da tela", voltou[0]?.x <= TELA.largura - 120, true);
  conferir("texto quebrado não derruba a tela", lerJanelasGuardadas("{não é json", TELA), []);
}

console.log("\n— A fiação —\n");

{
  const layout = ler("app/layout.tsx");
  conferir("o provider mora no layout raiz (sobrevive à navegação)", /<JanelasProvider>[\s\S]*\{children\}[\s\S]*<JanelasHost \/>[\s\S]*<\/JanelasProvider>/.test(layout), true);

  const contexto = ler("lib/context/JanelasContext.tsx");
  conferir("guarda na sessão só depois de restaurar (estado, não ref)", /const \[restaurado, setRestaurado\] = useState\(false\)/.test(contexto), true);

  const host = ler("components/janelas/JanelasHost.tsx");
  conferir("minimizada continua montada (o rascunho não se perde)", /janelas\.map\(\(j\) => \(/.test(host) && /minimizada \? "hidden" : "flex"/.test(host), true);
  conferir("sem fundo escurecido nem desfoque", /backdrop-blur|bg-zinc-900\/2|inset-0 bg-/.test(host), false);

  const entradas: [string, RegExp][] = [
    ["components/reclame-aqui/kanban/KanbanCard.tsx", /<BotaoAbrirEmJanela/],
    ["components/reclame-aqui/list/CaseRow.tsx", /frente="reclame-aqui"/],
    ["components/shared/MiniKanban.tsx", /<BotaoAbrirEmJanela/],
    ["app/redes-sociais/page.tsx", /frente="redes"/],
    ["components/nps/NpsList.tsx", /frente="nps"/],
    ["components/nps/NpsKanban.tsx", /frente="nps"/],
    ["app/google/page.tsx", /frente="google"/],
  ];

  for (const [arquivo, marca] of entradas) {
    conferir(`botão de abrir em ${arquivo.split("/").slice(-2).join("/")}`, marca.test(ler(arquivo)), true);
  }

  const caso = ler("components/janelas/JanelaDoCaso.tsx");
  conferir("a ficha do caso grava pelo updateCase (só o que mudou, sem pisar em ninguém)", /await updateCase\(/.test(caso), true);
  conferir("e só diz \"salvo\" depois da resposta", caso.indexOf("await updateCase(") < caso.indexOf("salvo."), true);

  const nps = ler("components/janelas/JanelaDoNps.tsx");
  conferir("a ficha do NPS avisa a recusa com a frase do servidor", /if \(!r\.ok\) \{\s*notify\(\{ tone: "error"/.test(nps), true);

  const google = ler("components/janelas/JanelaDoGoogle.tsx");
  conferir("a ficha do Google confere a resposta antes de gravar", /conferirResposta\(/.test(google) && /dadosSensiveis\(/.test(google), true);
}

console.log(
  falhas === 0
    ? "\n  As janelas abrem, empilham, voltam do F5 e gravam pelo caminho certo.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
