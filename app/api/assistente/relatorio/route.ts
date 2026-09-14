import { NextResponse } from "next/server";

import { tryRole } from "@/lib/auth/guard";
import { pedirEstruturado } from "@/lib/services/ia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A análise do Relatório de Reputação do ciclo.
 *
 * O documento pede um relatório "destacando os pontos de atenção da área
 * e as metas do período", com "as projeções para alcançar o selo
 * RA1000". Os números o relatório já tem — é conta sobre a base. A IA
 * recebe o relatório pronto e escreve o parágrafo de análise: o que o
 * ciclo mostra, o que mais pesa no selo, o que fazer no próximo.
 *
 * Sem IA (chave ausente, fila cheia), a análise sai pelas regras — os
 * pontos de atenção em frase —, e a tela diz que é das regras.
 */

const SISTEMA = `Você escreve a análise do Relatório de Reputação do ciclo da Cardápio Web, que o agente de reputação envia à gestão.

Recebe o relatório com os números já calculados: Reclame Aqui (aba vigente de 6 meses, a próxima aba, 12 meses e o selo RA1000), o que aconteceu no ciclo, NPS, redes sociais, Google e os pontos de atenção. Os números são fatos — não recalcule, não invente número nem causa que não esteja ali.

Escreva em português do Brasil, direto, sem preâmbulo e sem repetir a lista de números.

- "analise": de três a cinco frases. Diga como o ciclo foi, o que mais ameaça (ou sustenta) o selo RA1000 — olhando a próxima aba, que é a que vira vigente no dia 1º —, e termine com duas ou três ações concretas para o próximo ciclo, com quantidades quando o relatório as der ("responder as 10 que faltam", "contatar os detratores do ciclo").`;

const ESQUEMA = {
  type: "object",
  properties: { analise: { type: "string" } },
  required: ["analise"],
} as const;

/** A análise pelas regras: os pontos de atenção, em frase. */
function pelasRegras(pontos: string[]) {
  if (pontos.length === 0) {
    return "Ciclo sem pontos de atenção: as metas do selo estão cumpridas nas abas lidas. Para o próximo ciclo, manter o ritmo de respostas e de pedidos de avaliação.";
  }
  const principais = pontos.slice(0, 3).map((p) => p.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()));
  return `O ciclo pede atenção em ${principais.length === 1 ? "um ponto" : `${principais.length} pontos`}: ${principais.join("; ")}. Para o próximo ciclo, a prioridade é fechar o que mexe no selo — respostas públicas pendentes e pedidos de avaliação — antes do resto.`;
}

export async function POST(request: Request) {

  const ctx = await tryRole("LEITURA");
  if (!ctx) return NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 });

  const entrada = (await request.json().catch(() => ({}))) as { texto?: unknown; pontos?: unknown };
  const texto = typeof entrada.texto === "string" ? entrada.texto.slice(0, 8000) : "";
  const pontos = Array.isArray(entrada.pontos) ? entrada.pontos.filter((p): p is string => typeof p === "string").slice(0, 20) : [];

  if (!texto.trim()) return NextResponse.json({ erro: "Relatório ausente." }, { status: 400 });

  const r = await pedirEstruturado({ sistema: SISTEMA, prompt: texto, esquema: ESQUEMA, rapido: true });

  if (r.erro || !r.dados) {
    return NextResponse.json({ origem: "regras", aviso: r.erro ?? "A IA respondeu sem conteúdo.", analise: pelasRegras(pontos) });
  }

  const analise = typeof (r.dados as { analise?: unknown }).analise === "string" ? (r.dados as { analise: string }).analise.slice(0, 1500).trim() : "";

  if (!analise) return NextResponse.json({ origem: "regras", aviso: "A IA respondeu fora do formato.", analise: pelasRegras(pontos) });

  return NextResponse.json({ origem: "ia", provedor: r.provedor, analise });
}
