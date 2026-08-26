/**
 * O resumo da conversa entrega as três respostas para escolher?
 *
 *   npm run check:respostas            (sem chamar a IA)
 *   npm run check:respostas -- --ia    (chamando a IA de verdade)
 *
 * As três respostas nasceram no dossiê, e o Isaac corrigiu o lugar:
 * "as respostas não é necessariamente para o dossiê, mas sim para o
 * resumo e assim enviar ao cliente ao que faça sentido". A correção é
 * sobre o momento, não sobre o formato — o dossiê é para entender um
 * caso e quem o abre está estudando; o resumo é para responder, e quem
 * clicou em "Resumir" está com o cliente na linha.
 *
 * O que se testa aqui:
 *
 *  1. O contrato: o esquema exige três, o painel sabe desenhar três, e
 *     ainda sabe desenhar uma só — servidor antigo com extensão nova
 *     não pode ficar sem resposta nenhuma na tela.
 *  2. Com `--ia`, a resposta real: vieram três, com título e texto, e
 *     em quanto tempo. O tempo importa porque este é o botão que se
 *     aperta com o cliente esperando.
 */

import "dotenv/config";

import { readFileSync } from "node:fs";

import { SignJWT } from "jose";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const base = process.env.CW_BASE ?? "http://localhost:3000";
const comIa = process.argv.includes("--ia");

const segredo = process.env.AUTH_SECRET;

let falhas = 0;

function ok(titulo: string, detalhe: string) {
  console.log(`  ok     ${titulo}  ·  ${detalhe}`);
}

function falha(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`  FALHA  ${titulo}`);
  console.log(`         ${detalhe}`);
}

/* ------------------------------------------------- 1. o contrato --- */

console.log(
  "\n  RESPOSTAS PRONTAS — três para escolher, no resumo da conversa\n"
);

const rota = readFileSync(
  "app/api/extensao/conversa/route.ts",
  "utf8"
);

if (
  /respostas:\s*\{[\s\S]{0,400}?minItems:\s*3[\s\S]{0,400}?maxItems:\s*3/.test(
    rota
  )
) {
  ok(
    "o esquema exige exatamente três",
    "minItems e maxItems em 3 — o modelo não pode devolver uma nem quatro"
  );
} else {
  falha(
    "o esquema exige exatamente três",
    "sem minItems/maxItems em 3, o modelo devolve quantas quiser e a tela fica irregular"
  );
}

for (const campo of ["titulo", "quando", "texto"]) {
  if (
    new RegExp(
      `respostas:[\\s\\S]{0,600}?required:[\\s\\S]{0,120}?"${campo}"`
    ).test(rota)
  ) {
    ok(`"${campo}" é obrigatório`, "vem sempre preenchido");
  } else {
    falha(
      `"${campo}" é obrigatório`,
      "sem isso a tela desenha um cartão sem rótulo ou sem texto"
    );
  }
}

if (/"respostas",/.test(rota)) {
  ok(
    "respostas está no required do esquema",
    "o modelo não pode omitir o campo"
  );
} else {
  falha(
    "respostas está no required do esquema",
    "campo opcional volta ausente e a tela cai no rascunho único"
  );
}

const painel = readFileSync(
  "extensao/conteudo/painel.js",
  "utf8"
);

if (
  /Array\.isArray\(resumo\.respostas\)/.test(painel) &&
  /resumo\.respostas[\s\S]{0,600}?\.map\(/.test(painel)
) {
  ok(
    "o painel desenha a lista das três",
    "uma por bloco, com o texto pronto para copiar"
  );
} else {
  falha(
    "o painel desenha a lista das três",
    "o resumo continuaria mostrando só um rascunho"
  );
}

/**
 * O caminho de volta.
 *
 * Uma extensão nova instalada contra um servidor que ainda não subiu
 * recebe o formato antigo — um `resposta` e nenhum `respostas`. Sem
 * este ramo, a pessoa clica em "Resumir" e não vê rascunho nenhum, que
 * é pior do que ver um só.
 */
if (
  /resumo\.resposta \?\? ""/.test(painel) &&
  /Rascunho de resposta/.test(painel)
) {
  ok(
    "e ainda desenha o rascunho único",
    "servidor antigo com extensão nova não fica sem resposta na tela"
  );
} else {
  falha(
    "e ainda desenha o rascunho único",
    "sem o caminho de volta, extensão nova contra servidor antigo mostra vazio"
  );
}

/* ------------------------------------------------ 2. a IA de fato -- */

async function comModelo() {

  if (!segredo) {
    falha(
      "chamar a rota de verdade",
      "faltou AUTH_SECRET no .env"
    );
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DIRECT_URL || process.env.DATABASE_URL,
    }),
  });

  const admin = await prisma.user.findFirst({
    where: { active: true, role: "ADMIN" },
    select: { id: true, email: true },
  });

  await prisma.$disconnect();

  if (!admin) {
    falha(
      "chamar a rota de verdade",
      "nenhum ADMIN ativo na base para assinar a sessão"
    );
    return;
  }

  const token = await new SignJWT({ id: admin.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("600s")
    .sign(new TextEncoder().encode(segredo));

  const msg = (de: string, texto: string, hora: string) => ({
    de,
    texto,
    hora,
    parecemensagem: true,
  });

  const inicio = Date.now();

  const resposta = await fetch(
    `${base}/api/extensao/conversa`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mensagens: [
          msg(
            "cliente",
            "bom dia, meu cardápio online tá fora do ar desde ontem",
            "08:12"
          ),
          msg(
            "nos",
            "bom dia! vou verificar aqui, me confirma o nome do estabelecimento?",
            "08:20"
          ),
          msg("cliente", "Pizzaria do Beto, em Teresina", "08:21"),
          msg(
            "cliente",
            "já perdi umas 15 vendas, tô com o delivery parado",
            "08:22"
          ),
          msg("nos", "entendi, vou escalar pro time técnico", "09:05"),
          msg("cliente", "e aí? já faz 3 horas", "12:10"),
          msg("cliente", "se não resolver hoje vou cancelar", "12:11"),
        ],
        contato: {
          nome: "Beto Almeida",
          telefone: "86 99999-1234",
        },
      }),
    }
  );

  const ms = Date.now() - inicio;
  const dados = await resposta.json();

  if (resposta.status !== 200) {
    falha(
      "a rota respondeu",
      `${resposta.status} — ${dados.erro ?? "sem motivo"}`
    );
    return;
  }

  ok(
    "a rota respondeu",
    `200 em ${(ms / 1000).toFixed(1)} s pelo ${dados.provedor}`
  );

  const lista = dados.respostas ?? [];

  if (lista.length === 3) {
    ok(
      "vieram exatamente três",
      lista.map((r: { titulo: string }) => r.titulo).join(" · ")
    );
  } else {
    falha(
      "vieram exatamente três",
      `vieram ${lista.length}`
    );
  }

  const vazias = lista.filter(
    (r: { texto?: string }) => !(r.texto ?? "").trim()
  );

  if (vazias.length === 0 && lista.length > 0) {
    ok(
      "nenhuma veio sem texto",
      `a mais curta tem ${Math.min(...lista.map((r: { texto: string }) => r.texto.length))} caracteres`
    );
  } else if (lista.length > 0) {
    falha(
      "nenhuma veio sem texto",
      `${vazias.length} sem texto — a tela desenharia um bloco vazio`
    );
  }

  /*
    O tom é de WhatsApp, e não de e-mail.

    Uma resposta que abre com "Prezado(a)" e fecha com assinatura foi
    escrita para outro canal — colada no WhatsApp, soa como robô.
  */
  const formais = lista.filter((r: { texto: string }) =>
    /prezad|atenciosamente|cordialmente/i.test(r.texto)
  );

  if (formais.length === 0 && lista.length > 0) {
    ok(
      "o tom é de mensagem, não de carta",
      "nenhuma com 'Prezado' ou 'Atenciosamente'"
    );
  } else if (lista.length > 0) {
    falha(
      "o tom é de mensagem, não de carta",
      `${formais.length} com formalidade de e-mail`
    );
  }

  if (ms < 15_000) {
    ok(
      "chega a tempo de servir",
      `${(ms / 1000).toFixed(1)} s — quem clicou está com o cliente na linha`
    );
  } else {
    falha(
      "chega a tempo de servir",
      `${(ms / 1000).toFixed(1)} s é demais para um botão que se aperta durante o atendimento`
    );
  }

  console.log("\n  A primeira delas, inteira:\n");
  console.log(`    ${lista[0]?.titulo}`);
  console.log(`    quando: ${lista[0]?.quando}`);
  console.log("");
  (lista[0]?.texto ?? "")
    .split("\n")
    .forEach((l: string) => console.log(`    ${l}`));
}

async function main() {

  if (comIa) {
    console.log("");
    await comModelo();
  } else {
    console.log(
      "\n  Sem --ia: o modelo não foi chamado. Rode com --ia para conferir a resposta."
    );
  }

  console.log("");

  if (falhas === 0) {
    console.log(
      "  As três respostas estão onde se responde.\n"
    );
    process.exit(0);
  }

  console.log(`  ${falhas} problema(s).\n`);
  process.exit(1);
}

main();
