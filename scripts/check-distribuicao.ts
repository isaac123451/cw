/**
 * Confere a distribuição do time (1.106): a conta sobre casos montados à
 * mão e a prévia sobre a fila real — só leitura, nada é gravado.
 *
 *   npx tsx --env-file=.env scripts/check-distribuicao.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { cargaTotal, chaveDoCliente, estaAusente, planejarDistribuicao, type ItemDaFila, type PessoaDoTime } from "@/lib/models/distribuicao";
import { lerItensAbertos, lerPessoasDoTime } from "@/lib/services/distribuicao.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

const todas = { "reclame-aqui": true, redes: true, nps: true };
const pessoa = (id: string, nome: string, carga: Partial<PessoaDoTime["carga"]> = {}, extra: Partial<PessoaDoTime> = {}): PessoaDoTime => ({
  id,
  nome,
  ausenteAte: null,
  ausente: false,
  podeReceber: { ...todas },
  carga: { "reclame-aqui": 0, redes: 0, nps: 0, ...carga },
  semResposta: 0,
  ...extra,
});
const item = (id: string, frente: ItemDaFila["frente"], desde: string, cliente = "", donoId: string | null = "ana"): ItemDaFila => ({
  tipo: frente === "nps" ? "nps" : "caso",
  id,
  frente,
  rotulo: id,
  cliente,
  desde,
  donoId,
  href: "#",
});

/* A conta. */
ok("ausente até hoje ainda está fora", estaAusente("2026-09-30", "2026-09-30"));
ok("ausente até ontem já voltou", !estaAusente("2026-09-29", "2026-09-30"));
ok("sem data, presente", !estaAusente(null, "2026-09-30"));
ok("chave por e-mail, sem caixa", chaveDoCliente({ email: " Joao@X.com ", nome: "João" }) === "email:joao@x.com");
ok("chave por documento", chaveDoCliente({ documento: "123.456.789-01", nome: "João" }) === "doc:12345678901");
ok("chave por nome, sem acento", chaveDoCliente({ nome: "  João  Silva " }) === "nome:joao silva");

{
  const bia = pessoa("bia", "Bia", { "reclame-aqui": 5, nps: 0 });
  const caio = pessoa("caio", "Caio", { "reclame-aqui": 1, nps: 20 });
  const plano = planejarDistribuicao(
    [item("r1", "reclame-aqui", "2026-09-01"), item("r2", "reclame-aqui", "2026-09-02"), item("n1", "nps", "2026-09-03"), item("n2", "nps", "2026-09-04")],
    [bia, caio]
  );
  const para = Object.fromEntries(plano.atribuicoes.map((a) => [a.id, a.paraId]));
  ok("RA vai para quem tem menos RA (não menos no total)", para.r1 === "caio" && para.r2 === "caio", JSON.stringify(para));
  ok("NPS vai para quem tem menos NPS", para.n1 === "bia" && para.n2 === "bia");
  ok("a carga de origem não é mexida", bia.carga["reclame-aqui"] === 5);
}

{
  const bia = pessoa("bia", "Bia", { "reclame-aqui": 0 });
  const caio = pessoa("caio", "Caio", { "reclame-aqui": 9 });
  const plano = planejarDistribuicao([item("r1", "reclame-aqui", "2026-09-01", "email:x@y.com")], [bia, caio], [{ donoId: "caio", cliente: "email:x@y.com" }]);
  ok("mesmo cliente fica com quem já atende, mesmo com mais carga", plano.atribuicoes[0]?.paraId === "caio" && plano.atribuicoes[0]?.motivo === "mesmo-cliente");
}

{
  const bia = pessoa("bia", "Bia");
  const caio = pessoa("caio", "Caio");
  const fila = [item("a", "nps", "2026-09-01", "email:k@k.com"), item("b", "nps", "2026-09-02"), item("c", "nps", "2026-09-03", "email:k@k.com")];
  const plano = planejarDistribuicao(fila, [bia, caio]);
  const para = Object.fromEntries(plano.atribuicoes.map((a) => [a.id, a.paraId]));
  ok("dois itens do mesmo cliente na fila vão juntos", para.a === para.c, JSON.stringify(para));
  ok("o resto equilibra", para.b !== para.a);
}

{
  const leitor = pessoa("leo", "Leo", {}, { podeReceber: { "reclame-aqui": false, redes: false, nps: true } });
  const plano = planejarDistribuicao([item("r1", "reclame-aqui", "2026-09-01"), item("n1", "nps", "2026-09-01")], [leitor]);
  ok("sem acesso de agente na frente, o item fica onde está", plano.semDestino.map((i) => i.id).join() === "r1" && plano.atribuicoes.map((a) => a.id).join() === "n1");
}

{
  const muitos = Array.from({ length: 101 }, (_, i) => item(`n${i}`, "nps", `2026-09-${String((i % 28) + 1).padStart(2, "0")}`));
  const plano = planejarDistribuicao(muitos, [pessoa("a", "A", { nps: 10 }), pessoa("b", "B", { nps: 0 }), pessoa("c", "C", { nps: 3 })]);
  const recebe = Object.fromEntries(plano.porPessoa.map((p) => [p.id, p.recebe.nps]));
  const final = [10 + (recebe.a ?? 0), recebe.b ?? 0, 3 + (recebe.c ?? 0)];
  ok("no fim, a carga de NPS fica a um item de diferença", Math.max(...final) - Math.min(...final) <= 1, final.join("/"));
  ok("todos os itens foram atribuídos", plano.atribuicoes.length === 101);
}

/* A fila real. */
async function real() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const hoje = hojeNaOperacao();
    const itens = await lerItensAbertos(prisma);
    const pessoas = await lerPessoasDoTime(prisma, itens, hoje);
    const ativos = new Set(pessoas.map((p) => p.id));
    const semDono = itens.filter((i) => !i.donoId || !ativos.has(i.donoId));
    console.log(`\nbase real: ${itens.length} abertos, ${semDono.length} sem responsável ativo, ${pessoas.length} pessoas ativas`);
    for (const p of pessoas) console.log(`  ${p.nome}: RA ${p.carga["reclame-aqui"]} (sem resposta ${p.semResposta}) · Redes ${p.carga.redes} · NPS ${p.carga.nps}${p.ausente ? ` · fora até ${p.ausenteAte}` : ""}`);

    const somaDasCargas = pessoas.reduce((s, p) => s + cargaTotal(p.carga), 0);
    ok("carga das pessoas + sem responsável = todos os abertos", somaDasCargas + semDono.length === itens.length, `${somaDasCargas} + ${semDono.length} = ${itens.length}`);

    const destinos = pessoas.filter((p) => !p.ausente);
    const abertos = itens.filter((i) => i.donoId && ativos.has(i.donoId)).map((i) => ({ donoId: i.donoId, cliente: i.cliente }));
    const plano = planejarDistribuicao(semDono, destinos, abertos);
    ok("prévia real: todo item sem dono ganha destino ou fica explicado", plano.atribuicoes.length + plano.semDestino.length === semDono.length);
    for (const p of plano.porPessoa) console.log(`  prévia: ${p.nome} recebe RA ${p.recebe["reclame-aqui"]} · Redes ${p.recebe.redes} · NPS ${p.recebe.nps}`);
    const mesmo = plano.atribuicoes.filter((a) => a.motivo === "mesmo-cliente").length;
    console.log(`  ${mesmo} por já atender o mesmo cliente`);
  } finally {
    await prisma.$disconnect();
  }
}

real().then(() => {
  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
});
