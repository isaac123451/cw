/**
 * O checklist do dia **sem IA**, a partir dos mesmos números.
 *
 * **Por que existe.** Em 11/09/2026 o card "Checklist do dia" só
 * mostrava "O Gemini está congestionado neste momento". Os fatos
 * estavam todos calculados — quantas reclamações sem resposta, quantos
 * detratores sem contato — e a tela jogava fora porque o modelo que só
 * *ordena e explica* não respondeu.
 *
 * A ordem aqui é a mesma que o sistema pede ao modelo: **consequência,
 * não tamanho**. Primeiro quem está esperando contato, depois o que pesa
 * na nota do Reclame Aqui, por último o que é arrumação. O modelo
 * escreve melhor e enxerga padrões entre as frentes; estas regras
 * garantem que a lista sai mesmo quando ele não responde.
 *
 * `npm run check:checklist` prova a ordem e as contagens.
 */

export interface RetratoDoDia {
  dia: string;

  reclameAqui: {
    emAberto: number;
    semRespostaPublica: number;
    semResponsavel: number;
    foraDoPrazo: number;
    riscoDeCancelamento: number;
    avaliadosComoNaoResolvido: number;
    semRegraDeSla: boolean;
  };

  redesSociais: {
    emAberto: number;
    semResponsavel: number;
  };

  nps: {
    emTratativa: number;
    foraDoPrazoDePrimeiroContato: number;
    detratoresSemPrimeiroContato: number;
    semCausaRaiz: number;
  };

  agenda: {
    tarefasPendentes: number;
    atrasadas: number;
  };
}

export type Frente = "reclame-aqui" | "social" | "nps" | "geral";

export interface ItemDoChecklist {
  titulo: string;
  porque: string;
  frente: Frente;
  quantos: number;
}

export interface ChecklistDoDia {
  abertura: string;
  itens: ItemDoChecklist[];
  atencao?: string;
}

/** O limite que o sistema também pede ao modelo. */
const MAXIMO = 8;

export function checklistPelasRegras(
  retrato: RetratoDoDia
): ChecklistDoDia {

  const { reclameAqui: ra, redesSociais: social, nps, agenda } =
    retrato;

  /* Na ordem de consequência. Cada uma entra só se houver o que fazer. */
  const candidatos: ItemDoChecklist[] = [
    {
      titulo: "Fazer o primeiro contato com os detratores",
      porque:
        "Detrator sem retorno é o cliente mais perto de cancelar; cada dia sem contato confirma a nota que ele deu.",
      frente: "nps",
      quantos: nps.detratoresSemPrimeiroContato,
    },
    {
      titulo: "Retomar os ciclos de NPS fora do prazo",
      porque:
        "Já passaram do prazo de primeiro contato, e a chance de reverter a nota cai com o tempo.",
      frente: "nps",
      quantos: nps.foraDoPrazoDePrimeiroContato,
    },
    {
      titulo: "Responder as reclamações fora do prazo",
      porque:
        "Estão atrasadas pela regra de SLA, e o atraso fica à vista de quem pesquisa a empresa no portal.",
      frente: "reclame-aqui",
      quantos: ra.semRegraDeSla ? 0 : ra.foraDoPrazo,
    },
    {
      titulo: "Responder as reclamações sem resposta pública",
      porque:
        "Sem resposta no portal, cada uma conta contra o índice de resposta da nota do Reclame Aqui.",
      frente: "reclame-aqui",
      quantos: ra.semRespostaPublica,
    },
    {
      titulo: "Tratar as reclamações com risco de cancelamento",
      porque:
        "São clientes que já sinalizaram que podem sair; o contato de hoje é o que ainda muda isso.",
      frente: "reclame-aqui",
      quantos: ra.riscoDeCancelamento,
    },
    {
      titulo: "Distribuir as reclamações sem responsável",
      porque:
        "Reclamação sem dono não anda: ninguém é cobrado pelo prazo dela.",
      frente: "reclame-aqui",
      quantos: ra.semResponsavel,
    },
    {
      titulo: "Distribuir os atendimentos das redes sem responsável",
      porque:
        "Atendimento parado em rede social fica visível para todo mundo que segue a marca.",
      frente: "social",
      quantos: social.semResponsavel,
    },
    {
      titulo: "Dar baixa ou remarcar as tarefas atrasadas",
      porque:
        "Tarefa vencida na agenda esconde o que de fato precisa ser feito hoje.",
      frente: "geral",
      quantos: agenda.atrasadas,
    },
    {
      titulo: "Classificar a causa raiz dos ciclos de NPS",
      porque:
        "Sem causa raiz, o NPS não aponta o que corrigir no produto ou no atendimento.",
      frente: "nps",
      quantos: nps.semCausaRaiz,
    },
  ];

  const itens = candidatos
    .filter((item) => item.quantos > 0)
    .slice(0, MAXIMO);

  const abertura =
    itens.length === 0
      ? "Nada em aberto pedindo ação agora nas três frentes."
      : "A ordem abaixo segue a consequência: primeiro quem está esperando contato, depois o que pesa na nota do Reclame Aqui, por último a arrumação.";

  /*
    Uma observação que nenhum item mostra sozinho.

    A falta de regra de SLA vem primeiro porque ela esconde um item
    inteiro: sem regra, "fora do prazo" é sempre zero, e a lista parece
    mais limpa do que está.
  */
  const atencao = ra.semRegraDeSla
    ? "Nenhuma regra de SLA cadastrada: nenhuma reclamação pode ser apontada como fora do prazo, e a lista parece mais limpa do que está."
    : ra.avaliadosComoNaoResolvido > 0
      ? `${ra.avaliadosComoNaoResolvido} reclamação(ões) avaliada(s) como não resolvida(s) já estão puxando o índice de solução, o item de maior peso da nota.`
      : undefined;

  return { abertura, itens, atencao };
}
