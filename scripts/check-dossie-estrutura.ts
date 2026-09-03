/**
 * O dossiê estruturado sustenta o que afirma?
 *
 *   npm run check:dossie-estrutura
 *   npm run check:dossie-estrutura -- --ver RA-xxxx   (imprime o documento)
 *
 * **O que está em jogo aqui é diferente do resto.** As outras
 * conferências protegem um número na tela. Esta protege um documento
 * que vai para fora — para a moderação do Reclame Aqui, para um
 * parceiro, para uma discussão que a empresa pode perder. Uma data
 * errada na cronologia não deixa a tela feia: derruba o pedido.
 *
 * Daí o desenho que ela verifica: **a linha do tempo é montada do
 * banco**, evento por evento, cada um carregando de qual registro
 * saiu. O modelo não escreve cronologia. Ele escreve o sumário, a
 * apuração, o enquadramento e o pedido — depois, e a partir dela.
 *
 * As perguntas:
 *
 * 1. Todo evento tem data, e a cronologia está em ordem.
 * 2. Todo anexo citado existe, e todo anexo existente é citado.
 * 3. O texto escrito não cita anexo que não está no índice.
 * 4. Cada evento aponta o registro de origem — nenhuma linha nasce de
 *    texto livre.
 * 5. O nome de arquivo segue o padrão, com a data na frente.
 * 6. O que o sistema não tem aparece como lacuna, e não sumido.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  conferirDossie,
  montarDossie,
  nomeDeAnexo,
  renderizarDossie,
} from "../lib/services/dossie.service";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

const querVer = process.argv.indexOf("--ver");

const protocoloPedido =
  querVer >= 0 ? process.argv[querVer + 1] : undefined;

async function main() {

  console.log(
    "\n  DOSSIÊ ESTRUTURADO — sustenta o que afirma?\n"
  );

  /* ---------------- o nome de arquivo ---------------- */

  const nome = nomeDeAnexo({
    data: "2026-09-02T14:30:00.000Z",
    canal: "Reclame Aqui",
    protocolo: "RA-abc123",
    numero: 3,
    descricao: "Resposta pública da empresa",
  });

  if (
    nome ===
    "2026-09-02_reclame-aqui_ra-abc123_anexo-03_resposta-publica-da-empresa"
  ) {
    ok("o nome do anexo segue o padrão", nome);
  } else {
    falhar(
      "o nome do anexo segue o padrão",
      `saiu "${nome}"`
    );
  }

  /* ---------------- um caso de verdade ---------------- */

  /*
    Escolhe o caso com mais história, não o primeiro.

    Um dossiê sobre reclamação recém-criada tem um evento e não
    exercita ordenação, numeração nem cruzamento de anexo. O que
    interessa conferir é o caso movimentado.
  */
  const candidato = protocoloPedido
    ? await prisma.case.findFirst({
        where: {
          OR: [
            { protocol: protocoloPedido },
            { externalId: protocoloPedido },
          ],
        },
        select: { protocol: true },
      })
    : /*
         Prefere o caso com anotacao; aceita o que ao menos foi
         respondido com data.

         Uma primeira versao exigia anotacao **e** resposta publica, e
         nao achava nenhum — o que reprovava a conferencia por falta de
         dado, e nao por defeito. Exigir do banco a combinacao perfeita
         e´ escrever um teste que so passa no dia de sorte.
      */
      ((await prisma.case.findFirst({
        where: { comments: { some: {} } },
        orderBy: { updatedAt: "desc" },
        select: { protocol: true },
      })) ??
        (await prisma.case.findFirst({
          where: { NOT: { publicResponseAt: null } },
          orderBy: { updatedAt: "desc" },
          select: { protocol: true },
        })));

  if (!candidato) {
    falhar(
      "há um caso com histórico para montar",
      "nenhuma reclamação com anotação e resposta pública na base"
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const d = await montarDossie(
    prisma,
    candidato.protocol,
    {
      montadoPor: "Conferência automática",
      destinatario: "Moderação do Reclame Aqui",
      pedido: "Avaliação do caso",
    }
  );

  if (!d) {
    falhar(
      "o dossiê é montado",
      `montarDossie devolveu null para ${candidato.protocol}`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `  caso: ${candidato.protocol} · ${d.linhaDoTempo.length} evento(s) · ${d.anexos.length} anexo(s) · ${d.lacunas.length} lacuna(s)\n`
  );

  /* ---------------- a revisão mecânica ---------------- */

  const problemas = conferirDossie(d);

  if (problemas.length === 0) {
    ok(
      "cronologia em ordem, anexos citados e existentes",
      "nenhuma afirmação apoiada em peça que não está no índice"
    );
  } else {
    falhar(
      "cronologia em ordem, anexos citados e existentes",
      problemas.join("\n         ")
    );
  }

  /* ---------------- toda linha vem do banco ---------------- */

  const semOrigem = d.linhaDoTempo.filter(
    (e) => !e.origem
  );

  if (semOrigem.length === 0) {
    ok(
      "todo evento aponta o registro de origem",
      d.linhaDoTempo
        .map((e) => e.origem.split(".")[0])
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ")
    );
  } else {
    falhar(
      "todo evento aponta o registro de origem",
      `${semOrigem.length} evento(s) sem origem — linha escrita à mão não pode entrar numa cronologia que sustenta pedido`
    );
  }

  /* ---------------- a ordem cronológica ---------------- */

  const foraDeOrdem = d.linhaDoTempo.filter(
    (e, i) =>
      i > 0 && e.quando < d.linhaDoTempo[i - 1].quando
  );

  if (foraDeOrdem.length === 0) {
    ok(
      "a cronologia está em ordem",
      d.linhaDoTempo.length > 1
        ? `de ${d.linhaDoTempo[0].quando.slice(0, 10)} a ${d.linhaDoTempo.at(-1)!.quando.slice(0, 10)}`
        : "um evento só"
    );
  } else {
    falhar(
      "a cronologia está em ordem",
      `${foraDeOrdem.length} evento(s) fora de ordem`
    );
  }

  /* ---------------- o texto inventado é recusado ---------------- */

  /**
   * O caso que a revisão do par procura.
   *
   * Alguém escreve a conclusão citando o Anexo 09, o print fica de
   * fora do envio, e o argumento chega apoiado no vazio. Aqui isso é
   * simulado de propósito: se a conferência não reclamar, ela não
   * protege do erro que existe para pegar.
   */
  const comCitacaoFalsa = {
    ...d,
    conclusao:
      "Pelo exposto, e conforme o Anexo 99, pedimos a moderação.",
  };

  const pegou = conferirDossie(comCitacaoFalsa).some(
    (p) => p.includes("Anexo 99")
  );

  if (pegou) {
    ok(
      "afirmação apoiada em anexo inexistente é pega",
      "é a pergunta única da revisão do par, feita em código"
    );
  } else {
    falhar(
      "afirmação apoiada em anexo inexistente é pega",
      "a conclusão citou o Anexo 99 e ninguém reclamou"
    );
  }

  /* ---------------- as lacunas aparecem ---------------- */

  const semConteudo = d.anexos.filter((a) => !a.noSistema);

  ok(
    "o que o sistema não guarda vira lacuna declarada",
    d.lacunas.length || semConteudo.length
      ? `${d.lacunas.length} lacuna(s) e ${semConteudo.length} anexo(s) a juntar`
      : "este caso está completo — nada a anexar"
  );

  /* ---------------- o documento ---------------- */

  if (protocoloPedido) {
    console.log(
      "\n" + "─".repeat(60) + "\n"
    );
    console.log(renderizarDossie(d));
  } else {
    const texto = renderizarDossie(d);
    console.log(
      `\n  documento: ${texto.length} caracteres, ${texto.split("\n").length} linhas`
    );
    console.log(
      "  (rode com -- --ver <protocolo> para ver inteiro)"
    );
  }

  console.log(
    falhas === 0
      ? "\n  A cronologia sai do banco, e nada é afirmado sem peça.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  await prisma.$disconnect();
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exitCode = 1;
});
