import { NextResponse } from "next/server";

import { tryRole } from "@/lib/auth/guard";
import { pedirEstruturado } from "@/lib/services/ia.service";

import type { BlocoDoPlano, PlanoDoDia } from "@/lib/models/meuDia";
import { frente } from "@/lib/models/frentes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A leitura do plano do dia.
 *
 * O Isaac pediu ajuda "para organizar como vou fazer tais atividades
 * conforme a quantidade de demandas e urgências, pode ser algo com IA".
 * O plano já vem pronto da tela — é conta: minutos por item, a ordem do
 * documento, o atrasado na frente. A IA recebe o plano e devolve a
 * leitura: por onde começar, o que o conjunto revela, o que adiar se não
 * cabe. Não inventa atividade nem número: o que ela recebe é tudo o que
 * existe.
 *
 * Sem IA (chave ausente, modelo congestionado), a leitura sai pelas
 * regras, e a tela diz que é das regras.
 */

const SISTEMA = `Você ajuda quem cuida da reputação da Cardápio Web a organizar o dia de trabalho.

Recebe o plano do dia já calculado: as atividades da rotina com horário, quantos itens cada uma tem, quantos estão fora do prazo, e o que não cabe no expediente. Os números são fatos — não recalcule, não invente atividade, não mude horário.

A regra do documento, para volume alto: Reclame Aqui primeiro (impacto direto na nota e no selo RA1000), depois Redes Sociais (risco de exposição), NPS (retenção, detratores críticos primeiro) e Google (acompanhamento contínuo).

Escreva em português do Brasil, direto, sem preâmbulo.

- "abertura": duas ou três frases dizendo como está o dia e por onde começar, e por quê. Se o dia não cabe no expediente, diga quanto falta e o que isso significa.
- "conselhos": de dois a quatro conselhos práticos, cada um uma frase curta começando por verbo — o que fazer antes, o que agrupar, o que adiar ou pedir ajuda. Use só o que está no plano.`;

const ESQUEMA = {
  type: "object",
  properties: {
    abertura: { type: "string" },
    conselhos: { type: "array", items: { type: "string" } },
  },
  required: ["abertura", "conselhos"],
} as const;

function horas(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m}min`;
}

function linha(b: BlocoDoPlano) {
  return `- ${b.inicio}–${b.fim} ${b.titulo}${b.frente ? ` (${frente(b.frente).nome})` : ""}: ${b.itens} item(ns), ${b.atrasados} fora do prazo, ~${horas(b.minutos)}`;
}

/** A leitura pelas regras — o mesmo formato, sem modelo. */
function pelasRegras(plano: PlanoDoDia) {
  const falta = plano.minutosNecessarios - plano.minutosDisponiveis;
  const atrasados = plano.blocos.filter((b) => b.atrasados > 0);
  const primeiro = atrasados[0] ?? plano.blocos.find((b) => b.itens > 0) ?? plano.blocos[0];

  const abertura = [
    falta > 0
      ? `O dia pede ${horas(plano.minutosNecessarios)} e o expediente tem ${horas(plano.minutosDisponiveis)}: faltam ${horas(falta)}.`
      : `O dia pede ${horas(plano.minutosNecessarios)} e cabe no expediente, com ${horas(-falta)} de folga.`,
    primeiro ? `Comece por "${primeiro.titulo}"${primeiro.atrasados ? `, que tem ${primeiro.atrasados} item(ns) fora do prazo` : ""}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const conselhos = [
    atrasados.length > 1 ? `Resolva primeiro o que está fora do prazo: ${[...new Set(atrasados.map((b) => b.titulo.toLowerCase()))].join(", ")}.` : null,
    plano.naoCabe.length ? `Adie ou divida: ${[...new Set(plano.naoCabe.map((b) => b.titulo.toLowerCase()))].join(", ")}.` : null,
    "Com volume alto, siga a ordem do documento: Reclame Aqui, Redes Sociais, NPS e Google.",
  ].filter((c): c is string => Boolean(c));

  return { abertura, conselhos };
}

export async function POST(request: Request) {

  const ctx = await tryRole("LEITURA");
  if (!ctx) return NextResponse.json({ erro: "Sessão expirada. Entre novamente." }, { status: 401 });

  const entrada = (await request.json().catch(() => ({}))) as { plano?: PlanoDoDia };
  const plano = entrada.plano;

  if (!plano || !Array.isArray(plano.blocos) || !Array.isArray(plano.naoCabe)) {
    return NextResponse.json({ erro: "Plano ausente." }, { status: 400 });
  }

  /* O que vai ao modelo é o plano, e só ele — limitado, para ninguém mandar um livro por aqui. */
  const prompt = [
    `Expediente restante: ${horas(plano.minutosDisponiveis)}. O plano pede: ${horas(plano.minutosNecessarios)}.`,
    "",
    "PLANO",
    ...plano.blocos.slice(0, 20).map(linha),
    "",
    plano.naoCabe.length ? "NÃO CABE HOJE" : "Tudo cabe no expediente.",
    ...plano.naoCabe.slice(0, 20).map(linha),
  ].join("\n");

  const r = await pedirEstruturado({ sistema: SISTEMA, prompt, esquema: ESQUEMA, rapido: true });

  if (r.erro || !r.dados) {
    return NextResponse.json({ origem: "regras", aviso: r.erro ?? "A IA respondeu sem conteúdo.", ...pelasRegras(plano) });
  }

  const dados = r.dados as { abertura?: unknown; conselhos?: unknown };
  const abertura = typeof dados.abertura === "string" ? dados.abertura.slice(0, 800) : "";
  const conselhos = Array.isArray(dados.conselhos)
    ? dados.conselhos.filter((c): c is string => typeof c === "string").slice(0, 4).map((c) => c.slice(0, 240))
    : [];

  if (!abertura) {
    return NextResponse.json({ origem: "regras", aviso: "A IA respondeu fora do formato.", ...pelasRegras(plano) });
  }

  return NextResponse.json({ origem: "ia", provedor: r.provedor, abertura, conselhos });
}
