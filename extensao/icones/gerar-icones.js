/**
 * Gera os PNGs do ícone da extensão.
 *
 *   node extensao/icones/gerar-icones.js
 *
 * O Chrome não aceita SVG em `icons` do manifesto, e o projeto não tem
 * nenhuma biblioteca de imagem instalada. Em vez de acrescentar uma
 * dependência para desenhar quatro quadrados, o PNG é montado à mão:
 * `zlib` já vem no Node, e o formato é cabeçalho, um bloco comprimido e
 * um fim de arquivo.
 *
 * O desenho é o mesmo de `components/shared/BrandMark.tsx` reduzido ao
 * que ainda se lê a 16 pixels: moldura roxa, rosto laranja, sorriso.
 * Roxo **e** laranja — a marca tem as duas cores.
 *
 * Desenha em 4x e reduz por média: é o antisserrilhado do pobre, e
 * resolve, porque as formas são só círculo e retângulo arredondado.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const TAMANHOS = [16, 32, 48, 128];

const AMOSTRA = 4;

const ROXO = [0x5b, 0x2a, 0x86];
const VIOLETA = [0x7b, 0x3f, 0xbf];
const LARANJA = [0xf9, 0xa1, 0x1b];
const BRANCO = [0xff, 0xff, 0xff];

function misturar(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Dentro do retângulo de cantos arredondados? */
function noRetangulo(x, y, n, raio) {
  const meio = n / 2;
  const lado = n / 2 - raio;

  const dx = Math.max(Math.abs(x - meio) - lado, 0);
  const dy = Math.max(Math.abs(y - meio) - lado, 0);

  return dx * dx + dy * dy <= raio * raio;
}

function desenhar(tamanho) {
  const n = tamanho * AMOSTRA;

  // RGBA em ponto flutuante, para a média não acumular erro.
  const grande = new Float64Array(n * n * 4);

  const raio = n * 0.23;

  const centroRosto = { x: n / 2, y: n * 0.44 };
  const raioRosto = n * 0.165;

  const centroSorriso = { x: n / 2, y: n * 0.5 };
  const raioSorriso = n * 0.3;
  const grossura = n * 0.075;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;

      if (!noRetangulo(x + 0.5, y + 0.5, n, raio)) {
        continue;
      }

      // Fundo: violeta em cima, roxo embaixo.
      let cor = misturar(VIOLETA, ROXO, y / n);
      let alfa = 255;

      const dxRosto = x + 0.5 - centroRosto.x;
      const dyRosto = y + 0.5 - centroRosto.y;
      const distRosto = Math.hypot(dxRosto, dyRosto);

      if (distRosto <= raioRosto) {
        cor = LARANJA;
      }

      const dxSorriso = x + 0.5 - centroSorriso.x;
      const dySorriso = y + 0.5 - centroSorriso.y;
      const distSorriso = Math.hypot(dxSorriso, dySorriso);

      const noAnel =
        Math.abs(distSorriso - raioSorriso) <= grossura / 2;

      // Só a metade de baixo do anel — é um sorriso, não um aro.
      if (noAnel && dySorriso > raioSorriso * 0.28) {
        cor = BRANCO;
      }

      grande[i] = cor[0];
      grande[i + 1] = cor[1];
      grande[i + 2] = cor[2];
      grande[i + 3] = alfa;
    }
  }

  // Redução por média do bloco AMOSTRA x AMOSTRA.
  const pixels = Buffer.alloc(tamanho * tamanho * 4);

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < AMOSTRA; sy++) {
        for (let sx = 0; sx < AMOSTRA; sx++) {
          const i =
            ((y * AMOSTRA + sy) * n + (x * AMOSTRA + sx)) * 4;

          const alfa = grande[i + 3];

          // Pré-multiplica: sem isso a borda puxa preto do vazio.
          r += grande[i] * alfa;
          g += grande[i + 1] * alfa;
          b += grande[i + 2] * alfa;
          a += alfa;
        }
      }

      const destino = (y * tamanho + x) * 4;

      pixels[destino] = a === 0 ? 0 : Math.round(r / a);
      pixels[destino + 1] = a === 0 ? 0 : Math.round(g / a);
      pixels[destino + 2] = a === 0 ? 0 : Math.round(b / a);
      pixels[destino + 3] = Math.round(
        a / (AMOSTRA * AMOSTRA)
      );
    }
  }

  return pixels;
}

/* ---------- PNG ---------- */

const TABELA_CRC = (() => {
  const tabela = new Int32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    tabela[n] = c;
  }

  return tabela;
})();

function crc32(buffer) {
  let c = 0xffffffff;

  for (const byte of buffer) {
    c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);

  const corpo = Buffer.concat([
    Buffer.from(tipo, "ascii"),
    dados,
  ]);

  const verificacao = Buffer.alloc(4);
  verificacao.writeUInt32BE(crc32(corpo), 0);

  return Buffer.concat([tamanho, corpo, verificacao]);
}

function png(tamanho, pixels) {
  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro padrão
  ihdr[12] = 0; // sem entrelaçamento

  // Cada linha começa com o byte de filtro — 0, "sem filtro".
  const linhas = Buffer.alloc(
    tamanho * (tamanho * 4 + 1)
  );

  for (let y = 0; y < tamanho; y++) {
    const inicio = y * (tamanho * 4 + 1);

    linhas[inicio] = 0;

    pixels.copy(
      linhas,
      inicio + 1,
      y * tamanho * 4,
      (y + 1) * tamanho * 4
    );
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(linhas, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

for (const tamanho of TAMANHOS) {
  const destino = path.join(
    __dirname,
    `icone-${tamanho}.png`
  );

  fs.writeFileSync(destino, png(tamanho, desenhar(tamanho)));

  console.log(`  ${path.basename(destino)}`);
}

console.log("\n  Ícones gerados.\n");
