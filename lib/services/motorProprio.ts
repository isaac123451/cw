import type { Case } from "@/lib/models/case";
import { normalizarTexto, REGRAS_DE_ASSUNTO } from "@/lib/models/sugestaoPorTexto";

/**
 * O motor próprio: lê e resume uma conversa sem nenhuma IA externa
 * (roadmap 2.0, Fase 16).
 *
 * **A decisão do Isaac.** "Quero algo gratuito, se o Anthropic for você
 * pode utilizar, caso contrário trabalhe no agente de IA que você fez
 * para eu utilizar na plataforma e melhorar." A chave da Anthropic é um
 * marcador do `.env.example`; a do Gemini é real, mas tem camada
 * gratuita — e camada gratuita congestiona (medido em 26/08/2026: 503
 * "Gemini congestionado", e o resumo simplesmente não saía). Enquanto o
 * Groq e o OpenRouter não têm chave, o resumo de conversa dependia de
 * um provedor só. Agora não depende de nenhum: quando todos falham (ou
 * nenhum está configurado), este arquivo entrega o mesmo retrato —
 * resumo, assunto, humor, pendência, próximo passo e três rascunhos —
 * por conta e sem inventar nada que não esteja na conversa.
 *
 * **O que é deliberadamente diferente de um modelo de linguagem.** Não
 * há geração livre — cada campo sai de uma regra que se explica sozinha
 * (o léxico de humor, os assuntos da documentação, o estado da última
 * mensagem). É mais raso que a IA nas conversas complexas, e é exatamente
 * tão confiável quanto a regra que o escreveu — nunca inventa protocolo,
 * nome ou prazo, porque não escreve fora do que a conversa e as regras
 * já sabem.
 *
 * Sem banco e sem rede: a conferência prova sem nenhum dos dois.
 */

export interface RespostaPronta {
  titulo: string;
  quando: string;
  texto: string;
}

export interface RetratoDaConversa {
  resumo: string;
  assunto: string;
  humor: 1 | 2 | 3 | 4 | 5;
  pendencia: string;
  proximoPasso: string;
  resposta: string;
  respostas: [RespostaPronta, RespostaPronta, RespostaPronta];
  resolvido: boolean;
}

export interface MensagemDaConversa {
  de: "cliente" | "nos";
  texto: string;
}

/* ============================================================
   HUMOR — léxico de tom, em português do Brasil
============================================================ */

const POSITIVAS = [
  /\botim[oa]\b/, /\bexcelente\b/, /\bperfeit[oa]\b/, /\bador(ei|o)\b/, /\bmaravilh/, /\bshow\b/,
  /\bfuncionou\b/, /\bresolv(id[oa]|eu|emos)\b/, /\bobrigad[oa]/, /\bvaleu\b/, /\bparab[ée]ns\b/, /\bgrat[ao]/,
  /\bajudou\b/, /\btudo certo\b/, /\bdeu certo\b/, /\bfoi [óo]timo\b/, /\bmelhor sistema\b/,
];

const NEGATIVAS_FORTES = [
  /\bp[ée]ssim[oa]\b/, /\bhorr[íi]vel\b/, /\babsurd[oa]\b/, /\brid[íi]cul[oa]\b/, /\binaceit[áa]vel\b/,
  /\bcancel(ar|amento)\b/, /\bprocon\b/, /\bprocess(ar|o)\b/, /\bnunca mais\b/, /\brevoltad[oa]\b/,
  /\bindignad[oa]\b/, /\bdecep[cç]ion/, /\bp[ée]ssimo atendimento\b/, /\bincompetente\b/,
];

const NEGATIVAS_LEVES = [
  /\bn[ãa]o funciona\b/, /\bainda n[ãa]o\b/, /\bdemor(a|ando|ou)\b/, /\bsem resposta\b/, /\bsem retorno\b/,
  /\bat[ée] agora nada\b/, /\bn[ãa]o resolvid[oa]\b/, /\burgente\b/, /\bdif[íi]cil\b/, /\bcomplicado\b/,
  /\bnenhuma novidade\b/, /\bnada foi feito\b/,
];

function pontuarTom(texto: string): number {
  const t = normalizarTexto(texto);
  let n = 0;
  for (const p of POSITIVAS) if (p.test(t)) n += 1;
  for (const p of NEGATIVAS_FORTES) if (p.test(t)) n -= 2;
  for (const p of NEGATIVAS_LEVES) if (p.test(t)) n -= 1;
  return n;
}

/**
 * O humor de agora — as últimas mensagens do cliente pesam mais que as
 * de trás, porque "como o cliente está agora" é o que a trilha usa para
 * decidir o próximo passo, não o tom do começo da conversa.
 */
export function humorDaConversa(mensagens: MensagemDaConversa[]): 1 | 2 | 3 | 4 | 5 {
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  if (doCliente.length === 0) return 3;

  let pontos = 0;
  const n = doCliente.length;
  doCliente.forEach((m, i) => {
    /* A mais recente pesa 3×, a penúltima 2×, o resto 1×. */
    const peso = i >= n - 1 ? 3 : i >= n - 2 ? 2 : 1;
    pontos += pontuarTom(m.texto) * peso;
  });

  if (pontos <= -4) return 1;
  if (pontos <= -1) return 2;
  if (pontos === 0) return 3;
  if (pontos <= 2) return 4;
  return 5;
}

/**
 * O humor mudou ao longo da conversa?
 *
 * Compara as três últimas mensagens do cliente com as de antes. Só
 * responde com quatro ou mais mensagens dele: com menos, "antes" e
 * "agora" são a mesma frase, e qualquer tendência seria invenção.
 */
export function tendenciaDoHumor(mensagens: MensagemDaConversa[]): {
  antes: number;
  agora: number;
  piorou: boolean;
  melhorou: boolean;
} | null {
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  if (doCliente.length < 4) return null;
  const antes = humorDaConversa(doCliente.slice(0, -3));
  const agora = humorDaConversa(doCliente.slice(-3));
  return { antes, agora, piorou: agora < antes && agora <= 2, melhorou: agora > antes && antes <= 2 };
}

/* ============================================================
   ASSUNTO — as mesmas regras da triagem do Reclame Aqui
============================================================ */

export function assuntoDaConversa(mensagens: MensagemDaConversa[]): string {
  const texto = mensagens.map((m) => m.texto).join(" ");
  const normal = normalizarTexto(texto);
  const achado = REGRAS_DE_ASSUNTO.find((r) => r.padrao.test(normal));
  return achado?.rotulo ?? "Atendimento";
}

/* ============================================================
   RESUMO — extrativo: a primeira e a última fala do cliente
============================================================ */

function condensar(texto: string, limite = 160) {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > limite ? `${t.slice(0, limite - 1).trimEnd()}…` : t;
}

export function resumirTexto(mensagens: MensagemDaConversa[]): string {
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  if (doCliente.length === 0) return "O cliente ainda não escreveu nesta conversa.";

  const primeira = condensar(doCliente[0].texto);
  const ultima = condensar(doCliente[doCliente.length - 1].texto);

  if (doCliente.length === 1) return `O cliente relata: "${primeira}"`;
  if (primeira === ultima) return `O cliente insiste no mesmo ponto: "${primeira}"`;

  return `O cliente começou dizendo: "${primeira}" — e, mais recente, escreveu: "${ultima}"`;
}

/* ============================================================
   PENDÊNCIA E PRÓXIMO PASSO — pelo lado de quem falou por último
============================================================ */

const CONFIRMA_RESOLUCAO = [
  /\bresolvid[oa]\b/, /\bfuncionou\b/, /\bconsegui\b/, /\bdeu certo\b/, /\btudo certo\b/, /\bperfeit[oa],?\s*obrigad/,
  /\b[óo]timo,?\s*(valeu|obrigad)/,
];

function pareceResolucao(texto: string) {
  const t = normalizarTexto(texto);
  return CONFIRMA_RESOLUCAO.some((p) => p.test(t));
}

function pareceEncerramentoNosso(texto: string) {
  const t = normalizarTexto(texto);
  return /\bfoi resolvido\b|\bja est[áa] funcionando\b|\bja resolvemos\b|\bfica resolvido\b|\bqualquer coisa,? (é só |eh so )?chamar\b/.test(t);
}

export function estadoDaConversa(mensagens: MensagemDaConversa[]): {
  pendencia: string;
  proximoPasso: string;
  resolvido: boolean;
} {
  const ultima = mensagens[mensagens.length - 1];
  if (!ultima) return { pendencia: "Nada pendente.", proximoPasso: "Nenhuma ação — a conversa está vazia.", resolvido: false };

  const resolvido = pareceResolucao(ultima.texto) || (ultima.de === "nos" && pareceEncerramentoNosso(ultima.texto));

  if (resolvido) {
    return { pendencia: "Nada pendente — a última mensagem indica solução.", proximoPasso: "Confirmar com o cliente e encerrar, se ainda não encerrou.", resolvido: true };
  }

  if (ultima.de === "cliente") {
    const pergunta = /\?\s*$/.test(ultima.texto.trim());
    return {
      pendencia: pergunta ? "O cliente fez uma pergunta e aguarda a resposta." : "O cliente escreveu por último e aguarda retorno da operação.",
      proximoPasso: "Responder ao cliente.",
      resolvido: false,
    };
  }

  const pergunta = /\?\s*$/.test(ultima.texto.trim());
  return {
    pendencia: pergunta ? "A operação perguntou algo e aguarda a resposta do cliente." : "A operação falou por último; ainda sem confirmação do cliente.",
    proximoPasso: pergunta ? "Aguardar o retorno do cliente; cobrar se não vier em um dia útil." : "Acompanhar até o cliente confirmar que ficou resolvido.",
    resolvido: false,
  };
}

/* ============================================================
   RASCUNHOS — os três caminhos, sempre para revisar antes de enviar
============================================================ */

export function rascunhosDaConversa(entrada: {
  nome?: string;
  assunto: string;
  pendencia: string;
  ultimaDoCliente?: string;
}): [RespostaPronta, RespostaPronta, RespostaPronta] {
  const saudacao = entrada.nome ? `Oi, ${entrada.nome.split(/\s+/)[0]}!` : "Oi!";

  return [
    {
      titulo: "Responder agora",
      quando: "O que já se sabe é suficiente para dar uma notícia ao cliente.",
      texto: `${saudacao} Vi sua mensagem sobre ${entrada.assunto.toLowerCase()}. Já estou olhando com atenção e te retorno com uma posição em breve — obrigado pela paciência.`,
    },
    {
      titulo: "Pedir o que falta",
      quando: "Falta um dado do cliente para seguir — um print, um número de pedido, um horário.",
      texto: `${saudacao} Para eu conseguir resolver isso com você, preciso de mais uma informação: pode me confirmar o número do pedido (ou protocolo) e, se possível, um print do que está acontecendo?`,
    },
    {
      titulo: "Confirmar e encerrar",
      quando: "O assunto parece resolvido e falta só a confirmação do cliente.",
      texto: `${saudacao} Passando para confirmar: ficou tudo certo com o que combinamos? Se precisar de mais alguma coisa, é só me chamar por aqui.`,
    },
  ];
}

/* ============================================================
   O RETRATO INTEIRO
============================================================ */

/* ============================================================
   TRIAGEM — responder agora ou analisar, sem IA (Fase 16)
============================================================ */

export interface TriagemSemIA {
  decisao: "responder" | "analisar";
  porque: string;
  assunto: string;
  gravidade: "baixa" | "media" | "alta";
  oQueFalta: string[];
  areaSugerida: string;
  rascunho: string;
}

/**
 * O que obriga a olhar o sistema antes de responder. Cada regra diz o
 * que falta descobrir e quem apura — a mesma lógica da instrução da IA:
 * cobrança, erro, integração e pedido sumido pedem apuração.
 */
const PEDE_APURACAO: { padrao: RegExp; falta: string; area: string }[] = [
  { padrao: /\b(cobran[cç]a|cobrad[oa]|cobraram|estorno|reembols|fatura|boleto|mensalidade|valor|pix|cart[aã]o)\b/, falta: "Conferir a cobrança e o histórico de pagamentos da conta.", area: "Financeiro" },
  { padrao: /\b(n[aã]o funciona|parou|travou|trava|erro|bug|fora do ar|caiu|lento|n[aã]o (abre|carrega|imprime))\b/, falta: "Reproduzir o problema e checar os registros do sistema no período relatado.", area: "Suporte técnico" },
  { padrao: /\b(ifood|integra[cç][aã]o|anota a[ií]|rappi|aiqfome|99food|impressora)\b/, falta: "Checar a integração citada e se o problema é de lá ou daqui.", area: "Integrações" },
  { padrao: /\b(pedido (sumiu|n[aã]o chegou|perdido)|n[aã]o recebi|n[aã]o chegou)\b/, falta: "Localizar o pedido citado e o que aconteceu com ele.", area: "Suporte técnico" },
];

/*
  Alta, na definição da própria triagem: intenção de sair, ameaça de ação
  ou prejuízo declarado. Medido na base (363 relatos): "cancel" sozinho
  pegava "pedido cancelado" em 96 casos e "processo" pegava "processo de
  cadastro" — por isso cancelar só vale junto de plano, assinatura,
  contrato ou sistema, e processo só como ação na justiça.
*/
const GRAVE =
  /\b(procon|processar|processo judicial|a[cç][aã]o judicial|advogad|justi[cç]a|preju[ií]zo|perdi (clientes|vendas|dinheiro)|golpe|rescis|(trocar de|outro|mudar de) sistema|cancel\w*\s+((o|a) )?((meu|minha|nosso|nossa) )?(plano|assinatura|contrato|servi[cç]o|sistema|conta))/;
const MEDIA = /\b(cobran[cç]a|estorno|reembols|n[aã]o funciona|parou|erro|pedido|cliente(s)? reclam)/;

function palavrasDe(texto: string) {
  return new Set(normalizarTexto(texto).split(/[^a-z0-9]+/).filter((p) => p.length >= 4));
}

export function triarSemIA(entrada: {
  titulo: string;
  relato: string;
  nome?: string;
  macros: { titulo: string; corpo: string }[];
}): TriagemSemIA {

  const texto = normalizarTexto(`${entrada.titulo}\n${entrada.relato}`);
  const assunto = assuntoDaConversa([{ de: "cliente", texto }]);
  const gravidade: TriagemSemIA["gravidade"] = GRAVE.test(texto) ? "alta" : MEDIA.test(texto) ? "media" : "baixa";

  const apuracoes = PEDE_APURACAO.filter((r) => r.padrao.test(texto));
  const nome = primeiroNomeDo(entrada.nome);
  const ola = nome ? `Olá, ${nome}!` : "Olá!";

  /* Texto aprovado que cobre o assunto: metade das palavras do título dele aparecem no relato. */
  const doRelato = palavrasDe(texto);
  const coberta = entrada.macros
    .map((m) => {
      const doTitulo = [...palavrasDe(m.titulo)];
      const comuns = doTitulo.filter((p) => doRelato.has(p)).length;
      return { m, cobertura: doTitulo.length ? comuns / doTitulo.length : 0 };
    })
    .filter((x) => x.cobertura >= 0.5)
    .sort((a, b) => b.cobertura - a.cobertura)[0]?.m;

  if (apuracoes.length === 0 && coberta && gravidade !== "alta") {
    return {
      decisao: "responder",
      porque: `O relato não pede apuração e o texto aprovado "${coberta.titulo}" cobre o assunto.`,
      assunto,
      gravidade,
      oQueFalta: [],
      areaSugerida: "",
      rascunho: `${ola} Sentimos muito pelo transtorno.\n\n${coberta.corpo.trim()}`,
    };
  }

  const oQueFalta = apuracoes.length
    ? apuracoes.map((r) => r.falta)
    : ["Confirmar com a operação o fato relatado antes de responder."];

  return {
    decisao: "analisar",
    porque: apuracoes.length
      ? `O relato pede apuração (${apuracoes.map((r) => r.area.toLowerCase()).join(", ")}) antes de qualquer resposta.`
      : coberta
        ? "Há texto aprovado sobre o assunto, mas a gravidade pede olhar o caso antes."
        : "Nenhum texto aprovado cobre o assunto — na dúvida, analisar.",
    assunto,
    gravidade,
    oQueFalta,
    areaSugerida: apuracoes[0]?.area ?? "",
    rascunho: `${ola} Sentimos muito pelo transtorno e entendemos a sua frustração. Já estamos verificando o que aconteceu com a sua conta e retornamos por aqui com a apuração.`,
  };
}

function primeiroNomeDo(nome?: string) {
  const limpo = String(nome ?? "").trim();
  if (!limpo || /^n[ãa]o informado$/i.test(limpo)) return "";
  return limpo.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase());
}

export function retratarConversaSemIA(mensagens: MensagemDaConversa[], contato?: { nome?: string }): RetratoDaConversa {
  const assunto = assuntoDaConversa(mensagens);
  const { pendencia, proximoPasso, resolvido } = estadoDaConversa(mensagens);
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  const respostas = rascunhosDaConversa({
    nome: contato?.nome,
    assunto,
    pendencia,
    ultimaDoCliente: doCliente[doCliente.length - 1]?.texto,
  });

  /* O rascunho principal é o primeiro caminho, salvo quando a conversa já indica que falta o cliente confirmar. */
  const principal = resolvido ? respostas[2] : mensagens[mensagens.length - 1]?.de === "nos" ? respostas[1] : respostas[0];

  return {
    resumo: resumirTexto(mensagens),
    assunto,
    humor: humorDaConversa(mensagens),
    pendencia,
    proximoPasso,
    resposta: principal.texto,
    respostas,
    resolvido,
  };
}

/* ============================================================
   DOSSIÊ — o mesmo formato da IA, só com fatos (Fase 16)
============================================================ */

/**
 * O dossiê pelo motor próprio — o mesmo formato, só com fatos.
 *
 * Nenhuma frase aqui é deduzida: a situação vem do status, o último
 * movimento da linha do tempo, as pendências do que falta registrado
 * (resposta pública, réplica, área que não devolveu, avaliação). Onde a
 * IA escreveria a solução, fica um marcador para quem atende preencher —
 * inventar uma solução seria pior do que deixar o espaço.
 */
export function dossieSemIA(ctx: {
  caso: Pick<
    Case,
    "protocol" | "customer" | "source" | "status" | "title" | "createdAt" | "description" | "publicResponse" | "evaluated" | "resolved" | "score" | "churnRisk" | "category"
  > | null;
  linhaDoTempo: string[];
  historico: string[];
}) {
  const c = ctx.caso;
  const nome = String(c?.customer ?? "").trim().split(/\s+/)[0] ?? "";
  const ola = nome && !/^n[ãa]o$/i.test(nome) ? `Olá, ${nome.replace(/^./, (x) => x.toUpperCase())}!` : "Olá!";

  const respostas = [
    {
      titulo: "Acolher e apurar",
      quando: "Ainda não há solução e é preciso responder dentro do prazo.",
      texto: `${ola} Sentimos muito pelo transtorno e entendemos a sua frustração. Já estamos apurando o que aconteceu e retornamos por aqui com a apuração.`,
    },
    {
      titulo: "Responder com solução",
      quando: "Quando a apuração terminou e há o que informar.",
      texto: `${ola} Obrigado pela paciência enquanto apurávamos. [Explique aqui o que foi feito, ou o que precisa ser feito, em passos concretos.]`,
    },
    {
      titulo: "Encerrar e pedir reavaliação",
      quando: "Quando o assunto está resolvido.",
      texto: `${ola} Que bom que conseguimos resolver. Se fizer sentido para você, atualize a sua avaliação contando como foi o atendimento.`,
    },
  ];

  if (!c) {
    return {
      geral: "Este cliente não tem reclamação cadastrada; o dossiê saiu só do histórico do contato.",
      ultimo: ctx.historico.at(-1) ?? "Nenhum registro anterior deste contato.",
      dossie: ctx.historico.length ? ctx.historico.join("\n") : "Nenhum registro anterior deste contato nas outras frentes.",
      proximaResposta: "Entender o que a pessoa precisa agora e, se for reclamação, registrar o caso.",
      pendencias: [] as string[],
      respostas,
      pontos: [] as string[],
    };
  }

  const semResposta = !(c.publicResponse ?? "").trim();
  const areaPendente = ctx.linhaDoTempo.some((l) => l.includes("ainda não devolvido"));
  const avaliacao = c.evaluated
    ? `avaliada com nota ${c.score ?? "—"}, ${c.resolved ? "resolvida" : "não resolvida"}`
    : "ainda sem avaliação";

  const pendencias = [
    semResposta && "Publicar a resposta pública.",
    c.status === "Aguardando nossa réplica" && "Responder a réplica do consumidor.",
    areaPendente && "Cobrar o retorno da área para onde o caso foi movido.",
    !semResposta && !c.evaluated && "Pedir a avaliação ao consumidor.",
  ].filter((p): p is string => Boolean(p));

  const proximaResposta = semResposta
    ? "Responder publicamente dentro do prazo: reconhecer o problema, dizer que está sendo apurado e não prometer prazo em número."
    : c.status === "Aguardando nossa réplica"
      ? "Responder a réplica: retomar o que o consumidor disse por último e dizer o que muda a partir daqui."
      : !c.evaluated
        ? "Confirmar se o problema foi resolvido e, se foi, convidar a avaliar, sem cobrar nota."
        : "Caso já avaliado: só voltar a falar se o consumidor se manifestar de novo.";

  return {
    geral: `${c.customer} abriu ${c.protocol} em ${c.createdAt} pelo ${c.source}. Situação: ${c.status}, ${avaliacao}.${c.churnRisk ? " Marcado como risco de cancelamento." : ""}${ctx.historico.length ? ` Há mais ${ctx.historico.length} registro(s) deste contato em outras frentes.` : ""}`,
    ultimo:
      ctx.linhaDoTempo.at(-1) ??
      (semResposta ? "Nada aconteceu depois do relato: ainda sem resposta pública." : "A última ação registrada foi a nossa resposta pública."),
    dossie: [
      `Relato do consumidor: ${(c.description ?? "").trim().slice(0, 1200) || "(sem relato registrado)"}`,
      semResposta ? "Ainda sem resposta pública nossa." : `Resposta pública: ${(c.publicResponse ?? "").trim().slice(0, 800)}`,
      ...(ctx.linhaDoTempo.length ? ["", "Linha do tempo interna:", ...ctx.linhaDoTempo] : ["Nenhuma anotação nem movimentação interna registrada."]),
      ...(ctx.historico.length ? ["", "Outras frentes deste contato:", ...ctx.historico] : []),
      "",
      `Agora: ${c.status}, ${avaliacao}.`,
    ].join("\n"),
    proximaResposta,
    pendencias,
    respostas,
    pontos: [
      c.category ? `Categoria: ${c.category}` : null,
      `Situação: ${c.status}`,
      c.evaluated ? `Nota ${c.score ?? "—"}` : "Sem avaliação",
      c.churnRisk ? "Risco de cancelamento" : null,
      areaPendente ? "Movido para outra área e ainda não devolvido" : null,
    ].filter((p): p is string => Boolean(p)),
  };
}
