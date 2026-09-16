/**
 * A bancada do painel da extensão.
 *
 * **O problema.** O painel é a maior peça da extensão e a única que
 * ninguém consegue abrir sem instalar a extensão num navegador, entrar
 * numa conversa do WhatsApp e ter um cliente reconhecido do outro lado.
 * Isso fez dele a parte menos exercitada do repositório — e foi o que
 * permitiu que o arquivo chegasse a 6.800 linhas sem nenhuma conferência
 * que o rodasse de verdade.
 *
 * **O que esta bancada faz.** Monta uma página que carrega os mesmos
 * arquivos do painel, na mesma ordem do manifesto, e responde às
 * mensagens que ele mandaria ao service worker com **respostas reais**
 * da aplicação — buscadas agora, com uma sessão assinada aqui, como o
 * `check:extensao` faz. Depois abre cada tela do painel e diz o que
 * apareceu, o que ficou vazio e o que estourou.
 *
 * **Nada de dado inventado.** As respostas vêm da base; por isso o
 * arquivo gerado sai em `.bancada/`, que o git ignora — ele tem nome e
 * telefone de consumidor.
 *
 *   npm run bancada:painel        (precisa do `npm run dev`)
 *   CW_BASE=http://localhost:3201 npm run bancada:painel
 *
 * Abre em http://localhost:3999 e fica servindo até Ctrl+C.
 */
import "dotenv/config";

import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const RAIZ = resolve(__dirname, "..");
const PORTA = Number(process.env.CW_BANCADA_PORTA) || 3999;

const base = (process.env.CW_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const segredo = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!url || !segredo) {
  console.error("\n  Faltou DATABASE_URL ou AUTH_SECRET no .env.\n");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

let sessao = "";

async function pegar(caminho: string, params: Record<string, string | undefined> = {}) {
  const alvo = new URL(base + caminho);
  for (const [chave, valor] of Object.entries(params)) {
    if (valor) alvo.searchParams.set(chave, valor);
  }
  const resposta = await fetch(alvo, {
    headers: { Accept: "application/json", "X-CW-Sessao": sessao },
    cache: "no-store",
  });
  const texto = await resposta.text();
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return { erro: `${resposta.status}: ${texto.slice(0, 160)}` };
  }
}

/**
 * Os arquivos do painel, na ordem do manifesto.
 *
 * Lidos do próprio manifesto e não de uma lista escrita aqui: quando o
 * painel virar módulos, a bancada carrega os módulos novos sem ninguém
 * lembrar de editá-la — foi o defeito que o `check:fiacao` teve.
 */
function arquivosDoPainel() {
  const manifesto = JSON.parse(
    readFileSync(resolve(RAIZ, "extensao/manifest.json"), "utf8")
  ) as { content_scripts: { matches: string[]; js: string[] }[] };

  const doWhatsApp = manifesto.content_scripts.find((c) =>
    c.matches.some((m) => m.includes("whatsapp"))
  );

  /* Os detectores de site leem DOM que não existe aqui; ficam de fora. */
  const foraDaBancada = ["whatsapp.js", "respostas.js"];

  return (doWhatsApp?.js ?? []).filter(
    (caminho) => !foraDaBancada.some((nome) => caminho.endsWith(nome))
  );
}

function montarPagina(capturas: Record<string, unknown>, arquivos: string[]) {
  const fontes = arquivos
    .map((caminho) => {
      const corpo = readFileSync(resolve(RAIZ, "extensao", caminho), "utf8");
      return `<!-- ${caminho} -->\n<script>\n${corpo}\n</script>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bancada do painel</title>
<style>
  body { margin: 0; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; background: #0f0f12; color: #e7e5ea; }
  #app { padding: 24px 28px; max-width: 900px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { color: #9a95a6; margin: 0 0 18px; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #2a2733; vertical-align: top; }
  th { color: #9a95a6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .ok { color: #4ade80; } .ruim { color: #f87171; } .num { font-variant-numeric: tabular-nums; }
  pre { white-space: pre-wrap; color: #f87171; font-size: 12px; }
</style></head>
<body>
<div id="app">
  <h1>Bancada do painel da extensão</h1>
  <p class="sub">Os arquivos do painel carregados na ordem do manifesto, respondendo com dados reais de <code>${base}</code>. O painel de verdade está na lateral — arraste, troque de aba, abra um caso.</p>
  <div id="relatorio">rodando…</div>
</div>

${fontes}

<script>
(() => {
  const CW = window.CWReputacao;
  const capturas = ${JSON.stringify(capturas)};
  const erros = [];

  window.addEventListener("error", (e) => erros.push(String(e.message)));
  window.addEventListener("unhandledrejection", (e) => erros.push("promessa: " + String(e.reason)));

  /* A fonte vem do pacote da extensão; aqui não há pacote. */
  CW.registrarFonte = () => {};

  /**
   * O service worker, de mentira — mas com respostas de verdade.
   *
   * Só a entrega é simulada: o corpo de cada resposta foi buscado da
   * aplicação segundos atrás. O que é escrita (mover, anotar, criar,
   * registrar) devolve um erro em português, porque a bancada não grava
   * na base de ninguém.
   */
  const SOMENTE_LEITURA = {
    erro: "A bancada não grava: esta é uma cópia do painel para conferência, sem escrita na base.",
  };

  CW.enviar = async (mensagem) => {
    const t = mensagem?.tipo;
    if (t === "config") return { ok: true, dados: capturas.config };
    if (t === "sessao") return { ok: true, dados: capturas.sessao };
    if (t === "contexto") return { ok: true, dados: capturas.contexto };
    if (t === "resumo") return { ok: true, dados: capturas.resumo };
    if (t === "fila") return { ok: true, dados: capturas.fila };
    if (t === "agenda") return { ok: true, dados: capturas.agenda };
    if (t === "pendencias") return { ok: true, dados: capturas.pendencias };
    if (t === "detalhe" || t === "caso") return { ok: true, dados: capturas.detalhe };
    if (t === "nps") return { ok: true, dados: capturas.nps };
    if (t === "abrir" || t === "opcoes") return { ok: true };
    return { ok: true, dados: SOMENTE_LEITURA };
  };

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const raiz = () => document.querySelector("#cw-reputacao-painel")?.shadowRoot?.querySelector(".raiz");
  const corpo = () => raiz()?.querySelector(".corpo");

  async function telaDe(canal) {
    const botao = raiz()?.querySelector(\`[data-acao="canal"][data-canal="\${canal}"]\`);
    if (!botao) return { canal, ok: false, nota: "a aba não existe no rodapé" };
    botao.click();
    await espera(700);
    const html = corpo()?.innerHTML ?? "";
    return {
      canal,
      ok: html.trim().length > 60,
      nota: html.trim().length > 60 ? \`\${html.length} caracteres desenhados\` : "corpo vazio",
    };
  }

  (async () => {
    const linhas = [];

    CW.painel.montar();
    linhas.push({ canal: "montagem", ok: Boolean(raiz()), nota: raiz() ? "gaveta e gatilho no shadow" : "não montou" });

    CW.painel.definirContexto({
      canalDaPagina: "WhatsApp",
      telefone: capturas.telefone,
      nome: capturas.nome,
      rotulo: capturas.nome || capturas.telefone,
    });

    CW.painel.abrir();
    await espera(900);

    const doContato = corpo()?.innerHTML ?? "";
    linhas.push({
      canal: "contato",
      ok: doContato.length > 60,
      nota: doContato.length > 60 ? \`\${doContato.length} caracteres desenhados\` : "corpo vazio",
    });

    for (const canal of ["reclame-aqui", "nps", "social", "painel", "atividades"]) {
      linhas.push(await telaDe(canal));
    }

    /* A tela do caso: o primeiro item da fila do Reclame Aqui. */
    const botaoCanal = raiz()?.querySelector('[data-acao="canal"][data-canal="reclame-aqui"]');
    botaoCanal?.click();
    await espera(700);
    const item = raiz()?.querySelector('[data-acao="abrir-caso"], [data-acao="ver-caso"], [data-protocolo]');
    if (item) {
      item.click();
      await espera(900);
      const html = corpo()?.innerHTML ?? "";
      linhas.push({ canal: "caso", ok: html.length > 200, nota: \`\${html.length} caracteres desenhados\` });
    } else {
      linhas.push({ canal: "caso", ok: false, nota: "não achei como abrir um caso na lista" });
    }

    const relatorio = document.querySelector("#relatorio");
    relatorio.innerHTML =
      "<table><thead><tr><th>Tela</th><th>Situação</th><th>O que apareceu</th></tr></thead><tbody>" +
      linhas
        .map(
          (l) =>
            \`<tr><td>\${l.canal}</td><td class="\${l.ok ? "ok" : "ruim"}">\${l.ok ? "desenhou" : "falhou"}</td><td class="num">\${l.nota}</td></tr>\`
        )
        .join("") +
      "</tbody></table>" +
      (erros.length
        ? "<h3>Erros no console</h3><pre>" + erros.join("\\n") + "</pre>"
        : "<p class=\\"ok\\">Nenhum erro no console.</p>");

    window.__bancada = { linhas, erros };
  })();
})();
</script>
</body></html>`;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { active: true, role: "ADMIN" },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!admin) throw new Error("Nenhum ADMIN ativo no banco — rode npm run db:seed.");

  sessao = await new SignJWT({ ...admin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("3600s")
    .sign(new TextEncoder().encode(segredo));

  console.log(`\n  Buscando as respostas em ${base}, como ${admin.name}.\n`);

  const capturas: Record<string, unknown> = {
    config: {
      base,
      autoAbrir: false,
      tema: "auto",
      largura: 380,
      empurrar: false,
      fixado: true,
      posicao: null,
      contador: true,
      aviso: false,
    },
  };

  capturas.sessao = await pegar("/api/extensao/sessao");
  capturas.resumo = await pegar("/api/extensao/resumo");
  capturas.agenda = await pegar("/api/extensao/agenda", { escopo: "hoje" });
  capturas.pendencias = await pegar("/api/extensao/pendencias");

  const fila = await pegar("/api/extensao/fila", { canal: "reclame-aqui", recorte: "abertos" });
  capturas.fila = fila;

  const primeiro = ((fila.itens as { protocolo?: string }[]) ?? [])[0];

  capturas.detalhe = primeiro?.protocolo
    ? await pegar("/api/extensao/detalhe", { protocolo: primeiro.protocolo })
    : {};

  const telefone = String((capturas.detalhe as { telefone?: string }).telefone ?? "");
  const nome = String((capturas.detalhe as { cliente?: string }).cliente ?? "");

  capturas.telefone = telefone;
  capturas.nome = nome;
  capturas.contexto = telefone ? await pegar("/api/extensao/contexto", { telefone }) : {};
  capturas.nps = {};

  const arquivos = arquivosDoPainel();

  const pagina = montarPagina(capturas, arquivos);

  const pasta = resolve(RAIZ, ".bancada");
  mkdirSync(pasta, { recursive: true });
  const destino = resolve(pasta, "painel.html");
  writeFileSync(destino, pagina);

  console.log(`  ${arquivos.length} arquivo(s) do painel: ${arquivos.join(", ")}`);
  console.log(`  ${(pagina.length / 1024).toFixed(0)} KB em ${destino}\n`);

  await prisma.$disconnect();

  createServer((pedido, resposta) => {
    if (pedido.url === "/sair") {
      resposta.end("tchau");
      process.exit(0);
    }
    resposta.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    resposta.end(pagina);
  }).listen(PORTA, () => {
    console.log(`  Abra http://localhost:${PORTA} — Ctrl+C para parar.\n`);
  });
}

main().catch(async (erro) => {
  console.error(erro);
  await prisma.$disconnect();
  process.exit(1);
});
