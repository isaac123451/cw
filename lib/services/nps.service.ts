import {
  ABANDONO_DIAS,
  isEncerrado,
  JANELA_TENTATIVAS_DIAS,
  MOODS,
  NpsKindOption,
  NpsResponseView,
  NpsSegment,
  segmentOf,
  SEGMENTS,
  STATUS_AGUARDANDO,
  tentativasMinimas,
  tipoPorNome,
  TIPOS_PADRAO,
} from "@/lib/models/nps";
import { diaNaOperacao } from "@/lib/services/reputation.service";
import {
  EXPEDIENTE_PADRAO,
  type Expediente,
  minutosUteisEntre,
  paredeDe,
  prazoUtil,
} from "@/lib/services/horasUteis";

/* ============================================================
   PRAZO EM HORAS ÚTEIS
============================================================ */

/*
  O relógio mora em `lib/services/horasUteis.ts` desde 12/09/2026.

  Este arquivo tinha o seu: horas de relógio que caíam em dia útil,
  com o dia da semana lido em UTC — uma resposta das 22h de sexta, em
  Brasília, já contava como sábado —, e sem feriado nenhum. Agora o NPS,
  o Reclame Aqui e as redes contam o mesmo tempo útil.
*/

/**
 * Prazo do primeiro contato: o do tipo, quando existe; senão o do
 * segmento.
 *
 * `tipos` entra por parâmetro, com os do guia como padrão. Quem tem a
 * lista cadastrada em mãos (a tela, a rota) passa a dela; quem não tem
 * — um script, um teste — continua funcionando sem tocar no banco.
 */
export function prazoPrimeiroContato(
  respondedAt: Date,
  score: number,
  kind?: string | null,
  tipos: NpsKindOption[] = TIPOS_PADRAO,
  expediente: Expediente = EXPEDIENTE_PADRAO
): Date {

  const regra = tipoPorNome(tipos, kind);

  const horas =
    regra?.ownDeadlineHours ??
    segmentOf(score).slaHoursUteis;

  return prazoUtil(respondedAt, horas, expediente);
}

/* ============================================================
   ESTADO DO CICLO
============================================================ */

export type SlaState =
  | "no-prazo"
  | "vence-hoje"
  | "estourado"
  | "cumprido"
  | "encerrado";

export function slaState(
  item: NpsResponseView,
  agora = new Date()
): SlaState {

  if (isEncerrado(item.status)) return "encerrado";

  if (item.firstContactAt) return "cumprido";

  const prazo = new Date(item.firstContactDueAt);

  if (agora > prazo) return "estourado";

  /*
    "Vence hoje" é o dia de Brasília, e não as próximas 24 horas.

    Era a diferença em horas corridas: um prazo de amanhã às 10h, olhado
    hoje às 11h, aparecia como "Vence hoje" — e na sexta à tarde, um que
    vencia na segunda às 9h também, porque a conta passava por cima do
    fim de semana sem saber que ele existe.
  */
  return paredeDe(prazo).dia === paredeDe(agora).dia
    ? "vence-hoje"
    : "no-prazo";
}

/**
 * As tentativas que contam para "sem retorno": as dos últimos 7 dias,
 * feitas depois da última conversa com o cliente.
 *
 * Tentativa de antes da conversa não é falta de retorno — o cliente
 * respondeu. Contá-las fazia um ciclo em que já se falou com a pessoa
 * (e se esperava a confirmação) aparecer como "3 tentativas sem
 * resposta", e o encerramento automático o fecharia como Sem Retorno.
 */
export function tentativasNaJanela(
  item: Pick<NpsResponseView, "attempts" | "postContactAt">,
  agora = new Date()
) {
  const desde = item.postContactAt ? Date.parse(item.postContactAt) : 0;
  /* A que ainda aguarda retorno não conta: o cliente pode responder nas 2 horas. */
  return item.attempts.filter((a) => {
    const t = Date.parse(a.createdAt);
    return a.resultado !== "aguardando" && t > desde && (agora.getTime() - t) / 86400000 <= JANELA_TENTATIVAS_DIAS;
  });
}

/** A tentativa mais antiga ainda aguardando retorno, se houver. */
export function tentativaAguardando(item: Pick<NpsResponseView, "attempts">) {
  return item.attempts.find((a) => a.resultado === "aguardando") ?? null;
}

/**
 * Deve encerrar sozinho por falta de retorno?
 *
 * Duas portas, as duas do guia: as tentativas mínimas do tipo dentro da
 * janela de 7 dias, ou 30 dias sem qualquer resposta do cliente —
 * contados da pesquisa, ou da última conversa, se houve.
 */
export function deveEncerrarSemRetorno(
  item: NpsResponseView,
  agora = new Date()
): { deve: boolean; motivo?: string } {

  if (isEncerrado(item.status)) return { deve: false };

  const dias = (iso: string) =>
    (agora.getTime() - Date.parse(iso)) / 86400000;

  // Cliente já confirmou algo — não é falta de retorno.
  if (item.confirmedAt) return { deve: false };

  const naJanela = tentativasNaJanela(item, agora);

  if (naJanela.length >= tentativasMinimas(item.kind)) {
    return {
      deve: true,
      motivo: `${naJanela.length} tentativas em ${JANELA_TENTATIVAS_DIAS} dias, sem resposta.`,
    };
  }

  if (dias(item.postContactAt ?? item.respondedAt) >= ABANDONO_DIAS) {
    return {
      deve: true,
      motivo: `${ABANDONO_DIAS} dias sem qualquer resposta.`,
    };
  }

  return { deve: false };
}

/**
 * Por que este final ainda não pode ser aplicado — ou `null`, se pode.
 *
 * A mesma regra na ficha (o botão diz o que falta) e no servidor (a
 * gravação recusa). Antes só a tela travava, e só o "Resolvido": o
 * quadro e qualquer chamada direta encerravam sem lastro.
 *
 * - **Sem Retorno** pede o critério do guia: as tentativas mínimas do
 *   tipo em 7 dias, ou 30 dias sem resposta.
 * - **Engano** pede só o tipo: é controle interno.
 * - Os outros finais pedem o checklist do guia — tipo, causa raiz quando
 *   o tipo exige, o cliente contatado e, quando o tipo exige, a
 *   confirmação de que resolveu.
 */
export function motivoParaNaoEncerrar(
  item: NpsResponseView,
  final: string,
  tipos: NpsKindOption[] = TIPOS_PADRAO,
  agora = new Date()
): string | null {

  if (!isEncerrado(final)) return null;

  if (final === "[Encerrado] Sem tratativa") {
    return "\"Sem tratativa\" é só do promotor que chega calado pela importação.";
  }

  if (!item.kind) return "Classifique o tipo antes de encerrar.";

  if (/^\[Encerrado\]\s*Sem Retorno/i.test(final)) {
    if (deveEncerrarSemRetorno(item, agora).deve) return null;
    const feitas = tentativasNaJanela(item, agora).length;
    return `O guia pede ${tentativasMinimas(item.kind)} tentativas em ${JANELA_TENTATIVAS_DIAS} dias sem resposta (ou ${ABANDONO_DIAS} dias sem retorno). Até agora: ${feitas}.`;
  }

  if (/^\[Encerrado\]\s*Engano/i.test(final)) return null;

  const falta = checklist(item, tipos)
    .filter((c) => c.obrigatorio && !c.ok)
    .map((c) => c.label.toLowerCase());

  return falta.length ? `Falta: ${falta.join("; ")}.` : null;
}

/* ============================================================
   CHECKLIST DE ENCERRAMENTO
============================================================ */

export interface ChecklistItem {
  label: string;
  ok: boolean;
  /** Impede o encerramento enquanto não estiver cumprido. */
  obrigatorio: boolean;
}

/**
 * O checklist do guia, calculado sobre o registro.
 *
 * É a trava que impede "encerrar" virar um clique sem lastro: os itens
 * obrigatórios precisam estar cumpridos para o botão liberar.
 */
export function checklist(
  item: NpsResponseView,
  tipos: NpsKindOption[] = TIPOS_PADRAO
): ChecklistItem[] {

  const regra = tipoPorNome(tipos, item.kind);

  /**
   * Quem exige causa raiz sai do **cadastro**, não de três nomes.
   *
   * Era `item.kind === "Reclamação" || ...` aqui dentro. Com o tipo
   * virando cadastro, isso voltaria a ser o defeito que o cadastro
   * existe para tirar: um tipo novo nasceria sem a exigência, e a série
   * de causa raiz ganharia um buraco que ninguém veria.
   */
  const precisaCausa = Boolean(regra?.requiresRootCause);

  /* Engano é controle interno; Falta de Retorno é justamente o contato que não aconteceu. */
  const engano = item.kind === "Engano";
  const faltaDeRetorno = item.kind === "Falta de Retorno";

  return [
    {
      label: "Segmento de NPS identificado",
      // Sempre verdadeiro: sai da nota. Fica na lista porque o guia pede.
      ok: true,
      obrigatorio: true,
    },
    {
      label: "Tipo de tratativa classificado",
      ok: Boolean(item.kind),
      obrigatorio: true,
    },
    {
      label: "Causa raiz marcada",
      ok: !precisaCausa || Boolean(item.rootCause),
      obrigatorio: precisaCausa,
    },
    {
      label: "Cliente contatado",
      ok: Boolean(item.firstContactAt),
      obrigatorio: !engano,
    },
    {
      /*
        "A solução ou retorno foi registrado no sistema?" — item do
        checklist do guia que faltava: sem ele, uma tentativa sem
        resposta (que já conta como contato) bastava para encerrar
        como resolvido.
      */
      label: "Solução ou retorno registrado",
      ok: Boolean(item.postContactAt),
      obrigatorio: !engano && !faltaDeRetorno,
    },
    {
      label: "Responsável definido",
      ok: Boolean(item.owner),
      obrigatorio: false,
    },
    {
      label: "Cliente confirmou que resolveu",
      ok: Boolean(item.confirmedAt),
      obrigatorio: Boolean(regra?.requiresConfirmation),
    },
  ];
}

export function podeEncerrar(
  item: NpsResponseView,
  tipos: NpsKindOption[] = TIPOS_PADRAO
) {
  return checklist(item, tipos).every(
    (c) => !c.obrigatorio || c.ok
  );
}

/**
 * Status sugerido quando falta a confirmação do cliente.
 *
 * O guia é explícito: sem a resposta de reengajamento ("isso resolveu
 * sua questão?"), o loop **não** vai para resolvido.
 */
export function statusSemConfirmacao(
  kind?: string | null,
  tipos: NpsKindOption[] = TIPOS_PADRAO
) {
  return tipoPorNome(tipos, kind)?.requiresConfirmation
    ? STATUS_AGUARDANDO
    : undefined;
}

/* ============================================================
   INDICADORES
============================================================ */

export interface NpsSummary {
  total: number;
  promotores: number;
  passivos: number;
  detratores: number;
  /** −100 a 100. */
  score: number;
  /** Média das notas, 0–10. */
  media: number;
  /** Quantos ainda não tiveram primeiro contato dentro do prazo. */
  estourados: number;
  abertos: number;
}

export function summarize(
  itens: NpsResponseView[],
  agora = new Date()
): NpsSummary {

  const total = itens.length;

  const conta = (rotulo: NpsSegment) =>
    itens.filter(
      (i) => segmentOf(i.score).label === rotulo
    ).length;

  const promotores = conta("Promotor");
  const passivos = conta("Passivo");
  const detratores = conta("Detrator");

  /**
   * Fórmula oficial do NPS: % promotores − % detratores. Neutro entra
   * no total mas não soma nem subtrai — é o que torna a nota sensível a
   * quem está no meio sem opinião forte.
   */
  const score =
    total === 0
      ? 0
      : Math.round(
          ((promotores - detratores) / total) * 100
        );

  const media =
    total === 0
      ? 0
      : Math.round(
          (itens.reduce((s, i) => s + i.score, 0) /
            total) *
            10
        ) / 10;

  return {
    total,
    promotores,
    passivos,
    detratores,
    score,
    media,
    estourados: itens.filter(
      (i) => slaState(i, agora) === "estourado"
    ).length,
    abertos: itens.filter(
      (i) => !isEncerrado(i.status)
    ).length,
  };
}

/** Distribuição por segmento, para a barra da tela. */
export function bySegment(itens: NpsResponseView[]) {
  return SEGMENTS.map((s) => {

    const value = itens.filter(
      (i) => segmentOf(i.score).label === s.label
    ).length;

    return {
      label: s.label,
      value,
      percent:
        itens.length === 0
          ? 0
          : Math.round(
              (value / itens.length) * 1000
            ) / 10,
      color: s.color,
    };
  });
}

/* ============================================================
   TENDÊNCIA
============================================================ */

export interface PontoDeTendencia {
  /** "2026-08" — a chave, para ordenar sem depender do rótulo. */
  chave: string;
  /** "ago/26" — o que a tela mostra. */
  rotulo: string;
  score: number;
  media: number;
  total: number;
  promotores: number;
  passivos: number;
  detratores: number;
  /** Quantas trouxeram comentário — a base do que dá para trabalhar. */
  comentarios: number;
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * O NPS mês a mês.
 *
 * **A nota é recalculada em cada mês, não a média das notas mensais.**
 * São coisas diferentes quando os meses têm tamanhos diferentes, e a
 * segunda é a que produz um número plausível e errado.
 *
 * Meses sem resposta nenhuma **não** entram: uma linha caindo a zero
 * num mês vazio se lê como piora, quando é ausência de dado.
 */
export function trendByMonth(
  itens: NpsResponseView[],
  meses = 12
): PontoDeTendencia[] {

  const porMes = new Map<string, NpsResponseView[]>();

  for (const item of itens) {

    /*
      O mês de São Paulo. `respondedAt` é ISO em UTC: cortar o texto
      punha a resposta do último dia do mês, dada depois das 21h, no mês
      seguinte da tendência.
    */
    const chave = diaNaOperacao(item.respondedAt).slice(0, 7);

    const lista = porMes.get(chave);

    if (lista) lista.push(item);
    else porMes.set(chave, [item]);
  }

  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-meses)
    .map(([chave, doMes]) => {

      const resumo = summarize(doMes);

      const [ano, mes] = chave.split("-");

      return {
        chave,
        rotulo: `${MESES[Number(mes) - 1] ?? mes}/${ano.slice(2)}`,
        score: resumo.score,
        media: resumo.media,
        total: resumo.total,
        promotores: resumo.promotores,
        passivos: resumo.passivos,
        detratores: resumo.detratores,
        comentarios: doMes.filter(
          (i) => i.comment.trim() !== ""
        ).length,
      };
    });
}

/**
 * Distribuição da régua de humor — o **depois** do contato.
 *
 * A nota do NPS é de antes e não se reescreve. Esta é a única leitura
 * que responde se o atendimento moveu a agulha, e ela só existe sobre
 * quem teve pós-contato registrado — por isso a conta é sobre esses, e
 * não sobre a base inteira: dividir por 868 quando 40 têm registro
 * transformaria um indicador de recuperação num indicador de cobertura.
 */
export function byMood(itens: NpsResponseView[]) {

  const comRegistro = itens.filter(
    (item) => typeof item.moodAfter === "number"
  );

  return MOODS.map((passo) => {

    const value = comRegistro.filter(
      (item) => item.moodAfter === passo.value
    ).length;

    return {
      label: `${passo.emoji} ${passo.label}`,
      value,
      percent:
        comRegistro.length === 0
          ? 0
          : Math.round(
              (value / comRegistro.length) * 1000
            ) / 10,
      color: passo.color,
    };
  });
}

/**
 * Recuperação: de quem saiu do contato bem, entre os que registraram.
 *
 * "Satisfeito" ou "Encantado" na régua — 4 e 5. É o que responde se a
 * operação conseguiu fazer alguma coisa a respeito, que é diferente de
 * saber que o cliente estava insatisfeito.
 */
export function recuperacao(itens: NpsResponseView[]) {

  const comRegistro = itens.filter(
    (item) => typeof item.moodAfter === "number"
  );

  const bons = comRegistro.filter(
    (item) => (item.moodAfter ?? 0) >= 4
  ).length;

  return {
    comRegistro: comRegistro.length,
    recuperados: bons,
    percent:
      comRegistro.length === 0
        ? 0
        : Math.round(
            (bons / comRegistro.length) * 100
          ),
  };
}

/** Ranking por tipo de tratativa — o que mais chega. */
export function byKind(itens: NpsResponseView[]) {

  const mapa = new Map<string, number>();

  for (const item of itens) {
    const chave = item.kind ?? "Não classificado";
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }

  const total = itens.length;

  return [...mapa.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent:
        total === 0
          ? 0
          : Math.round((value / total) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Ranking de causa raiz — onde investir para parar de sangrar.
 *
 * **O percentual é sobre tudo que poderia ter causa raiz**, e não sobre
 * o que já foi classificado. A diferença não é acadêmica: na base real
 * havia 89 respostas com comentário e **uma** classificada, e dividir
 * pelo classificado devolvia "Outro — 100%".
 *
 * Cem por cento é uma afirmação forte numa tela chamada "onde investir
 * para parar de perder cliente". Ela diria que a operação inteira tem
 * uma causa só, quando o que existe é uma amostra de um. Sobre a
 * população certa, o mesmo dado vira "Outro — 1,1%", que é verdade e
 * ainda escancara o buraco de classificação.
 *
 * A população certa é quem escreveu alguma coisa: sem comentário não há
 * o que classificar, e contar essas respostas no denominador diluiria o
 * indicador com quem nunca teve chance de entrar nele.
 */
export function byRootCause(itens: NpsResponseView[]) {

  const mapa = new Map<string, number>();

  for (const item of itens) {
    if (!item.rootCause) continue;
    mapa.set(
      item.rootCause,
      (mapa.get(item.rootCause) ?? 0) + 1
    );
  }

  const classificaveis = itens.filter(
    (item) =>
      item.rootCause || item.comment.trim() !== ""
  ).length;

  return [...mapa.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent:
        classificaveis === 0
          ? 0
          : Math.round(
              (value / classificaveis) * 1000
            ) / 10,
    }))
    .sort((a, b) => b.value - a.value);
}

/* ============================================================
   OS INDICADORES DO GUIA
============================================================ */

export interface IndicadoresDoGuia {
  detratores: number;
  /** Detratores com primeiro contato (tentativa ou conversa registrada). */
  detratoresContatados: number;
  percentualContatados: number | null;
  /** Detratores com a régua de humor registrada depois do contato. */
  detratoresComHumor: number;
  /** Média da régua (1 a 5) entre esses. */
  humorMedioDoDetrator: number | null;
  /** Detratores que saíram do contato satisfeitos ou encantados (4 e 5). */
  detratoresRecuperados: number;
  promotores: number;
  indicacoes: number;
  indicacoesPedidas: number;
  reviewsNoGoogle: number;
  reviewsPedidas: number;
  aceitaramCase: number;
  casesPedidos: number;
}

/**
 * A tabela de indicadores do guia, calculada.
 *
 * "% de detratores contatados" conta a primeira tentativa, que é o que o
 * SLA do segmento mede. "Humor do detrator após resolução" é a régua de
 * quem teve pós-contato — sobre esses, e não sobre a base, pelo mesmo
 * motivo de `recuperacao`. Indicações e avaliações no Google são o que
 * **voltou** das ações do promotor, e não o que foi pedido.
 */
export function indicadoresDoGuia(itens: NpsResponseView[]): IndicadoresDoGuia {

  const detratores = itens.filter((i) => segmentOf(i.score).label === "Detrator");
  const promotores = itens.filter((i) => segmentOf(i.score).label === "Promotor");

  const contatados = detratores.filter((i) => i.firstContactAt).length;
  const comHumor = detratores.filter((i) => typeof i.moodAfter === "number");

  return {
    detratores: detratores.length,
    detratoresContatados: contatados,
    percentualContatados: detratores.length ? Math.round((contatados / detratores.length) * 100) : null,
    detratoresComHumor: comHumor.length,
    humorMedioDoDetrator: comHumor.length
      ? Math.round((comHumor.reduce((s, i) => s + (i.moodAfter ?? 0), 0) / comHumor.length) * 10) / 10
      : null,
    detratoresRecuperados: comHumor.filter((i) => (i.moodAfter ?? 0) >= 4).length,
    promotores: promotores.length,
    indicacoes: itens.reduce((s, i) => s + (i.indicacoes ?? 0), 0),
    indicacoesPedidas: itens.filter((i) => i.referralAsked).length,
    reviewsNoGoogle: itens.filter((i) => i.reviewFeita === true).length,
    reviewsPedidas: itens.filter((i) => i.reviewAsked).length,
    aceitaramCase: itens.filter((i) => i.aceitaCase === true).length,
    casesPedidos: itens.filter((i) => i.testimonialAsked).length,
  };
}

/* ============================================================
   TRIAGEM DO QUE ESTÁ PARADO
============================================================ */

export type NivelDeTriagem = "detrator-critico" | "detrator" | "neutro" | "promotor";

export const ROTULO_DA_TRIAGEM: Record<NivelDeTriagem, string> = {
  "detrator-critico": "Detratores críticos",
  detrator: "Detratores",
  neutro: "Neutros",
  promotor: "Promotores",
};

const ORDEM_DA_TRIAGEM: NivelDeTriagem[] = ["detrator-critico", "detrator", "neutro", "promotor"];

/** "Vou cancelar", "trocar de sistema", "concorrente" — o aviso que chega no comentário. */
const FALA_EM_SAIR = /\bcancel|\bdesist|\btrocar de (sistema|plataforma)|\boutro sistema\b|\bconcorrente|\bparar de usar\b|\bencerrar (a |minha )?conta\b|\bsair d[ao] (card[áa]pio|sistema|plataforma)/i;

export interface ItemDeTriagem {
  item: NpsResponseView;
  nivel: NivelDeTriagem;
  /** Por que está neste nível — o que a tela mostra ao lado do nome. */
  motivos: string[];
  /** Minutos úteis até o prazo do 1º contato; negativo quando estourou. */
  folgaMin: number;
  /**
   * O prazo passou — pelo instante, e não pela folga.
   *
   * Visto no fim de semana, um prazo que venceu no sábado tem folga de
   * zero minuto útil (não há expediente entre os dois), e "zero" se lia
   * "vence agora". Estourado é o relógio de parede; a folga só mede.
   */
  estourado: boolean;
  /** A conta vinculada não está ativa: fica no fim do nível. */
  contaInativa: boolean;
}

/**
 * O nível da resposta na ordem da rotina, e por quê.
 *
 * Crítico é o detrator que falou em cancelar (marcado ou escrito), deu
 * nota de 0 a 3 ou relatou erro no sistema. Serve à triagem do que está
 * parado e à ordem do Meu dia — a mesma régua nos dois lugares.
 */
export function nivelDoNps(
  item: Pick<NpsResponseView, "score" | "churnRisk" | "comment" | "kind">
): { nivel: NivelDeTriagem; motivos: string[] } {

  const segmento = segmentOf(item.score).label;
  const motivos: string[] = [];

  let nivel: NivelDeTriagem =
    segmento === "Detrator" ? "detrator" : segmento === "Passivo" ? "neutro" : "promotor";

  if (nivel === "detrator") {
    if (item.churnRisk) motivos.push("marcado como risco de cancelamento");
    else if (FALA_EM_SAIR.test(item.comment)) motivos.push("fala em cancelar ou trocar");
    if (item.score <= 3) motivos.push(`nota ${item.score}`);
    if (item.kind === "Erro no Sistema") motivos.push("erro no sistema");
    if (motivos.length > 0) nivel = "detrator-critico";
  }

  return { nivel, motivos };
}

/** 0 para o detrator crítico, 3 para o promotor. */
export function ordemDoNivel(nivel: NivelDeTriagem) {
  return ORDEM_DA_TRIAGEM.indexOf(nivel);
}

/**
 * A fila do que está parado, na ordem da rotina.
 *
 * "Identificação de detratores críticos na base ativa; após isso seguir
 * para neutros" — o documento de acompanhamento do agente. Parado é o
 * ciclo aberto sem primeiro contato. Crítico é o detrator que falou em
 * cancelar (marcado ou escrito), deu nota de 0 a 3, ou relatou erro no
 * sistema — que o guia manda tratar como urgente para detrator.
 *
 * "Base ativa": a conta vinculada que não está ativa vai para o fim do
 * seu nível. Sem vínculo, a resposta conta como ativa — o NPS só é
 * respondido de dentro do portal, por quem ainda usa.
 *
 * Dentro do nível, o mais estourado primeiro.
 */
export function filaDeTriagem(
  itens: NpsResponseView[],
  opcoes: {
    agora?: Date;
    expediente?: Expediente;
    situacaoDaConta?: (establishmentId: string) => string | undefined;
  } = {}
): ItemDeTriagem[] {

  const agora = opcoes.agora ?? new Date();
  const expediente = opcoes.expediente ?? EXPEDIENTE_PADRAO;

  const fila: ItemDeTriagem[] = [];

  for (const item of itens) {

    if (isEncerrado(item.status) || item.firstContactAt) continue;

    const { nivel, motivos } = nivelDoNps(item);

    const situacao = item.establishmentId ? opcoes.situacaoDaConta?.(item.establishmentId) : undefined;
    const contaInativa = Boolean(situacao && !/^ativ/i.test(situacao));
    if (contaInativa) motivos.push(`conta ${situacao!.toLowerCase()}`);

    const prazo = new Date(item.firstContactDueAt);

    fila.push({
      item,
      nivel,
      motivos,
      folgaMin: minutosUteisEntre(agora, prazo, expediente),
      estourado: agora.getTime() > prazo.getTime(),
      contaInativa,
    });
  }

  return fila.sort(
    (a, b) =>
      ORDEM_DA_TRIAGEM.indexOf(a.nivel) - ORDEM_DA_TRIAGEM.indexOf(b.nivel) ||
      Number(a.contaInativa) - Number(b.contaInativa) ||
      Number(b.estourado) - Number(a.estourado) ||
      a.folgaMin - b.folgaMin ||
      a.item.score - b.item.score
  );
}
