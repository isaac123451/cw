import { motivosDoCancelamento } from "@/lib/models/motivoDoCancelamento";

/**
 * Cancelamento e retenção, identificados sozinhos (1.85).
 *
 * "Quero que você identifique automaticamente nos casos, juntando pontos
 * até da conversa de WhatsApp, os casos de cancelamento e retenção para
 * termos um número."
 *
 * **Os pontos.** Cada texto que o CW tem — o relato do Reclame Aqui e das
 * Redes, a solução aplicada, o comentário do NPS e as mensagens das
 * conversas guardadas — é lido atrás de três sinais:
 * - **pedido**: quer cancelar o plano, o contrato, o sistema; rescisão;
 *   trocar de sistema. "O pedido foi cancelado" (o pedido do consumidor
 *   final) não conta.
 * - **retido**: "vou continuar", "desisti de cancelar", "pode manter",
 *   "aceito o desconto"; ou a avaliação do caso de cancelamento dizendo
 *   que voltaria a fazer negócio.
 * - **cancelado**: "já cancelei", "cancelamento efetuado", a cobrança
 *   depois de cancelar; ou a avaliação dizendo que não voltaria.
 *
 * **Os pontos se juntam por cliente** — a conta (estabelecimento), o
 * documento, o e-mail ou o telefone —, e o desfecho é o sinal mais recente
 * entre retido e cancelado. Sem desfecho, retido — enquanto não cancelou, ficou (20/10). A pessoa pode
 * corrigir à mão (retido, cancelado, cancelado por outro setor, não é
 * cancelamento), e a correção vale acima de tudo — até o cliente pedir
 * de novo depois dela.
 */

/**
 * Enquanto não cancelou, é retido (20/10/2026): "a parte de pediram,
 * enquanto ele não foi cancelado ele é retido". Não há mais "em aberto".
 */
export type Desfecho = "retido" | "cancelado";
export type DesfechoManual = "retido" | "cancelado" | "cancelado-outro-setor" | "nao-e-cancelamento";
export type FrenteDoSinal = "reclame-aqui" | "redes" | "nps" | "conversa";
export type TipoDeSinal = "pedido" | "retido" | "cancelado";

export interface SinalDeCancelamento {
  tipo: TipoDeSinal;
  frente: FrenteDoSinal;
  /** Protocolo, id do NPS ou id da conversa. */
  ref: string;
  /** ISO. */
  quando: string;
  /** Por que o sinal existe: o trecho lido ou o dado usado. */
  trecho: string;
  /** Veio do relato, no dia em que a reclamação chegou — "já cancelei" aqui é cancelamento de antes de chegar ao time. */
  chegada?: boolean;
  /** O setor que o texto diz ter cancelado. */
  setor?: string;
  /**
   * Evidência fraca: a avaliação do portal. "Voltaria a fazer negócio" não
   * quer dizer que ficou — o BR Mania avaliou assim depois da nossa
   * resposta "lamentamos o cancelamento do seu plano" (20/10). Só decide
   * quando não há fala nossa nem do cliente sobre o desfecho.
   */
  fraco?: boolean;
}

const norma = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** Pedido de cancelamento do plano — não do pedido do consumidor. */
const PEDIDO =
  /cancel(ar|amento|o|ei) (o |do |meu |minha |a |da |nosso |nossa )?(contrato|plano|assinatura|servico|sistema|conta|cardapio web|mensalidade)|(quero|vou|preciso|gostaria de|desejo|entendo que (voce )?deseja|queremos|vamos|solicito|solicitei|pedi|estou|considerando|pensando em|vou ter que|temos de|temos que|teremos que|teremos de|vamos ter que)( o)? (cancelar|cancelamento|cancelando)(?! (d?[oa] |meu |minha |o |um )?(pedido|entrega|compra))|solicitacao de cancelamento|pedido de cancelamento (do|da|de) (plano|contrato|assinatura|servico|sistema)|rescis|encerrar (o |meu |nosso )?contrato|trocar de (sistema|plataforma|empresa)|nao (vou |quero )?(mais )?renovar|nao quero mais (usar|o sistema|a plataforma|os servicos|o cardapio)|cancel(ar|amento d)a renovacao|cancelamento e (o )?reembolso|nada do cancelamento|confirma(ndo|cao d)o cancelamento|nao (consegue|conseguem|consigo|conseguimos) cancelar|(poderia|posso|podia) cancelar(?! (o |um |do |da |a )?pedido)/;

/** Retido: ficou. */
const RETIDO =
  /(vou|vamos|decidi|decidimos|resolvi|resolvemos) (continuar|ficar|permanecer) (com voces|com a cardapio|com o cardapio|no cardapio|com o sistema|no sistema|no plano|usando)|(vou|vamos|decidi|resolvi) manter (o plano|o contrato|a assinatura|o sistema)|desist(i|imos) (de|do) cancel|nao (vou|vamos) (mais )?cancelar|pode manter|vou manter|vamos manter|aceito (a proposta|o desconto|a oferta|a condicao)|aceitamos (a proposta|o desconto)|fico com voces|continuo com voces|cliente (retido|mantido)|retencao (feita|realizada|com sucesso)|revert(eu|emos|ido) o cancelamento/;

/** Cancelado: saiu. */
const CANCELADO =
  /ja cancelei|cancelei (o |meu |minha |a )?(contrato|plano|assinatura|servico|sistema|renovacao)|(portanto|entao|por isso|e) cancelei[,.;]|fiz o cancelamento(?! (do|da|o|a) pedido)|cancelamento (ser|foi|ja foi) feito|(havia sido|foi|fui) cancelad[oa] por (falta de pagamento|inadimplencia)|cancelou (nosso|meu|o) acesso|cancelamento (foi )?(efetuado|realizado|confirmado|concluido|processado)|contrato (encerrado|cancelado|rescindido)|ja migrei|(estou|estamos) usando outro sistema|cliente cancelou|(apos|depois d[oe]) (a |o )?(solicitacao d[oe] |pedido d[oe] )?cancelamento.{0,60}(cobra|debit|boleto|fatura)|(cobra|debit|boleto|fatura).{0,60}(apos|depois d[oe]) (a |o )?(solicitacao d[oe] |pedido d[oe] )?cancel/;

/**
 * O desfecho na nossa própria fala (20/10/2026): a resposta pública do
 * Reclame Aqui e os comentários do caso (os resumos das conversas). É a
 * evidência mais forte que existe — quem atendeu dizendo o que aconteceu.
 * Na base: "lamentamos o cancelamento do seu plano", "infelizmente não
 * continuamos neste momento, mas te esperamos de portas abertas", "o
 * cancelamento foi realizado no momento solicitado", "agente confirmou e
 * realizou o cancelamento"; e "você continuará como nossa cliente",
 * "decidiu continuar como nosso cliente".
 */
const NOSSO_CANCELADO =
  /lamentamos (o|pelo) cancelamento|nao (continuamos|seguiremos|seguimos|vamos continuar) (juntos|neste momento|nesse momento)|portas abertas para (quando|o seu retorno|seu retorno|voce voltar|receber voce)|(realizamos|efetuamos|concluimos|processamos|fizemos) o cancelamento|cancelamento (ja )?(foi|esta|ficou) (realizado|efetuado|concluido|processado|feito)|(realizou|efetuou|concluiu|fez|processou) o cancelamento|conta (foi )?(cancelada|encerrada)|plano (foi )?cancelado/;
const NOSSO_RETIDO =
  /continuara (como )?(nosso|nossa) cliente|(decidiu|decidiram|optou por|vai|resolveu) (continuar|permanecer|seguir) (como nosso cliente|como nossa cliente|conosco|com a gente|com a cardapio|com o cardapio)|seguira conosco|permanecer conosco|(revertemos|conseguimos reverter) o cancelamento|cancelamento (foi )?revertido|desistiu do cancelamento|(mantivemos|manteremos) (o )?seu plano/;

/** O desfecho que a nossa fala registra — cancelado ou retido —, com o trecho. */
export function desfechoNaNossaFala(texto: string): { tipo: "retido" | "cancelado"; trecho: string } | null {
  const n = norma(texto);
  const c = NOSSO_CANCELADO.exec(n);
  const r = NOSSO_RETIDO.exec(n);
  if (!c && !r) return null;
  /* As duas na mesma fala: vale a que vem por último no texto. */
  const tipo = c && (!r || c.index > r.index) ? "cancelado" : "retido";
  return { tipo, trecho: trechoDe(texto, tipo === "cancelado" ? NOSSO_CANCELADO : NOSSO_RETIDO) };
}

/** O trecho em volta do que casou, para a pessoa ver por que foi contado. */
function trechoDe(texto: string, padrao: RegExp) {
  const n = norma(texto);
  const m = padrao.exec(n);
  if (!m) return "";
  const de = Math.max(0, m.index - 40);
  const ate = Math.min(texto.length, m.index + m[0].length + 40);
  return `${de > 0 ? "…" : ""}${texto.slice(de, ate).replace(/\s+/g, " ").trim()}${ate < texto.length ? "…" : ""}`;
}

/** Os sinais de um texto: pedido, retido, cancelado — cada um com o trecho. */
export function sinaisDoTexto(texto: string): { tipo: TipoDeSinal; trecho: string }[] {
  const n = norma(texto);
  const saida: { tipo: TipoDeSinal; trecho: string }[] = [];
  if (PEDIDO.test(n)) saida.push({ tipo: "pedido", trecho: trechoDe(texto, PEDIDO) });
  if (RETIDO.test(n)) saida.push({ tipo: "retido", trecho: trechoDe(texto, RETIDO) });
  if (CANCELADO.test(n)) saida.push({ tipo: "cancelado", trecho: trechoDe(texto, CANCELADO) });
  /* "Desisti de cancelar" é pedido e retenção no mesmo gesto. */
  if (saida.some((s) => s.tipo === "retido") && /cancel/.test(n) && !saida.some((s) => s.tipo === "pedido")) {
    saida.push({ tipo: "pedido", trecho: trechoDe(texto, RETIDO) });
  }
  return saida;
}

/* ============================================================
   JUNTAR OS PONTOS
============================================================ */

/**
 * Quem cancelou, e se conta contra quem atende (20/10/2026).
 *
 * - **atendimento**: saiu depois do prazo do 1º contato, com o caso na mão
 *   do time — é o que a taxa de retenção mede.
 * - **prazo**: saiu antes de vencer o prazo do 1º contato (1 dia útil) —
 *   não havia o que fazer ainda (regra de 30/09).
 * - **outro-setor**: o cancelamento foi feito por outro setor (Financeiro,
 *   Comercial, Suporte…) — o cliente já chegou cancelado ("cobrança após o
 *   cancelamento"), o texto diz quem cancelou, ou alguém marcou à mão.
 *
 * Os três somam o total de cancelamentos, que a tela mostra inteiro; só o
 * primeiro entra na taxa.
 */
export type CanceladoPor = "atendimento" | "prazo" | "outro-setor";

export const SETORES = ["Financeiro", "Comercial", "Suporte", "Sucesso do cliente", "Implantação", "Outro setor"] as const;

/** O setor citado junto do cancelamento: "o financeiro cancelou", "cancelado pelo comercial". */
const SETOR_NO_TEXTO: { setor: (typeof SETORES)[number]; re: RegExp }[] = [
  { setor: "Financeiro", re: /financeiro|cobranca|falta de pagamento|inadimplencia/ },
  { setor: "Comercial", re: /comercial|vendas|vendedor|consultor/ },
  { setor: "Suporte", re: /suporte/ },
  { setor: "Sucesso do cliente", re: /sucesso do cliente|customer success|\bcs\b/ },
  { setor: "Implantação", re: /implantacao|onboarding/ },
];
const CANCELADO_POR_SETOR =
  /(cancel(ado|ada|amento|ou|aram|ei)|encerrad[oa]).{0,40}(pelo|pela|com o|com a|no|na|junto ao|junto a) (setor )?(financeiro|cobranca|comercial|vendas|vendedor|consultor|suporte|sucesso do cliente|customer success|cs|implantacao|onboarding)|cancelad[oa] por (falta de pagamento|inadimplencia)|(financeiro|comercial|suporte|sucesso do cliente|implantacao) (ja )?(cancelou|fez o cancelamento|efetuou o cancelamento|realizou o cancelamento)/;

/** O setor que cancelou, pelo texto; `null` quando o texto não diz. */
export function setorDoCancelamento(texto: string): string | null {
  const n = norma(texto);
  const m = CANCELADO_POR_SETOR.exec(n);
  if (!m) return null;
  return SETOR_NO_TEXTO.find((s) => s.re.test(m[0]))?.setor ?? "Outro setor";
}

export interface CasoParaCancelamento {
  protocolo: string;
  frente: "reclame-aqui" | "redes";
  cliente: string;
  titulo: string;
  relato?: string;
  categoria?: string;
  subcategoria?: string;
  causaRaiz?: string;
  solucao?: string;
  /** A nossa resposta pública no portal, e quando foi dada (ISO). */
  resposta?: string;
  respondidoEm?: string;
  /** Os comentários do caso — os resumos das conversas e as notas de quem atende. */
  comentarios?: { texto: string; quando: string }[];
  avaliado?: boolean;
  resolvido?: boolean;
  voltaria?: boolean;
  avaliadoEm?: string;
  criadoEm: string;
  /** O prazo do 1º contato (1 dia útil depois de chegar) — ISO (1.113). */
  prazoDoContato?: string;
  contaId?: string;
  contaNome?: string;
  documento?: string;
  email?: string;
  telefone?: string;
}

export interface NpsParaCancelamento {
  id: string;
  cliente: string;
  comentario: string;
  quando: string;
  contaId?: string;
  email?: string;
}

export interface MensagemParaCancelamento {
  conversaId: string;
  texto: string;
  quando: string;
  caseProtocolo?: string;
  contaId?: string;
  npsId?: string;
  telefone?: string;
  contato?: string;
}

export interface MarcacaoManual {
  desfecho: DesfechoManual;
  por?: string;
  /** ISO — quando foi marcado. Um pedido novo depois disto reabre o cliente. */
  em?: string;
  /** O setor, em "cancelado-outro-setor". */
  setor?: string;
}

export interface ClienteEmCancelamento {
  chave: string;
  nome: string;
  contaId?: string;
  sinais: SinalDeCancelamento[];
  desfecho: Desfecho;
  /** Por que esse desfecho: o sinal que decidiu, ou a correção de alguém. */
  porque: string;
  manual?: boolean;
  /**
   * A marcação à mão diz uma coisa e a nossa própria fala diz outra — por
   * exemplo, marcado retido e a resposta "lamentamos o cancelamento".
   */
  conflito?: string;
  /** Retido só porque não cancelou: nenhum sinal de que ficou — o pedido segue pedindo atenção (cliente em risco). */
  retidoSemSinal?: boolean;
  /** O primeiro pedido (ISO) — o mês da conta. */
  desde: string;
  /** Os protocolos envolvidos, para abrir. */
  protocolos: string[];
  /** Por que queria cancelar — ids de `MOTIVOS_DE_CANCELAMENTO`, lidos do que o cliente escreveu. */
  motivos: string[];
  /** Todas as chaves do cliente (conta, documento, e-mail…) — o painel de risco o acha por qualquer uma. */
  chaves: string[];
  /** O primeiro pedido de cancelamento — quem queria cancelar, quando, por onde e com que frase. Sem ele, o cliente já chegou cancelado. */
  pedido?: SinalDeCancelamento;
  /** Só nos cancelados: quem cancelou — e se conta na taxa. */
  canceladoPor?: CanceladoPor;
  /** Em "outro-setor", qual, quando se sabe. */
  setor?: string;
  /** O prazo do 1º contato da primeira reclamação do cliente. */
  prazoDoContato?: string;
}

const digitos = (v?: string) => String(v ?? "").replace(/\D/g, "");

/** Nome que não diz quem é: vazio, "Não informado", um telefone. */
const nomeVazio = (n?: string) => !n || /^\s*(nao informado|anonimo|cliente|contato do whatsapp)?\s*$/i.test(norma(n)) || /^[+\d\s().-]{8,}$/.test(n);

/**
 * As chaves de um caso — a conta, o documento e o e-mail. A primeira é a
 * que o CW usava sozinha até 20/10 (as marcações à mão foram gravadas
 * nela); as outras servem para juntar o mesmo cliente que reclamou duas
 * vezes, uma com CPF e outra só com e-mail.
 */
function chavesDoCaso(c: CasoParaCancelamento) {
  const chaves: string[] = [];
  if (c.contaId) chaves.push(`conta:${c.contaId}`);
  const d = digitos(c.documento);
  if (d.length === 11 || d.length === 14) chaves.push(`doc:${d}`);
  if (c.email && !c.email.includes("•")) chaves.push(`email:${c.email.toLowerCase()}`);
  /* A própria reclamação também é chave: é nela que o botão da ficha grava ("esta reclamação é retido/churn"). */
  chaves.push(chaveDaReclamacao(c.protocolo));
  return chaves;
}

/** A chave de uma reclamação só — o que o botão "Retido / Churn" da ficha e da Retenção grava. */
export function chaveDaReclamacao(protocolo: string) {
  return `caso:${protocolo}`;
}

const ORDEM_DA_CHAVE = ["conta", "doc", "email", "tel", "nps", "conversa", "caso"];
const pesoDaChave = (k: string) => ORDEM_DA_CHAVE.indexOf(k.slice(0, k.indexOf(":")));

/** Cancelado antes de chegar: a subcategoria diz ("Cobrança após cancelamento"). */
const CHEGOU_CANCELADO = /(apos|pos|depois do) (o )?cancelamento/;

export interface CancelamentoJuntado {
  clientes: ClienteEmCancelamento[];
  /** Quem foi marcado "não é cancelamento", com os protocolos — para a tela não dizer "pediu para cancelar". */
  foraDaConta: { chave: string; protocolos: string[] }[];
}

/** Os clientes em cancelamento — ver `juntarCancelamento`. */
export function clientesEmCancelamento(entrada: Parameters<typeof juntarCancelamento>[0]): ClienteEmCancelamento[] {
  return juntarCancelamento(entrada).clientes;
}

/**
 * Os clientes em cancelamento, com os sinais juntados e o desfecho.
 *
 * Entra quem tem pedido ou cancelado; retido sozinho só entra quando fala
 * de cancelamento ("desisti de cancelar"). O mesmo cliente é um só, mesmo
 * que tenha reclamado com CPF numa e só com e-mail na outra. A correção
 * manual vence — até o cliente pedir de novo depois dela.
 */
export function juntarCancelamento(entrada: {
  casos: CasoParaCancelamento[];
  nps: NpsParaCancelamento[];
  mensagens: MensagemParaCancelamento[];
  manuais?: Map<string, MarcacaoManual>;
}): CancelamentoJuntado {
  /* Quem é quem: as chaves do mesmo cliente, unidas. */
  const pai = new Map<string, string>();
  const raiz = (k: string): string => {
    let r = k;
    while (pai.has(r) && pai.get(r) !== r) r = pai.get(r)!;
    let x = k;
    while (pai.has(x) && pai.get(x) !== r) {
      const proximo = pai.get(x)!;
      pai.set(x, r);
      x = proximo;
    }
    if (!pai.has(r)) pai.set(r, r);
    return r;
  };
  const unir = (chaves: string[]) => {
    for (const k of chaves.slice(1)) {
      const a = raiz(chaves[0]);
      const b = raiz(k);
      if (a !== b) pai.set(b, a);
    }
  };

  const chavesPorProtocolo = new Map<string, string[]>();
  const casoPorProtocolo = new Map<string, CasoParaCancelamento>();
  for (const c of entrada.casos) {
    const chaves = chavesDoCaso(c);
    chavesPorProtocolo.set(c.protocolo, chaves);
    casoPorProtocolo.set(c.protocolo, c);
    unir(chaves);
  }
  const chavesDoNps = (r: NpsParaCancelamento) => {
    const chaves: string[] = [];
    if (r.contaId) chaves.push(`conta:${r.contaId}`);
    if (r.email) chaves.push(`email:${r.email.toLowerCase()}`);
    if (!chaves.length) chaves.push(`nps:${r.id}`);
    return chaves;
  };
  const npsPorId = new Map<string, NpsParaCancelamento>();
  for (const r of entrada.nps) {
    npsPorId.set(r.id, r);
    unir(chavesDoNps(r));
  }
  const chavesDaMensagem = (m: MensagemParaCancelamento) =>
    (m.caseProtocolo && chavesPorProtocolo.get(m.caseProtocolo)) ||
    (m.contaId ? [`conta:${m.contaId}`] : null) ||
    (m.npsId && npsPorId.has(m.npsId) ? chavesDoNps(npsPorId.get(m.npsId)!) : null) ||
    [m.telefone ? `tel:${digitos(m.telefone).slice(-8)}` : `conversa:${m.conversaId}`];

  type Grupo = { nomes: { nome: string; peso: number }[]; contaId?: string; sinais: SinalDeCancelamento[]; protocolos: Set<string>; prazos: string[]; chaves: Set<string>; textos: string[] };
  const grupos = new Map<string, Grupo>();
  const grupo = (chaves: string[]) => {
    const r = raiz(chaves[0]);
    const g = grupos.get(r) ?? { nomes: [], sinais: [], protocolos: new Set<string>(), prazos: [], chaves: new Set<string>(), textos: [] };
    for (const k of chaves) g.chaves.add(k);
    grupos.set(r, g);
    return g;
  };
  /* O nome: a conta, depois quem reclamou, o NPS, o contato da conversa — nunca um telefone se houver nome. */
  const nomear = (g: Grupo, nome: string | undefined, peso: number) => {
    /* Telefone ou "Não informado" só servem se não houver nome nenhum. */
    if (nome?.trim()) g.nomes.push({ nome: nome.trim(), peso: nomeVazio(nome) ? 10 + peso : peso });
  };
  const doCaso = (g: Grupo, c: CasoParaCancelamento) => {
    if (c.contaId && !g.contaId) g.contaId = c.contaId;
    nomear(g, c.contaNome, 0);
    nomear(g, c.cliente, 1);
    g.protocolos.add(c.protocolo);
    if (c.prazoDoContato) g.prazos.push(c.prazoDoContato);
  };

  /* Os casos: o texto, a categoria e a causa, e a avaliação do caso de cancelamento. */
  for (const c of entrada.casos) {
    const sinais: SinalDeCancelamento[] = [];
    const base = { frente: c.frente, ref: c.protocolo } as const;
    for (const s of sinaisDoTexto(`${c.titulo}\n${c.relato ?? ""}`)) sinais.push({ ...base, tipo: s.tipo, quando: c.criadoEm, trecho: s.trecho, chegada: true });
    const classificacao = norma(`${c.categoria ?? ""} ${c.subcategoria ?? ""}`);
    if (!sinais.some((s) => s.tipo === "pedido") && /cancel/.test(classificacao)) {
      sinais.push({ ...base, tipo: "pedido", quando: c.criadoEm, trecho: `categoria: ${[c.categoria, c.subcategoria].filter(Boolean).join(" › ")}` });
    }
    if (!sinais.some((s) => s.tipo === "cancelado") && CHEGOU_CANCELADO.test(classificacao)) {
      sinais.push({ ...base, tipo: "cancelado", quando: c.criadoEm, trecho: `chegou cancelado — ${[c.categoria, c.subcategoria].filter(Boolean).join(" › ")}`, chegada: true });
    }
    if (!sinais.some((s) => s.tipo === "pedido") && /cancelamento do plano/i.test(c.causaRaiz ?? "")) {
      sinais.push({ ...base, tipo: "pedido", quando: c.criadoEm, trecho: `causa raiz: ${c.causaRaiz}` });
    }
    for (const s of sinaisDoTexto(c.solucao ?? "")) {
      if (s.tipo !== "pedido") sinais.push({ ...base, tipo: s.tipo, quando: c.avaliadoEm ?? c.criadoEm, trecho: `solução: ${s.trecho}`, setor: s.tipo === "cancelado" ? setorDoCancelamento(c.solucao ?? "") ?? undefined : undefined });
    }
    /* A nossa fala: a resposta pública e os comentários do caso. */
    const falas = [
      ...(c.resposta ? [{ texto: c.resposta, quando: c.respondidoEm ?? c.avaliadoEm ?? c.criadoEm, onde: "nossa resposta" }] : []),
      ...(c.comentarios ?? []).map((m) => ({ texto: m.texto, quando: m.quando, onde: "comentário do caso" })),
    ];
    for (const f of falas) {
      const d = desfechoNaNossaFala(f.texto);
      if (d) sinais.push({ ...base, tipo: d.tipo, quando: f.quando, trecho: `${f.onde}: ${d.trecho}`, setor: d.tipo === "cancelado" ? setorDoCancelamento(f.texto) ?? undefined : undefined });
      /* O resumo da conversa também conta o pedido ("cliente quer cancelar"). */
      if (f.onde === "comentário do caso") for (const s of sinaisDoTexto(f.texto)) if (s.tipo === "pedido") sinais.push({ ...base, tipo: "pedido", quando: f.quando, trecho: `${f.onde}: ${s.trecho}` });
    }
    /* Falamos do cancelamento sem o relato pedir: o cliente pediu por outro canal. */
    if (!sinais.some((s) => s.tipo === "pedido") && sinais.some((s) => s.trecho.startsWith("nossa resposta") || s.trecho.startsWith("comentário do caso"))) {
      sinais.push({ ...base, tipo: "pedido", quando: c.criadoEm, trecho: "a nossa resposta trata do cancelamento" });
    }
    /* Reclamação adicionada à mão (botão Retido / Churn): entra na conta mesmo sem o texto falar em cancelar. */
    const marcada = entrada.manuais?.get(chaveDaReclamacao(c.protocolo));
    if (!sinais.some((s) => s.tipo === "pedido") && marcada && marcada.desfecho !== "nao-e-cancelamento") {
      sinais.push({ ...base, tipo: "pedido", quando: c.criadoEm, trecho: `reclamação adicionada à mão${marcada.por ? ` por ${marcada.por}` : ""}` });
    }
    const pediu = sinais.some((s) => s.tipo === "pedido");
    if (pediu && c.avaliado) {
      sinais.push({
        ...base,
        tipo: c.voltaria ? "retido" : "cancelado",
        quando: c.avaliadoEm ?? c.criadoEm,
        trecho: c.voltaria ? "avaliou: voltaria a fazer negócio" : `avaliou: não voltaria${c.resolvido ? " (resolvido)" : ""}`,
        fraco: true,
      });
    }
    if (sinais.length) {
      const g = grupo(chavesPorProtocolo.get(c.protocolo)!);
      g.sinais.push(...sinais);
      g.textos.push(`${c.titulo}\n${c.relato ?? ""}`);
      doCaso(g, c);
    }
  }

  /* O NPS: o comentário. */
  for (const r of entrada.nps) {
    const sinais = sinaisDoTexto(r.comentario).map((s) => ({ tipo: s.tipo, frente: "nps" as const, ref: r.id, quando: r.quando, trecho: s.trecho }));
    if (!sinais.length) continue;
    const g = grupo(chavesDoNps(r));
    g.sinais.push(...sinais);
    g.textos.push(r.comentario);
    if (r.contaId && !g.contaId) g.contaId = r.contaId;
    nomear(g, r.cliente, 2);
  }

  /* As conversas guardadas: cada mensagem, ligada ao cliente pelo caso, pela conta, pelo NPS ou pelo telefone. */
  for (const m of entrada.mensagens) {
    const sinais = sinaisDoTexto(m.texto);
    if (!sinais.length) continue;
    const g = grupo(chavesDaMensagem(m));
    g.textos.push(m.texto);
    g.sinais.push(
      ...sinais.map((s) => ({
        tipo: s.tipo,
        frente: "conversa" as const,
        ref: m.conversaId,
        quando: m.quando,
        trecho: s.trecho,
        setor: s.tipo === "cancelado" ? setorDoCancelamento(m.texto) ?? undefined : undefined,
      }))
    );
    if (m.contaId && !g.contaId) g.contaId = m.contaId;
    /* A conversa de um caso traz o nome e o protocolo do caso, não o número do WhatsApp. */
    const caso = m.caseProtocolo ? casoPorProtocolo.get(m.caseProtocolo) : undefined;
    if (caso) doCaso(g, caso);
    nomear(g, m.contato, 3);
  }

  const saida: ClienteEmCancelamento[] = [];
  const foraDaConta: CancelamentoJuntado["foraDaConta"] = [];
  for (const g of grupos.values()) {
    const pedidos = g.sinais.filter((s) => s.tipo === "pedido");
    const desfechos = g.sinais.filter((s) => s.tipo !== "pedido").sort((a, b) => b.quando.localeCompare(a.quando));
    if (!pedidos.length && !desfechos.some((s) => s.tipo === "cancelado")) continue;

    /* A marcação à mão de qualquer chave do cliente; a mais recente vale. */
    const marcadas = [...g.chaves].flatMap((k) => (entrada.manuais?.get(k) ? [{ chave: k, ...entrada.manuais.get(k)! }] : []));
    marcadas.sort((a, b) => (b.em ?? "").localeCompare(a.em ?? ""));
    let manual: (typeof marcadas)[number] | undefined = marcadas[0];
    const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    /*
     * Pediu de novo depois do desfecho — da marcação à mão ou do último
     * sinal: o desfecho era do pedido anterior, e o cliente volta a ficar
     * em aberto (o Eduardo Lino retido em agosto pediu outra vez em 08/10).
     */
    /* O resumo da conversa no comentário conta o pedido, mas não reabre: ele é escrito depois, junto com o desfecho (o Fabiano). */
    const ultimoPedido = pedidos.filter((s) => !s.trecho.startsWith("comentário do caso")).map((s) => s.quando).sort().at(-1);
    let reaberto: string | undefined;
    if (manual?.em && ultimoPedido && ultimoPedido > manual.em) {
      const marcado = manual.desfecho === "retido" ? "retido" : manual.desfecho === "nao-e-cancelamento" ? "como não cancelamento" : "cancelado";
      reaberto = `pediu de novo em ${dia(ultimoPedido)}, depois de marcado ${marcado} à mão em ${dia(manual.em)}`;
      manual = undefined;
    }

    const chave = marcadas[0]?.chave ?? [...g.chaves].sort((a, b) => pesoDaChave(a) - pesoDaChave(b))[0];
    const protocolos = [...g.protocolos];
    if (manual?.desfecho === "nao-e-cancelamento") {
      foraDaConta.push({ chave, protocolos });
      continue;
    }

    /* O desfecho mais recente entre as evidências fortes; a avaliação do portal só decide sozinha. */
    let ultimo: SinalDeCancelamento | undefined = desfechos.find((s) => !s.fraco) ?? desfechos[0];
    if (!manual && ultimo && ultimoPedido && ultimo.quando < ultimoPedido) {
      reaberto ??= `pediu de novo em ${dia(ultimoPedido)}, depois de ${ultimo.tipo === "retido" ? "ter ficado" : "ter cancelado"} em ${dia(ultimo.quando)}`;
      ultimo = undefined;
    }
    if (reaberto && ultimo && ultimoPedido && ultimo.quando < ultimoPedido) ultimo = undefined;
    const desfecho: Desfecho = manual ? (manual.desfecho === "retido" ? "retido" : "cancelado") : ultimo ? (ultimo.tipo as Desfecho) : "retido";
    const porque = manual
      ? `marcado à mão${manual.por ? ` por ${manual.por}` : ""}${manual.desfecho === "cancelado-outro-setor" ? ` — cancelado por ${manual.setor || "outro setor"}` : ""}`
      : ultimo
        ? ultimo.trecho
        : `${reaberto ?? "pediu"} e não cancelou — conta como retido`;
    const desde = [...pedidos, ...desfechos].map((s) => s.quando).sort()[0];
    /* A marcação contra a nossa própria fala: aparece para conferir. */
    const nossa = desfechos.find((s) => /^(nossa resposta|comentário do caso)/.test(s.trecho));
    const conflito =
      manual && nossa && (manual.desfecho === "retido") !== (nossa.tipo === "retido") ? `marcado ${manual.desfecho === "retido" ? "retido" : "cancelado"}, mas a ${nossa.trecho}` : undefined;
    const prazo = [...g.prazos].sort()[0];

    /* Quem cancelou: à mão, o setor marcado; senão o texto, a chegada já cancelada, ou o prazo do contato. */
    let canceladoPor: CanceladoPor | undefined;
    let setor: string | undefined;
    if (desfecho === "cancelado") {
      const cancelados = desfechos.filter((s) => s.tipo === "cancelado").sort((a, b) => a.quando.localeCompare(b.quando));
      const comSetor = cancelados.find((s) => s.setor);
      if (manual?.desfecho === "cancelado-outro-setor") {
        canceladoPor = "outro-setor";
        setor = manual.setor || undefined;
      } else if (comSetor) {
        canceladoPor = "outro-setor";
        setor = comSetor.setor;
      } else if (cancelados[0]?.chegada) {
        canceladoPor = "outro-setor";
      } else if (prazo && cancelados[0] && cancelados[0].quando <= prazo) {
        canceladoPor = "prazo";
      } else {
        canceladoPor = "atendimento";
      }
    }
    /* O melhor nome; sem nenhum, o e-mail; sem e-mail, o telefone da conversa. "Não informado" nunca. */
    const nomes = [...g.nomes].sort((a, b) => a.peso - b.peso);
    const email = [...g.chaves].find((k) => k.startsWith("email:"))?.slice(6);
    const nome =
      nomes.find((n) => n.peso < 10)?.nome ?? email ?? nomes.find((n) => /^[+\d\s().-]{8,}$/.test(n.nome))?.nome ?? "Contato sem nome";
    saida.push({
      canceladoPor,
      setor,
      prazoDoContato: prazo,
      chave,
      nome,
      contaId: g.contaId,
      sinais: g.sinais.sort((a, b) => a.quando.localeCompare(b.quando)),
      desfecho,
      porque,
      manual: Boolean(manual),
      retidoSemSinal: !manual && !ultimo,
      conflito,
      desde,
      protocolos,
      chaves: [...g.chaves],
      motivos: motivosDoCancelamento(g.textos.join("\n")),
      pedido: pedidos.sort((a, b) => a.quando.localeCompare(b.quando))[0],
    });
  }
  return { clientes: saida.sort((a, b) => b.desde.localeCompare(a.desde)), foraDaConta };
}

export interface ContagemDeRetencao {
  clientes: number;
  retidos: number;
  /** Todos os cancelamentos — pelo atendimento, no prazo e por outro setor. */
  cancelados: number;
  /** Os que contam na taxa: saíram com o caso na mão do time. */
  canceladosQueContam: number;
  /** Saíram antes do prazo do 1º contato — não contam (1.113). */
  canceladosNoPrazo: number;
  /** Cancelados por outro setor — não contam (20/10). */
  canceladosOutroSetor: number;
  /** Retidos sobre retidos + cancelados que contam; `null` sem desfecho nenhum. */
  taxaDeRetencao: number | null;
}

export interface ResumoDeRetencao extends ContagemDeRetencao {
  porMes: ({ mes: string } & ContagemDeRetencao)[];
}

function contar(lista: ClienteEmCancelamento[]): ContagemDeRetencao {
  const cancelados = lista.filter((c) => c.desfecho === "cancelado");
  const retidos = lista.filter((c) => c.desfecho === "retido").length;
  const canceladosQueContam = cancelados.filter((c) => (c.canceladoPor ?? "atendimento") === "atendimento").length;
  return {
    clientes: lista.length,
    retidos,
    cancelados: cancelados.length,
    canceladosQueContam,
    canceladosNoPrazo: cancelados.filter((c) => c.canceladoPor === "prazo").length,
    canceladosOutroSetor: cancelados.filter((c) => c.canceladoPor === "outro-setor").length,
    taxaDeRetencao: retidos + canceladosQueContam > 0 ? retidos / (retidos + canceladosQueContam) : null,
  };
}

export function resumoDeRetencao(clientes: ClienteEmCancelamento[]): ResumoDeRetencao {
  const meses = [...new Set(clientes.map((c) => c.desde.slice(0, 7)))].sort().reverse();
  return {
    ...contar(clientes),
    porMes: meses.map((mes) => ({ mes, ...contar(clientes.filter((c) => c.desde.startsWith(mes))) })),
  };
}
