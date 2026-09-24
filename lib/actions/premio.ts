"use server";

import * as XLSX from "xlsx";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { mensagemParaContato, type ContatoDoPremio } from "@/lib/models/premio";

/*
  O Prêmio Reclame Aqui (Fase 23): a campanha e quem já recebeu o pedido.

  As duas tabelas são novas. Até alguém rodar `npm run db:push` (e
  `npm run db:rls`) no banco, o Prisma responde "tabela não existe" — e
  a tela diz exatamente isso, em vez de um erro genérico.
*/

export interface CampanhaView {
  id: string;
  nome: string;
  categoria?: string;
  linkVotacao?: string;
  mensagem?: string;
  lembrete?: string;
  votacaoInicio?: string;
  votacaoFim?: string;
  dataDeCorte?: string;
  notaMeta?: number;
}

export type SituacaoDoPedido = "exportado" | "pedido" | "lembrete" | "votou";

export interface PedidoView {
  id: string;
  origem: "reclame-aqui" | "nps";
  ref: string;
  nome: string;
  telefone?: string;
  email?: string;
  motivo?: string;
  situacao: SituacaoDoPedido;
  exportadoPor?: string;
  exportadoEm: string;
  pedidoEm?: string;
  lembreteEm?: string;
  votouEm?: string;
}

type Falha = { ok: false; erro: string };

function traduzir(erro: unknown): string {
  const codigo = (erro as { code?: string })?.code;
  if (codigo === "P2021" || codigo === "P2022") {
    return "As tabelas do prêmio ainda não existem no banco. Rode npm run db:push e depois npm run db:rls — uma vez só.";
  }
  console.error("[premio]", erro);
  return "O banco não aceitou agora. Tente de novo em instantes.";
}

async function quem(minimo: "AGENTE" | "LEITURA") {
  try {
    const ctx = minimo === "LEITURA" ? await tryRole("LEITURA") : await requireRole("AGENTE");
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    return { ctx } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." } as const;
  }
}

const opcional = <T,>(v: T | null) => (v === null ? undefined : v);

/** As campanhas (a mais nova primeiro) e os pedidos da escolhida. */
export async function lerPremio(campanhaId?: string): Promise<{ ok: true; campanhas: CampanhaView[]; pedidos: PedidoView[] } | Falha> {
  const q = await quem("LEITURA");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  try {
    const campanhas = await q.ctx.prisma.campanhaDoPremio.findMany({ orderBy: { criadoEm: "desc" } });
    const alvo = campanhaId ?? campanhas[0]?.id;
    const pedidos = alvo ? await q.ctx.prisma.pedidoDeVoto.findMany({ where: { campanhaId: alvo }, orderBy: { exportadoEm: "desc" } }) : [];
    return {
      ok: true,
      campanhas: campanhas.map((c) => ({
        id: c.id,
        nome: c.nome,
        categoria: opcional(c.categoria),
        linkVotacao: opcional(c.linkVotacao),
        mensagem: opcional(c.mensagem),
        lembrete: opcional(c.lembrete),
        votacaoInicio: opcional(c.votacaoInicio),
        votacaoFim: opcional(c.votacaoFim),
        dataDeCorte: opcional(c.dataDeCorte),
        notaMeta: opcional(c.notaMeta),
      })),
      pedidos: pedidos.map((p) => ({
        id: p.id,
        origem: p.origem as PedidoView["origem"],
        ref: p.ref,
        nome: p.nome,
        telefone: opcional(p.telefone),
        email: opcional(p.email),
        motivo: opcional(p.motivo),
        situacao: p.situacao as SituacaoDoPedido,
        exportadoPor: opcional(p.exportadoPor),
        exportadoEm: p.exportadoEm.toISOString(),
        pedidoEm: p.pedidoEm?.toISOString(),
        lembreteEm: p.lembreteEm?.toISOString(),
        votouEm: p.votouEm?.toISOString(),
      })),
    };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Cria ou atualiza a campanha. */
export async function salvarCampanha(dados: Omit<CampanhaView, "id"> & { id?: string }): Promise<{ ok: true; id: string } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };

  const nome = dados.nome?.trim();
  if (!nome) return { ok: false, erro: "Dê um nome à campanha (ex.: Prêmio Reclame Aqui 2026)." };
  for (const d of [dados.votacaoInicio, dados.votacaoFim, dados.dataDeCorte]) {
    if (d && !DIA.test(d)) return { ok: false, erro: "Data inválida." };
  }
  if (dados.linkVotacao && !/^https:\/\//.test(dados.linkVotacao.trim())) return { ok: false, erro: "O link da votação precisa começar com https://." };
  if (dados.notaMeta !== undefined && (dados.notaMeta < 0 || dados.notaMeta > 10)) return { ok: false, erro: "A nota meta vai de 0 a 10." };

  const campos = {
    nome: nome.slice(0, 120),
    categoria: dados.categoria?.trim().slice(0, 120) || null,
    linkVotacao: dados.linkVotacao?.trim() || null,
    mensagem: dados.mensagem?.trim().slice(0, 1000) || null,
    lembrete: dados.lembrete?.trim().slice(0, 1000) || null,
    votacaoInicio: dados.votacaoInicio || null,
    votacaoFim: dados.votacaoFim || null,
    dataDeCorte: dados.dataDeCorte || null,
    notaMeta: dados.notaMeta ?? null,
  };

  try {
    const salvo = dados.id
      ? await q.ctx.prisma.campanhaDoPremio.update({ where: { id: dados.id }, data: campos, select: { id: true } })
      : await q.ctx.prisma.campanhaDoPremio.create({ data: { ...campos, criadoPor: q.ctx.userId }, select: { id: true } });
    return { ok: true, id: salvo.id };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/**
 * Registra quem foi exportado — quem exportou e quando — e devolve a
 * planilha pronta para o WhatsApp: nome, telefone internacional, a
 * mensagem com o nome e o link, e por que a pessoa está na lista. Quem
 * já estava na campanha não é tocado (a situação dele segue a que era).
 */
export async function registrarExportados(
  campanhaId: string,
  contatos: ContatoDoPremio[]
): Promise<{ ok: true; novos: number; arquivo: string; nome: string } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  if (!campanhaId) return { ok: false, erro: "Escolha a campanha antes de exportar." };
  if (contatos.length === 0) return { ok: false, erro: "Nenhum contato com esses filtros." };
  if (contatos.length > 5000) return { ok: false, erro: "Mais de 5 mil contatos de uma vez: estreite os filtros." };

  try {
    const eu = await q.ctx.prisma.user.findUnique({ where: { id: q.ctx.userId }, select: { name: true } });
    const r = await q.ctx.prisma.pedidoDeVoto.createMany({
      data: contatos.map((c) => ({
        campanhaId,
        origem: c.origem,
        ref: c.ref,
        nome: c.nome.slice(0, 200),
        telefone: c.telefoneInternacional ?? c.telefone ?? null,
        email: c.email ?? null,
        motivo: c.motivo.slice(0, 200),
        exportadoPor: eu?.name ?? null,
      })),
      skipDuplicates: true,
    });

    const campanha = await q.ctx.prisma.campanhaDoPremio.findUnique({ where: { id: campanhaId }, select: { nome: true, mensagem: true, linkVotacao: true } });
    const modelo = campanha?.mensagem ?? "";
    const linhas = contatos.map((c) => ({
      Nome: c.nome,
      Telefone: c.telefoneInternacional ?? "",
      "E-mail": c.email ?? "",
      Mensagem: modelo ? mensagemParaContato(modelo, c, campanha?.linkVotacao ?? "") : "",
      Motivo: c.motivo,
      Origem: c.origem === "nps" ? "NPS" : "Reclame Aqui",
      "Data da avaliação": c.data ? c.data.split("-").reverse().join("/") : "",
    }));
    const sheet = XLSX.utils.json_to_sheet(linhas);
    sheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 80 }, { wch: 36 }, { wch: 12 }, { wch: 12 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Pedido de voto");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const dia = new Date().toISOString().slice(0, 10);

    return { ok: true, novos: r.count, arquivo: buffer.toString("base64"), nome: `pedido-de-voto-${dia}.xlsx` };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

/** Anda com os pedidos: pedido feito, lembrete enviado, disse que votou — ou volta um passo. */
export async function marcarPedidos(ids: string[], situacao: SituacaoDoPedido): Promise<{ ok: true; alterados: number } | Falha> {
  const q = await quem("AGENTE");
  if ("erro" in q) return { ok: false, erro: q.erro! };
  if (!["exportado", "pedido", "lembrete", "votou"].includes(situacao)) return { ok: false, erro: "Situação inválida." };
  if (!ids.length || ids.length > 2000) return { ok: false, erro: "Escolha de 1 a 2.000 pessoas." };

  const agora = new Date();
  const datas =
    situacao === "pedido"
      ? { pedidoEm: agora }
      : situacao === "lembrete"
        ? { lembreteEm: agora }
        : situacao === "votou"
          ? { votouEm: agora }
          : { pedidoEm: null, lembreteEm: null, votouEm: null };

  try {
    const r = await q.ctx.prisma.pedidoDeVoto.updateMany({ where: { id: { in: ids } }, data: { situacao, ...datas } });
    return { ok: true, alterados: r.count };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}
