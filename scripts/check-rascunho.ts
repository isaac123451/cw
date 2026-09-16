/**
 * Prova a conferência do rascunho contra as regras do documento.
 *
 * **O que está em jogo.** O rascunho existe para ser copiado e colado.
 * Se ele sair com o CPF que estava no relato, o CPF vai para o ar; se
 * sair igual ao que já foi publicado em outro caso, a "Regra de Ouro"
 * do documento (sem macros prontas) é quebrada em público. Pedir isso
 * ao modelo na instrução melhora a média e não garante nada — a
 * garantia é esta conferência, que roda no servidor depois de o texto
 * pronto, e é a mesma que confere o texto digitado à mão.
 *
 * Os textos abaixo são inventados de propósito: nenhum cliente real
 * entra num arquivo que vive no git.
 *
 *   npm run check:rascunho
 */

import {
  conferirRascunho,
  REGRAS_DO_RASCUNHO,
  resumoDoRascunho,
  type ProblemaDoRascunho,
} from "../lib/models/rascunho";

let falhas = 0;

function conferir(titulo: string, passou: boolean, detalhe = "") {
  if (!passou) falhas += 1;
  console.log(`  ${passou ? "ok   " : "FALHA"} ${titulo.padEnd(56)} ${detalhe}`);
}

function tipos(achados: { tipo: ProblemaDoRascunho }[]) {
  return achados.map((a) => a.tipo).sort().join(", ") || "(nenhum)";
}

console.log("\n  RASCUNHO — ele segue o documento?\n");

/* ============================================================
   O RASCUNHO BOM
============================================================ */

const BOM = `Marina, sinto muito pelo transtorno com a integração do iFood — entendo
o quanto isso atrapalha o movimento do almoço. Já acionei o time responsável
para olhar o seu caso especificamente e volto a falar com você assim que
tiver a apuração.`;

{
  const achados = conferirRascunho(BOM, { nome: "Marina Ferreira", publico: true });
  conferir("o rascunho que segue as regras passa limpo", achados.length === 0, tipos(achados));
  conferir(
    "e o resumo diz isso",
    resumoDoRascunho(achados) === "Segue as regras do documento.",
    resumoDoRascunho(achados)
  );
}

/* ============================================================
   CADA REGRA, SOZINHA
============================================================ */

console.log("\n— Cada regra, uma de cada vez —");

{
  /* Sem o nome: o documento pede começar por ele. */
  const semNome = BOM.replace("Marina, sinto", "Prezado cliente, sinto");
  const achados = conferirRascunho(semNome, { nome: "Marina Ferreira", publico: true });

  conferir(
    "não chamar pelo nome é apontado",
    achados.some((a) => a.tipo === "sem-nome"),
    tipos(achados)
  );

  conferir(
    "e o apontamento diz qual nome usar",
    achados.some((a) => a.texto.includes("Marina")),
    achados.find((a) => a.tipo === "sem-nome")?.texto ?? ""
  );
}

{
  /* Sem acolhimento: explicar antes de validar é o erro do documento. */
  const seco = `Marina, o procedimento para a integração do iFood é reabrir o token
  no portal e aguardar a sincronização. Segue o passo a passo no link.`;

  const achados = conferirRascunho(seco, { nome: "Marina Ferreira" });

  conferir(
    "texto que não valida o sentimento é apontado",
    achados.some((a) => a.tipo === "sem-validacao"),
    tipos(achados)
  );
}

{
  /* Dado pessoal na resposta pública. */
  const comCpf = `${BOM}\n\nConfirmo o CPF 529.982.247-25 e o telefone (51) 90000-0000 do cadastro.`;

  const publico = conferirRascunho(comCpf, { nome: "Marina Ferreira", publico: true });
  const privado = conferirRascunho(comCpf, { nome: "Marina Ferreira", publico: false });

  conferir(
    "CPF e telefone na resposta pública são barrados",
    publico.some((a) => a.tipo === "dado-pessoal" && a.tom === "perigo"),
    publico.find((a) => a.tipo === "dado-pessoal")?.texto.slice(0, 60) ?? tipos(publico)
  );

  /*
    O mesmo texto no WhatsApp não é problema: o canal privado é onde o
    documento manda tratar dado pessoal. Uma conferência que reclamasse
    dos dois ensinaria a ignorá-la.
  */
  conferir(
    "e o mesmo texto no canal privado não é",
    !privado.some((a) => a.tipo === "dado-pessoal"),
    tipos(privado)
  );
}

{
  /* Parece macro: igual ao que já foi publicado. */
  const publicadas = [BOM];
  const achados = conferirRascunho(BOM, { nome: "Marina Ferreira", publicadas });

  conferir(
    "texto igual a um já publicado é barrado",
    achados.some((a) => a.tipo === "parece-macro" && a.tom === "perigo"),
    achados.find((a) => a.tipo === "parece-macro")?.texto.slice(0, 50) ?? tipos(achados)
  );

  /* Um texto sobre outro assunto não é macro. */
  const outro = `João, entendo a sua frustração com a cobrança duplicada de setembro.
  Confirmei com o financeiro e o estorno já foi solicitado — assim que tiver o
  número do protocolo do banco, aviso você por aqui.`;

  const limpo = conferirRascunho(outro, { nome: "João Pedro", publicadas });

  conferir(
    "e um texto sobre outro assunto não é",
    !limpo.some((a) => a.tipo === "parece-macro"),
    tipos(limpo)
  );
}

{
  /* Promessa de prazo em número, sem prazo conhecido. */
  const prometendo = `Marina, sinto muito pelo transtorno com a integração.
  Vamos resolver em 2 dias úteis, pode ficar tranquila.`;

  const semPrazo = conferirRascunho(prometendo, { nome: "Marina Ferreira" });
  const comPrazo = conferirRascunho(prometendo, {
    nome: "Marina Ferreira",
    prazoConhecido: true,
  });

  conferir(
    "prometer prazo em número sem ter o prazo é apontado",
    semPrazo.some((a) => a.tipo === "promete-prazo"),
    tipos(semPrazo)
  );

  /*
    Com o prazo acordado com a área, citar o número é o certo — é o que
    o documento chama de não deixar o cliente no vácuo.
  */
  conferir(
    "com o prazo acordado, citar o número é permitido",
    !comPrazo.some((a) => a.tipo === "promete-prazo"),
    tipos(comPrazo)
  );

  /* "o quanto antes" não é promessa de prazo. */
  const semNumero = conferirRascunho(
    `Marina, sinto muito pelo transtorno. Já acionei o time e retorno o quanto antes com a apuração.`,
    { nome: "Marina Ferreira" }
  );

  conferir(
    '"o quanto antes" não conta como promessa',
    !semNumero.some((a) => a.tipo === "promete-prazo"),
    tipos(semNumero)
  );
}

/* ============================================================
   AS BORDAS
============================================================ */

console.log("\n— As bordas —");

{
  /*
    Texto curto demais não é rascunho: é o modelo devolvendo vazio, ou
    um campo que não veio. Apontar cinco regras sobre três palavras
    treina a pessoa a fechar o aviso sem ler.
  */
  const achados = conferirRascunho("ok", { nome: "Marina Ferreira", publico: true });
  conferir("texto curto demais não vira cinco apontamentos", achados.length === 0, tipos(achados));
}

{
  /* Sem nome conhecido, não dá para cobrar o nome. */
  const semNomeConhecido = conferirRascunho(
    `Sinto muito pelo transtorno com a integração. Já acionei o time responsável.`,
    {}
  );

  conferir(
    "sem saber o nome, não cobra o nome",
    !semNomeConhecido.some((a) => a.tipo === "sem-nome"),
    tipos(semNomeConhecido)
  );
}

{
  /* Acento não muda nada: "João" no cadastro e "Joao" no texto. */
  const achados = conferirRascunho(
    `Joao, sinto muito pelo transtorno. Ja acionei o time responsavel.`,
    { nome: "João Pedro" }
  );

  conferir(
    "o nome casa mesmo sem acento",
    !achados.some((a) => a.tipo === "sem-nome"),
    tipos(achados)
  );
}

/* ============================================================
   AS REGRAS CHEGAM AO MODELO
============================================================ */

console.log("\n— As regras também vão na instrução —");

{
  const rotas = [
    "app/api/extensao/triagem/route.ts",
    "app/api/extensao/conversa/route.ts",
  ];

  const fs = require("node:fs") as typeof import("node:fs");

  for (const rota of rotas) {
    const fonte = fs.readFileSync(rota, "utf8");

    conferir(
      `${rota.split("/").slice(-2)[0]} manda as regras ao modelo`,
      /\$\{REGRAS_DO_RASCUNHO\}/.test(fonte),
      ""
    );

    conferir(
      `${rota.split("/").slice(-2)[0]} confere o que voltou`,
      /conferirRascunho\(/.test(fonte),
      ""
    );
  }

  conferir(
    "as regras citam o documento de onde saíram",
    /Atendimento no Reclame Aqui/.test(REGRAS_DO_RASCUNHO),
    ""
  );
}

console.log(
  falhas === 0
    ? "\n  O rascunho é conferido antes de alguém copiar.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
