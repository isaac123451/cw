import { EXPEDIENTE_PADRAO, ehDiaUtil, type Expediente } from "@/lib/services/horasUteis";

/**
 * A rotina do agente, como o documento "Gestão de Rotinas" descreve.
 *
 * Onze atividades diárias numa ordem de prioridade, quatro semanais e
 * três contínuas. Viram **cadastro**: o documento termina dizendo que
 * "conforme a necessidade da marca e da operação essas demandas podem
 * ser alteradas, assim como sua ordem de prioridade" — e o Isaac pediu
 * "configurar atividades semanais para esse checklist sair direitinho".
 *
 * As do documento são o ponto de partida. Banco vazio devolve estas, com
 * id "padrao-…"; a primeira gravação materializa todas.
 */

export type Frequencia = "diaria" | "semanal" | "continua";

export type CategoriaDaRotina = "Operacional" | "Organização" | "Demandas Internas" | "Gestão";

/**
 * A contagem que a plataforma sabe fazer para a atividade.
 *
 * Atividade com chave mostra o número vivo ("12 novos casos") e o
 * atalho para a lista certa. Sem chave, é marcada à mão.
 */
export type ChaveDaRotina =
  | "metricas"
  | "pendencias"
  | "em-aberto"
  | "novos"
  | "fups"
  | "moderacoes"
  | "avaliacoes"
  | "ligacoes"
  | "concluidos"
  | "areas"
  | "checkpoint"
  | "indicadores"
  | "relatorio"
  | "processos"
  | "sprint";

export interface AtividadeDaRotina {
  id: string;
  titulo: string;
  descricao?: string;
  frequencia: Frequencia;
  /** 1 = segunda … 7 = domingo. Só vale para a semanal. */
  diasDaSemana: number[];
  /** "09:30" — a hora sugerida; vazia é "ao longo do dia". */
  horario?: string;
  /** Minutos que a atividade toma por si — o plano do dia soma os itens em cima. */
  duracaoMin: number;
  categoria: CategoriaDaRotina;
  chave?: ChaveDaRotina;
  link?: string;
  ordem: number;
  ativa: boolean;
}

export const ROTULO_DA_FREQUENCIA: Record<Frequencia, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  continua: "Contínua",
};

export const DIAS_DA_SEMANA = [
  { n: 1, curto: "seg", nome: "segunda" },
  { n: 2, curto: "ter", nome: "terça" },
  { n: 3, curto: "qua", nome: "quarta" },
  { n: 4, curto: "qui", nome: "quinta" },
  { n: 5, curto: "sex", nome: "sexta" },
  { n: 6, curto: "sáb", nome: "sábado" },
  { n: 7, curto: "dom", nome: "domingo" },
];

type Semente = Omit<AtividadeDaRotina, "id" | "ordem" | "ativa" | "diasDaSemana"> & { diasDaSemana?: number[] };

const QUATRO = "Reclame Aqui, Redes Sociais, NPS e Google Avaliações";

/** As atividades do documento, na ordem dele. */
const SEMENTE: Semente[] = [
  { titulo: "Preencher a Planilha de Métricas Reputação", frequencia: "diaria", categoria: "Operacional", chave: "metricas", link: "/analytics", duracaoMin: 10, horario: "08:00",
    descricao: "A métrica do dia já se preenche sozinha; confira e complete o que é manual." },
  { titulo: "Verificar atividades e pendências do dia", frequencia: "diaria", categoria: "Organização", chave: "pendencias", link: "/agenda", duracaoMin: 10, horario: "08:15" },
  { titulo: "Retornar os casos em aberto conforme a tratativa", frequencia: "diaria", categoria: "Operacional", chave: "em-aberto", link: "/reclame-aqui", duracaoMin: 15,
    descricao: `Andamento dos casos em aberto e o retorno ao cliente, de acordo com a tratativa documentada (${QUATRO}).` },
  { titulo: "Verificar novos casos e iniciar o atendimento", frequencia: "diaria", categoria: "Operacional", chave: "novos", link: "/reclame-aqui", duracaoMin: 10,
    descricao: `Triagem, imersão e 1º contato dos que chegaram (${QUATRO}).` },
  { titulo: "Fazer os FUPs de quem está sem retorno", frequencia: "diaria", categoria: "Operacional", chave: "fups", link: "/reclame-aqui", duracaoMin: 10,
    descricao: `Clientes com ausência de retorno (${QUATRO}).` },
  { titulo: "Solicitar e acompanhar moderações", frequencia: "diaria", categoria: "Operacional", chave: "moderacoes", link: "/reclame-aqui", duracaoMin: 10 },
  { titulo: "Pedir avaliação das reclamações respondidas", frequencia: "diaria", categoria: "Operacional", chave: "avaliacoes", link: "/reclame-aqui/avaliacoes", duracaoMin: 10 },
  { titulo: "Ligar para quem está sem retorno, pela cadência", frequencia: "diaria", categoria: "Operacional", chave: "ligacoes", link: "/reclame-aqui", duracaoMin: 10,
    descricao: `As tentativas documentadas, no horário ainda pouco tentado (${QUATRO}).` },
  { titulo: "Registrar e atualizar os casos concluídos", frequencia: "diaria", categoria: "Operacional", chave: "concluidos", link: "/reclame-aqui", duracaoMin: 10,
    descricao: `Nas ferramentas documentadas (${QUATRO}).` },
  { titulo: "Verificar e cobrar as solicitações às áreas", frequencia: "diaria", categoria: "Demandas Internas", chave: "areas", link: "/processos", duracaoMin: 10 },
  { titulo: "Checkpoint diário com a gestão", frequencia: "diaria", categoria: "Gestão", chave: "checkpoint", duracaoMin: 15, horario: "17:30" },

  { titulo: "Analisar os indicadores, oportunidades e projeções", frequencia: "semanal", diasDaSemana: [1], categoria: "Gestão", chave: "indicadores", link: "/analytics", duracaoMin: 60, horario: "14:00" },
  { titulo: "Enviar o Relatório de Reputação do ciclo", frequencia: "semanal", diasDaSemana: [5], categoria: "Gestão", chave: "relatorio", link: "/relatorio", duracaoMin: 60, horario: "16:00",
    descricao: "Pontos de atenção, metas, NPS e Reclame Aqui, com as projeções para o selo RA1000." },
  { titulo: "Alterar ou sugerir processos que impactem a experiência", frequencia: "semanal", diasDaSemana: [3], categoria: "Gestão", chave: "processos", link: "/processos", duracaoMin: 45, horario: "15:00" },
  { titulo: "Atuar nas demandas paralelas da Sprint", frequencia: "semanal", diasDaSemana: [4], categoria: "Demandas Internas", chave: "sprint", link: "/projetos", duracaoMin: 60, horario: "14:00" },

  { titulo: "Criar e revisitar os processos do time", frequencia: "continua", categoria: "Gestão", link: "/processos", duracaoMin: 30 },
  { titulo: "Documentar iniciativas que impactam a experiência", frequencia: "continua", categoria: "Gestão", link: "/projetos", duracaoMin: 30 },
  { titulo: "Elaborar dossiês de atendimento e jornada", frequencia: "continua", categoria: "Operacional", link: "/jornada", duracaoMin: 30 },
];

export const ROTINA_PADRAO: AtividadeDaRotina[] = SEMENTE.map((s, i) => ({
  ...s,
  id: `padrao-rotina-${i}`,
  diasDaSemana: s.diasDaSemana ?? [],
  ordem: i,
  ativa: true,
}));

/** 1 = segunda … 7 = domingo, do dia "AAAA-MM-DD". */
export function diaDaSemana(dia: string) {
  const d = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * O que vale para um dia: as diárias (em dia útil) e as semanais daquele
 * dia da semana, na ordem do cadastro.
 */
export function atividadesDoDia(
  atividades: AtividadeDaRotina[],
  dia: string,
  expediente: Expediente = EXPEDIENTE_PADRAO
) {
  const util = ehDiaUtil(dia, expediente);
  const semana = diaDaSemana(dia);
  return atividades
    .filter((a) => a.ativa)
    .filter((a) => (a.frequencia === "diaria" ? util : a.frequencia === "semanal" ? a.diasDaSemana.includes(semana) : false))
    .sort((a, b) => a.ordem - b.ordem);
}

/**
 * Dias úteis seguidos com a rotina inteira marcada.
 *
 * Conta de ontem para trás — hoje ainda está acontecendo — e soma hoje
 * se hoje já fechou. Um dia útil sem marca nenhuma interrompe; fim de
 * semana e feriado não contam nem interrompem.
 */
export function sequenciaDeDias(
  atividades: AtividadeDaRotina[],
  marcas: { atividadeId: string; dia: string }[],
  hoje: string,
  expediente: Expediente = EXPEDIENTE_PADRAO
) {
  const porDia = new Map<string, Set<string>>();
  for (const m of marcas) {
    const s = porDia.get(m.dia) ?? new Set<string>();
    s.add(m.atividadeId);
    porDia.set(m.dia, s);
  }

  const completo = (dia: string) => {
    const doDia = atividadesDoDia(atividades, dia, expediente);
    if (doDia.length === 0) return null;
    const feitas = porDia.get(dia) ?? new Set();
    return doDia.every((a) => feitas.has(a.id));
  };

  const antes = (dia: string) => new Date(Date.parse(`${dia}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

  let dias = completo(hoje) ? 1 : 0;
  let cursor = antes(hoje);

  for (let guarda = 0; guarda < 400; guarda++) {
    if (!ehDiaUtil(cursor, expediente)) {
      cursor = antes(cursor);
      continue;
    }
    const c = completo(cursor);
    if (!c) break;
    dias += 1;
    cursor = antes(cursor);
  }

  return dias;
}
