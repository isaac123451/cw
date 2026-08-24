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
  TENTATIVAS_MINIMAS,
  tipoPorNome,
  TIPOS_PADRAO,
} from "@/lib/models/nps";

/* ============================================================
   PRAZO EM HORAS ÚTEIS
============================================================ */

/**
 * Sábado e domingo não contam.
 *
 * "24 horas úteis" é lido como 24 horas de relógio que caem em dia
 * útil — a interpretação mais simples de explicar para a operação e de
 * conferir num caso concreto. Feriado não entra: exigiria um calendário
 * mantido à mão, que envelheceria calado.
 */
function ehDiaUtil(d: Date) {
  const dia = d.getUTCDay();
  return dia !== 0 && dia !== 6;
}

/** Soma horas úteis a partir de uma data, pulando fim de semana. */
export function prazoUtil(
  inicio: Date,
  horasUteis: number
): Date {

  const cursor = new Date(inicio.getTime());

  let restantes = Math.max(horasUteis, 0);

  // Passo de uma hora: simples de auditar e barato no volume desta tela.
  while (restantes > 0) {
    cursor.setUTCHours(cursor.getUTCHours() + 1);
    if (ehDiaUtil(cursor)) restantes -= 1;
  }

  return cursor;
}

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
  tipos: NpsKindOption[] = TIPOS_PADRAO
): Date {

  const regra = tipoPorNome(tipos, kind);

  const horas =
    regra?.ownDeadlineHours ??
    segmentOf(score).slaHoursUteis;

  return prazoUtil(respondedAt, horas);
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

  const horas =
    (prazo.getTime() - agora.getTime()) / 3600000;

  return horas <= 24 ? "vence-hoje" : "no-prazo";
}

/**
 * Deve encerrar sozinho por falta de retorno?
 *
 * Duas portas, as duas do guia: três tentativas dentro da janela de 7
 * dias, ou 30 dias sem qualquer resposta do cliente.
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

  const naJanela = item.attempts.filter(
    (a) => dias(a.createdAt) <= JANELA_TENTATIVAS_DIAS
  );

  if (naJanela.length >= TENTATIVAS_MINIMAS) {
    return {
      deve: true,
      motivo: `${naJanela.length} tentativas em ${JANELA_TENTATIVAS_DIAS} dias, sem resposta.`,
    };
  }

  if (dias(item.respondedAt) >= ABANDONO_DIAS) {
    return {
      deve: true,
      motivo: `${ABANDONO_DIAS} dias sem qualquer resposta.`,
    };
  }

  return { deve: false };
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
      obrigatorio: true,
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

    const chave = item.respondedAt.slice(0, 7);

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
