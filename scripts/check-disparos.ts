/**
 * Disparos em lote seguros — as regras, o painel e um ciclo no banco.
 *
 *   npm run check:disparos
 *
 * A parte pura roda sem banco. O ciclo cria uma lista descartável (com
 * referências que não apontam para caso nenhum, então nada muda nas
 * reclamações), anda com ela e a apaga no fim.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { itensValidos, POR_LOTE, telefoneDoDisparo } from "../lib/models/disparos";
import { getPrisma } from "../lib/prisma";
import { criarLote, loteDaVez, marcarItem, mudarLote } from "../lib/services/disparos.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

async function main() {
  console.log("\n  DISPAROS EM LOTE\n");

  /* ---- regras puras ---- */
  conferir("celular com DDD vira 55 + número", telefoneDoDisparo("(48) 99664-0777"), "5548996640777");
  conferir("com +55 fica igual", telefoneDoDisparo("+55 48 99664-0777"), "5548996640777");
  conferir("mascarado não dispara", telefoneDoDisparo("(48) 9••••-0777"), null);
  conferir("curto demais não dispara", telefoneDoDisparo("0777"), null);
  const validos = itensValidos([
    { nome: "Ana", telefone: "48996640777", mensagem: "Oi" },
    { nome: "Ana de novo", telefone: "+5548996640777", mensagem: "Oi" },
    { nome: "Sem mensagem", telefone: "48996640778", mensagem: " " },
  ]);
  conferir("um por telefone, só com mensagem", validos.map((v) => v.nome), ["Ana"]);

  /* ---- o painel da extensão, numa caixa sem página ---- */
  const codigo = readFileSync(resolve(__dirname, "../extensao/conteudo/disparos.js"), "utf8");
  const caixa: Record<string, unknown> = { window: {}, location: { hostname: "exemplo.test" }, chrome: undefined };
  (caixa.window as Record<string, unknown>).CWReputacao = { escapar: (v: unknown) => String(v ?? "").replace(/</g, "&lt;") };
  vm.createContext(caixa);
  vm.runInContext(codigo, caixa);
  const d = ((caixa.window as Record<string, unknown>).CWReputacao as { disparos: Record<string, (...a: unknown[]) => string | number> }).disparos;
  const lote = { nome: "Prêmio <b>x</b>", total: 12, enviados: 3, pulados: 1, porLote: 10, proximos: [{ id: "i1", nome: "Ana" }] };
  const esperando = d.htmlDoPainel({ fase: "esperando", itemId: "i1", noLote: 3 }, lote) as string;
  conferir("esperando: pede o Enter e diz para quem", esperando.includes("aperte Enter</b> para enviar a Ana"), true);
  conferir("o nome da lista vem escapado", esperando.includes("<b>x</b>"), false);
  conferir("progresso: feitos de total", esperando.includes("4 de 12"), true);
  conferir("intervalo: conta os segundos", (d.htmlDoPainel({ fase: "intervalo", ateEm: 41_000 }, lote, 0) as string).includes("<b>41 s</b>"), true);
  conferir("fim do lote: para e espera o clique", (d.htmlDoPainel({ fase: "pausa-lote" }, lote) as string).includes('data-acao="comecar"'), true);
  const s1 = d.sortearIntervalo([35, 50], 0) as number;
  const s2 = d.sortearIntervalo([35, 50], 0.999) as number;
  conferir("o intervalo fica entre 35 e 50 s", [s1, s2], [35, 50]);

  /* ---- a garantia: o script nunca envia sozinho ---- */
  conferir("nenhum clique no botão de enviar", /data-icon="send"|\bsend\b.*click|\.click\(\)/.test(codigo), false);
  conferir("nenhuma tecla simulada", /KeyboardEvent|dispatchEvent\(\s*new\s+Keyboard/.test(codigo), false);

  /* ---- um ciclo no banco, com uma lista descartável ---- */
  const prisma = getPrisma();
  if (!prisma) {
    console.log("\n  Sem banco: o ciclo não rodou.");
  } else {
    const eu = await prisma.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true, name: true } });
    const autor = { id: eu!.id, nome: eu!.name };
    const itens = Array.from({ length: 12 }, (_, i) => ({ nome: `Teste descartável ${i + 1}`, telefone: `4899000${String(1000 + i)}`, mensagem: `Oi ${i + 1}`, ref: "caso:TESTE-INEXISTENTE" }));
    const criado = await criarLote(prisma, { nome: "TESTE descartável do check", origem: "avaliacao", itens, autor });
    if ("erro" in criado) throw new Error(criado.erro);
    try {
      const vez = await loteDaVez(prisma, autor.id);
      conferir("a lista da vez é a recém-criada", vez?.id, criado.id);
      conferir(`o próximo lote traz ${POR_LOTE} de cada vez`, vez?.proximos.length, POR_LOTE);
      await marcarItem(prisma, vez!.proximos[0].id, "enviado", autor);
      await marcarItem(prisma, vez!.proximos[1].id, "enviado", autor);
      await marcarItem(prisma, vez!.proximos[2].id, "pulado", autor, "teste");
      const repetido = await marcarItem(prisma, vez!.proximos[0].id, "enviado", autor);
      conferir("marcar de novo não conta duas vezes", "repetido" in repetido && repetido.repetido, true);
      const depois = await loteDaVez(prisma, autor.id);
      conferir("contagem: 2 enviados, 1 pulado, 9 pendentes", [depois?.enviados, depois?.pulados, depois?.pendentes], [2, 1, 9]);
      const outra = await marcarItem(prisma, depois!.proximos[0].id, "enviado", { id: "outra-pessoa", nome: "x" });
      conferir("a lista de uma pessoa não anda por outra", "erro" in outra, true);
      await mudarLote(prisma, criado.id, "pausado", autor);
      conferir("pausada continua sendo a da vez", (await loteDaVez(prisma, autor.id))?.situacao, "pausado");
      await mudarLote(prisma, criado.id, "parado", autor);
      conferir("parada sai da vez", (await loteDaVez(prisma, autor.id))?.id === criado.id, false);
    } finally {
      await prisma.loteDeDisparo.delete({ where: { id: criado.id } });
    }
    conferir("a lista descartável foi apagada", await prisma.itemDeDisparo.count({ where: { loteId: criado.id } }), 0);
  }

  console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
