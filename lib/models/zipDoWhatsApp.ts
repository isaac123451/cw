/**
 * O texto da conversa de dentro do .zip que o WhatsApp exporta.
 *
 * "Exportar conversa → Anexar mídia" gera um .zip com o `_chat.txt` (ou
 * "Conversa do WhatsApp com Fulano.txt") e as fotos, áudios e vídeos.
 * Só o texto interessa — e ele é lido **no navegador**: mandar o .zip
 * inteiro para o servidor subiria as fotos da conversa sem necessidade.
 *
 * Leitor mínimo de ZIP: acha o diretório central pelo fim do arquivo,
 * procura a entrada .txt e descomprime com `DecompressionStream`
 * ("deflate-raw"), que o Chrome e o Node já têm. Sem biblioteca.
 */

const FIM_DO_DIRETORIO = 0x06054b50;
const ENTRADA_CENTRAL = 0x02014b50;
const CABECALHO_LOCAL = 0x04034b50;

interface Entrada {
  nome: string;
  metodo: number;
  tamanhoComprimido: number;
  inicioLocal: number;
}

function entradas(buf: Uint8Array): Entrada[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  /* O fim do diretório fica nos últimos 22 bytes + comentário (até 64 KB). */
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === FIM_DO_DIRETORIO) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("Este arquivo não é um .zip válido.");

  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const lista: Entrada[] = [];
  const utf8 = new TextDecoder("utf-8");
  const latin1 = new TextDecoder("latin1");

  for (let k = 0; k < total && p + 46 <= buf.length; k++) {
    if (dv.getUint32(p, true) !== ENTRADA_CENTRAL) break;
    const flags = dv.getUint16(p + 8, true);
    const metodo = dv.getUint16(p + 10, true);
    const tamanhoComprimido = dv.getUint32(p + 20, true);
    const n = dv.getUint16(p + 28, true);
    const extra = dv.getUint16(p + 30, true);
    const comentario = dv.getUint16(p + 32, true);
    const inicioLocal = dv.getUint32(p + 42, true);
    const bytesDoNome = buf.subarray(p + 46, p + 46 + n);
    /* Bit 11: nome em UTF-8. Sem ele, o WhatsApp antigo gravava em latin1. */
    const nome = (flags & 0x800 ? utf8 : latin1).decode(bytesDoNome);
    lista.push({ nome, metodo, tamanhoComprimido, inicioLocal });
    p += 46 + n + extra + comentario;
  }
  return lista;
}

async function inflar(bytes: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** O .txt da conversa de dentro do .zip, e o nome dele. */
export async function textoDoZip(arquivo: ArrayBuffer): Promise<{ nome: string; texto: string }> {
  const buf = new Uint8Array(arquivo);
  const txts = entradas(buf).filter((e) => /\.txt$/i.test(e.nome) && !e.nome.startsWith("__MACOSX"));
  if (txts.length === 0) throw new Error("O .zip não tem o texto da conversa (.txt). Exporte de novo pelo WhatsApp.");
  /* Com mais de um, o da conversa é o maior. */
  const alvo = txts.sort((a, b) => b.tamanhoComprimido - a.tamanhoComprimido)[0];

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(alvo.inicioLocal, true) !== CABECALHO_LOCAL) throw new Error("O .zip está corrompido.");
  const n = dv.getUint16(alvo.inicioLocal + 26, true);
  const extra = dv.getUint16(alvo.inicioLocal + 28, true);
  const inicio = alvo.inicioLocal + 30 + n + extra;
  const dados = buf.subarray(inicio, inicio + alvo.tamanhoComprimido);

  let bruto: Uint8Array;
  if (alvo.metodo === 0) bruto = dados;
  else if (alvo.metodo === 8) bruto = await inflar(dados);
  else throw new Error("Compressão do .zip não suportada. Exporte sem mídia (só o .txt).");

  return { nome: alvo.nome.split("/").pop() ?? alvo.nome, texto: new TextDecoder("utf-8").decode(bruto) };
}
