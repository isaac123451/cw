"use server";

import * as XLSX from "xlsx";

import { updateTag } from "next/cache";

import { getPrisma } from "@/lib/prisma";
import { CASES_TAG } from "@/lib/actions/tags";
import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getSession } from "@/lib/auth/session";

import {
  fetchCases,
  importCasesBulk,
} from "@/lib/services/case.repository";

import {
  ImportFormatError,
  parseReclameAqui,
} from "@/lib/services/raImport.service";

/**
 * Importação e exportação da base de reclamações.
 *
 * Server actions, e não rotas em `/api`: o middleware libera `/api` (a
 * API pública tem token próprio), então um endpoint que despeja a base
 * inteira ali dentro nasceria sem proteção de sessão.
 */

export interface ImportSummary {
  error?: string;
  lidas?: number;
  gravadas?: number;
  novas?: number;
  atualizadas?: number;
  /** Já estavam iguais no banco: a planilha não trouxe mudança. */
  inalteradas?: number;
  de?: string | null;
  ate?: string | null;
}

async function exigirSessao() {

  const prisma = getPrisma();

  if (!prisma) {
    throw new Error(
      "Banco de dados não configurado. Defina DATABASE_URL."
    );
  }

  const session = await getSession();

  if (!session) {
    throw new Error("Sessão expirada. Entre novamente.");
  }

  return prisma;
}

/**
 * Lê o .xlsx do Reclame Aqui e grava no banco.
 *
 * `keepPii: true` de propósito — o destino é o Postgres, com acesso
 * controlado, e não o repositório. Perder e-mail e telefone aqui tiraria
 * da operação o contato do consumidor.
 */
export async function importCases(
  _state: ImportSummary,
  formData: FormData
): Promise<ImportSummary> {

  let prisma;

  try {
    prisma = await exigirSessao();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não autorizado.",
    };
  }

  const file = formData.get("arquivo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo .xlsx." };
  }

  if (!/\.xlsx?$/i.test(file.name)) {
    return {
      error: "O arquivo precisa ser .xlsx exportado do HugMe.",
    };
  }

  let lidas;

  try {
    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    lidas = parseReclameAqui(buffer, {
      keepPii: true,
    });
  } catch (error) {

    if (error instanceof ImportFormatError) {
      return { error: error.message };
    }

    console.error("[importar] leitura falhou", error);

    return {
      error:
        "Não foi possível ler a planilha. Confira se é o export do HugMe.",
    };
  }

  const { gravadas, novas, inalteradas } =
    await importCasesBulk(prisma, lidas.cases);

  // A importação cria categorias e etiquetas além dos casos, então as
  // duas cargas precisam ser relidas.
  updateTag(CASES_TAG);
  updateTag(WORKSPACE_TAG);

  return {
    lidas: lidas.cases.length,
    gravadas,
    novas,
    atualizadas: gravadas - novas,
    inalteradas,
    de: lidas.from,
    ate: lidas.to,
  };
}

/**
 * Exporta a base para .xlsx.
 *
 * Devolve base64 porque server action não transporta binário puro; a
 * tela remonta o arquivo e dispara o download.
 */
export async function exportCases(): Promise<{
  error?: string;
  arquivo?: string;
  nome?: string;
  total?: number;
}> {

  let prisma;

  try {
    prisma = await exigirSessao();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não autorizado.",
    };
  }

  const cases = await fetchCases(prisma, {
    withDescription: true,
  });

  const linhas = cases.map((item) => ({
    Protocolo: item.protocol,
    "Id origem": item.id,
    Origem: item.source,
    "Data Reclamação": item.createdAt,
    Status: item.status,
    Título: item.title,
    "Texto da Reclamação": item.description,
    Categoria: item.category,
    Subcategoria: item.subcategory ?? "",
    Prioridade: item.priority,
    Consumidor: item.customer,
    Estabelecimento: item.company,
    Email: item.email ?? "",
    Telefone: item.phone ?? "",
    Cidade: item.city ?? "",
    Estado: item.state ?? "",
    Responsável: item.owner ?? "",
    "Resposta pública": item.publicResponse ?? "",
    "Tempo de resposta": item.responseTime ?? "",
    "Tempo de solução": item.solutionTime ?? "",
    Avaliado: item.evaluated ? "Sim" : "Não",
    Nota: item.score ?? "",
    "Nota desconsiderada": item.scoreDisregarded
      ? "Sim"
      : "Não",
    Resolvido: item.resolved ? "Sim" : "Não",
    "Voltaria a fazer negócio": item.wouldDoBusiness
      ? "Sim"
      : "Não",
    "Data avaliação": item.evaluatedAt ?? "",
    SLA: item.sla,
    Etiquetas: (item.tags ?? []).join("; "),
    "Última atualização": item.updatedAt ?? "",
  }));

  const sheet = XLSX.utils.json_to_sheet(linhas);
  const book = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    book,
    sheet,
    "Reclamações"
  );

  const buffer = XLSX.write(book, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return {
    arquivo: buffer.toString("base64"),
    nome: `cw-reputacao-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`,
    total: cases.length,
  };
}
