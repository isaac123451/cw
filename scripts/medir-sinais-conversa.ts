/**
 * O aviso "a mensagem é a mesma da reclamação RA-x" acerta na base real?
 *
 *   npx tsx scripts/medir-sinais-conversa.ts
 *
 * Só leitura. Duas medidas:
 *
 * 1. **Colado inteiro:** cada relato recente, colado como mensagem do
 *    cliente, tem de achar a própria reclamação acima do limite de
 *    "igual" (IGUAL).
 * 2. **Colado em pedaço:** só a metade do relato — é o mais comum no
 *    WhatsApp — ainda deve achar a própria reclamação, ao menos como
 *    "parecida".
 * 3. **Falso alarme:** comentários reais do NPS (que não são relato de
 *    reclamação) não podem virar "a mesma reclamação".
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { criarIndice, type Exemplo } from "../lib/models/sugestaoPorTexto";
import { avisosDaConversa, IGUAL, PARECIDA } from "../lib/services/sinaisDaConversa";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const linhas = await prisma.case.findMany({
    where: { channel: "RECLAME_AQUI" },
    select: { id: true, protocol: true, title: true, description: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const relatos: Exemplo[] = linhas
    .filter((l) => (l.description ?? "").trim().length > 0)
    .map((l) => ({ id: l.id, referencia: l.protocol, texto: `${l.title}\n${l.description}`, rotulo: "" }));
  const indice = criarIndice(relatos);

  const amostra = relatos.filter((r) => r.texto.length >= 200).slice(0, 60);
  let inteiroCerto = 0;
  let metadeAchou = 0;
  for (const r of amostra) {
    const inteiro = avisosDaConversa([{ de: "cliente", texto: r.texto }], indice);
    if (inteiro.some((a) => a.texto.startsWith("A mensagem é a mesma") && a.texto.includes(r.referencia!))) inteiroCerto += 1;
    const metade = r.texto.slice(0, Math.floor(r.texto.length / 2));
    const parte = avisosDaConversa([{ de: "cliente", texto: metade }], indice);
    if (parte.some((a) => a.texto.includes(r.referencia!))) metadeAchou += 1;
  }

  const comentarios = await prisma.npsResponse.findMany({
    where: { NOT: { comment: "" } },
    select: { comment: true },
    take: 400,
  });
  const longos = comentarios.map((c) => c.comment ?? "").filter((c) => c.length >= 80);
  let falsoIgual = 0;
  let falsoParecido = 0;
  for (const c of longos) {
    const avisos = avisosDaConversa([{ de: "cliente", texto: c }], indice);
    if (avisos.some((a) => a.texto.startsWith("A mensagem é a mesma"))) falsoIgual += 1;
    if (avisos.some((a) => a.texto.startsWith("Parecida"))) falsoParecido += 1;
  }

  console.log(`\n  ${relatos.length} relatos do Reclame Aqui no índice (IGUAL ${IGUAL}, PARECIDA ${PARECIDA})\n`);
  console.log(`  relato colado inteiro acha a própria reclamação como "a mesma": ${inteiroCerto} de ${amostra.length}`);
  console.log(`  metade do relato ainda acha a própria reclamação:               ${metadeAchou} de ${amostra.length}`);
  console.log(`  comentários do NPS (≥ 80 caracteres) tomados por "a mesma":      ${falsoIgual} de ${longos.length}`);
  console.log(`  comentários do NPS tomados por "parecida":                       ${falsoParecido} de ${longos.length}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
