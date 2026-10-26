/**
 * O telefone do NPS pelo portal da Cardápio Web (26/10/2026).
 *
 *   npm run check:telefones-portal
 *
 * A leitura da resposta do portal (o arquivo da extensão, sem navegador), o
 * telefone formatado, a ordem de quem buscar e a gravação — esta no banco de
 * verdade, com respostas descartáveis criadas e apagadas aqui.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { formatarTelefone, gravarDoPortalCw, pendentesDeTelefone, validarLido } from "../lib/services/telefoneDoPortal.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

console.log("\n  TELEFONE DO NPS PELO PORTAL DA CARDÁPIO WEB\n");

/* ---- a leitura, pelo arquivo da extensão ---- */
const janela: Record<string, unknown> = {};
runInNewContext(readFileSync("extensao/conteudo/portal-telefones.js", "utf8"), { window: janela });
const { lerResposta } = (janela.CWReputacao as { telefonesDoPortal: { lerResposta: (id: string, lista: unknown, dono: unknown) => Record<string, unknown> } }).telefonesDoPortal;

const lista = [{ id: 56090, name: "Outra", owner_id: 1 }, { id: 5609, name: "Açaí Real ", owner_id: 4388, owner_name: "Hevellyn" }];
const dono = { user_telephone: "62996588482", user_name: "Hevellyn Vieira da Silva Damas", user_email: "hevellyndamas@gmail.com" };
conferir("o estabelecimento é o do id exato, não o primeiro da busca", lerResposta("5609", lista, dono), { companyId: "5609", achou: true, telefone: "62996588482", dono: "Hevellyn Vieira da Silva Damas", emailDono: "hevellyndamas@gmail.com", loja: "Açaí Real" });
conferir("busca sem o id exato: não achou", lerResposta("123", lista, null), { companyId: "123", achou: false });

/* ---- o telefone ---- */
conferir(
  "telefone em qualquer formato vira 'DD 9XXXX-XXXX'",
  ["62996588482", "(14) 99602-9938", "+55 62 9 9658-8482", "1133334444", "123", ""].map(formatarTelefone),
  ["62 99658-8482", "14 99602-9938", "62 99658-8482", "11 3333-4444", null, null]
);
conferir("o que vem da página é conferido: id que não é número cai", [validarLido({ companyId: "abc" }), validarLido({ companyId: "12", achou: true, emailDono: "X@Y.COM" })?.emailDono], [null, "x@y.com"]);

/* ---- a ordem e a gravação, no banco ---- */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const IDS = ["999999901", "999999902", "999999903"];
const base = { customer: "teste-descartavel", respondedAt: new Date(), firstContactDueAt: new Date(), source: "Teste" };

(async () => {
  await prisma.npsResponse.deleteMany({ where: { externalCompanyId: { in: IDS } } });
  try {
    await prisma.npsResponse.createMany({
      data: [
        { ...base, score: 10, status: "[Encerrado] Sem tratativa", externalCompanyId: IDS[0], email: "a@teste.cw" },
        { ...base, score: 3, status: "Novo", externalCompanyId: IDS[1], email: "dono@teste.cw" },
        { ...base, score: 3, status: "Novo", externalCompanyId: IDS[1], email: "funcionario@teste.cw" },
        { ...base, score: 9, status: "Novo", externalCompanyId: IDS[2], email: "c@teste.cw", phone: "11 91111-1111" },
      ],
    });

    const ordem = (await pendentesDeTelefone(prisma, new Date(), 5000)).filter((c) => IDS.includes(c));
    conferir("detrator em aberto antes do encerrado; quem tem telefone fica de fora", ordem, [IDS[1], IDS[0]]);

    const r = await gravarDoPortalCw(prisma, [
      { companyId: IDS[1], achou: true, telefone: "(14) 99602-9938", dono: "Dona Teste", emailDono: "dono@teste.cw", loja: "Loja Teste" },
      { companyId: IDS[0], achou: false },
      { companyId: IDS[2], achou: true, telefone: "62996588482", dono: "Outro", emailDono: "x@teste.cw", loja: "Loja C" },
    ]);
    conferir("resultado: 3 conferidos, 2 com telefone, 2 NPS preenchidos", r, { conferidos: 3, comTelefone: 2, nps: 2 });

    const linhas = await prisma.npsResponse.findMany({ where: { externalCompanyId: { in: IDS } }, orderBy: { email: "asc" }, select: { email: true, phone: true, phoneOrigem: true, customerName: true, company: true, portalConferidoEm: true } });
    const de = (email: string) => linhas.find((l) => l.email === email)!;
    conferir("e-mail do dono: telefone, nome da pessoa e loja", [de("dono@teste.cw").phone, de("dono@teste.cw").phoneOrigem, de("dono@teste.cw").customerName, de("dono@teste.cw").company], ["14 99602-9938", "portal", "Dona Teste", "Loja Teste"]);
    conferir("outro e-mail na mesma loja: telefone do dono, sem pôr o nome do dono", [de("funcionario@teste.cw").phone, de("funcionario@teste.cw").phoneOrigem, de("funcionario@teste.cw").customerName], ["14 99602-9938", "portal-dono", null]);
    conferir("telefone digitado à mão não é trocado", de("c@teste.cw").phone, "11 91111-1111");
    conferir("não achado no portal: marcado como conferido, sem telefone", [de("a@teste.cw").phone, Boolean(de("a@teste.cw").portalConferidoEm)], [null, true]);
    conferir("conferido não volta para a fila na mesma semana", (await pendentesDeTelefone(prisma, new Date(), 5000)).filter((c) => IDS.includes(c)), []);
  } finally {
    await prisma.npsResponse.deleteMany({ where: { externalCompanyId: { in: IDS } } });
    conferir("as descartáveis saíram do banco", await prisma.npsResponse.count({ where: { externalCompanyId: { in: IDS } } }), 0);
    await prisma.$disconnect();
  }
  console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  O NPS ganha o telefone do dono pelo portal, sem trocar o que foi digitado.\n");
  process.exitCode = falhas ? 1 : 0;
})();
