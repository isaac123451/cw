import type { PrismaClient } from "@prisma/client";

/**
 * O dossiê, na estrutura de nove seções.
 *
 * **O que muda em relação ao que existia.** O dossiê era um campo de
 * texto que o modelo escrevia por inteiro — narrativa corrida, boa para
 * assumir um caso e imprópria para pedir moderação. Esta estrutura é
 * outra coisa: um documento que sustenta um pedido diante de terceiro,
 * e num documento desses **a data errada derruba o argumento inteiro**.
 *
 * Daí a regra que organiza este arquivo:
 *
 * > A linha do tempo, a identificação, as partes e o índice de anexos
 * > são **montados do banco**. O modelo não os escreve, não os
 * > reordena e não os completa.
 *
 * O modelo continua útil — sumário executivo, apuração, enquadramento e
 * pedido são texto e é isso que ele faz bem. Mas ele os escreve
 * **depois** e **a partir** da cronologia já fechada, que é exatamente a
 * ordem de montagem que a especificação manda seguir: congelar
 * evidência, fechar a linha do tempo, e só então escrever — inclusive o
 * sumário, que vem por último porque só aí se sabe o que a evidência
 * aguenta.
 *
 * **O que este módulo não pode fazer, e diz.** Print, áudio e e-mail com
 * cabeçalho não estão no banco: o sistema guarda o que ele mesmo
 * registrou — resposta pública, anotação interna, movimentação entre
 * áreas, avaliação, lembrete. Cada um vira anexo com nome padronizado e
 * conteúdo de verdade. O que falta é listado como **lacuna**, com o nome
 * de arquivo já reservado, em vez de ser omitido. Um dossiê que esconde
 * o que não tem é um dossiê que quebra na revisão do par.
 */

/* ============================================================
   O DOCUMENTO
============================================================ */

export interface EventoDaLinhaDoTempo {
  /** Posição na tabela numerada. */
  numero: number;
  /** ISO. Sempre existe — evento sem data não entra. */
  quando: string;
  /** Fato puro, sem adjetivo e sem interpretação. */
  evento: string;
  canal: string;
  /** "Anexo 03", ou vazio quando o fato não tem peça. */
  evidencia: string;
  /**
   * De qual registro do banco este evento saiu.
   *
   * Não vai para o documento final: serve para conferir que nenhuma
   * linha foi escrita à mão, e é o que a verificação usa.
   */
  origem: string;
}

export interface AnexoDoDossie {
  numero: number;
  /** `AAAA-MM-DD_canal_protocolo_anexo-01_descricao` */
  nome: string;
  descricao: string;
  /** O sistema tem o conteúdo, ou é uma peça que alguém precisa anexar? */
  noSistema: boolean;
  /** O conteúdo, quando o sistema o tem. */
  conteudo?: string;
}

export interface DossieMontado {

  /** 1. Identificação */
  identificacao: {
    titulo: string;
    protocolo: string;
    canal: string;
    abertoEm: string;
    montadoPor: string;
    montadoEm: string;
    destinatario: string;
    pedido: string;
  };

  /** 2. Sumário executivo — escrito por último, fora daqui. */
  sumario?: string;

  /** 3. Partes envolvidas */
  partes: {
    consumidor: string;
    contato: string[];
    estabelecimento?: string;
    documento?: string;
    setoresAcionados: string[];
  };

  /** 4. Linha do tempo */
  linhaDoTempo: EventoDaLinhaDoTempo[];

  /** 5. Evidências */
  anexos: AnexoDoDossie[];

  /** 6, 7, 8 — texto, escrito depois da cronologia fechar. */
  apuracao?: {
    verificado: string[];
    sustentadoPelaEvidencia: string[];
    alegacaoSemProva: string[];
  };
  enquadramento?: string;
  conclusao?: string;

  /** 9. Controle de versão */
  versao: {
    numero: number;
    geradoEm: string;
    base: string;
  };

  /** O que o sistema não tem e alguém precisa juntar. */
  lacunas: string[];
}

/* ============================================================
   NOMES DE ARQUIVO
============================================================ */

/** Sem acento, minúsculo, hífen no lugar de espaço. */
function pedaco(texto: string, limite = 40) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limite)
    .replace(/-+$/g, "");
}

/**
 * `AAAA-MM-DD_canal_protocolo_anexo-01_descricao`
 *
 * O padrão é da especificação e existe por um motivo prático: quinze
 * prints com nome solto viram uma revisão impossível. Com data na
 * frente, a pasta se ordena sozinha na cronologia do caso.
 */
export function nomeDeAnexo(entrada: {
  data: string;
  canal: string;
  protocolo: string;
  numero: number;
  descricao: string;
}) {

  const dia = entrada.data.slice(0, 10);

  const n = String(entrada.numero).padStart(2, "0");

  return [
    dia,
    pedaco(entrada.canal, 20),
    pedaco(entrada.protocolo, 30),
    `anexo-${n}`,
    pedaco(entrada.descricao),
  ].join("_");
}

/* ============================================================
   A MONTAGEM
============================================================ */

function iso(valor: Date | string | null | undefined) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Monta as seções que saem do banco.
 *
 * Devolve `null` quando o protocolo não existe — não monta documento
 * sobre caso que não está lá.
 */
export async function montarDossie(
  prisma: PrismaClient,
  protocolo: string,
  contexto: {
    montadoPor: string;
    destinatario?: string;
    pedido?: string;
  }
): Promise<DossieMontado | null> {

  const caso = await prisma.case.findFirst({
    where: {
      OR: [
        { protocol: protocolo },
        { externalId: protocolo },
      ],
    },
    include: {
      establishment: {
        select: { name: true, document: true },
      },
      movements: { orderBy: { startedAt: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
      tasks: { orderBy: { createdAt: "asc" } },
      category: { select: { name: true } },
    },
  });

  if (!caso) return null;

  const eventos: Omit<EventoDaLinhaDoTempo, "numero">[] = [];
  const anexos: AnexoDoDossie[] = [];
  const lacunas: string[] = [];

  const canalDoCaso =
    caso.channel === "RECLAME_AQUI"
      ? "Reclame Aqui"
      : caso.channel === "INSTAGRAM"
        ? "Instagram"
        : caso.channel;

  /** Cria o anexo e devolve o rótulo para a linha do tempo. */
  function anexar(entrada: {
    data: string;
    descricao: string;
    conteudo?: string;
    canal?: string;
  }) {

    const numero = anexos.length + 1;

    anexos.push({
      numero,
      nome: nomeDeAnexo({
        data: entrada.data,
        canal: entrada.canal ?? canalDoCaso,
        protocolo: caso!.protocol,
        numero,
        descricao: entrada.descricao,
      }),
      descricao: entrada.descricao,
      noSistema: Boolean(entrada.conteudo),
      conteudo: entrada.conteudo,
    });

    return `Anexo ${String(numero).padStart(2, "0")}`;
  }

  /* ---------- abertura ---------- */

  const abertura = iso(caso.publishedAt ?? caso.createdAt);

  if (abertura) {
    eventos.push({
      quando: abertura,
      evento: `Reclamação registrada pelo consumidor${
        caso.title ? `: "${caso.title}"` : ""
      }`,
      canal: canalDoCaso,
      evidencia: anexar({
        data: abertura,
        descricao: "relato do consumidor",
        conteudo: caso.description || undefined,
      }),
      origem: "Case.publishedAt",
    });

    if (!caso.description?.trim()) {
      lacunas.push(
        "O relato do consumidor não está gravado — sem ele o dossiê afirma o que aconteceu sem a peça que sustenta."
      );
    }
  }

  /* ---------- resposta pública ---------- */

  const respondidoEm = iso(caso.publicResponseAt);

  if ((caso.publicResponse ?? "").trim()) {

    /*
      Resposta sem data vira lacuna, não vira evento sem data.

      A tabela é cronológica; uma linha sem quando não tem onde entrar
      e destruiria a ordem que sustenta o argumento.
    */
    if (!respondidoEm) {
      lacunas.push(
        "Há resposta pública gravada, mas sem data. Sem ela o evento não entra na cronologia — confira no portal quando foi publicada."
      );
    } else {
      eventos.push({
        quando: respondidoEm,
        evento: "Empresa respondeu publicamente",
        canal: canalDoCaso,
        evidencia: anexar({
          data: respondidoEm,
          descricao: "resposta publica da empresa",
          conteudo: caso.publicResponse ?? undefined,
        }),
        origem: "Case.publicResponseAt",
      });
    }
  }

  /* ---------- movimentações entre áreas ---------- */

  const setores = new Set<string>();

  for (const m of caso.movements) {

    const quando = iso(m.startedAt);
    if (!quando) continue;

    setores.add(m.destination);

    eventos.push({
      quando,
      evento: `Caso encaminhado para ${m.destination} por ${m.actor}. Motivo registrado: ${m.reason}`,
      canal: "Interno",
      evidencia: anexar({
        data: quando,
        descricao: `encaminhamento ${m.destination}`,
        conteudo: `Destino: ${m.destination}\nMotivo: ${m.reason}\nPor: ${m.actor}\nPrazo acordado: ${m.dueHours}h`,
        canal: "interno",
      }),
      origem: `CaseMovement.${m.id}`,
    });

    const voltou = iso(m.returnedAt);

    if (voltou) {
      eventos.push({
        quando: voltou,
        evento: `${m.destination} devolveu o caso${
          m.outcome ? `. Desfecho registrado: ${m.outcome}` : ", sem desfecho registrado"
        }`,
        canal: "Interno",
        evidencia: "",
        origem: `CaseMovement.${m.id}.returnedAt`,
      });
    }
  }

  /* ---------- anotações internas ---------- */

  for (const c of caso.comments) {

    const quando = iso(c.createdAt);
    if (!quando) continue;

    eventos.push({
      quando,
      evento: `Anotação interna registrada por ${c.author?.name ?? "autor não identificado"}`,
      canal: "Interno",
      evidencia: anexar({
        data: quando,
        descricao: "anotacao interna",
        conteudo: c.body,
        canal: "interno",
      }),
      origem: `CaseComment.${c.id}`,
    });
  }

  /* ---------- lembretes e tentativas ---------- */

  for (const t of caso.tasks) {

    const quando = iso(t.createdAt);
    if (!quando) continue;

    /**
     * Tentativa de contato sem retorno entra como evento.
     *
     * É o que mais pesa em pedido de moderação: mostra que a empresa
     * procurou e não foi atendida. Omitir isso é jogar fora o
     * argumento mais forte que o caso costuma ter.
     */
    eventos.push({
      quando,
      evento: `${t.title}${t.done ? " — concluído" : " — registrado e ainda em aberto"}`,
      canal: "Agenda",
      evidencia: "",
      origem: `AgendaTask.${t.id}`,
    });
  }

  /* ---------- avaliação do consumidor ---------- */

  const avaliadoEm = iso(caso.evaluatedAt);

  if (avaliadoEm && caso.evaluated) {
    eventos.push({
      quando: avaliadoEm,
      evento: `Consumidor avaliou o atendimento${
        caso.score !== null && caso.score !== undefined
          ? `: nota ${caso.score}`
          : ""
      }${caso.resolved ? ", marcando como resolvido" : ", sem marcar como resolvido"}`,
      canal: canalDoCaso,
      evidencia: "",
      origem: "Case.evaluatedAt",
    });
  }

  /* ---------- ordena e numera ---------- */

  eventos.sort((a, b) => a.quando.localeCompare(b.quando));

  const linhaDoTempo: EventoDaLinhaDoTempo[] = eventos.map(
    (e, i) => ({ ...e, numero: i + 1 })
  );

  /* ---------- lacunas conhecidas ---------- */

  /* No banco a coluna chama `externalUrl`; `raUrl` é o nome no modelo. */
  if (
    caso.channel === "RECLAME_AQUI" &&
    !caso.externalUrl
  ) {
    lacunas.push(
      "Falta o endereço da reclamação no portal. Um print da página, com URL e data visíveis, é a peça que prova o estado público do caso."
    );
  }

  if (linhaDoTempo.length < 2) {
    lacunas.push(
      "A cronologia tem menos de dois eventos. Segundo a própria montagem, buraco na linha do tempo é sinal de apuração faltando — não de documento pronto."
    );
  }

  const contato = [
    caso.email && `e-mail ${caso.email}`,
    caso.phone && `telefone ${caso.phone}`,
    caso.city &&
      `${caso.city}${caso.state ? `/${caso.state}` : ""}`,
  ].filter(Boolean) as string[];

  const agora = new Date().toISOString();

  return {
    identificacao: {
      titulo: caso.title || "(sem título registrado)",
      protocolo: caso.protocol,
      canal: canalDoCaso,
      abertoEm: abertura ?? "(sem data de abertura)",
      montadoPor: contexto.montadoPor,
      montadoEm: agora,
      destinatario:
        contexto.destinatario ?? "(a definir)",
      pedido: contexto.pedido ?? "(a definir)",
    },

    partes: {
      consumidor: caso.customer,
      contato,
      estabelecimento: caso.establishment?.name,
      documento:
        caso.establishment?.document ??
        caso.document ??
        undefined,
      setoresAcionados: [...setores],
    },

    linhaDoTempo,
    anexos,

    versao: {
      numero: 1,
      geradoEm: agora,
      base: `caso ${caso.protocol}, ${linhaDoTempo.length} evento(s), ${anexos.length} anexo(s)`,
    },

    lacunas,
  };
}

/* ============================================================
   A REVISÃO DO PAR, EM CÓDIGO
============================================================ */

/**
 * "Alguma afirmação sem anexo correspondente?"
 *
 * É a última etapa da montagem, e a especificação pede que um par a
 * faça olhando uma coisa só. Parte dela dá para fazer aqui, e o que dá
 * é justamente o que o olho humano erra depois de quinze prints:
 * numeração fora de ordem, anexo citado que não existe, evento sem
 * data, cronologia desordenada.
 *
 * Não substitui a leitura de um colega — não sabe se o argumento se
 * sustenta. Substitui a conferência mecânica, que é onde o cansaço
 * entra.
 */
export function conferirDossie(
  d: DossieMontado
): string[] {

  const problemas: string[] = [];

  /* A cronologia está em ordem e numerada sem buraco? */
  for (let i = 0; i < d.linhaDoTempo.length; i += 1) {

    const e = d.linhaDoTempo[i];

    if (e.numero !== i + 1) {
      problemas.push(
        `O evento "${e.evento.slice(0, 40)}" está com o número ${e.numero} na posição ${i + 1}.`
      );
    }

    if (!e.quando) {
      problemas.push(
        `Evento sem data: "${e.evento.slice(0, 60)}". Linha sem quando não tem lugar na cronologia.`
      );
    }

    if (
      i > 0 &&
      e.quando < d.linhaDoTempo[i - 1].quando
    ) {
      problemas.push(
        `A cronologia sai da ordem no evento ${e.numero}.`
      );
    }
  }

  /* Todo anexo citado existe? */
  const existentes = new Set(
    d.anexos.map(
      (a) => `Anexo ${String(a.numero).padStart(2, "0")}`
    )
  );

  for (const e of d.linhaDoTempo) {
    if (e.evidencia && !existentes.has(e.evidencia)) {
      problemas.push(
        `O evento ${e.numero} cita ${e.evidencia}, que não está no índice.`
      );
    }
  }

  /* E todo anexo é citado por algum evento? */
  const citados = new Set(
    d.linhaDoTempo.map((e) => e.evidencia).filter(Boolean)
  );

  for (const a of d.anexos) {

    const rotulo = `Anexo ${String(a.numero).padStart(2, "0")}`;

    if (!citados.has(rotulo)) {
      problemas.push(
        `${rotulo} (${a.descricao}) não é referenciado por nenhum evento — anexo solto não sustenta nada.`
      );
    }
  }

  /*
    O texto escrito não pode citar anexo inexistente.

    É o erro que a revisão do par procura: a conclusão afirma algo
    apoiada numa peça que ficou de fora do envio.
  */
  const escrito = [
    d.sumario,
    d.enquadramento,
    d.conclusao,
    ...(d.apuracao?.verificado ?? []),
    ...(d.apuracao?.sustentadoPelaEvidencia ?? []),
    ...(d.apuracao?.alegacaoSemProva ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  for (const m of escrito.matchAll(/Anexo\s+(\d{1,2})/gi)) {

    const rotulo = `Anexo ${m[1].padStart(2, "0")}`;

    if (!existentes.has(rotulo)) {
      problemas.push(
        `O texto cita ${rotulo}, que não existe no índice.`
      );
    }
  }

  return problemas;
}

/* ============================================================
   O DOCUMENTO EM TEXTO
============================================================ */

function dataHora(iso: string) {

  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;

  const d = new Date(iso);

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * O dossiê em texto, na ordem das nove seções.
 *
 * Markdown, e não PDF: o PDF é o formato de envio e sai de uma
 * conversão, mas o que precisa estar certo é o conteúdo e a ordem. Sai
 * daqui pronto para copiar, revisar e converter.
 */
export function renderizarDossie(
  d: DossieMontado
): string {

  const l: string[] = [];

  const secao = (n: number, titulo: string) =>
    l.push("", `## ${n}. ${titulo}`, "");

  l.push(`# Dossiê — ${d.identificacao.titulo}`);

  secao(1, "Identificação");
  l.push(
    `- **Protocolo:** ${d.identificacao.protocolo}`,
    `- **Canal de origem:** ${d.identificacao.canal}`,
    `- **Aberto em:** ${dataHora(d.identificacao.abertoEm)}`,
    `- **Montado por:** ${d.identificacao.montadoPor}`,
    `- **Montado em:** ${dataHora(d.identificacao.montadoEm)}`,
    `- **Destinatário:** ${d.identificacao.destinatario}`,
    `- **Pedido:** ${d.identificacao.pedido}`
  );

  secao(2, "Sumário executivo");
  l.push(
    d.sumario ??
      "_A escrever, depois de fechada a linha do tempo — é a última seção a ser redigida, quando já se sabe o que a evidência aguenta._"
  );

  secao(3, "Partes envolvidas");
  l.push(`- **Consumidor:** ${d.partes.consumidor}`);
  if (d.partes.contato.length) {
    l.push(`- **Contato:** ${d.partes.contato.join(" · ")}`);
  }
  if (d.partes.estabelecimento) {
    l.push(
      `- **Estabelecimento parceiro:** ${d.partes.estabelecimento}${
        d.partes.documento
          ? ` (${d.partes.documento})`
          : ""
      }`
    );
  }
  l.push(
    `- **Setores internos acionados:** ${
      d.partes.setoresAcionados.length
        ? d.partes.setoresAcionados.join(", ")
        : "nenhum registrado"
    }`
  );

  secao(4, "Linha do tempo");

  if (d.linhaDoTempo.length === 0) {
    l.push(
      "_Nenhum evento datado no sistema para este caso._"
    );
  } else {
    l.push(
      "| # | Data/hora | Evento | Canal | Evidência |",
      "|---|---|---|---|---|"
    );

    for (const e of d.linhaDoTempo) {
      l.push(
        `| ${e.numero} | ${dataHora(e.quando)} | ${e.evento.replace(/\|/g, "\\|")} | ${e.canal} | ${e.evidencia || "—"} |`
      );
    }
  }

  secao(5, "Evidências");

  if (d.anexos.length === 0) {
    l.push("_Nenhuma peça registrada._");
  } else {
    for (const a of d.anexos) {
      l.push(
        `**Anexo ${String(a.numero).padStart(2, "0")}** — ${a.descricao}`,
        `\`${a.nome}\``,
        a.noSistema
          ? "Conteúdo registrado no sistema."
          : "**Peça a anexar** — o sistema não guarda este conteúdo.",
        ""
      );
    }
  }

  secao(6, "Apuração");

  if (!d.apuracao) {
    l.push(
      "_A escrever. Separar explicitamente: o que foi verificado internamente, o que a evidência sustenta, e o que é apenas alegação da outra parte._"
    );
  } else {
    l.push("**Verificado internamente**");
    for (const i of d.apuracao.verificado) l.push(`- ${i}`);
    l.push("", "**Sustentado pela evidência**");
    for (const i of d.apuracao.sustentadoPelaEvidencia)
      l.push(`- ${i}`);
    l.push("", "**Alegação da outra parte, sem prova**");
    for (const i of d.apuracao.alegacaoSemProva)
      l.push(`- ${i}`);
  }

  secao(7, "Enquadramento");
  l.push(
    d.enquadramento ??
      "_A escrever: a regra que embasa o pedido — regulamento do RA, cláusula contratual ou política interna. Citar o trecho e conectá-lo ao fato._"
  );

  secao(8, "Conclusão e pedido");
  l.push(
    d.conclusao ??
      "_A escrever: uma coisa por vez. Redirecionamento, remoção, retenção ou escalonamento — não três alternativas no mesmo parágrafo._"
  );

  secao(9, "Índice de anexos e controle de versão");

  for (const a of d.anexos) {
    l.push(
      `${String(a.numero).padStart(2, "0")}. ${a.descricao} — \`${a.nome}\`${a.noSistema ? "" : " *(a anexar)*"}`
    );
  }

  l.push(
    "",
    `Versão ${d.versao.numero} · gerada em ${dataHora(d.versao.geradoEm)} · ${d.versao.base}`
  );

  if (d.lacunas.length) {
    l.push("", "---", "", "### O que falta antes de enviar", "");
    for (const g of d.lacunas) l.push(`- ${g}`);
  }

  return l.join("\n");
}
