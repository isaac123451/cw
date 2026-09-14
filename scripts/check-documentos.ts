/**
 * Prova a leitura dos documentos do time.
 *
 *   npm run check:documentos
 *
 * Os nove documentos viraram markdown a partir do PDF, e é fácil uma
 * linha sumir no caminho: uma tabela com célula a menos, um `**` sem
 * par que aparece como asterisco na tela, uma seção cujo endereço muda
 * e quebra o "por quê?" que aponta para ela. Esta varredura lê os nove
 * com o mesmo código da tela e confere, linha por linha, que tudo o que
 * estava no texto chegou a algum bloco. Sem banco.
 */
import {
  DOCUMENTOS_DO_TIME,
  ORIGEM_DOS_DOCUMENTOS,
} from "../lib/documentos/documentosDoTime";
import { ORIGEM_DOS_DOCUMENTOS_DO_TIME, SLUGS_DOS_DOCUMENTOS_DO_TIME } from "../lib/documentos/indice";
import {
  PORQUE_DO_PASSO_NPS,
  PORQUE_DO_PASSO_RA,
  PORQUE_DO_PASSO_REDES,
  PORQUES,
  porqueDoContato,
  porqueDoTipoNps,
} from "../lib/documentos/porques";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { ATALHOS_DO_DOCUMENTO } from "../lib/documentos/atalhosDoDocumento";
import { lerEstadoGravado, progressoDoGuia, ROTEIRO } from "../lib/models/primeiroAcesso";
import { enderecoValido, normalizarEndereco } from "../lib/models/atalho";
import { blocosDoMarkdown, dobrar, marcarTermo, textoPuro, trechosDaLinha, type Bloco } from "../lib/models/markdown";
import { markdownDosPassos, secoesDoDocumento } from "../lib/models/playbook";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

console.log("\n— As duas listas dos documentos —");
confere("os endereços da tela são os da importação, na mesma ordem", [...SLUGS_DOS_DOCUMENTOS_DO_TIME], DOCUMENTOS_DO_TIME.map((d) => d.slug));
confere("a marca de origem é a mesma", ORIGEM_DOS_DOCUMENTOS_DO_TIME, ORIGEM_DOS_DOCUMENTOS);

/** As linhas de texto que um bloco carrega, para somar contra o original. */
function linhasDo(b: Bloco): string[] {
  switch (b.tipo) {
    case "titulo":
      return [b.texto];
    case "paragrafo":
    case "citacao":
      return b.linhas;
    case "lista":
      return b.itens;
    case "tabela":
      return [b.cabecalho.join("|"), ...b.linhas.map((l) => l.join("|"))];
    case "separador":
      return ["---"];
  }
}

console.log("\n— Cada documento, lido como a tela lê —");
for (const d of DOCUMENTOS_DO_TIME) {
  const blocos = blocosDoMarkdown(d.conteudo);
  const secoes = secoesDoDocumento(d.conteudo);
  const ancorasDosBlocos = blocos.flatMap((b) => (b.tipo === "titulo" && b.ancora ? [b.ancora] : []));

  confere(`${d.slug}: o índice e os títulos têm os mesmos endereços`, ancorasDosBlocos, secoes.map((s) => s.ancora));
  confere(`${d.slug}: nenhum endereço repetido`, new Set(ancorasDosBlocos).size, ancorasDosBlocos.length);

  /* Toda linha com texto vira parte de algum bloco (a divisória da tabela é a única que some). */
  const originais = d.conteudo.split("\n").filter((l) => l.trim() && !/^\s*\|?\s*:?-{3,}/.test(l)).length;
  const lidas = blocos.reduce((n, b) => n + (b.tipo === "tabela" ? 1 + b.linhas.length : b.tipo === "paragrafo" || b.tipo === "citacao" ? b.linhas.length : b.tipo === "lista" ? b.itens.length : 1), 0);
  confere(`${d.slug}: as ${originais} linhas chegaram a algum bloco`, lidas, originais);

  /* Tabela com célula a menos no original é defeito da conversão do PDF. */
  const tortas = d.conteudo
    .split("\n\n")
    .filter((trecho) => /^\s*\|/.test(trecho))
    .flatMap((t) => {
      const linhas = t.split("\n").filter((l) => /^\s*\|/.test(l));
      const colunas = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).length;
      return linhas.filter((l) => colunas(l) !== colunas(linhas[0])).map((l) => l.slice(0, 60));
    });
  confere(`${d.slug}: toda linha de tabela tem as colunas do cabeçalho`, tortas, []);

  /* Um `**` sem par aparece como asterisco na tela. */
  const sobras = blocos.flatMap(linhasDo).filter((l) => textoPuro(l).includes("**")).map((l) => l.slice(0, 60));
  confere(`${d.slug}: nenhum negrito sem par`, sobras, []);
}

console.log("\n— Dentro da linha —");
confere("negrito", trechosDaLinha("um **dois** três"), [
  { tipo: "texto", texto: "um " },
  { tipo: "negrito", filhos: [{ tipo: "texto", texto: "dois" }] },
  { tipo: "texto", texto: " três" },
]);
confere("asterisco escapado é asterisco", textoPuro("nota \\* obrigatória"), "nota * obrigatória");
confere("itálico dentro de negrito", textoPuro("**muito *importante***"), "muito importante");
confere("colchete de modelo não vira link", textoPuro("[Saudação]! O cliente [nome]"), "[Saudação]! O cliente [nome]");
confere("link http vira link", trechosDaLinha("[ajuda](https://ajuda.cardapioweb.com)")[0].tipo, "link");
confere("javascript: não vira link", trechosDaLinha("[x](javascript:alert(1))").some((t) => t.tipo === "link"), false);
confere("HTML fica texto", textoPuro("<script>alert(1)</script>"), "<script>alert(1)</script>");

console.log("\n— Blocos —");
const tabela = blocosDoMarkdown("| A | B |\n| --- | --- |\n| 1 |\n| 2 | 3 | 4 |");
confere("linha curta ganha célula vazia e a comprida perde o excesso", tabela[0].tipo === "tabela" ? tabela[0].linhas : null, [["1", ""], ["2", "3"]]);
confere(
  "lista numerada guarda o número de início",
  blocosDoMarkdown("3. três\n4. quatro")[0],
  { tipo: "lista", ordenada: true, inicio: 3, itens: ["três", "quatro"] }
);
confere(
  "linha que continua o item de cima",
  blocosDoMarkdown("- começa aqui\n  e termina aqui\n- outro")[0],
  { tipo: "lista", ordenada: false, inicio: 1, itens: ["começa aqui e termina aqui", "outro"] }
);
confere(
  "citação guarda as linhas (é modelo de mensagem)",
  blocosDoMarkdown("> @setor\n> [Saudação]!")[0],
  { tipo: "citacao", linhas: ["@setor", "[Saudação]!"] }
);
confere(
  "título repetido ganha endereço próprio",
  blocosDoMarkdown("## Exceções\n\ntexto\n\n## Exceções").map((b) => (b.tipo === "titulo" ? b.ancora : null)),
  ["excecoes", null, "excecoes-2"]
);

console.log("\n— A busca —");
confere(
  "acha sem acento e sem caixa",
  marcarTermo("Falta de Retorno às 18h", "retorno as").filter((p) => p.achou).map((p) => p.texto),
  ["Retorno às"]
);
confere("com emoji antes, o índice não desanda", marcarTermo("🧭 O que é reputação?", "reputacao").filter((p) => p.achou).map((p) => p.texto), ["reputação"]);

console.log("\n— O playbook em etapas vira texto —");
const convertido = markdownDosPassos({
  steps: [
    { title: "1. Receber", owner: "Reputação", sla: "2h úteis", detail: "Ler a reclamação.", checklist: ["Classificar"] },
    { title: "Responder", owner: "", detail: "" },
  ],
  rules: ["Nunca prometer prazo sem a área"],
});
confere(
  "cada etapa é uma seção, e as regras fecham o texto",
  secoesDoDocumento(convertido).map((s) => s.titulo),
  ["Etapas", "1. Receber", "2. Responder", "Regras da operação"]
);
confere("responsável e prazo em uma linha", convertido.includes("**Responsável:** Reputação · **Prazo:** 2h úteis"), true);

console.log("\n— O \"por quê?\" aponta para um trecho que existe —");
const secoesPorDoc = new Map(DOCUMENTOS_DO_TIME.map((d) => [d.slug, new Set(secoesDoDocumento(d.conteudo).map((s) => s.ancora))]));
const quebrados = Object.entries(PORQUES)
  .filter(([, p]) => !secoesPorDoc.get(p.doc)?.has(p.ancora))
  .map(([chave, p]) => `${chave} → ${p.doc}#${p.ancora}`);
confere(`as ${Object.keys(PORQUES).length} regras têm a seção no documento`, quebrados, []);
confere(
  "cada tipo do NPS abre o trecho do próprio tipo",
  ["Reclamação", "Sugestão", "Elogio", "Engano", "Erro no Sistema", "Erro Processual", "Falta de Retorno"].map(porqueDoTipoNps),
  ["nps.reclamacao", "nps.sugestao", "nps.elogio", "nps.engano", "nps.erro-no-sistema", "nps.erro-processual", "nps.falta-de-retorno"]
);
confere("tipo que o documento não tem cai no geral", porqueDoTipoNps("Outro"), "nps.tipos");
confere("a tentativa do Reclame Aqui é a persistência do passo 4", porqueDoContato("tentativa", "ra"), "ra.persistencia");
confere("a tentativa nas redes é a ausência de contato", porqueDoContato("tentativa", "redes"), "redes.sem-contato");
confere(
  "todo passo das trilhas tem um trecho",
  [PORQUE_DO_PASSO_RA, PORQUE_DO_PASSO_NPS, PORQUE_DO_PASSO_REDES].flatMap((m) => Object.values(m)).filter((c) => !(c in PORQUES)),
  []
);

console.log("\n— Ferramentas e Acessos —");
confere("as chaves dos atalhos não se repetem", new Set(ATALHOS_DO_DOCUMENTO.map((a) => a.chave)).size, ATALHOS_DO_DOCUMENTO.length);
confere(
  "todo endereço do documento é aceito",
  ATALHOS_DO_DOCUMENTO.filter((a) => !enderecoValido(a.url)).map((a) => a.chave),
  []
);
const ferramentasDoTexto = DOCUMENTOS_DO_TIME.find((d) => d.slug === "cintcw-ferramentas-e-acessos")!.conteudo;
const tabelaDeFerramentas = blocosDoMarkdown(ferramentasDoTexto).find((b) => b.tipo === "tabela");
const nomes = tabelaDeFerramentas && tabelaDeFerramentas.tipo === "tabela" ? tabelaDeFerramentas.linhas.map((l) => l[0]) : [];
const semAtalho = nomes
  .filter((n) => !/planilhas internas/i.test(n))
  .flatMap((n) => n.split(" / "))
  .filter((n) => !ATALHOS_DO_DOCUMENTO.some((a) => dobrar(a.nome).includes(dobrar(n.replace(/\s*\(.*\)$/, "")))));
confere("cada ferramenta da tabela do documento tem o seu atalho", semAtalho, []);
confere(
  "endereço perigoso não passa",
  ["javascript:alert(1)", "data:text/html,oi", "//site.com", "ftp://x.com"].map(enderecoValido),
  [false, false, false, false]
);
confere("caminho da plataforma passa", enderecoValido("/relatorio"), true);
confere("sem esquema ganha https", normalizarEndereco("www.hugme.com.br/login"), "https://www.hugme.com.br/login");

console.log("\n— Primeiro acesso —");
const semTela = ROTEIRO.flatMap((p) => [p.link, p.link2?.href].filter(Boolean) as string[])
  .map((href) => href.split(/[?#]/)[0])
  .filter((rota) => !existsSync(resolve(__dirname, "..", "app", `.${rota}`, "page.tsx")));
confere("todo passo leva a uma tela que existe", semTela, []);
confere("só o último passo se marca sozinho", ROTEIRO.filter((p) => p.automatico).map((p) => p.id), ["primeiro-caso"]);
confere(
  "o gravado estranho não quebra: passo desconhecido e o automático são ignorados",
  lerEstadoGravado({ passos: { reputacao: "2026-09-14T12:00:00Z", inventado: "x", "primeiro-caso": "x", rotina: 3 }, dispensadoEm: 5 }),
  { passos: { reputacao: "2026-09-14T12:00:00Z" }, dispensadoEm: undefined }
);
confere("JSON nulo vira roteiro vazio", lerEstadoGravado(null), { passos: {}, dispensadoEm: undefined });
const todosMarcados = Object.fromEntries(ROTEIRO.filter((p) => !p.automatico).map((p) => [p.id, "2026-09-14T12:00:00Z"]));
confere(
  "tudo marcado sem o primeiro caso ainda não termina",
  progressoDoGuia({ passos: todosMarcados, primeiroCaso: null }).proximo?.id,
  "primeiro-caso"
);
confere(
  "com o primeiro contato registrado, termina",
  progressoDoGuia({ passos: todosMarcados, primeiroCaso: { quando: "2026-09-14T13:00:00Z", onde: "NPS", link: "/nps/x" } }).concluido,
  true
);

console.log(falhas ? `\n${falhas} conferência(s) falharam.\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
