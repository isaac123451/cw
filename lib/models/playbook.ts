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
}
