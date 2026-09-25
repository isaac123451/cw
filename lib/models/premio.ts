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
  /**
   * Quão boa é a lembrança dessa pessoa — ordena os indicados.
   * Nota 10, resolvido e "voltaria" pesam mais; promotor 10 mais que 9.
   */
  forca: number;
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
        forca: Math.max(0, (c.score ?? 0) - 7) + (c.resolved ? 2 : 0) + (c.wouldDoBusiness ? 1 : 0),
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
        forca: Math.max(0, r.score - 8) + (r.avaliacaoGoogle?.estrelas === 5 ? 1 : 0) + (r.aceitaCase ? 1 : 0),
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

/* ------------------------------------------------------------------ */
/* Depoimentos prontos                                                 */
/* ------------------------------------------------------------------ */

export interface Depoimento {
  origem: "nps" | "google";
  ref: string;
  autor: string;
  fala: string;
  nota: number;
  data: string;
  /** Pode ir para a campanha e para o marketing sem pedir de novo. */
  liberado: boolean;
  /** Por que está liberado — ou o que falta para estar. */
  uso: string;
  link?: string;
}

/* Uma ressalva no meio do elogio ("ótimo, mas demorou") não serve de depoimento. */
const RESSALVA = /\b(mas|porem|entretanto|contudo|so que|poderia|deveria|demor|problema|ruim|pessimo|falha|erro|bug|nao gostei|reclam)/;
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * As melhores falas de quem gosta da Cardápio Web.
 *
 * Os promotores do NPS com comentário e as avaliações 5 estrelas do
 * Google com texto; sem ressalva, de 25 caracteres para cima. Primeiro
 * quem aceitou ser case, depois o que já é público (o Google), depois o
 * resto — que precisa de autorização antes de ir para o marketing.
 */
export function depoimentosDoPremio(entrada: {
  nps: NpsResponseView[];
  google?: { id: string; estrelas: number; autor: string; texto?: string; identificado: boolean; publicadaEm: string; link?: string }[];
}): Depoimento[] {

  const lista: Depoimento[] = [];

  for (const r of entrada.nps) {
    const fala = r.comment?.trim() ?? "";
    if (r.score < 9 || fala.length < 25 || RESSALVA.test(semAcento(fala))) continue;
    lista.push({
      origem: "nps",
      ref: r.id,
      autor: nomeDoCliente(r),
      fala,
      nota: r.score,
      data: (r.respondedAt ?? "").slice(0, 10),
      liberado: r.aceitaCase === true,
      uso: r.aceitaCase === true ? "aceitou ser case" : "comentário privado do NPS: pedir autorização antes de publicar",
    });
  }

  for (const g of entrada.google ?? []) {
    const fala = g.texto?.trim() ?? "";
    if (g.estrelas !== 5 || !g.identificado || fala.length < 25 || RESSALVA.test(semAcento(fala))) continue;
    lista.push({
      origem: "google",
      ref: g.id,
      autor: g.autor,
      fala,
      nota: 5,
      data: g.publicadaEm.slice(0, 10),
      liberado: true,
      uso: "avaliação pública no Google",
      link: g.link,
    });
  }

  /* Liberado primeiro (case, depois Google), e dentro de cada grupo a fala de tamanho bom e mais recente. */
  const peso = (d: Depoimento) => (d.origem === "nps" && d.liberado ? 0 : d.origem === "google" ? 1 : 2);
  const tamanho = (d: Depoimento) => Math.abs(Math.min(d.fala.length, 400) - 160);
  return lista.sort((a, b) => peso(a) - peso(b) || tamanho(a) - tamanho(b) || b.data.localeCompare(a.data));
}

/** O depoimento pronto para colar: a fala entre aspas e quem disse. */
export function textoDoDepoimento(d: Pick<Depoimento, "fala" | "autor">) {
  return `“${d.fala.replace(/\s+/g, " ")}” — ${d.autor}, cliente Cardápio Web`;
}

/* ------------------------------------------------------------------ */
/* Pedir o voto como o pedir avaliação (1.76)                          */
/* ------------------------------------------------------------------ */

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/**
 * Os indicados para pedir o voto agora: com telefone, fora da campanha,
 * a melhor lembrança primeiro e a mais recente como desempate.
 *
 * Quem avaliou há pouco lembra do atendimento — os últimos 90 dias ganham
 * dois pontos, até 180 dias um. É a mesma ideia do pedir avaliação: a
 * lista do dia, e não a base inteira numa planilha.
 */
export function indicadosParaPedir(contatos: ContatoDoPremio[], hoje: string): ContatoDoPremio[] {
  const recencia = (c: ContatoDoPremio) => {
    if (!c.data) return 0;
    const d = diasEntre(c.data, hoje);
    return d <= 90 ? 2 : d <= 180 ? 1 : 0;
  };
  return contatos
    .filter((c) => c.telefoneInternacional)
    .map((c) => ({ c, pontos: c.forca + recencia(c) }))
    .sort((a, b) => b.pontos - a.pontos || b.c.data.localeCompare(a.c.data))
    .map((x) => x.c);
}

/** Um lembrete só, 3 dias depois do pedido: quem já passou disso e não votou. */
export const DIAS_PARA_LEMBRAR = 3;

export function lembretesDaVez<T extends { situacao: SituacaoDoVoto; pedidoEm?: string; telefone?: string }>(pedidos: T[], hoje: string): T[] {
  return pedidos.filter((p) => p.situacao === "pedido" && p.pedidoEm && p.telefone && diasEntre(p.pedidoEm, hoje) >= DIAS_PARA_LEMBRAR);
}

export interface IdeiaDoPremio {
  titulo: string;
  texto: string;
  /** O número da base que sustenta a ideia, quando há. */
  numero?: string;
}

/**
 * Ideias e estratégias da campanha, com os números desta base.
 *
 * Nada de promessa sobre o regulamento do prêmio: são as alavancas que a
 * operação controla — quem pedir primeiro, quando pedir, quantas vezes e
 * onde deixar o link.
 */
export function ideiasDoPremio(entrada: {
  indicados: ContatoDoPremio[];
  pedidos: { situacao: SituacaoDoVoto; pedidoEm?: string; telefone?: string }[];
  hoje: string;
  votacaoFim?: string;
}): IdeiaDoPremio[] {
  const { indicados, pedidos, hoje } = entrada;
  const recentes = indicados.filter((c) => c.origem === "reclame-aqui" && c.data && diasEntre(c.data, hoje) <= 90 && c.forca >= 5).length;
  const promotores = indicados.filter((c) => c.origem === "nps").length;
  const lembrar = lembretesDaVez(pedidos, hoje).length;
  const restam = entrada.votacaoFim ? diasEntre(hoje, entrada.votacaoFim) : null;

  const ideias: IdeiaDoPremio[] = [
    {
      titulo: "Comece por quem lembra do atendimento",
      texto: "Quem avaliou 10, resolvido e voltaria nos últimos 90 dias tem o atendimento fresco na memória — é o pedido com mais chance. Eles vêm primeiro em Pedir o voto.",
      numero: `${recentes} pessoa(s) assim, com telefone`,
    },
    {
      titulo: "Promotores do NPS",
      texto: "Quem deu 9 ou 10 no NPS já disse que recomenda a Cardápio Web. O pedido de voto é o mesmo gesto, em outro lugar.",
      numero: `${promotores} promotor(es) com telefone, fora da campanha`,
    },
    {
      titulo: "Peça no fim de um atendimento que deu certo",
      texto: "Quando o cliente agradece pela solução, o link da votação no fechamento da conversa pega o melhor momento — o mesmo do pedido de avaliação.",
    },
    {
      titulo: "Um lembrete só",
      texto: `Depois do pedido, um lembrete ${DIAS_PARA_LEMBRAR} dias depois, e só. Insistir mais vira incômodo e pode virar reclamação.`,
      numero: lembrar > 0 ? `${lembrar} pedido(s) já passaram de ${DIAS_PARA_LEMBRAR} dias sem lembrete` : undefined,
    },
    {
      titulo: "O link onde o cliente já está",
      texto: "Assinatura do e-mail do suporte, mensagem de encerramento do atendimento e stories da marca durante a votação — sem abordagem nova, só o link no caminho.",
    },
    {
      titulo: "Depoimentos para as redes",
      texto: "As falas de quem avaliou bem viram posts com o link da votação: prova social de gente real, com autorização. Estão prontos logo abaixo.",
    },
  ];

  if (restam !== null) {
    ideias.unshift({
      titulo: restam >= 0 ? "O relógio da votação" : "A votação fechou",
      texto: restam >= 0 ? "Distribua os pedidos até a última semana e deixe os lembretes para os dias finais." : "Registre quem disse que votou e guarde a lista para o próximo ano.",
      numero: restam >= 0 ? `${restam} dia(s) até fechar` : undefined,
    });
  }
  return ideias;
}
