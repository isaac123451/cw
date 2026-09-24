import type { Case } from "@/lib/models/case";
import { nomeDoCliente, type NpsResponseView } from "@/lib/models/nps";
import { emptySimulation, getRawCounts, pendingEvaluations, scoreFrom, simulate } from "@/lib/services/reputation.service";

/**
 * O Prêmio Reclame Aqui (Fase 23).
 *
 * "Exportar todos os contatos que me avaliaram positivamente … para
 * pedir para votarem nos prêmios Reclame Aqui." O voto vem de quem já
 * foi bem atendido — e a base sabe quem são: quem avaliou a reclamação
 * como resolvida, com nota alta ou dizendo que voltaria, e os promotores
 * do NPS. Aqui mora a lista certa; o banco guarda quem já recebeu o
 * pedido, para ninguém ser pedido duas vezes.
 */

export type OrigemDoContato = "reclame-aqui" | "nps";

export interface FiltrosDoPremio {
  /** Reclame Aqui: avaliou como resolvido. */
  resolvido: boolean;
  /** Reclame Aqui: disse que voltaria a fazer negócio. */
  voltaria: boolean;
  /** Reclame Aqui: nota mínima do consumidor (0 a 10); 0 é "qualquer". */
  notaMinima: number;
  /** NPS: promotores (9 e 10). */
  promotores: boolean;
  /** NPS: só quem publicou 5 estrelas no Google. */
  googleCinco: boolean;
  /** AAAA-MM-DD, pela data da avaliação (RA) ou da resposta (NPS). */
  de?: string;
  ate?: string;
  frentes: OrigemDoContato[];
}

export const FILTROS_PADRAO: FiltrosDoPremio = {
  resolvido: true,
  voltaria: false,
  notaMinima: 7,
  promotores: true,
  googleCinco: false,
  frentes: ["reclame-aqui", "nps"],
};

export interface ContatoDoPremio {
  origem: OrigemDoContato;
  /** O id do caso (portal) ou da resposta do NPS. */
  ref: string;
  nome: string;
  telefone?: string;
  /** +55DDDNÚMERO, o formato que o WhatsApp aceita em lista. */
  telefoneInternacional?: string;
  email?: string;
  /** Por que está na lista: "avaliou 10, resolvido", "promotor 9". */
  motivo: string;
  /** AAAA-MM-DD da avaliação ou da resposta. */
  data: string;
}

/**
 * O telefone no formato internacional do Brasil, ou `undefined` quando
 * não dá para confiar nele (mascarado, curto, longo demais).
 */
export function telefoneInternacional(bruto?: string) {
  if (!bruto || bruto.includes("•") || bruto.includes("*")) return undefined;
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return undefined;
  return `+55${d}`;
}

/** A mensagem com o primeiro nome da pessoa no lugar de {nome} e o link no de {link}. */
export function mensagemParaContato(modelo: string, contato: Pick<ContatoDoPremio, "nome">, link = "") {
  const primeiro = contato.nome.trim().split(/\s+/)[0] ?? "";
  const nome = primeiro && !/^n[ãa]o$/i.test(primeiro) ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
  return modelo
    .replace(/\{nome\}/g, nome)
    .replace(/\{link\}/g, link)
    .replace(/Olá, !/g, "Olá!")
    .replace(/\s+,/g, ",");
}

const naJanela = (dia: string, f: FiltrosDoPremio) => (!f.de || dia >= f.de) && (!f.ate || dia <= f.ate);

/**
 * A lista para o pedido de voto.
 *
 * Um contato por telefone (ou e-mail, sem telefone): quem reclamou duas
 * vezes e respondeu ao NPS recebe um pedido só. Quem já está na campanha
 * (`jaNaCampanha`, pela chave `origem:ref`) fica de fora.
 */
export function contatosDoPremio(entrada: {
  casos: Case[];
  nps: NpsResponseView[];
  filtros: FiltrosDoPremio;
  jaNaCampanha?: ReadonlySet<string>;
}): ContatoDoPremio[] {

  const { filtros: f } = entrada;
  const ja = entrada.jaNaCampanha ?? new Set<string>();
  const lista: ContatoDoPremio[] = [];

  if (f.frentes.includes("reclame-aqui")) {
    for (const c of entrada.casos) {
      if (c.source !== "Reclame Aqui" || !c.evaluated || c.scoreDisregarded) continue;
      const dia = (c.evaluatedAt ?? c.createdAt).slice(0, 10);
      if (!naJanela(dia, f)) continue;
      if (f.resolvido && !c.resolved) continue;
      if (f.voltaria && !c.wouldDoBusiness) continue;
      if (f.notaMinima > 0 && (c.score ?? 0) < f.notaMinima) continue;
      if (ja.has(`reclame-aqui:${c.id}`)) continue;
      lista.push({
        origem: "reclame-aqui",
        ref: c.id,
        nome: c.customer,
        telefone: c.phone,
        telefoneInternacional: telefoneInternacional(c.phone),
        email: c.email,
        motivo: [`avaliou ${c.score ?? "—"}`, c.resolved ? "resolvido" : null, c.wouldDoBusiness ? "voltaria" : null].filter(Boolean).join(", "),
        data: dia,
      });
    }
  }

  if (f.frentes.includes("nps")) {
    for (const r of entrada.nps) {
      if (f.promotores && r.score < 9) continue;
      if (f.googleCinco && r.avaliacaoGoogle?.estrelas !== 5) continue;
      const dia = r.respondedAt ?? "";
      if (dia && !naJanela(dia.slice(0, 10), f)) continue;
      if (ja.has(`nps:${r.id}`)) continue;
      lista.push({
        origem: "nps",
        ref: r.id,
        nome: nomeDoCliente(r),
        telefone: r.phone,
        telefoneInternacional: telefoneInternacional(r.phone),
        email: r.email,
        motivo: [`NPS ${r.score}`, r.avaliacaoGoogle?.estrelas === 5 ? "5 estrelas no Google" : null, r.aceitaCase ? "aceitou ser case" : null].filter(Boolean).join(", "),
        data: dia.slice(0, 10),
      });
    }
  }

  /* Um pedido por pessoa: pelo telefone, e sem telefone pelo e-mail. A avaliação mais recente fica. */
  const porPessoa = new Map<string, ContatoDoPremio>();
  for (const c of lista.sort((a, b) => b.data.localeCompare(a.data))) {
    const chave = c.telefoneInternacional ?? (c.email ? c.email.toLowerCase() : `${c.origem}:${c.ref}`);
    if (!porPessoa.has(chave)) porPessoa.set(chave, c);
  }
  return [...porPessoa.values()];
}

/* ------------------------------------------------------------------ */
/* A campanha de votação                                               */
/* ------------------------------------------------------------------ */

export type SituacaoDoVoto = "exportado" | "pedido" | "lembrete" | "votou";

export const ORDEM_DA_SITUACAO: SituacaoDoVoto[] = ["exportado", "pedido", "lembrete", "votou"];

export const ROTULO_DA_SITUACAO: Record<SituacaoDoVoto, string> = {
  exportado: "a pedir",
  pedido: "pedido feito",
  lembrete: "lembrete feito",
  votou: "disse que votou",
};

/** Quantos em cada passo, e quantos dos pedidos já disseram que votaram. */
export function resumoDaCampanha(pedidos: { situacao: SituacaoDoVoto }[]) {
  const conta = Object.fromEntries(ORDEM_DA_SITUACAO.map((s) => [s, pedidos.filter((p) => p.situacao === s).length])) as Record<SituacaoDoVoto, number>;
  const pedidosFeitos = conta.pedido + conta.lembrete + conta.votou;
  return {
    ...conta,
    total: pedidos.length,
    pedidosFeitos,
    /* De quem recebeu o pedido, quantos disseram que votaram. */
    taxaDeVoto: pedidosFeitos ? conta.votou / pedidosFeitos : 0,
  };
}

/** A mensagem da vez: o pedido para quem ainda não recebeu; o lembrete para quem recebeu e não votou. */
export function mensagemDaVez(
  pedido: { situacao: SituacaoDoVoto; nome: string },
  campanha: { mensagem?: string; lembrete?: string; linkVotacao?: string }
) {
  if (pedido.situacao === "votou") return "";
  const modelo = pedido.situacao === "exportado" ? campanha.mensagem : campanha.lembrete || campanha.mensagem;
  return modelo ? mensagemParaContato(modelo, pedido, campanha.linkVotacao ?? "") : "";
}

/** O link que abre a conversa no WhatsApp com a mensagem escrita; `null` sem telefone. */
export function linkDoWhatsApp(telefone: string | undefined, texto: string) {
  const d = telefone?.replace(/\D/g, "");
  if (!d || d.length < 12) return null;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/* ------------------------------------------------------------------ */
/* O prêmio no calendário                                              */
/* ------------------------------------------------------------------ */

/**
 * A janela do índice na data de corte: os seis meses fechados antes do
 * mês do corte — a mesma regra da janela "vigente" do portal, olhada
 * daquele dia.
 */
export function janelaNaDataDeCorte(dataDeCorte: string) {
  const [ano, mes] = dataDeCorte.split("-").map(Number);
  const fim = new Date(Date.UTC(ano, mes - 1, 0)).toISOString().slice(0, 10);
  const inicio = new Date(Date.UTC(ano, mes - 7, 1)).toISOString().slice(0, 10);
  return { inicio, fim };
}

/**
 * A reputação chega onde precisa até a data de corte?
 *
 * A nota da janela do corte hoje, e quantas avaliações nota 10 — entre
 * as reclamações da janela ainda sem avaliação — levam a nota até a
 * meta, pela mesma conta da calculadora (`simulate`). `faltam: null` é
 * "nem com todas avaliando 10".
 */
export function premioNoCalendario(entrada: { casos: Case[]; dataDeCorte: string; notaMeta: number; hoje: string }) {
  const janela = janelaNaDataDeCorte(entrada.dataDeCorte);
  const doPeriodo = entrada.casos.filter((c) => c.source === "Reclame Aqui" && c.createdAt >= janela.inicio && c.createdAt <= janela.fim);
  const base = getRawCounts(doPeriodo);
  const atual = scoreFrom(base);
  const avaliaveis = pendingEvaluations(base);
  const dias = Math.round((Date.parse(`${entrada.dataDeCorte}T00:00:00Z`) - Date.parse(`${entrada.hoje}T00:00:00Z`)) / 86_400_000);

  let faltam: number | null = null;
  if (!atual.scoreUnavailable && atual.raScore >= entrada.notaMeta) faltam = 0;
  else {
    for (let n = 1; n <= avaliaveis; n++) {
      const s = scoreFrom(simulate(base, { ...emptySimulation, ratings: { 10: n } }));
      if (!s.scoreUnavailable && s.raScore >= entrada.notaMeta) {
        faltam = n;
        break;
      }
    }
  }

  return {
    janela,
    reclamacoes: doPeriodo.length,
    nota: atual.scoreUnavailable ? null : atual.raScore,
    avaliaveis,
    faltam,
    diasAteOCorte: dias,
  };
}
