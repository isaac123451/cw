import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guarda na ficha o dossiê que a extensão montou.
 *
 * O Isaac foi específico sobre o que guardar: "não quero que você salve
 * o arquivo do crisp, quero que você salve o dossiê caso eu clique em
 * salvar pela extensão e assim apareça na ferramenta".
 *
 * A distinção importa. A transcrição do Crisp é matéria-prima — dezenas
 * de milhares de caracteres de conversa bruta, que já vivem no Crisp e
 * não precisam de segunda cópia. O dossiê é o produto: a história lida
 * e ordenada, do tamanho que se lê antes de responder.
 *
 * **É por clique, e não automático.** Montar dossiê é barato e se faz
 * por curiosidade; guardar é decidir que aquele texto vale para a
 * próxima pessoa. Guardar todo dossiê montado encheria a ficha de
 * versões que ninguém escolheu, e a mais recente nem sempre é a melhor.
 *
 * **Sobrescreve o anterior**, de propósito: são leituras do mesmo caso,
 * e um histórico de dossiês seria um histórico de rascunhos. O que
 * importa é o que vale agora — a linha do tempo do caso já guarda o que
 * aconteceu.
 */

/**
 * Teto do que se guarda.
 *
 * O dossiê completo costuma ter alguns milhares de caracteres. Cem mil
 * é folga larga e serve de freio contra alguém mandar a transcrição
 * inteira por engano — que é exatamente o que este endpoint não deve
 * guardar.
 */
const TETO = 100_000;

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  /*
    Demonstração lê, não grava.

    É o mesmo critério das outras rotas de escrita: sem sessão de
    verdade não há a quem atribuir o registro, e um dossiê sem autor na
    ficha é pior do que nenhum.
  */
  if (!usuario) {
    return responder(
      request,
      { erro: "Entre na aplicação para guardar o dossiê." },
      401
    );
  }

  const entrada = await request
    .json()
    .catch(() => ({}) as Record<string, unknown>);

  const protocolo = String(entrada.protocolo ?? "").trim();

  const texto = String(entrada.dossie ?? "").trim();

  if (!protocolo) {
    return responder(
      request,
      {
        erro: "Sem caso não há ficha onde guardar.",
        dica: "O dossiê de um contato sem reclamação cadastrada só existe enquanto o painel estiver aberto.",
      },
      400
    );
  }

  if (texto === "") {
    return responder(
      request,
      { erro: "Dossiê vazio — nada a guardar." },
      400
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      { erro: "Sem banco configurado." },
      503
    );
  }

  const caso = await prisma.case.findUnique({
    where: { protocol: protocolo },
    select: { id: true },
  });

  if (!caso) {
    return responder(
      request,
      { erro: `Não achei o caso ${protocolo}.` },
      404
    );
  }

  await prisma.case.update({
    where: { id: caso.id },
    data: {
      dossier: texto.slice(0, TETO),
      dossierAt: new Date(),
      dossierBy: usuario.nome,
    },
  });

  return responder(request, {
    ok: true,
    protocolo,
    guardadoEm: new Date().toISOString(),
    por: usuario.nome,
    caracteres: Math.min(texto.length, TETO),
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
