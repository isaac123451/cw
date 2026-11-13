/**
 * O pacote da extensão para baixar pela plataforma (13/11/2026).
 *
 *   node scripts/zip-da-extensao.js
 *
 * "preciso que você deixe disponível na plataforma a extensão". Roda no
 * build (inclusive na Vercel, que é Linux — por isso Node puro, sem o
 * PowerShell do `empacotar-extensao.js`) e grava em `public/extensao/`:
 *
 * - `cw-reputacao-extensao.zip`: a pasta `extensao/` inteira, dentro de uma
 *   pasta `cw-reputacao-extensao/` — descompactar dá a pasta pronta para o
 *   "Carregar sem compactação" do Chrome;
 * - `versao.json`: a versão do manifesto, para a página dizer qual baixa.
 *
 * O zip é escrito à mão (cabeçalhos locais, diretório central, deflate do
 * zlib e CRC-32): poucas linhas, nenhuma dependência nova.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const RAIZ = process.cwd();
const ORIGEM = path.join(RAIZ, "extensao");
const DESTINO = path.join(RAIZ, "public", "extensao");
const PASTA_NO_ZIP = "cw-reputacao-extensao";

const TABELA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function arquivos(pasta, base = "") {
  const saida = [];
  for (const nome of fs.readdirSync(pasta).sort()) {
    if (nome.startsWith(".") || nome === "node_modules") continue;
    const cheio = path.join(pasta, nome);
    const relativo = base ? `${base}/${nome}` : nome;
    if (fs.statSync(cheio).isDirectory()) saida.push(...arquivos(cheio, relativo));
    else saida.push({ cheio, relativo });
  }
  return saida;
}

/* Data e hora do DOS: fixas, para o mesmo conteúdo dar o mesmo zip. */
const HORA_DOS = 0;
const DATA_DOS = ((2026 - 1980) << 9) | (11 << 5) | 13;

const partes = [];
const central = [];
let posicao = 0;

for (const { cheio, relativo } of arquivos(ORIGEM)) {
  const dados = fs.readFileSync(cheio);
  const comprimido = zlib.deflateRawSync(dados, { level: 9 });
  const nome = Buffer.from(`${PASTA_NO_ZIP}/${relativo}`, "utf8");
  const crc = crc32(dados);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); /* nomes em UTF-8 */
  local.writeUInt16LE(8, 8); /* deflate */
  local.writeUInt16LE(HORA_DOS, 10);
  local.writeUInt16LE(DATA_DOS, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comprimido.length, 18);
  local.writeUInt32LE(dados.length, 22);
  local.writeUInt16LE(nome.length, 26);
  local.writeUInt16LE(0, 28);
  partes.push(local, nome, comprimido);

  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(0x0800, 8);
  c.writeUInt16LE(8, 10);
  c.writeUInt16LE(HORA_DOS, 12);
  c.writeUInt16LE(DATA_DOS, 14);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(comprimido.length, 20);
  c.writeUInt32LE(dados.length, 24);
  c.writeUInt16LE(nome.length, 28);
  c.writeUInt32LE(posicao, 42);
  central.push(c, nome);

  posicao += local.length + nome.length + comprimido.length;
}

const diretorio = Buffer.concat(central);
const fim = Buffer.alloc(22);
fim.writeUInt32LE(0x06054b50, 0);
fim.writeUInt16LE(central.length / 2, 8);
fim.writeUInt16LE(central.length / 2, 10);
fim.writeUInt32LE(diretorio.length, 12);
fim.writeUInt32LE(posicao, 16);

const zip = Buffer.concat([...partes, diretorio, fim]);
const versao = JSON.parse(fs.readFileSync(path.join(ORIGEM, "manifest.json"), "utf8")).version;

fs.mkdirSync(DESTINO, { recursive: true });
fs.writeFileSync(path.join(DESTINO, "cw-reputacao-extensao.zip"), zip);
fs.writeFileSync(path.join(DESTINO, "versao.json"), JSON.stringify({ versao, arquivos: central.length / 2, bytes: zip.length }));
console.log(`  extensão ${versao}: ${central.length / 2} arquivos, ${(zip.length / 1024).toFixed(0)} KB em public/extensao/`);
