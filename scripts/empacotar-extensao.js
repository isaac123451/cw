/**
 * Empacota a extensão num .zip pronto para instalar.
 *
 *   npm run extensao:pacote
 *
 * A extensão instala descompactada (`Carregar sem compactação`), e para
 * quem tem o repositório isso basta — aponta para `extensao/` e pronto.
 * Este script existe para quem **não** tem o repositório: manda-se um
 * arquivo, a pessoa descompacta e aponta para a pasta.
 *
 * O nome carrega a versão do manifesto de propósito. Um zip chamado
 * `extensao.zip` na pasta de Downloads de alguém é indistinguível do zip
 * da semana passada, e o sintoma de instalar o antigo é a extensão "não
 * ter" a funcionalidade que acabou de ser anunciada.
 *
 * **Compacta pelo PowerShell, e não pelo `tar`.** O `tar` do Git for
 * Windows é o GNU tar, que não sabe escrever zip: com `-a -f algo.zip`
 * ele não reclama do formato desconhecido, escreve um tar e dá a ele o
 * nome `.zip`. O arquivo existe, tem tamanho plausível, e o Chrome o
 * recusa sem dizer por quê. `Compress-Archive` é nativo do Windows e
 * escreve zip de verdade.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = process.cwd();
const ORIGEM = path.join(RAIZ, "extensao");
const DESTINO = path.join(RAIZ, "dist");

const manifesto = JSON.parse(
  fs.readFileSync(
    path.join(ORIGEM, "manifest.json"),
    "utf8"
  )
);

const versao = manifesto.version;

const nome = `cw-reputacao-extensao-${versao}.zip`;
const caminho = path.join(DESTINO, nome);

fs.mkdirSync(DESTINO, { recursive: true });

if (fs.existsSync(caminho)) fs.rmSync(caminho);

/*
  O LEIA-ME vai junto de propósito.

  Ele tem o passo a passo de instalação e de configuração do endereço
  do servidor — que é exatamente o que falta a quem recebe só o zip.
*/
execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Compress-Archive -Path $env:CW_ORIGEM -DestinationPath $env:CW_DESTINO -CompressionLevel Optimal -Force",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CW_ORIGEM: ORIGEM,
      CW_DESTINO: caminho,
    },
  }
);

if (!fs.existsSync(caminho)) {
  console.log("\n  O PowerShell não gerou o arquivo.\n");
  process.exit(1);
}

const tamanho = fs.statSync(caminho).size;

/* ---- conferência: é zip mesmo, e tem o que precisa? ---- */

/**
 * Os dois primeiros bytes de um zip são `PK`.
 *
 * Conferir isto parece exagero até acontecer: foi assim que a primeira
 * versão deste script entregou um tar chamado `.zip` sem que nada
 * reclamasse.
 */
const cabecalho = Buffer.alloc(2);
const fd = fs.openSync(caminho, "r");
fs.readSync(fd, cabecalho, 0, 2, 0);
fs.closeSync(fd);

if (cabecalho.toString("latin1") !== "PK") {
  console.log(
    `\n  O arquivo gerado não é um zip (começa com ${JSON.stringify(cabecalho.toString("latin1"))}).\n`
  );
  process.exit(1);
}

/**
 * Os arquivos sem os quais a extensão não carrega.
 *
 * Um zip que abre mas não tem o `manifest.json` é aceito pelo sistema de
 * arquivos e recusado pelo Chrome com uma mensagem que não diz o que
 * faltou.
 */
const OBRIGATORIOS = [
  "extensao/manifest.json",
  "extensao/fundo/service-worker.js",
  "extensao/conteudo/nucleo.js",
  "extensao/conteudo/painel.js",
  "extensao/conteudo/whatsapp.js",
];

const dentro = execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
      "[IO.Compression.ZipFile]::OpenRead($env:CW_DESTINO).Entries " +
      "| ForEach-Object { $_.FullName }",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, CW_DESTINO: caminho },
  }
)
  .split("\n")
  .map((l) => l.trim().split("\\").join("/"))
  .filter(Boolean);

const faltando = OBRIGATORIOS.filter(
  (f) => !dentro.includes(f)
);

console.log("");

if (faltando.length > 0) {
  console.log("  O pacote saiu incompleto:\n");
  faltando.forEach((f) => console.log(`    falta  ${f}`));
  console.log("");
  process.exit(1);
}

console.log(`  Extensão ${versao} empacotada.\n`);
console.log(
  `    arquivo    ${path.relative(RAIZ, caminho).split("\\").join("/")}`
);
console.log(
  `    tamanho    ${(tamanho / 1024).toFixed(0)} kB`
);
console.log(`    itens      ${dentro.length}`);
console.log("");
console.log(
  "  Para instalar: descompacte, abra chrome://extensions, ligue o"
);
console.log(
  "  Modo do desenvolvedor e use \"Carregar sem compactação\""
);
console.log("  apontando para a pasta extensao.\n");
