/**
 * O dossiê em texto único — o texto corrido, os fatos e a situação.
 *
 *   npm run check:dossie-texto
 *
 * Sem banco. Um dossiê montado à mão, no formato de `montarDossie`.
 */
import { fatoValido, situacaoDoCaso, textoCorridoDoDossie } from "../lib/models/dossieTexto";
import type { DossieMontado } from "../lib/services/dossie.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${String(JSON.stringify(obtido)).slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${String(JSON.stringify(esperado)).slice(0, 44)}`);
}

console.log("\n  DOSSIÊ EM TEXTO ÚNICO\n");

const d = {
  identificacao: { titulo: "Impressora não imprime", protocolo: "RA-1", canal: "Reclame Aqui", abertoEm: "2026-08-30T21:00:00Z", montadoPor: "x", montadoEm: "", destinatario: "", pedido: "Pedido — o que se quer" },
  partes: { consumidor: "Luiz", contato: [], estabelecimento: "Pizzaria do Luiz", setoresAcionados: ["Suporte N2"] },
  linhaDoTempo: [
    { numero: 1, quando: "2026-08-30T21:00:00Z", evento: "Reclamação registrada pelo consumidor", canal: "Reclame Aqui", evidencia: "Anexo 01" },
    { numero: 2, quando: "2026-09-17T15:39:00Z", evento: "Tentativa de contato por WhatsApp — não atendeu", canal: "WhatsApp", evidencia: "" },
    { numero: 3, quando: "2026-09-22T18:15:00Z", evento: "Tentativa de contato por WhatsApp — sem resposta", canal: "WhatsApp", evidencia: "" },
  ],
  anexos: [],
  versao: { numero: 1, geradoEm: "", base: "" },
  lacunas: [],
} as unknown as DossieMontado;

const texto = textoCorridoDoDossie(d, {
  fatos: [
    { id: "a", quando: "2026-09-20", texto: "O cliente mandou vídeo da impressora travando", em: "" },
    { id: "b", texto: "a loja usa a impressora Elgin i9", em: "" },
  ],
  imagens: [{ nome: "print.jpg", legenda: "Tela do erro" }],
  situacao: situacaoDoCaso({ status: "Aguardando retorno", respondida: false }),
});
const paragrafos = texto.split("\n\n");

conferir("sem títulos de seção: parágrafos corridos", paragrafos.every((p) => !/^\d\.|^#/.test(p)), true);
conferir("abre com quem, o estabelecimento e o título", paragrafos[0].startsWith("Luiz, cliente do estabelecimento Pizzaria do Luiz, registrou a reclamação RA-1"), true);
conferir("o fato datado entra na ordem da linha do tempo", paragrafos[1].indexOf("20/09/2026") > paragrafos[1].indexOf("17/09/2026") && paragrafos[1].indexOf("20/09/2026") < paragrafos[1].indexOf("22/09/2026"), true);
conferir("o evento vira frase minúscula depois da data", paragrafos[1].includes("Em 17/09/2026, tentativa de contato por WhatsApp"), true);
conferir("o fato sem data vai para o fim", paragrafos[2], "Também se sabe que a loja usa a impressora Elgin i9.");
conferir("a situação atual", paragrafos[3], 'Hoje o caso está em "Aguardando retorno"; ainda sem resposta pública.');
conferir("o pedido de modelo não entra", texto.includes("O que se pede"), false);
conferir("as imagens, numeradas pela legenda", paragrafos[paragrafos.length - 1], "Imagens anexadas: 1) Tela do erro.");
conferir("fato vazio não é fato", fatoValido({ texto: "  " }), null);
conferir("data inválida vira sem data", fatoValido({ quando: "20/09", texto: "algo aconteceu" }), { quando: undefined, texto: "algo aconteceu" });
conferir(
  "avaliado e respondido na situação",
  situacaoDoCaso({ status: "Resolvido", respondida: true, publicResponseAt: "2026-09-10T12:00:00Z", evaluated: true, score: 9, resolved: true, wouldDoBusiness: true }),
  'Hoje o caso está em "Resolvido"; a resposta pública foi publicada em 10/09/2026; o consumidor avaliou com nota 9, resolvido, e voltaria a fazer negócio.'
);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
