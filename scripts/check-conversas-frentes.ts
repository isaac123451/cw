/**
 * As conversas divididas pelo WhatsApp de cada frente (26/10/2026).
 *
 *   npm run check:conversas-frentes
 *
 * A frente de cada conversa, e no banco de verdade (com conversas
 * descartáveis criadas e apagadas aqui): o mesmo cliente nos dois WhatsApps
 * são duas conversas, e a antiga, sem número, ganha o número.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { frenteDaConversa } from "../lib/models/conversa";
import { candidatas, gravarMensagens } from "../lib/services/conversas.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)}`);
}

const RA = "5548900000001";
const NPS = "5548900000002";
const numeros = { reclameAqui: RA, npsRedes: NPS };

console.log("\n  CONVERSAS POR FRENTE\n");
conferir(
  "o vínculo decide: NPS, caso do RA, caso de Redes",
  [
    frenteDaConversa({ nps: { id: "1", cliente: "x", nota: 3 }, numeroNosso: RA }, numeros),
    frenteDaConversa({ caso: { id: "1", protocolo: "RA-1", frente: "Reclame Aqui" } }, numeros),
    frenteDaConversa({ caso: { id: "1", protocolo: "IG-1", frente: "Redes Sociais" }, numeroNosso: NPS }, numeros),
  ],
  ["nps", "reclame-aqui", "redes"]
);
conferir(
  "sem vínculo: do número do RA é RA; do NPS/Redes ou sem número, sem vínculo",
  [frenteDaConversa({ numeroNosso: RA }, numeros), frenteDaConversa({ numeroNosso: NPS }, numeros), frenteDaConversa({}, numeros)],
  ["reclame-aqui", "sem-vinculo", "sem-vinculo"]
);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const CLIENTE = "5511988887777";
const msg = (texto: string) => [{ de: "cliente" as const, texto, em: new Date().toISOString(), chave: `teste-${texto}` }];

(async () => {
  const limpar = () => prisma.conversa.deleteMany({ where: { telefone: { endsWith: "88887777" }, guardadaPor: "teste-frentes" } });
  await limpar();
  try {
    const antiga = await gravarMensagens(prisma, { destino: "nova", telefone: CLIENTE, contatoNome: "Cliente Teste", origem: "extensao", mensagens: msg("antiga"), autor: "teste-frentes" });
    const doRa = (await candidatas(prisma, CLIENTE, "", RA))[0]?.id ?? "nova";
    conferir("a conversa antiga, sem número, é achada pelo WhatsApp do RA", doRa, antiga.id);
    await gravarMensagens(prisma, { destino: doRa, telefone: CLIENTE, contatoNome: "Cliente Teste", numeroNosso: RA, origem: "extensao", mensagens: msg("ra"), autor: "teste-frentes" });
    conferir("e ganha o número do RA", (await prisma.conversa.findUnique({ where: { id: antiga.id }, select: { numeroNosso: true } }))?.numeroNosso, RA);

    const doNps = (await candidatas(prisma, CLIENTE, "", NPS))[0]?.id ?? "nova";
    conferir("o mesmo cliente no WhatsApp do NPS não cai na conversa do RA", doNps, "nova");
    const nova = await gravarMensagens(prisma, { destino: doNps, telefone: CLIENTE, contatoNome: "Cliente Teste", numeroNosso: NPS, origem: "extensao", mensagens: msg("nps"), autor: "teste-frentes" });
    conferir("vira outra conversa, com o número do NPS", [nova.id !== antiga.id, (await prisma.conversa.findUnique({ where: { id: nova.id }, select: { numeroNosso: true } }))?.numeroNosso], [true, NPS]);
    conferir("e a próxima gravação do NPS volta para ela", (await candidatas(prisma, CLIENTE, "", NPS))[0]?.id, nova.id);
  } finally {
    await limpar();
    conferir("as descartáveis saíram do banco", await prisma.conversa.count({ where: { guardadaPor: "teste-frentes" } }), 0);
    await prisma.$disconnect();
  }
  console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  Cada WhatsApp tem a sua conversa, e a tela separa as frentes.\n");
  process.exitCode = falhas ? 1 : 0;
})();
