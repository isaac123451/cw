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
 * entre retido e cancelado. Sem desfecho, "em aberto". A pessoa pode
 * corrigir à mão (retido, cancelado, não é cancelamento), e a correção
 * vale acima de tudo.
 */

export type Desfecho = "retido" | "cancelado" | "em-aberto";
export type DesfechoManual = "retido" | "cancelado" | "nao-e-cancelamento";
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
}

const norma = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** Pedido de cancelamento do plano — não do pedido do consumidor. */
const PEDIDO =
  /cancel(ar|amento|o|ei) (o |do |meu |minha |a |da |nosso |nossa )?(contrato|plano|assinatura|servico|sistema|conta|cardapio web|mensalidade)|(quero|vou|preciso|gostaria de|desejo|queremos|vamos|solicito|solicitei|pedi)( o)? (cancelar|cancelamento)(?! (d?[oa] |meu |minha |o |um )?(pedido|entrega|compra))|solicitacao de cancelamento|pedido de cancelamento (do|da|de) (plano|contrato|assinatura|servico|sistema)|rescis|encerrar (o |meu |nosso )?contrato|trocar de (sistema|plataforma|empresa)|nao (vou |quero )?(mais )?renovar|nao quero mais (usar|o sistema|a plataforma|os servicos|o cardapio)/;

/** Retido: ficou. */
const RETIDO =
  /(vou|vamos|decidi|decidimos|resolvi|resolvemos) (continuar|ficar|permanecer) (com voces|com a cardapio|com o cardapio|no cardapio|com o sistema|no sistema|no plano|usando)|(vou|vamos|decidi|resolvi) manter (o plano|o contrato|a assinatura|o sistema)|desist(i|imos) (de|do) cancel|nao (vou|vamos) (mais )?cancelar|pode manter|vou manter|vamos manter|aceito (a proposta|o desconto|a oferta|a condicao)|aceitamos (a proposta|o desconto)|fico com voces|continuo com voces|cliente (retido|mantido)|retencao (feita|realizada|com sucesso)|revert(eu|emos|ido) o cancelamento/;

/** Cancelado: saiu. */
const CANCELADO =
  /ja cancelei|cancelei (o |meu |minha |a )?(contrato|plano|assinatura|servico|sistema)|cancelamento (foi )?(efetuado|realizado|confirmado|concluido|processado)|contrato (encerrado|cancelado|rescindido)|ja migrei|(estou|estamos) usando outro sistema|cliente cancelou|(apos|depois d[oe]) (a |o )?(solicitacao d[oe] |pedido d[oe] )?cancelamento.{0,60}(cobra|debit|boleto|fatura)|(cobra|debit|boleto|fatura).{0,60}(apos|depois d[oe]) (a |o )?(solicitacao d[oe] |pedido d[oe] )?cancel/;

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
  avaliado?: boolean;
  resolvido?: boolean;
  voltaria?: boolean;
  avaliadoEm?: string;
  criadoEm: string;
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

export interface ClienteEmCancelamento {
  chave: string;
  nome: string;
  contaId?: string;
  sinais: SinalDeCancelamento[];
  desfecho: Desfecho;
  /** Por que esse desfecho: o sinal que decidiu, ou a correção de alguém. */
  porque: string;
  manual?: boolean;
  /** O primeiro pedido (ISO) — o mês da conta. */
  desde: string;
  /** Os protocolos envolvidos, para abrir. */
  protocolos: string[];
}

const digitos = (v?: string) => String(v ?? "").replace(/\D/g, "");

function chaveDoCaso(c: CasoParaCancelamento) {
  if (c.contaId) return `conta:${c.contaId}`;
  const d = digitos(c.documento);
  if (d.length === 11 || d.length === 14) return `doc:${d}`;
  if (c.email && !c.email.includes("•")) return `email:${c.email.toLowerCase()}`;
  return `caso:${c.protocolo}`;
}

/**
 * Os clientes em cancelamento, com os sinais juntados e o desfecho.
 *
 * Entra quem tem pedido ou cancelado; retido sozinho só entra quando fala
 * de cancelamento ("desisti de cancelar"). A correção manual (`manuais`,
 * por chave) vence: "não é cancelamento" tira o cliente da conta.
 */
export function clientesEmCancelamento(entrada: {
  casos: CasoParaCancelamento[];
  nps: NpsParaCancelamento[];
  mensagens: MensagemParaCancelamento[];
  manuais?: Map<string, { desfecho: DesfechoManual; por?: string }>;
}): ClienteEmCancelamento[] {
  const grupos = new Map<string, { nome: string; contaId?: string; sinais: SinalDeCancelamento[]; protocolos: Set<string> }>();
  const porProtocolo = new Map<string, string>();
  const porEmail = new Map<string, string>();
  const porNps = new Map<string, string>();

  const grupo = (chave: string, nome: string, contaId?: string) => {
    const g = grupos.get(chave) ?? { nome, contaId, sinais: [], protocolos: new Set<string>() };
    if (!g.contaId && contaId) g.contaId = contaId;
    grupos.set(chave, g);
    return g;
  };

  /* Os casos: o texto, a categoria e a causa, e a avaliação do caso de cancelamento. */
  for (const c of entrada.casos) {
    const chave = chaveDoCaso(c);
    porProtocolo.set(c.protocolo, chave);
    if (c.email) porEmail.set(c.email.toLowerCase(), chave);
    const sinais: SinalDeCancelamento[] = [];
    const base = { frente: c.frente, ref: c.protocolo } as const;
    for (const s of sinaisDoTexto(`${c.titulo}\n${c.relato ?? ""}`)) sinais.push({ ...base, tipo: s.tipo, quando: c.criadoEm, trecho: s.trecho });
    if (!sinais.some((s) => s.tipo === "pedido") && /cancel/i.test(`${c.categoria ?? ""} ${c.subcategoria ?? ""}`)) {
      sinais.push({ ...base, tipo: "pedido", quando: c.criadoEm, trecho: `categoria: ${[c.categoria, c.subcategoria].filter(Boolean).join(" › ")}` });
    }
    if (!sinais.some((s) => s.tipo === "pedido") && /cancelamento do plano/i.test(c.causaRaiz ?? "")) {
      sinais.push({ ...base, tipo: "pedido", quando: c.criadoEm, trecho: `causa raiz: ${c.causaRaiz}` });
    }
    for (const s of sinaisDoTexto(c.solucao ?? "")) {
      if (s.tipo !== "pedido") sinais.push({ ...base, tipo: s.tipo, quando: c.avaliadoEm ?? c.criadoEm, trecho: `solução: ${s.trecho}` });
    }
    const pediu = sinais.some((s) => s.tipo === "pedido");
    if (pediu && c.avaliado) {
      sinais.push({
        ...base,
        tipo: c.voltaria ? "retido" : "cancelado",
        quando: c.avaliadoEm ?? c.criadoEm,
        trecho: c.voltaria ? "avaliou: voltaria a fazer negócio" : `avaliou: não voltaria${c.resolvido ? " (resolvido)" : ""}`,
      });
    }
    if (sinais.length) {
      const g = grupo(chave, c.contaNome || c.cliente, c.contaId);
      g.sinais.push(...sinais);
      g.protocolos.add(c.protocolo);
    }
  }

  /* O NPS: o comentário. */
  for (const r of entrada.nps) {
    const chave = r.contaId ? `conta:${r.contaId}` : r.email ? porEmail.get(r.email.toLowerCase()) ?? `email:${r.email.toLowerCase()}` : `nps:${r.id}`;
    porNps.set(r.id, chave);
    const sinais = sinaisDoTexto(r.comentario).map((s) => ({ tipo: s.tipo, frente: "nps" as const, ref: r.id, quando: r.quando, trecho: s.trecho }));
    if (sinais.length) grupo(chave, r.cliente, r.contaId).sinais.push(...sinais);
  }

  /* As conversas guardadas: cada mensagem, ligada ao cliente pelo caso, pela conta, pelo NPS ou pelo telefone. */
  for (const m of entrada.mensagens) {
    const sinais = sinaisDoTexto(m.texto);
    if (!sinais.length) continue;
    const chave =
      (m.caseProtocolo && porProtocolo.get(m.caseProtocolo)) ||
      (m.contaId ? `conta:${m.contaId}` : "") ||
      (m.npsId && porNps.get(m.npsId)) ||
      (m.telefone ? `tel:${digitos(m.telefone).slice(-8)}` : `conversa:${m.conversaId}`);
    grupo(chave, m.contato || "Contato do WhatsApp", m.contaId).sinais.push(
      ...sinais.map((s) => ({ tipo: s.tipo, frente: "conversa" as const, ref: m.conversaId, quando: m.quando, trecho: s.trecho }))
    );
  }

  const saida: ClienteEmCancelamento[] = [];
  for (const [chave, g] of grupos) {
    const pedidos = g.sinais.filter((s) => s.tipo === "pedido");
    const desfechos = g.sinais.filter((s) => s.tipo !== "pedido").sort((a, b) => b.quando.localeCompare(a.quando));
    if (!pedidos.length && !desfechos.some((s) => s.tipo === "cancelado")) continue;

    const manual = entrada.manuais?.get(chave);
    if (manual?.desfecho === "nao-e-cancelamento") continue;

    const ultimo = desfechos[0];
    const desfecho: Desfecho = manual ? (manual.desfecho as Desfecho) : ultimo ? (ultimo.tipo as Desfecho) : "em-aberto";
    const porque = manual
      ? `marcado à mão${manual.por ? ` por ${manual.por}` : ""}`
      : ultimo
        ? ultimo.trecho
        : "pediu, e ainda não há sinal de que ficou ou saiu";
    const desde = [...pedidos, ...desfechos].map((s) => s.quando).sort()[0];
    saida.push({
      chave,
      nome: g.nome,
      contaId: g.contaId,
      sinais: g.sinais.sort((a, b) => a.quando.localeCompare(b.quando)),
      desfecho,
      porque,
      manual: Boolean(manual),
      desde,
      protocolos: [...g.protocolos],
    });
  }
  return saida.sort((a, b) => b.desde.localeCompare(a.desde));
}

export interface ResumoDeRetencao {
  clientes: number;
  retidos: number;
  cancelados: number;
  emAberto: number;
  /** Retidos sobre os que têm desfecho; `null` sem desfecho nenhum. */
  taxaDeRetencao: number | null;
  porMes: { mes: string; clientes: number; retidos: number; cancelados: number; emAberto: number }[];
}

export function resumoDeRetencao(clientes: ClienteEmCancelamento[]): ResumoDeRetencao {
  const contar = (lista: ClienteEmCancelamento[]) => ({
    clientes: lista.length,
    retidos: lista.filter((c) => c.desfecho === "retido").length,
    cancelados: lista.filter((c) => c.desfecho === "cancelado").length,
    emAberto: lista.filter((c) => c.desfecho === "em-aberto").length,
  });
  const total = contar(clientes);
  const meses = [...new Set(clientes.map((c) => c.desde.slice(0, 7)))].sort().reverse();
  return {
    ...total,
    taxaDeRetencao: total.retidos + total.cancelados > 0 ? total.retidos / (total.retidos + total.cancelados) : null,
    porMes: meses.map((mes) => ({ mes, ...contar(clientes.filter((c) => c.desde.startsWith(mes))) })),
  };
}
