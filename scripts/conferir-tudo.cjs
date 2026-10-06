/**
 * Todas as conferências que só leem, de uma vez.
 *
 *   npm run conferir
 *
 * Roda cada `check:*` do package.json, seis por vez, e pula as que gravam
 * no banco ou assinam sessão contra o servidor — o `.env` local aponta
 * para o banco de produção, e essas pedem decisão de quem roda. No fim,
 * diz quantas passaram, quais falharam (com as linhas de falha) e quais
 * foram puladas.
 *
 * Existe porque são mais de 150 conferências e nenhuma forma de rodar
 * todas: depois de uma mudança grande, a regressão aparecia dias depois
 * numa conferência que ninguém lembrou de rodar (out/2026).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));

/** Gravação no banco, sessão assinada ou chamada ao servidor: fica para quem decide rodar. */
const GRAVA = /\bprisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|AUTH_SECRET|CW_BASE/;

/** Medem tempo: em paralelo com as outras o tempo infla e elas falham sem motivo. Rodam sozinhas, no fim. */
const SOZINHAS = new Set(["check:desempenho"]);

const lista = [];
const sozinhas = [];
const pulados = [];

for (const [nome, comando] of Object.entries(pkg.scripts)) {
  if (!nome.startsWith("check:")) continue;
  const arquivo = comando.match(/scripts\/[\w.-]+\.(ts|js|cjs|mjs)/);
  if (!arquivo) {
    pulados.push(nome);
    continue;
  }
  const fonte = fs.readFileSync(path.join(RAIZ, arquivo[0]), "utf8");
  if (GRAVA.test(fonte)) pulados.push(nome);
  else if (SOZINHAS.has(nome)) sozinhas.push(nome);
  else lista.push(nome);
}

const PARALELO = 6;
const LIMITE_MS = 240_000;
const total = lista.length + sozinhas.length;
const falhas = [];
const inicio = Date.now();
let proxima = 0;
let rodando = 0;
let terminou = false;

function executar(nome, depois) {
  const filho = spawn(`npm run -s ${nome}`, { cwd: RAIZ, shell: true });
  let saida = "";
  filho.stdout.on("data", (d) => (saida += d));
  filho.stderr.on("data", (d) => (saida += d));
  const relogio = setTimeout(() => filho.kill(), LIMITE_MS);
  filho.on("close", (codigo) => {
    clearTimeout(relogio);
    if (codigo !== 0) {
      const linhas = saida.split("\n").filter((l) => /FALHA|rror|falh/i.test(l)).slice(0, 4);
      falhas.push({ nome, codigo, linhas });
    }
    depois();
  });
}

function rodar() {
  if (proxima >= lista.length) {
    if (rodando === 0) rodarSozinhas();
    return;
  }
  const nome = lista[proxima++];
  rodando++;
  executar(nome, () => {
    rodando--;
    rodar();
  });
}

function rodarSozinhas() {
  if (terminou) return;
  const nome = sozinhas.shift();
  if (!nome) {
    terminou = true;
    terminar();
    return;
  }
  executar(nome, rodarSozinhas);
}

function terminar() {
  const segundos = Math.round((Date.now() - inicio) / 1000);
  console.log(`\n  ${total - falhas.length} de ${total} conferências passaram em ${segundos} s.`);
  for (const f of falhas) {
    console.log(`\n  FALHA ${f.nome} (saída ${f.codigo})`);
    for (const l of f.linhas) console.log(`    ${l.trim().slice(0, 160)}`);
  }
  console.log(`\n  Puladas (gravam no banco ou falam com o servidor): ${pulados.join(", ")}\n`);
  process.exitCode = falhas.length ? 1 : 0;
}

for (let i = 0; i < PARALELO; i++) rodar();
