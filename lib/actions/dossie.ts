"use server";

import type { Prisma } from "@prisma/client";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { conferenciaAntesDeUsar, PARTES_VAZIAS, rascunhoSemIA, type PartesEscritas } from "@/lib/models/dossieEscrito";
import { montarDossie, renderizarDossie, type DossieMontado } from "@/lib/services/dossie.service";
import { aplicarPartes } from "@/lib/models/dossieEscrito";
import { pedirEstruturado } from "@/lib/services/ia.service";
import { fatoValido, situacaoDoCaso, type FatoDoDossie, type ImagemDoDossieView } from "@/lib/models/dossieTexto";

/*
  O dossiê pela plataforma (Fase 26).

  `abrirDossie` monta o documento do banco a cada abertura — a linha do
  tempo nunca é guardada nem editada — e junta as partes escritas, que
  moram em `DossieDoCaso`. A tabela é nova: sem `npm run db:push`, o
  dossiê abre com as partes em branco e salvar diz o que falta.
*/

type Falha = { ok: false; erro: string };

function traduzir(erro: unknown) {
  const codigo = (erro as { code?: string })?.code;
  if (codigo === "P2021" || codigo === "P2022") return "A tabela do dossiê ainda não existe no banco. Rode npm run db:push e depois npm run db:rls — uma vez só.";
  console.error("[dossie]", erro);
  return "O banco não aceitou agora. Tente de novo em instantes.";
}

async function quem(minimo: "AGENTE" | "LEITURA") {
  try {
    const ctx = minimo === "LEITURA" ? await tryRole("LEITURA") : await requireRole("AGENTE");
    if (!ctx) return { erro: "Sem banco configurado — o dossiê é montado do banco." } as const;
    return { ctx } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

export interface DossieAberto {
  montado: DossieMontado;
  partes: PartesEscritas;
  /** Quando as partes foram salvas pela última vez, e por quem. */
  salvo?: { em: string; por?: string; versao: number };
  /** A tabela ainda não existe: as partes começam em branco. */
  semTabela?: boolean;
  /** O texto único editado — ausente, a tela escreve do registro. */
  texto?: string;
  fatos: FatoDoDossie[];
  imagens: ImagemDoDossieView[];
  /** Onde o caso está agora, numa frase (status, resposta, avaliação). */
  situacao: string;
}

export async function abrirDossie(protocolo: string): Promise<({ ok: true } & DossieAberto) | Falha> {
  const q = await quem("LEITURA");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    const eu = await q.ctx.prisma.user.findUnique({ where: { id: q.ctx.userId }, select: { name: true } });
    const montado = await montarDossie(q.ctx.prisma, protocolo, { montadoPor: eu?.name ?? "Operação" });
    if (!montado) return { ok: false, erro: "Caso não encontrado." };
    const caso = await q.ctx.prisma.case.findFirst({
      where: { OR: [{ protocol: protocolo }, { externalId: protocolo }] },
      select: { id: true, status: true, publicResponse: true, publicResponseAt: true, evaluated: true, score: true, resolved: true, wouldDoBusiness: true },
    });
    let salvo = null;
    let imagens: ImagemDoDossieView[] = [];
    let semTabela = false;
    try {
      salvo = caso ? await q.ctx.prisma.dossieDoCaso.findUnique({ where: { caseId: caso.id } }) : null;
      imagens = caso
        ? (
            await q.ctx.prisma.imagemDoDossie.findMany({
              where: { caseId: caso.id },
              select: { id: true, nome: true, legenda: true, bytes: true, criadoEm: true },
              orderBy: { criadoEm: "asc" },
            })
          ).map((i) => ({ id: i.id, nome: i.nome, legenda: i.legenda ?? undefined, bytes: i.bytes, criadoEm: i.criadoEm.toISOString() }))
        : [];
    } catch (erro) {
      const codigo = (erro as { code?: string })?.code;
      if (codigo !== "P2021" && codigo !== "P2022") throw erro;
      semTabela = true;
    }
    const partes: PartesEscritas = salvo
      ? {
          destinatario: salvo.destinatario ?? undefined,
          pedido: salvo.pedido ?? undefined,
          sumario: salvo.sumario ?? undefined,
          verificado: salvo.verificado,
          sustentado: salvo.sustentado,
          alegado: salvo.alegado,
          enquadramento: salvo.enquadramento ?? undefined,
          conclusao: salvo.conclusao ?? undefined,
        }
      : PARTES_VAZIAS;
    return {
      ok: true,
      montado,
      partes,
      salvo: salvo ? { em: salvo.atualizadoEm.toISOString(), por: salvo.atualizadoPor ?? undefined, versao: salvo.versao } : undefined,
      semTabela,
      texto: salvo?.texto ?? undefined,
      fatos: lerFatos(salvo?.fatos),
      imagens,
      situacao: caso
        ? situacaoDoCaso({ ...caso, respondida: Boolean(caso.publicResponse?.trim()) })
        : "",
    };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

const limpar = (lista: string[]) => lista.map((x) => x.trim()).filter(Boolean).slice(0, 40).map((x) => x.slice(0, 600));

/** Grava as partes escritas; cada gravação sobe a versão do documento. */
export async function salvarPartesDoDossie(protocolo: string, partes: PartesEscritas): Promise<{ ok: true; versao: number } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    const caso = await q.ctx.prisma.case.findFirst({ where: { OR: [{ protocol: protocolo }, { externalId: protocolo }] }, select: { id: true } });
    if (!caso) return { ok: false, erro: "Caso não encontrado." };
    const eu = await q.ctx.prisma.user.findUnique({ where: { id: q.ctx.userId }, select: { name: true } });
    const dados = {
      destinatario: partes.destinatario?.trim().slice(0, 200) || null,
      pedido: partes.pedido?.trim().slice(0, 3000) || null,
      sumario: partes.sumario?.trim().slice(0, 4000) || null,
      verificado: limpar(partes.verificado),
      sustentado: limpar(partes.sustentado),
      alegado: limpar(partes.alegado),
      enquadramento: partes.enquadramento?.trim().slice(0, 4000) || null,
      conclusao: partes.conclusao?.trim().slice(0, 4000) || null,
      atualizadoPor: eu?.name ?? null,
    };
    const r = await q.ctx.prisma.dossieDoCaso.upsert({
      where: { caseId: caso.id },
      create: { caseId: caso.id, ...dados },
      update: { ...dados, versao: { increment: 1 } },
      select: { versao: true },
    });
    return { ok: true, versao: r.versao };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/**
 * O primeiro rascunho do sumário e da apuração.
 *
 * A IA recebe a linha do tempo já fechada e os anexos — nunca escreve
 * cronologia — e devolve o sumário e as três listas da apuração. Sem IA
 * no ar, volta o rascunho das regras (`rascunhoSemIA`), e a tela diz de
 * onde veio. Nada é gravado aqui: quem salva é a pessoa, depois de ler.
 */
export async function escreverDossieComIA(protocolo: string): Promise<{ ok: true; partes: Pick<PartesEscritas, "sumario" | "verificado" | "sustentado" | "alegado">; origem: "ia" | "regras"; aviso?: string } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    const montado = await montarDossie(q.ctx.prisma, protocolo, { montadoPor: "IA" });
    if (!montado) return { ok: false, erro: "Caso não encontrado." };
    const semIA = rascunhoSemIA(montado);

    const cronologia = montado.linhaDoTempo.map((e) => `${e.numero}. ${e.quando.slice(0, 16).replace("T", " ")} · ${e.canal} · ${e.evento}${e.evidencia ? ` (${e.evidencia})` : ""}`).join("\n");
    const anexos = montado.anexos.map((a) => `Anexo ${String(a.numero).padStart(2, "0")}: ${a.descricao}${a.noSistema ? "" : " (fora do sistema, ainda por anexar)"}`).join("\n");

    const r = await pedirEstruturado({
      sistema:
        "Você escreve partes de um dossiê de reputação que sustenta um pedido diante de terceiros (moderação do Reclame Aqui). Português do Brasil, frases curtas, sem adjetivos. Use só os fatos da cronologia e dos anexos dados; não invente data, valor nem fato. Cite anexos só pelos nomes dados (\"Anexo 01\").",
      prompt: `Caso: ${montado.identificacao.titulo} (${montado.identificacao.protocolo}), aberto por ${montado.partes.consumidor}.\n\nCronologia (fechada):\n${cronologia || "(sem eventos)"}\n\nAnexos:\n${anexos || "(sem anexos)"}\n\nEscreva: o sumário executivo (até 5 frases: o que o consumidor alegou, o que foi feito, como terminou); e a apuração em três listas — verificado (fato com anexo), sustentado pela evidência (conclusão que os anexos apoiam) e alegação sem prova (o que o consumidor afirma e nenhum anexo sustenta).`,
      esquema: {
        type: "object",
        properties: {
          sumario: { type: "string" },
          verificado: { type: "array", items: { type: "string" } },
          sustentado: { type: "array", items: { type: "string" } },
          alegado: { type: "array", items: { type: "string" } },
        },
        required: ["sumario", "verificado", "sustentado", "alegado"],
      },
    });

    if (r.erro || !r.dados) {
      return { ok: true, partes: semIA, origem: "regras", aviso: `Sem IA agora (${r.erro ?? "sem resposta"}): o rascunho é das regras, só com o que a linha do tempo afirma.` };
    }
    const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
    const dados = r.dados as Record<string, unknown>;
    return {
      ok: true,
      origem: "ia",
      partes: {
        sumario: String(dados.sumario ?? "") || semIA.sumario,
        verificado: lista(dados.verificado),
        sustentado: lista(dados.sustentado),
        alegado: lista(dados.alegado),
      },
    };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/** O documento inteiro em Markdown, com a conferência — para baixar e anexar. */
export async function documentoDoDossie(protocolo: string, partes: PartesEscritas): Promise<{ ok: true; texto: string; problemas: string[] } | Falha> {
  const q = await quem("LEITURA");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    const eu = await q.ctx.prisma.user.findUnique({ where: { id: q.ctx.userId }, select: { name: true } });
    const montado = await montarDossie(q.ctx.prisma, protocolo, { montadoPor: eu?.name ?? "Operação" });
    if (!montado) return { ok: false, erro: "Caso não encontrado." };
    return { ok: true, texto: renderizarDossie(aplicarPartes(montado, partes)), problemas: conferenciaAntesDeUsar(montado, partes) };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/* ============================================================
   O DOSSIÊ EM TEXTO ÚNICO (1.77)
============================================================ */

function lerFatos(json: unknown): FatoDoDossie[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((f): f is FatoDoDossie => Boolean(f && typeof f === "object" && typeof (f as FatoDoDossie).texto === "string" && typeof (f as FatoDoDossie).id === "string"))
    .slice(0, 100);
}

async function casoEAutor(prisma: NonNullable<Awaited<ReturnType<typeof tryRole>>>["prisma"], userId: string, protocolo: string) {
  const [caso, eu] = await Promise.all([
    prisma.case.findFirst({ where: { OR: [{ protocol: protocolo }, { externalId: protocolo }] }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  return { caso, autor: eu?.name ?? undefined };
}

/** Grava o texto único editado; `null` volta ao texto escrito do registro. */
export async function salvarTextoDoDossie(protocolo: string, texto: string | null): Promise<{ ok: true; versao: number } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    const { caso, autor } = await casoEAutor(q.ctx.prisma, q.ctx.userId, protocolo);
    if (!caso) return { ok: false, erro: "Caso não encontrado." };
    const limpo = texto === null ? null : texto.replace(/\r\n/g, "\n").trim().slice(0, 20_000) || null;
    const r = await q.ctx.prisma.dossieDoCaso.upsert({
      where: { caseId: caso.id },
      create: { caseId: caso.id, texto: limpo, atualizadoPor: autor ?? null },
      update: { texto: limpo, atualizadoPor: autor ?? null, versao: { increment: 1 } },
      select: { versao: true },
    });
    return { ok: true, versao: r.versao };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/** Acrescenta um fato ao dossiê — ou tira, com `remover`. Devolve a lista gravada. */
export async function mudarFatosDoDossie(
  protocolo: string,
  mudanca: { acrescentar?: { quando?: string; texto: string }; remover?: string }
): Promise<{ ok: true; fatos: FatoDoDossie[] } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  const novo = mudanca.acrescentar ? fatoValido(mudanca.acrescentar) : null;
  if (mudanca.acrescentar && !novo) return { ok: false, erro: "Escreva o fato (pelo menos algumas palavras)." };
  try {
    const { caso, autor } = await casoEAutor(q.ctx.prisma, q.ctx.userId, protocolo);
    if (!caso) return { ok: false, erro: "Caso não encontrado." };
    const atual = await q.ctx.prisma.dossieDoCaso.findUnique({ where: { caseId: caso.id }, select: { fatos: true } });
    let fatos = lerFatos(atual?.fatos);
    if (mudanca.remover) fatos = fatos.filter((f) => f.id !== mudanca.remover);
    if (novo) {
      if (fatos.length >= 100) return { ok: false, erro: "O dossiê já tem 100 fatos acrescentados." };
      fatos = [...fatos, { id: crypto.randomUUID(), ...novo, autor, em: new Date().toISOString() }];
    }
    await q.ctx.prisma.dossieDoCaso.upsert({
      where: { caseId: caso.id },
      create: { caseId: caso.id, fatos: fatos as unknown as Prisma.InputJsonValue, atualizadoPor: autor ?? null },
      update: { fatos: fatos as unknown as Prisma.InputJsonValue, atualizadoPor: autor ?? null, versao: { increment: 1 } },
      select: { id: true },
    });
    return { ok: true, fatos };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/** Troca a legenda de uma imagem do dossiê, ou a tira (`remover`). */
export async function mudarImagemDoDossie(id: string, mudanca: { legenda?: string; remover?: boolean }): Promise<{ ok: true } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    if (mudanca.remover) await q.ctx.prisma.imagemDoDossie.delete({ where: { id }, select: { id: true } });
    else await q.ctx.prisma.imagemDoDossie.update({ where: { id }, data: { legenda: mudanca.legenda?.trim().slice(0, 300) || null }, select: { id: true } });
    return { ok: true };
  } catch (erro) {
    if ((erro as { code?: string })?.code === "P2025") return { ok: false, erro: "Esta imagem já não existe." };
    return { ok: false, erro: traduzir(erro) };
  }
}
