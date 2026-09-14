/**
 * Playbook: o passo a passo de um fluxo de atendimento.
 *
 * Como o `CaseTag`, o tipo vivia junto dos exemplos em `lib/data/`. O
 * contrato fica aqui; os playbooks reais moram no banco.
 */
export interface PlaybookStep {
  title: string;
  owner: string;
  sla?: string;
  detail: string;
  checklist?: string[];
}

export interface Playbook {
  id: string;
  slug: string;
  title: string;
  summary: string;
  scope: string;
  owner: string;
  updatedAt: string;
  version: string;
  steps: PlaybookStep[];
  rules?: string[];
  /** Página correspondente no Confluence, onde a doc oficial vive. */
  confluenceUrl?: string;
  /** O documento inteiro em markdown (os nove do time). Vazio nos playbooks em passos. */
  conteudo?: string;
  /** "documentos-agosto-2026" para os importados. */
  origem?: string;
}

/* ============================================================
   O DOCUMENTO EM MARKDOWN
============================================================ */

export interface SecaoDoDocumento {
  nivel: 2 | 3;
  titulo: string;
  /** "passo-3-primeiro-contato" — o endereço da seção na página. */
  ancora: string;
  /** O corpo da seção, sem o título: até a próxima seção de mesmo nível ou acima. */
  texto: string;
}

/**
 * A âncora de um título: sem emoji, sem acento, minúscula, com hífens.
 *
 * É o endereço estável que o "por quê?" das telas usa para abrir o
 * trecho certo — "2. Prazos e Classificação de Criticidade (SLA)" vira
 * "2-prazos-e-classificacao-de-criticidade-sla".
 */
export function ancoraDe(titulo: string) {
  return titulo
    .replace(/\p{Extended_Pictographic}/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "1. 🔴 Reclamação" → "1. Reclamação": o índice e a lista não precisam do emoji. */
export function tituloSemEmoji(titulo: string) {
  return titulo.replace(/\p{Extended_Pictographic}\p{M}*\s*/gu, "").trim();
}

/**
 * O playbook em passos escrito como documento.
 *
 * Os três playbooks antigos (Rastreabilidade, ManyChat, Atendimento no
 * Reclame Aqui) nasceram como lista de etapas. Ao abrir o editor, eles
 * chegam como texto — cada etapa vira uma seção, o responsável e o
 * prazo uma linha em negrito, o checklist uma lista — e, salvos, passam
 * a ser lidos como os outros. As etapas continuam no banco.
 */
export function markdownDosPassos(p: Pick<Playbook, "steps" | "rules">) {
  const partes: string[] = [];
  if (p.steps.length > 0) {
    partes.push("## Etapas");
    p.steps.forEach((s, i) => {
      partes.push(`### ${i + 1}. ${s.title.replace(/^\d+\.\s*/, "")}`);
      const ficha = [s.owner && `**Responsável:** ${s.owner}`, s.sla && `**Prazo:** ${s.sla}`].filter(Boolean).join(" · ");
      if (ficha) partes.push(ficha);
      if (s.detail) partes.push(s.detail);
      if (s.checklist?.length) partes.push(s.checklist.map((c) => `- ${c}`).join("\n"));
    });
  }
  if (p.rules?.length) {
    partes.push("## Regras da operação");
    partes.push(p.rules.map((r) => `- ${r}`).join("\n"));
  }
  return partes.join("\n\n");
}

/** As seções (## e ###) de um documento, com o corpo de cada uma. */
export function secoesDoDocumento(conteudo: string): SecaoDoDocumento[] {
  const linhas = conteudo.replace(/\r/g, "").split("\n");
  const marcas: { i: number; nivel: 2 | 3; titulo: string }[] = [];
  linhas.forEach((l, i) => {
    const m = l.match(/^(##|###)\s+(.+?)\s*$/);
    if (m) marcas.push({ i, nivel: m[1].length as 2 | 3, titulo: m[2] });
  });

  const usadas = new Map<string, number>();
  return marcas.map((m, k) => {
    const fim = marcas.slice(k + 1).find((o) => o.nivel <= m.nivel)?.i ?? linhas.length;
    const base = ancoraDe(m.titulo) || "secao";
    const vezes = usadas.get(base) ?? 0;
    usadas.set(base, vezes + 1);
    return {
      nivel: m.nivel,
      titulo: m.titulo,
      ancora: vezes ? `${base}-${vezes + 1}` : base,
      texto: linhas.slice(m.i + 1, fim).join("\n").trim(),
    };
  });
}
