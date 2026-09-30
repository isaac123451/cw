/**
 * Cliente em risco (Fase 31, 1.101).
 *
 * "Detrator do NPS + reclamação aberta + conta que parou de usar: um sinal
 * só, antes do cancelamento, com o histórico inteiro." Cada frente via o
 * seu pedaço: o NPS via o detrator, o quadro via a reclamação, a retenção
 * via o pedido de cancelamento. Aqui os pedaços se juntam por cliente — a
 * mesma chave da retenção (conta, CPF/CNPJ, e-mail) — e **dois ou mais**
 * sinais diferentes fazem o cliente entrar na lista.
 *
 * "Conta que parou de usar" não entra: a plataforma não tem o uso da
 * conta (o cadastro diz só "Ativo"). Quando tiver, é mais um sinal aqui.
 */

export type SinalDeRisco = "reclamacao-aberta" | "detrator" | "pedido-de-cancelamento" | "marcado-churn" | "reincidente";

export const ROTULO_DO_RISCO: Record<SinalDeRisco, string> = {
  "reclamacao-aberta": "reclamação aberta",
  detrator: "detrator no NPS",
  "pedido-de-cancelamento": "pediu para cancelar",
  "marcado-churn": "marcado como risco de churn",
  reincidente: "reincidente (2+ reclamações em 90 dias)",
};

export interface CasoParaRisco {
  protocolo: string;
  cliente: string;
  aberto: boolean;
  churn: boolean;
  criadoEm: string;
  contaId?: string;
  contaNome?: string;
  documento?: string;
  email?: string;
}

export interface NpsParaRisco {
  id: string;
  cliente: string;
  nota: number;
  respondidoEm: string;
  encerrado: boolean;
  contaId?: string;
  email?: string;
}

export interface ClienteEmRisco {
  chave: string;
  nome: string;
  sinais: SinalDeRisco[];
  protocolos: string[];
  nps: string[];
  /** O sinal mais recente (ISO) — a lista vem do mais recente. */
  ultimo: string;
}

const DIAS_DO_DETRATOR = 60;
const DIAS_DA_REINCIDENCIA = 90;

const digitos = (v?: string) => String(v ?? "").replace(/\D/g, "");

export function chaveDoCliente(c: { contaId?: string; documento?: string; email?: string }, reserva: string) {
  if (c.contaId) return `conta:${c.contaId}`;
  const d = digitos(c.documento);
  if (d.length === 11 || d.length === 14) return `doc:${d}`;
  if (c.email && !c.email.includes("•")) return `email:${c.email.toLowerCase()}`;
  return reserva;
}

export function clientesEmRisco(entrada: {
  casos: CasoParaRisco[];
  nps: NpsParaRisco[];
  /** As chaves dos clientes com pedido de cancelamento ainda em aberto (a conta da retenção). */
  pedidosEmAberto?: Set<string>;
  agora?: Date;
}): ClienteEmRisco[] {
  const agora = (entrada.agora ?? new Date()).getTime();
  const grupos = new Map<string, { nome: string; sinais: Set<SinalDeRisco>; protocolos: Set<string>; nps: Set<string>; ultimo: string; criados: string[] }>();
  const porEmail = new Map<string, string>();

  const grupo = (chave: string, nome: string) => {
    const g = grupos.get(chave) ?? { nome, sinais: new Set<SinalDeRisco>(), protocolos: new Set<string>(), nps: new Set<string>(), ultimo: "", criados: [] };
    grupos.set(chave, g);
    return g;
  };
  const marcar = (g: { ultimo: string }, quando: string) => {
    if (quando > g.ultimo) g.ultimo = quando;
  };

  for (const c of entrada.casos) {
    const chave = chaveDoCliente(c, `caso:${c.protocolo}`);
    if (c.email) porEmail.set(c.email.toLowerCase(), chave);
    const g = grupo(chave, c.contaNome || c.cliente);
    g.criados.push(c.criadoEm);
    if (c.aberto) {
      g.sinais.add("reclamacao-aberta");
      g.protocolos.add(c.protocolo);
      marcar(g, c.criadoEm);
    }
    if (c.churn) {
      g.sinais.add("marcado-churn");
      g.protocolos.add(c.protocolo);
      marcar(g, c.criadoEm);
    }
  }

  for (const g of grupos.values()) {
    const recentes = g.criados.filter((q) => agora - Date.parse(q) <= DIAS_DA_REINCIDENCIA * 86_400_000);
    if (recentes.length >= 2) g.sinais.add("reincidente");
  }

  for (const r of entrada.nps) {
    if (r.nota > 6 || agora - Date.parse(r.respondidoEm) > DIAS_DO_DETRATOR * 86_400_000) continue;
    /* O NPS só cruza por conta ou e-mail (ver a nota de identidade do NPS). */
    const chave = r.contaId ? `conta:${r.contaId}` : r.email ? porEmail.get(r.email.toLowerCase()) ?? `email:${r.email.toLowerCase()}` : `nps:${r.id}`;
    const g = grupo(chave, r.cliente);
    g.sinais.add("detrator");
    g.nps.add(r.id);
    marcar(g, r.respondidoEm);
  }

  for (const chave of entrada.pedidosEmAberto ?? []) {
    const g = grupos.get(chave);
    if (g) g.sinais.add("pedido-de-cancelamento");
  }

  return [...grupos.entries()]
    .filter(([, g]) => g.sinais.size >= 2)
    .map(([chave, g]) => ({ chave, nome: g.nome, sinais: [...g.sinais], protocolos: [...g.protocolos], nps: [...g.nps], ultimo: g.ultimo }))
    .sort((a, b) => b.sinais.length - a.sinais.length || b.ultimo.localeCompare(a.ultimo));
}
