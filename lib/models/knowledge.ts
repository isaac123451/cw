export type ArticleType =
  | "Procedimento"
  | "Macro"
  | "FAQ"
  | "Checklist"
  | "Fluxograma"
  | "Documentação";

export interface Article {
  id: string;

  title: string;

  summary: string;

  type: ArticleType;

  category: string;

  owner: string;

  version: string;

  updatedAt: string;

  views: number;

  tags: string[];
}
