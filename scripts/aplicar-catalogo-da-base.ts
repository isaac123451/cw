/**
 * Causas e categorias novas tiradas da base atual (Fase 32, 1.74).
 *
 *   npx tsx scripts/aplicar-catalogo-da-base.ts          # mostra o que faria
 *   npx tsx scripts/aplicar-catalogo-da-base.ts --gravar # grava
 *
 * **Só acrescenta.** Nada é apagado nem renomeado: a causa que já existe
 * com o mesmo nome ganha área, prazo e palavras; a nova entra no fim da
 * lista. Rodar de novo não duplica.
 *
 * Causas: as famílias de `FAMILIAS_DE_CAUSA` com ao menos
 * `MINIMO_PARA_PROPOR` registros reais (Reclame Aqui, NPS e Google) — a
 * mesma conta da tela Causas raiz, onde ninguém tinha aprovado nenhuma.
 *
 * Categorias: as duas famílias grandes sem categoria própria. Impressão
 * (38 registros) e WhatsApp (45) caíam em "Atendimento", "Sistema" ou
 * "Limitação" — e a categoria é o que o cliente reclamou. As
 * subcategorias saem dos títulos reais: "não imprime", "impressão no
 * horário de pico", "conexão da impressora"; "WhatsApp bloqueado",
 * "WhatsApp banido", "bot ineficaz", "disparo de mensagens".
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { FAMILIAS_DE_CAUSA, MINIMO_PARA_PROPOR, propostaDoCatalogo, type TextoDaBase } from "../lib/models/catalogoDeCausas";

const CATEGORIAS_NOVAS: { nome: string; descricao: string; subcategorias: string[] }[] = [
  {
    nome: "Impressão de pedidos",
    descricao: "A impressora não imprime, imprime tarde ou perde a conexão — no pico, é a loja parada.",
    subcategorias: ["Não imprime pedidos", "Falha no horário de pico", "Conexão da impressora", "Impressão de pedidos do iFood"],
  },
  {
    nome: "WhatsApp e robô",
    descricao: "O robô de atendimento, o número da loja e os disparos de mensagem pelo WhatsApp.",
    subcategorias: ["Robô não responde ou responde errado", "Número bloqueado ou banido", "Disparo de mensagens", "Conexão do WhatsApp"],
  },
];

async function main() {
  const gravar = process.argv.includes("--gravar");
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const [casos, nps, google, causas] = await Promise.all([
    prisma.case.findMany({ select: { protocol: true, title: true, description: true } }),
    prisma.npsResponse.findMany({ where: { comment: { not: "" } }, select: { comment: true, score: true } }),
    prisma.avaliacaoGoogle.findMany({ where: { texto: { not: null } }, select: { texto: true } }),
    prisma.npsRootCause.findMany({ select: { id: true, name: true, order: true } }),
  ]);

  const registros: TextoDaBase[] = [
    ...casos.map((c) => ({ frente: "reclame-aqui" as const, texto: `${c.title}\n${c.description ?? ""}`, ref: c.protocol })),
    ...nps.map((n) => ({ frente: "nps" as const, texto: n.comment, ref: `NPS ${n.score}` })),
    ...google.map((g) => ({ frente: "google" as const, texto: g.texto ?? "", ref: "Google" })),
  ];

  const proposta = propostaDoCatalogo(registros, causas.map((c) => c.name));
  const aprovadas = proposta.linhas.filter((l) => l.total >= MINIMO_PARA_PROPOR);

  const porNome = new Map(causas.map((c) => [c.name.trim().toLowerCase(), c]));
  let ordem = Math.max(-1, ...causas.map((c) => c.order)) + 1;

  console.log(`\n  CAUSAS (${aprovadas.length} famílias com ${MINIMO_PARA_PROPOR}+ registros)\n`);
  for (const l of aprovadas) {
    const f = FAMILIAS_DE_CAUSA.find((x) => x.id === l.familia.id)!;
    const achada = porNome.get(f.nome.toLowerCase());
    console.log(`  ${achada ? "atualiza" : "cria    "}  ${f.nome.padEnd(40)} ${f.area.padEnd(16)} ${f.prazoHoras} h · ${l.total} registros`);
    if (!gravar) continue;
    const dados = { description: f.descricao.slice(0, 500), area: f.area, prazoHoras: f.prazoHoras, palavras: f.palavras.slice(0, 20) };
    if (achada) await prisma.npsRootCause.update({ where: { id: achada.id }, data: { ...dados, active: true }, select: { id: true } });
    else await prisma.npsRootCause.create({ data: { name: f.nome, order: ordem++, ...dados }, select: { id: true } });
  }

  const cats = await prisma.category.findMany({ select: { id: true, name: true, order: true } });
  let ordemCat = Math.max(0, ...cats.map((c) => c.order)) + 1;

  console.log(`\n  CATEGORIAS\n`);
  for (const nova of CATEGORIAS_NOVAS) {
    let cat = cats.find((c) => c.name.toLowerCase() === nova.nome.toLowerCase());
    console.log(`  ${cat ? "já existe" : "cria     "}  ${nova.nome} · ${nova.subcategorias.join(", ")}`);
    if (!gravar) continue;
    if (!cat) cat = await prisma.category.create({ data: { name: nova.nome, description: nova.descricao, order: ordemCat++, active: true }, select: { id: true, name: true, order: true } });
    const subs = await prisma.subcategory.findMany({ where: { categoryId: cat.id }, select: { name: true } });
    let ordemSub = subs.length;
    for (const s of nova.subcategorias) {
      if (subs.some((x) => x.name.toLowerCase() === s.toLowerCase())) continue;
      await prisma.subcategory.create({ data: { name: s, description: "", order: ordemSub++, active: true, categoryId: cat.id }, select: { id: true } });
    }
  }

  console.log(gravar ? "\n  Gravado.\n" : "\n  Só mostrando. Rode com --gravar para gravar.\n");
  process.exit(0);
}

main();
