/**
 * Distribuição entre o time (Fase 30, 1.106).
 *
 * "Atribuir casos por pessoa, com a carga de cada um e a fila de quem está
 * ausente redistribuída." Aqui fica só a conta, sem banco: quem pode
 * receber, quanto cada um já carrega e para quem vai cada item de uma fila
 * que precisa de dono — a de quem está ausente, ou a dos que nunca tiveram.
 *
 * **Equilibra por frente, não pelo total.** Uma reclamação do Reclame Aqui
 * dá muito mais trabalho que um NPS; somar as duas faria quem tem 10 casos
 * de RA "valer" o mesmo que quem tem 10 NPS. Cada item vai para quem tem
 * menos na mesma frente — o total só desempata.
 *
 * **O mesmo cliente fica com a mesma pessoa.** Se alguém do destino já
 * atende aquele cliente (por e-mail, documento ou nome), o item vai para
 * ela: duas pessoas falando com o mesmo cliente sobre coisas diferentes é
 * como o cliente passa a repetir a história.
 */

export type FrenteDaFila = "reclame-aqui" | "redes" | "nps";

export const FRENTES_DA_FILA: FrenteDaFila[] = ["reclame-aqui", "redes", "nps"];

export const ROTULO_DA_FRENTE: Record<FrenteDaFila, string> = {
  "reclame-aqui": "Reclame Aqui",
  redes: "Redes",
  nps: "NPS",
};

export interface ItemDaFila {
  tipo: "caso" | "nps";
  id: string;
  frente: FrenteDaFila;
  rotulo: string;
  /** A chave do cliente — ver `chaveDoCliente`. */
  cliente: string;
  /** Desde quando está aberto (AAAA-MM-DD). Os mais antigos são distribuídos primeiro. */
  desde: string;
  donoId: string | null;
  href: string;
}

export interface PessoaDoTime {
  id: string;
  nome: string;
  /** Ausente até este dia, inclusive (AAAA-MM-DD). */
  ausenteAte: string | null;
  ausente: boolean;
  /** Pode receber itens desta frente: papel de agente ou mais no módulo. */
  podeReceber: Record<FrenteDaFila, boolean>;
  /** Itens abertos com a pessoa, por frente. */
  carga: Record<FrenteDaFila, number>;
  /** Reclamações abertas ainda sem resposta pública — a parte mais urgente da carga. */
  semResposta: number;
}

export interface Atribuicao {
  tipo: "caso" | "nps";
  id: string;
  frente: FrenteDaFila;
  rotulo: string;
  href: string;
  paraId: string;
  paraNome: string;
  motivo: "mesmo-cliente" | "menor-carga";
}

export interface PlanoDeDistribuicao {
  atribuicoes: Atribuicao[];
  /** Itens de uma frente em que nenhum destino pode receber. Ficam onde estão. */
  semDestino: ItemDaFila[];
  /** Quantos itens cada destino recebe, por frente. */
  porPessoa: { id: string; nome: string; recebe: Record<FrenteDaFila, number> }[];
}

/** Ausente se a data de volta ainda não passou (inclusive hoje). */
export function estaAusente(ausenteAte: string | null, hoje: string) {
  return !!ausenteAte && ausenteAte >= hoje;
}

export function cargaTotal(carga: Record<FrenteDaFila, number>) {
  return carga["reclame-aqui"] + carga.redes + carga.nps;
}

/**
 * A chave que diz "é o mesmo cliente": e-mail, senão documento (só os
 * dígitos), senão o nome sem acento e sem caixa.
 */
export function chaveDoCliente(c: { email?: string | null; documento?: string | null; nome?: string | null }) {
  const email = (c.email ?? "").trim().toLowerCase();
  if (email.includes("@")) return `email:${email}`;
  const doc = (c.documento ?? "").replace(/\D/g, "");
  if (doc.length >= 11) return `doc:${doc}`;
  const nome = (c.nome ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return nome ? `nome:${nome}` : "";
}

/**
 * Para quem vai cada item da fila.
 *
 * `abertosDoTime` são os itens abertos que já estão com alguém — servem
 * para saber quem atende qual cliente. Os destinos entram com a carga de
 * agora, e cada item atribuído soma na carga de quem recebeu, para o
 * próximo item já ver a conta nova.
 */
export function planejarDistribuicao(fila: ItemDaFila[], destinos: PessoaDoTime[], abertosDoTime: { donoId: string | null; cliente: string }[] = []): PlanoDeDistribuicao {
  const carga = new Map(destinos.map((p) => [p.id, { ...p.carga }]));
  const recebe = new Map(destinos.map((p) => [p.id, { "reclame-aqui": 0, redes: 0, nps: 0 } as Record<FrenteDaFila, number>]));
  const porId = new Map(destinos.map((p) => [p.id, p]));

  const donoDoCliente = new Map<string, string>();
  for (const a of abertosDoTime) {
    if (a.cliente && a.donoId && porId.has(a.donoId) && !donoDoCliente.has(a.cliente)) donoDoCliente.set(a.cliente, a.donoId);
  }

  const ordenada = [...fila].sort((a, b) => a.desde.localeCompare(b.desde) || a.id.localeCompare(b.id));
  const atribuicoes: Atribuicao[] = [];
  const semDestino: ItemDaFila[] = [];

  for (const item of ordenada) {
    const aptos = destinos.filter((p) => p.podeReceber[item.frente] && p.id !== item.donoId);
    if (aptos.length === 0) {
      semDestino.push(item);
      continue;
    }

    let para: PessoaDoTime | undefined;
    let motivo: Atribuicao["motivo"] = "menor-carga";
    const conhecido = item.cliente ? donoDoCliente.get(item.cliente) : undefined;
    if (conhecido && aptos.some((p) => p.id === conhecido)) {
      para = porId.get(conhecido);
      motivo = "mesmo-cliente";
    }
    if (!para) {
      para = [...aptos].sort((a, b) => {
        const ca = carga.get(a.id)!;
        const cb = carga.get(b.id)!;
        return ca[item.frente] - cb[item.frente] || cargaTotal(ca) - cargaTotal(cb) || a.nome.localeCompare(b.nome, "pt-BR");
      })[0];
    }

    carga.get(para.id)![item.frente] += 1;
    recebe.get(para.id)![item.frente] += 1;
    if (item.cliente) donoDoCliente.set(item.cliente, para.id);
    atribuicoes.push({ tipo: item.tipo, id: item.id, frente: item.frente, rotulo: item.rotulo, href: item.href, paraId: para.id, paraNome: para.nome, motivo });
  }

  return {
    atribuicoes,
    semDestino,
    porPessoa: destinos.map((p) => ({ id: p.id, nome: p.nome, recebe: recebe.get(p.id)! })).filter((p) => cargaTotal(p.recebe) > 0),
  };
}
