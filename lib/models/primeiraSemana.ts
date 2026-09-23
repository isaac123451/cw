import type { TourDaNovidade } from "@/lib/models/novidades";

/**
 * A primeira semana guiada (roadmap 2.0, Fase 19).
 *
 * O roteiro do primeiro acesso ensina o que é reputação e leva a cada
 * tela uma vez. Faltava o momento seguinte: a pessoa volta ao Reclame
 * Aqui no terceiro dia e não lembra para que serve a barra de cima. Aqui
 * cada tela principal tem um tour curto — dois ou três balões nos
 * blocos que decidem o trabalho —, oferecido **uma vez**, na primeira
 * visita a ela, e só durante a primeira semana.
 *
 * Nada abre sozinho: aparece um aviso pequeno no canto ("Primeira vez
 * aqui?"). Quem já concluiu ou dispensou o roteiro do primeiro acesso
 * não vê aviso nenhum — já conhece a plataforma.
 */

export const DIAS_DA_PRIMEIRA_SEMANA = 7;

export const TOURS_DAS_TELAS: Record<string, TourDaNovidade> = {
  "/meu-dia": {
    id: "tela-meu-dia",
    rota: "/meu-dia",
    passos: [
      { alvo: '[data-tour="pede-acao"]', titulo: "Comece por aqui", texto: "O que vence, quem está sem notícia e de quem pedir avaliação hoje. Cada linha tem Resolver." },
      { alvo: '[data-tour="um-por-vez"]', titulo: "Um item por vez", texto: "A fila do dia, um caso de cada vez, com os passos que faltam para ele sair do dia." },
      { alvo: '[data-tour="plano-do-dia"]', titulo: "O que cabe no expediente", texto: "O plano encaixa a rotina nas horas que sobram e mostra o que fica para amanhã." },
    ],
  },
  "/reclame-aqui": {
    id: "tela-reclame-aqui",
    rota: "/reclame-aqui",
    passos: [
      { alvo: '[data-tour="cartao-do-quadro"]', titulo: "Cada cartão é um caso", texto: "Clique para abrir a ficha; arraste para mudar a etapa. O relógio mostra o prazo do documento." },
      { alvo: '[data-tour="ler-portal"]', titulo: "Trazer o que é novo", texto: "Lê o portal do Reclame Aqui pela extensão e traz as reclamações que ainda não estão aqui." },
      { alvo: '[data-tour="modulo-avaliacoes"]', titulo: "Pedir avaliação", texto: "A fila de quem pedir a nota hoje, na cadência da documentação. É a maior alavanca da nota." },
    ],
  },
  "/nps": {
    id: "tela-nps",
    rota: "/nps",
    passos: [
      { alvo: '[data-tour="indicadores-nps"]', titulo: "O NPS e as faixas", texto: "Clique em uma faixa (detratores, passivos, promotores) para ver só ela na lista." },
      { alvo: '[data-tour="triagem-nps"]', titulo: "O que está parado", texto: "Os ciclos sem primeiro contato, na ordem da rotina: detratores críticos primeiro." },
      { alvo: '[data-tour="respostas-nps"]', titulo: "Cada resposta é um ciclo", texto: "Abra para classificar, registrar o contato e encerrar o ciclo." },
    ],
  },
  "/redes-sociais": {
    id: "tela-redes",
    rota: "/redes-sociais",
    passos: [
      { alvo: '[data-tour="segmentos"]', titulo: "Recortes", texto: "Origem, rede, assunto, gravidade: clique para filtrar o quadro e a lista." },
      { alvo: '[data-tour="quadro-redes"]', titulo: "O atendimento em etapas", texto: "Do recebido ao encerrado. Sem triagem, o caso abre com cinco perguntas, uma por vez." },
    ],
  },
  "/agenda": {
    id: "tela-agenda",
    rota: "/agenda",
    passos: [
      { alvo: '[data-tour="nova-atividade"]', titulo: "Anotar o que fazer", texto: "Follow-up, cobrança interna, pendência: com data, hora e, se quiser, o protocolo do caso." },
      { alvo: '[data-tour="dia-da-agenda"]', titulo: "O dia na ordem", texto: "Atrasadas em destaque. Concluir ou passar para o próximo dia útil, direto na linha." },
    ],
  },
};

export function tourDaTela(id: string | null | undefined): TourDaNovidade | null {
  if (!id) return null;
  return Object.values(TOURS_DAS_TELAS).find((t) => t.id === id) ?? null;
}

/**
 * Oferecer o tour desta tela agora?
 *
 * Só na primeira semana (contada da primeira visita guardada), só se o
 * roteiro do primeiro acesso ainda está em curso, e só uma vez por tela.
 */
export function oferecerTourDaTela(entrada: {
  rota: string;
  primeiraVisita: string | null;
  jaVistas: string[];
  roteiroEmCurso: boolean;
  agora?: Date;
}): TourDaNovidade | null {
  const tour = TOURS_DAS_TELAS[entrada.rota];
  if (!tour || !entrada.roteiroEmCurso || !entrada.primeiraVisita) return null;
  if (entrada.jaVistas.includes(tour.id)) return null;
  const dias = ((entrada.agora ?? new Date()).getTime() - new Date(entrada.primeiraVisita).getTime()) / 86_400_000;
  if (!(dias >= 0 && dias < DIAS_DA_PRIMEIRA_SEMANA)) return null;
  return tour;
}
