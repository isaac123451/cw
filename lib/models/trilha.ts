import { respondida, type Case } from "@/lib/models/case";
import { pedidoDeAvaliacao } from "@/lib/models/cadencia";

/**
 * A trilha do Reclame Aqui, na ordem da documentação.
 *
 * Três fases e oito passos — Diagnóstico (recebimento e triagem,
 * imersão), Conexão (1º contato, persistência, resolução interna) e
 * Validação (validação com o cliente, resposta pública, follow-up de
 * avaliação) — e a finalização do fluxo interno: atualizar o CW Engine.
 *
 * **Cada passo se marca pelo que o banco sabe.** A resposta pública
 * existe ou não; a avaliação chegou ou não; o 1º contato foi registrado.
 * O que só a pessoa sabe — "fiz a imersão", "atualizei o CW Engine" — é
 * um clique, com data e autor.
 *
 * **O legado não fica vermelho.** Reclamação anterior ao registro, com
 * resposta pública, teve contato e validação que ninguém tinha onde
 * anotar: esses passos aparecem como feitos "por dedução", e não como
 * pendências que ninguém poderia ter cumprido.
 *
 * Só vale para o Reclame Aqui. As redes sociais têm o fluxo do documento
 * delas — ver `lib/models/redes.ts`.
 */

export type EstadoDoPasso = "feito" | "atual" | "pendente" | "opcional";

export type AcaoDoPasso =
  | "triar"
  | "imersao"
  | "contato"
  | "tentativa"
  | "acionar-area"
  | "validacao"
  | "resposta"
  | "pedir-avaliacao"
  | "cw-engine";

export interface PassoDaTrilha {
  id: AcaoDoPasso | "persistencia" | "area";
  numero: number;
  fase: "Diagnóstico" | "Conexão" | "Validação" | "Finalização";
  titulo: string;
  /** Curto, para o cartão: "Próximo: pedir avaliação". */
  curto: string;
  estado: EstadoDoPasso;
  /** O que o dado diz sobre o passo — "3 de 5 tentativas". */
  detalhe?: string;
  /** Quando foi feito, se foi. */
  quando?: string;
  /** Feito por dedução (legado), e não por registro. */
  deduzido?: boolean;
  /** O que o botão do passo faz. */
  acao?: AcaoDoPasso;
}

/** O passo antes de a ordem decidir qual é o atual. */
type Rascunho = Omit<PassoDaTrilha, "estado"> & {
  feito: boolean;
  /** Não segura a fila quando não se aplica — persistência, área. */
  opcional?: boolean;
};

export interface ContextoDaTrilha {
  /** Há área interna acionada sem retorno. */
  areaAberta?: { destino: string; vence?: string };
  /** Quantas áreas já devolveram o caso. */
  areasConcluidas?: number;
  /** O instante de referência — a janela de 6 meses do follow-up depende dele. */
  agora?: Date;
}

/** O dia a partir do qual a plataforma registra contatos e validação. */
export const INICIO_DA_TRILHA = "2026-09-12";

const FINAIS = ["Resolvido", "Não resolvido"];

export function trilhaDoCaso(
  item: Case,
  contexto: ContextoDaTrilha = {}
): PassoDaTrilha[] {

  const legado = item.createdAt < INICIO_DA_TRILHA;
  const resposta = respondida(item);

  /*
    Respondida há mais de 6 meses e nunca avaliada: o follow-up acabou.

    A documentação acompanha "semanalmente, por até 6 meses". Passado
    isso, pedir de novo não é o próximo passo de ninguém — e cem casos
    antigos gritando "pedir avaliação" no quadro esconderiam os dez que
    ainda estão na janela.
  */
  const foraDaJanela =
    resposta && !item.evaluated && !pedidoDeAvaliacao(item, contexto.agora).ativo;

  const encerrado = FINAIS.includes(item.status) || Boolean(item.evaluated) || foraDaJanela;

  /* O que o fim do caso prova sobre o começo dele. */
  const houveConversa = resposta || encerrado;

  const passos: Rascunho[] = [];

  const empurrar = (p: Rascunho) => passos.push(p);

  empurrar({
    id: "triar",
    numero: 1,
    fase: "Diagnóstico",
    titulo: "Recebimento e triagem",
    curto: "triar",
    feito: Boolean(item.triadaEm) || (legado && houveConversa),
    deduzido: !item.triadaEm && legado && houveConversa,
    quando: item.triadaEm,
    detalhe: item.triadaEm
      ? `${item.priority}${item.triadaPor ? ` · ${item.triadaPor}` : ""}`
      : "Classificar a criticidade: Urgente, Alta ou Normal.",
    acao: "triar",
  });

  empurrar({
    id: "imersao",
    numero: 2,
    fase: "Diagnóstico",
    titulo: "Imersão no histórico",
    curto: "fazer a imersão",
    feito: Boolean(item.imersaoEm) || Boolean(item.primeiroContatoEm) || houveConversa,
    deduzido: !item.imersaoEm && (Boolean(item.primeiroContatoEm) || houveConversa),
    quando: item.imersaoEm,
    detalhe: item.imersaoEm
      ? item.imersaoPor
      : "Conta, fase do cliente e jornada de atendimento antes de qualquer mensagem.",
    acao: "imersao",
  });

  empurrar({
    id: "contato",
    numero: 3,
    fase: "Conexão",
    titulo: "1º contato humanizado",
    curto: "fazer o 1º contato",
    feito: Boolean(item.primeiroContatoEm) || houveConversa,
    deduzido: !item.primeiroContatoEm && houveConversa,
    quando: item.primeiroContatoEm,
    detalhe: item.primeiroContatoEm
      ? `${item.primeiroContatoCanal ?? ""}${item.primeiroContatoPor ? ` · ${item.primeiroContatoPor}` : ""}`
      : "De preferência WhatsApp ou telefone, apresentando-se como responsável.",
    acao: "contato",
  });

  /*
    Persistência só existe quando o cliente não respondeu.

    Quem atendeu na primeira ligação não passa por este passo — ele fica
    como "não precisou", e não como pendência.
  */
  const tentativas = item.tentativasSemResposta ?? 0;
  const clienteRespondeu = Boolean(item.ultimaRespostaEm) || houveConversa;

  empurrar({
    id: "persistencia",
    numero: 4,
    fase: "Conexão",
    titulo: "Persistência no contato",
    curto: `nova tentativa (${Math.min(tentativas + 1, 5)} de 5)`,
    feito: tentativas === 0 && (clienteRespondeu || Boolean(item.primeiroContatoEm)),
    opcional: tentativas === 0,
    detalhe:
      tentativas > 0
        ? `${tentativas} tentativa(s) seguida(s) sem resposta · até 5 ligações em 7 dias, horários variados`
        : clienteRespondeu
          ? "Não precisou: o cliente respondeu."
          : "Só se o cliente não responder.",
    acao: "tentativa",
  });

  const area = contexto.areaAberta;

  empurrar({
    id: "area",
    numero: 5,
    fase: "Conexão",
    titulo: "Resolução interna",
    curto: area ? `aguardar ${area.destino}` : "acionar área, se precisar",
    feito: !area && (contexto.areasConcluidas ?? 0) > 0,
    opcional: !area,
    detalhe: area
      ? `Com ${area.destino}${area.vence ? ` · retorno até ${area.vence}` : ""}. Manter o cliente informado.`
      : (contexto.areasConcluidas ?? 0) > 0
        ? `${contexto.areasConcluidas} área(s) já devolveram o caso.`
        : "Suporte N2, Financeiro, Comercial ou Desenvolvimento — só quando necessário.",
    acao: "acionar-area",
  });

  empurrar({
    id: "validacao",
    numero: 6,
    fase: "Validação",
    titulo: "Validação com o cliente",
    curto: "validar a solução com o cliente",
    feito: Boolean(item.validadoEm) || (legado && resposta) || encerrado,
    deduzido: !item.validadoEm && ((legado && resposta) || encerrado),
    quando: item.validadoEm,
    detalhe: item.validadoEm
      ? "O cliente confirmou que tudo voltou a funcionar."
      : "Confirmar que tudo voltou a funcionar antes da resposta pública.",
    acao: "validacao",
  });

  /*
    A réplica do consumidor reabre a resposta.

    No portal, "Aguardando nossa réplica" é o consumidor que respondeu à
    nossa resposta — e a vez é da empresa. Pedir avaliação a quem está
    esperando a nossa réplica seria pedir nota no meio da conversa.
  */
  const devendoReplica = /aguardando nossa r[ée]plica/i.test(item.status);

  empurrar({
    id: "resposta",
    numero: 7,
    fase: "Validação",
    titulo: devendoReplica ? "Réplica ao consumidor" : "Resposta pública",
    curto: devendoReplica ? "responder a réplica" : "publicar a resposta",
    feito: resposta && !devendoReplica,
    quando: devendoReplica ? undefined : item.publicResponseAt,
    detalhe: devendoReplica
      ? "O consumidor respondeu no portal — a vez é nossa. Mesmas regras: texto do caso, sem dado pessoal."
      : resposta
        ? "Publicada no Reclame Aqui."
        : "Texto exclusivo do caso, sem dado pessoal, só depois da validação.",
    acao: "resposta",
  });

  empurrar({
    id: "pedir-avaliacao",
    numero: 8,
    fase: "Validação",
    titulo: "Follow-up de avaliação",
    curto: "pedir a avaliação",
    feito: Boolean(item.evaluated),
    opcional: foraDaJanela,
    quando: item.evaluatedAt,
    detalhe: item.evaluated
      ? `Avaliada${item.score !== undefined ? ` com nota ${item.score}` : ""}.`
      : foraDaJanela
        ? "Encerrado sem avaliação: mais de 6 meses desde a resposta."
        : (item.pedidosDeAvaliacao ?? 0) > 0
          ? `${item.pedidosDeAvaliacao} pedido(s) feito(s).`
          : "Lembretes a cada 2 dias depois da resposta; depois, semanais.",
    acao: "pedir-avaliacao",
  });

  empurrar({
    id: "cw-engine",
    numero: 9,
    fase: "Finalização",
    titulo: "Atualizar o CW Engine",
    curto: "atualizar o CW Engine",
    feito: Boolean(item.cwEngineEm) || (legado && encerrado),
    deduzido: !item.cwEngineEm && legado && encerrado,
    quando: item.cwEngineEm,
    detalhe: item.cwEngineEm
      ? item.cwEnginePor
      : "O registro final do caso na conta do cliente.",
    acao: "cw-engine",
  });

  /* O passo atual é o primeiro que falta — os opcionais não seguram a fila. */
  let atualMarcado = false;

  return passos.map(
    ({ feito, opcional, ...p }) => {

      let estado: EstadoDoPasso;

      if (feito) estado = "feito";
      else if (opcional && !(p.id === "area" && area) && !(p.id === "persistencia" && tentativas > 0)) {
        estado = "opcional";
      } else if (!atualMarcado) {
        estado = "atual";
        atualMarcado = true;
      } else {
        estado = "pendente";
      }

      return { ...p, estado };
    }
  );
}

/** O passo que a pessoa tem na frente — ou `null` com a trilha completa. */
export function proximoPasso(
  item: Case,
  contexto: ContextoDaTrilha = {}
): PassoDaTrilha | null {
  return trilhaDoCaso(item, contexto).find((p) => p.estado === "atual") ?? null;
}
