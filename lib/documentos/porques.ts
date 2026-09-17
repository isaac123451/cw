import type { SlugDoTime } from "@/lib/documentos/indice";
import { dobrar } from "@/lib/models/markdown";

/**
 * O "por quê?" de cada regra: o trecho do documento que a sustenta.
 *
 * Cada entrada aponta para uma seção dos documentos do time pelo
 * endereço dela (`secoesDoDocumento`). O texto não fica aqui — vem do
 * documento importado, então quem editar a Documentação muda também o
 * que o "por quê?" mostra. `check:documentos` confere que cada endereço
 * existe no texto original; se alguém renomear a seção na plataforma, o
 * balão abre o documento inteiro e avisa.
 */
export interface PorQue {
  doc: SlugDoTime;
  ancora: string;
  /** O nome do trecho, no balão e no link. */
  rotulo: string;
}

export const PORQUES = {
  /* Reclame Aqui — os oito passos, o prazo e a finalização */
  "ra.criticidade": { doc: "cintcw-reclame-aqui", ancora: "2-prazos-e-classificacao-de-criticidade-sla", rotulo: "Prazos e criticidade (SLA)" },
  "ra.recebimento": { doc: "cintcw-reclame-aqui", ancora: "passo-1-recebimento-e-notificacao", rotulo: "Passo 1 — Recebimento e notificação" },
  "ra.imersao": { doc: "cintcw-reclame-aqui", ancora: "passo-2-imersao-no-historico-do-cliente-antes-do-1-contato", rotulo: "Passo 2 — Imersão no histórico" },
  "ra.primeiro-contato": { doc: "cintcw-reclame-aqui", ancora: "passo-3-primeiro-contato-humanizado-preferencialmente-whatsapp-telefone", rotulo: "Passo 3 — Primeiro contato humanizado" },
  "ra.persistencia": { doc: "cintcw-reclame-aqui", ancora: "passo-4-gestao-de-excecoes-e-persistencia-no-contato", rotulo: "Passo 4 — Persistência no contato" },
  "ra.resolucao-interna": { doc: "cintcw-reclame-aqui", ancora: "passo-5-resolucao-interna-com-acompanhamento-sem-ruidos", rotulo: "Passo 5 — Resolução interna" },
  "ra.validacao": { doc: "cintcw-reclame-aqui", ancora: "passo-6-validacao-de-satisfacao-e-construcao-do-compromisso", rotulo: "Passo 6 — Validação com o cliente" },
  "ra.resposta-publica": { doc: "cintcw-reclame-aqui", ancora: "passo-7-resposta-publica", rotulo: "Passo 7 — Resposta pública" },
  "ra.follow-up": { doc: "cintcw-reclame-aqui", ancora: "passo-8-follow-up-de-avaliacao-acompanhamento-ativo", rotulo: "Passo 8 — Follow-up de avaliação" },
  "ra.regra-de-ouro": { doc: "cintcw-reclame-aqui", ancora: "regra-de-ouro-sem-macros-prontas-ou-textos-robotizados", rotulo: "Regra de ouro: sem macros prontas" },
  "ra.indicadores": { doc: "cintcw-reclame-aqui", ancora: "indicadores", rotulo: "Indicadores do Reclame Aqui" },

  /* As áreas internas */
  "areas.acionamento": { doc: "cintcw-tratativa-interna", ancora: "passo-2-acionamento-de-areas-internas", rotulo: "Acionamento das áreas internas" },
  "areas.prazos": { doc: "cintcw-tratativa-interna", ancora: "3-responsabilidades-das-areas-internas", rotulo: "Prazos e responsabilidades das áreas" },

  /* Ofertas e renegociação */
  "ofertas.quando": { doc: "cintcw-ofertas", ancora: "quando-aplicar-oferta-ou-desconto", rotulo: "Quando aplicar oferta ou desconto" },
  "ofertas.autonomia": { doc: "cintcw-ofertas", ancora: "diretrizes-de-concessao", rotulo: "Diretrizes de concessão" },
  "ofertas.renegociacao": { doc: "cintcw-ofertas", ancora: "quando-usamos", rotulo: "Renegociação: quando usamos" },
  "ofertas.calculo": { doc: "cintcw-ofertas", ancora: "calculos-detalhados", rotulo: "Cálculos da renegociação" },
  "ofertas.checklist": { doc: "cintcw-ofertas", ancora: "checklist-antes-e-apos-a-proposta-de-renegociacao", rotulo: "Checklist da renegociação" },

  /* Redes sociais */
  "redes.recebimento": { doc: "cintcw-redes-sociais", ancora: "passo-1-recebimento-da-solicitacao", rotulo: "Passo 1 — Recebimento da solicitação" },
  "redes.analise": { doc: "cintcw-redes-sociais", ancora: "passo-2-analise-inicial", rotulo: "Passo 2 — Análise inicial" },
  "redes.primeiro-contato": { doc: "cintcw-redes-sociais", ancora: "passo-3-primeiro-contato", rotulo: "Passo 3 — Primeiro contato" },
  "redes.tratativa": { doc: "cintcw-redes-sociais", ancora: "passo-4-tratativa", rotulo: "Passo 4 — Tratativa" },
  "redes.validacao": { doc: "cintcw-redes-sociais", ancora: "passo-5-validacao-da-solucao", rotulo: "Passo 5 — Validação da solução" },
  "redes.excecoes": { doc: "cintcw-redes-sociais", ancora: "situacoes-de-excecao", rotulo: "Situações de exceção" },
  "redes.crise": { doc: "cintcw-redes-sociais", ancora: "risco-de-exposicao-ou-crise", rotulo: "Risco de exposição ou crise" },
  "redes.sem-contato": { doc: "cintcw-redes-sociais", ancora: "ausencia-de-contato", rotulo: "Ausência de contato" },
  "redes.registro": { doc: "cintcw-redes-sociais", ancora: "registro-do-caso", rotulo: "Registro do caso" },

  /* Google */
  "google.monitoramento": { doc: "cintcw-google", ancora: "1-recebimento-e-monitoramento", rotulo: "Recebimento e monitoramento" },
  "google.classificacao": { doc: "cintcw-google", ancora: "2-classificacao-da-avaliacao", rotulo: "Classificação da avaliação" },
  "google.resposta": { doc: "cintcw-google", ancora: "3-resposta-publica", rotulo: "Resposta pública" },
  "google.tratativa": { doc: "cintcw-google", ancora: "4-tratativa-privada-quando-aplicavel", rotulo: "Tratativa privada" },
  "google.encerramento": { doc: "cintcw-google", ancora: "5-encerramento-e-registro", rotulo: "Encerramento e registro" },
  "google.excecoes": { doc: "cintcw-google", ancora: "situacoes-de-excecao", rotulo: "Situações de exceção" },
  "google.indicadores": { doc: "cintcw-google", ancora: "indicadores", rotulo: "Indicadores do Google" },

  /* NPS */
  "nps.segmentacao": { doc: "cintcw-nps", ancora: "segmentacao-inicial", rotulo: "Segmentação e prazo do 1º contato" },
  "nps.tipos": { doc: "cintcw-nps", ancora: "tratativa-por-tipo-de-feedback", rotulo: "Tratativa por tipo de feedback" },
  "nps.reclamacao": { doc: "cintcw-nps", ancora: "1-reclamacao", rotulo: "Reclamação" },
  "nps.sugestao": { doc: "cintcw-nps", ancora: "2-sugestao", rotulo: "Sugestão" },
  "nps.elogio": { doc: "cintcw-nps", ancora: "3-elogio", rotulo: "Elogio" },
  "nps.engano": { doc: "cintcw-nps", ancora: "4-engano", rotulo: "Engano" },
  "nps.erro-no-sistema": { doc: "cintcw-nps", ancora: "5-erro-no-sistema", rotulo: "Erro no Sistema" },
  "nps.erro-processual": { doc: "cintcw-nps", ancora: "6-erro-processual", rotulo: "Erro Processual" },
  "nps.falta-de-retorno": { doc: "cintcw-nps", ancora: "7-falta-de-retorno", rotulo: "Falta de Retorno" },
  "nps.checklist": { doc: "cintcw-nps", ancora: "checklist-para-encerrar-um-loop", rotulo: "Checklist para encerrar um loop" },
  "nps.indicadores": { doc: "cintcw-nps", ancora: "indicadores", rotulo: "Indicadores do NPS" },

  /* Rotina */
  "rotina.diaria": { doc: "cintcw-rotina-do-agente", ancora: "rotina-diaria", rotulo: "Rotina diária" },
  "rotina.prioridade": { doc: "cintcw-rotina-do-agente", ancora: "priorizacao-de-tratativas", rotulo: "Priorização de tratativas" },
  "rotina.semanal": { doc: "cintcw-rotina-do-agente", ancora: "rotina-semanal", rotulo: "Rotina semanal" },

  /* Ferramentas */
  "ferramentas.lista": { doc: "cintcw-ferramentas-e-acessos", ancora: "ferramentas-que-usamos", rotulo: "Ferramentas que usamos" },
  "ferramentas.acessos": { doc: "cintcw-ferramentas-e-acessos", ancora: "acessos", rotulo: "Acessos com segurança" },
  "ferramentas.planilhas": { doc: "cintcw-ferramentas-e-acessos", ancora: "planilhas", rotulo: "Planilhas da área" },
} satisfies Record<string, PorQue>;

export type ChaveDoPorQue = keyof typeof PORQUES;

/** O endereço do trecho na Documentação. */
export function linkDoPorQue(p: PorQue) {
  return `/documentacao?doc=${p.doc}#${p.ancora}`;
}

/* ============================================================
   OS PASSOS DAS TRILHAS
============================================================ */

/** O passo da trilha do Reclame Aqui e o trecho que o explica. */
export const PORQUE_DO_PASSO_RA: Record<string, ChaveDoPorQue> = {
  triar: "ra.criticidade",
  imersao: "ra.imersao",
  contato: "ra.primeiro-contato",
  tentativa: "ra.persistencia",
  persistencia: "ra.persistencia",
  area: "areas.prazos",
  "acionar-area": "areas.acionamento",
  validacao: "ra.validacao",
  resposta: "ra.resposta-publica",
  "pedir-avaliacao": "ra.follow-up",
};

/** O passo do fluxo das redes sociais. */
export const PORQUE_DO_PASSO_REDES: Record<string, ChaveDoPorQue> = {
  recebido: "redes.recebimento",
  triagem: "redes.recebimento",
  analise: "redes.analise",
  contato: "redes.primeiro-contato",
  tratativa: "redes.tratativa",
  validacao: "redes.validacao",
  encerramento: "redes.registro",
};

/** O passo da trilha do NPS. O retorno depende do tipo — ver `porqueDoTipoNps`. */
export const PORQUE_DO_PASSO_NPS: Record<string, ChaveDoPorQue> = {
  segmento: "nps.segmentacao",
  classificar: "nps.tipos",
  contato: "nps.segmentacao",
  retorno: "nps.tipos",
  confirmacao: "nps.checklist",
  promotor: "nps.elogio",
  encerrar: "nps.checklist",
};

/** O registro de contato do Reclame Aqui e das redes: cada tipo tem o seu passo. */
export function porqueDoContato(tipo: string, frente: "ra" | "redes"): ChaveDoPorQue {
  const ra: Record<string, ChaveDoPorQue> = {
    contato: "ra.primeiro-contato",
    tentativa: "ra.persistencia",
    atualizacao: "ra.resolucao-interna",
    "pedido-avaliacao": "ra.follow-up",
    validacao: "ra.validacao",
  };
  const redes: Record<string, ChaveDoPorQue> = {
    contato: "redes.primeiro-contato",
    tentativa: "redes.sem-contato",
    atualizacao: "redes.tratativa",
    "pedido-avaliacao": "redes.validacao",
    validacao: "redes.validacao",
  };
  return (frente === "ra" ? ra : redes)[tipo] ?? (frente === "ra" ? "ra.primeiro-contato" : "redes.primeiro-contato");
}

const TIPOS_NPS: Record<string, ChaveDoPorQue> = {
  reclamacao: "nps.reclamacao",
  sugestao: "nps.sugestao",
  elogio: "nps.elogio",
  engano: "nps.engano",
  "erro no sistema": "nps.erro-no-sistema",
  "erro processual": "nps.erro-processual",
  "falta de retorno": "nps.falta-de-retorno",
};

/** "Erro no Sistema" → o trecho do tipo. Tipo que o documento não tem cai no geral. */
export function porqueDoTipoNps(nome: string | null | undefined): ChaveDoPorQue {
  return TIPOS_NPS[dobrar((nome ?? "").trim())] ?? "nps.tipos";
}
