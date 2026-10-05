/**
 * As categorias oficiais, a unificação e as propostas da IA (1.132).
 *
 *   npm run check:categorias
 *
 * Primeiro as regras, com cadastro e reclamações montados à mão. Depois a
 * base real, só leitura: a prévia da unificação e o estado das propostas.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { calcularUnificacao, categoriaOficial, chaveDaSubcategoria, ehOficial, MAPA_DE_UNIFICACAO, NOMES_OFICIAIS, type CategoriaDoCadastro } from "../lib/models/taxonomia";
import { instrucaoDoSistema, mesmaClassificacao, validarPropostas, type Taxonomia } from "../lib/services/propostaDeCategoria.service";
import { preverUnificacao } from "../lib/services/taxonomia.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${String(JSON.stringify(obtido)).slice(0, 46)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${String(JSON.stringify(esperado)).slice(0, 46)}`);
}

console.log("\n  CATEGORIAS — a lista oficial e o mapa\n");

conferir("o nome do portal cai na oficial", categoriaOficial("Financeiro E Cobranças"), "Financeiro");
conferir("sem olhar maiúscula nem acento", categoriaOficial("qualidade do atendimento"), "Atendimento");
conferir("a oficial fica como está", categoriaOficial("implantação"), "Implantação");
conferir("categoria criada à mão não muda", categoriaOficial("Minha categoria"), "Minha categoria");
conferir("todo destino do mapa é oficial", Object.values(MAPA_DE_UNIFICACAO).every(ehOficial), true);
conferir("as 15 oficiais", NOMES_OFICIAIS.length, 15);
conferir("subcategoria gêmea por maiúscula", chaveDaSubcategoria("Demora No Atendimento") === chaveDaSubcategoria("Demora no atendimento"), true);
conferir("e pelo erro de digitação conhecido", chaveDaSubcategoria("Domora no suporte") === chaveDaSubcategoria("Demora no suporte"), true);

console.log("\n  UNIFICAÇÃO — calculada sem banco\n");
{
  const cadastro: CategoriaDoCadastro[] = [
    { id: "fin", nome: "Financeiro", ativa: true, casos: 2, subcategorias: [{ id: "s1", nome: "Cobrança indevida", ativa: true, casos: 2 }] },
    {
      id: "fec",
      nome: "Financeiro E Cobranças",
      ativa: true,
      casos: 3,
      subcategorias: [
        { id: "s2", nome: "Cobrança Indevida", ativa: true, casos: 2 },
        { id: "s3", nome: "Reembolso Negado", ativa: true, casos: 1 },
      ],
    },
    { id: "minha", nome: "Minha categoria", ativa: true, casos: 1, subcategorias: [] },
    { id: "velha", nome: "Cliente Final", ativa: false, casos: 0, subcategorias: [] },
  ];
  const casos = [
    { id: "c1", categoryId: "fin", subcategoryId: "s1" },
    { id: "c2", categoryId: "fec", subcategoryId: "s2" },
    { id: "c3", categoryId: "fec", subcategoryId: "s3" },
    { id: "c4", categoryId: "fec", subcategoryId: null },
    { id: "c5", categoryId: "minha", subcategoryId: null },
    { id: "c6", categoryId: null, subcategoryId: null },
  ];
  const u = calcularUnificacao(cadastro, casos);
  conferir("a categoria do portal vai para a oficial", u.movimentos.map((m) => [m.nome, m.para]), [["Financeiro E Cobranças", "Financeiro"], ["Cliente Final", "Outros"]]);
  conferir("a oficial que falta é criada (Outros)", u.criar, ["Outros"]);
  conferir("a de origem ativa fica desativada", u.desativarCategorias, ["fec"]);
  conferir("a gêmea que fica é a da oficial", u.trocas.find((t) => t.caseId === "c2")?.paraSubcategoriaId, "s1");
  conferir("a gêmea de fora fica desativada", u.desativarSubcategorias, ["s2"]);
  conferir("subcategoria sem gêmea muda junto para a oficial", u.moverSubcategorias, [{ id: "s3", paraCategoria: "Financeiro" }]);
  conferir("trocas: as 3 da categoria do portal, nem a oficial nem a criada à mão", u.trocas.map((t) => t.caseId).sort(), ["c2", "c3", "c4"]);
  conferir("caso sem subcategoria muda só a categoria", u.trocas.find((t) => t.caseId === "c4"), { caseId: "c4", deCategoriaId: "fec", deSubcategoriaId: null, paraCategoria: "Financeiro", paraSubcategoriaId: null });
}
{
  /* Duas gêmeas dentro da própria oficial: fica a com mais casos. */
  const u = calcularUnificacao(
    [{ id: "at", nome: "Atendimento", ativa: true, casos: 4, subcategorias: [{ id: "a", nome: "Demora No Atendimento", ativa: true, casos: 3 }, { id: "b", nome: "Demora no atendimento", ativa: true, casos: 1 }] }],
    [{ id: "x", categoryId: "at", subcategoryId: "b" }, { id: "y", categoryId: "at", subcategoryId: "a" }]
  );
  conferir("gêmeas na oficial: a com mais casos fica", [u.trocas.map((t) => [t.caseId, t.paraSubcategoriaId]), u.desativarSubcategorias], [[["x", "a"]], ["b"]]);
  conferir("unificar duas vezes não muda nada", calcularUnificacao([{ id: "at", nome: "Atendimento", ativa: true, casos: 4, subcategorias: [{ id: "a", nome: "Demora No Atendimento", ativa: true, casos: 4 }, { id: "b", nome: "Demora no atendimento", ativa: false, casos: 0 }] }], [{ id: "x", categoryId: "at", subcategoryId: "a" }]).trocas.length, 0);
}

console.log("\n  PROPOSTAS DA IA — o que a resposta do modelo pode e não pode\n");
{
  const t: Taxonomia = { subcategorias: new Map([["Financeiro", ["Cobrança indevida", "Reembolso negado"]], ["Cancelamento", ["Solicitação de cancelamento"]]]) };
  const casos = [
    { id: "1", protocolo: "RA-1", titulo: "", relato: "", categoria: "Atendimento", subcategoria: null },
    { id: "2", protocolo: "RA-2", titulo: "", relato: "", categoria: "Financeiro", subcategoria: "Cobrança indevida" },
    { id: "3", protocolo: "RA-3", titulo: "", relato: "", categoria: null, subcategoria: null },
  ];
  const v = validarPropostas(
    {
      itens: [
        { protocolo: "RA-1", categoria: "cancelamento", subcategoria: "SOLICITAÇÃO DE CANCELAMENTO", confianca: "alta", motivo: "quer cancelar" },
        { protocolo: "RA-2", categoria: "Financeiro", subcategoria: "Cobrança Indevida", confianca: "alta", motivo: "cobrança" },
        { protocolo: "RA-3", categoria: "Inventada", subcategoria: "", confianca: "alta", motivo: "x" },
        { protocolo: "RA-9", categoria: "Financeiro", subcategoria: "", confianca: "alta", motivo: "x" },
        { protocolo: "RA-1", categoria: "Sistema", subcategoria: "", confianca: "baixa", motivo: "repetida" },
        { protocolo: "RA-2", categoria: "Financeiro", subcategoria: "Não existe", confianca: "muita", motivo: "" },
      ],
    },
    casos,
    t
  );
  conferir("categoria e subcategoria na grafia oficial", v.find((p) => p.caseId === "1"), { caseId: "1", categoria: "Cancelamento", subcategoria: "Solicitação de cancelamento", confianca: "alta", motivo: "quer cancelar" });
  conferir("categoria fora da lista é descartada", v.some((p) => p.caseId === "3"), false);
  conferir("protocolo que não foi pedido é descartado", v.length, 2);
  conferir("a primeira resposta de cada caso vale", v.filter((p) => p.caseId === "1").length, 1);
  conferir("igual ao gravado, sem olhar grafia", mesmaClassificacao(v.find((p) => p.caseId === "2")!, casos[1]), true);
  const subInventada = validarPropostas({ itens: [{ protocolo: "RA-3", categoria: "Financeiro", subcategoria: "Não existe", confianca: "muita", motivo: "" }] }, casos, t)[0];
  conferir("subcategoria inventada vira nenhuma; confiança desconhecida vira baixa", [subInventada.subcategoria, subInventada.confianca, subInventada.motivo], [null, "baixa", "—"]);
  conferir("a instrução lista as 15 com as definições", NOMES_OFICIAIS.every((n) => instrucaoDoSistema(t).includes(`- ${n}:`)), true);
}

async function base() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return console.log("\n  Sem DATABASE_URL: a parte da base real ficou de fora.\n");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log("\n  A BASE REAL — só leitura\n");
    const p = await preverUnificacao(prisma);
    const comCasos = await prisma.category.findMany({ where: { cases: { some: {} } }, select: { name: true, active: true, _count: { select: { cases: true } } } });
    const foraDaLista = comCasos.filter((c) => !ehOficial(c.name));
    console.log(`        prévia: ${p.movimentos.filter((m) => m.casos > 0).length} categoria(s) com casos para unificar, ${p.trocas.length} troca(s), ${p.fusoes.length} grupo(s) de subcategorias gêmeas`);
    console.log(`        categorias com casos fora da lista: ${foraDaLista.map((c) => `${c.name} (${c._count.cases})`).join(", ") || "nenhuma"}`);
    const desconhecidas = foraDaLista.filter((c) => !categoriaOficial(c.name) || !ehOficial(categoriaOficial(c.name)!));
    conferir("toda categoria fora da lista tem destino no mapa", desconhecidas.map((c) => c.name), []);
    const grupos = await prisma.propostaDeCategoria.groupBy({ by: ["status"], _count: { _all: true } });
    console.log(`        propostas: ${grupos.map((g) => `${g.status} ${g._count._all}`).join(" · ") || "nenhuma ainda"}`);
    const ruins = await prisma.propostaDeCategoria.findMany({ where: { NOT: { categoria: { in: NOMES_OFICIAIS } } }, select: { id: true } });
    conferir("nenhuma proposta fora da lista oficial", ruins.length, 0);
  } finally {
    await prisma.$disconnect();
  }
}

base().then(() => {
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo confere.\n");
  process.exit(falhas ? 1 : 0);
});
