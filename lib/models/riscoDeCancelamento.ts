import { sinaisDoTexto } from "@/lib/models/cancelamento";
import { criteriosPeloTexto, normalizarTexto } from "@/lib/models/sugestaoPorTexto";

/**
 * A chance de o cliente cancelar, reclamação por reclamação (1.113).
 *
 * "Reclamações precisam ter alguma coisa de identificação pela extensão
 * para verificar uma chance do cliente cancelar." E: "pense em algo
 * voltado para retenção no Reclame Aqui, artimanhas que ajudem, algo como
 * em recuperação também."
 *
 * **Os motivos** vêm do que o CW já sabe, sem IA: o relato (pedido de
 * cancelamento, ameaça de trocar de sistema, "já cancelei"), os critérios
 * da triagem (operação parada, jurídico, prejuízo, cobrança depois do
 * cancelamento, prazo descumprido), a repetição (outras reclamações do
 * mesmo CPF/CNPJ), o NPS da conta (detrator recente), o tom e o relógio
 * (prazo estourado). Cada motivo pesa; a soma dá o nível.
 *
 * **As atitudes** são o que fazer por motivo — retenção enquanto o cliente
 * está aqui, recuperação quando ele já saiu. A primeira é sempre a de
 * maior efeito: ligar no mesmo dia útil.
 *
 * O número é uma régua de atenção, não uma previsão: diz por que, e a
 * pessoa decide.
 */

export type NivelDeRisco = "alto" | "medio" | "baixo" | "cancelou";

export interface EntradaDoRisco {
  titulo: string;
  relato: string;
  categoria?: string;
  subcategoria?: string;
  /** Critérios marcados na triagem. */
  criterios?: string[];
  /** Outras reclamações do mesmo CPF/CNPJ nos 90 dias antes desta. */
  reincidencia?: number;
  /** Nota de NPS 0–6 da mesma conta (ou e-mail) nos últimos 60 dias. */
  detratorRecente?: number | null;
  prazoEstourado?: boolean;
  /** Marcado como risco de churn na ficha. */
  churn?: boolean;
  avaliado?: boolean;
  voltaria?: boolean;
  resolvido?: boolean;
}

export interface MotivoDoRisco {
  id: string;
  texto: string;
  peso: number;
  trecho?: string;
}

export interface Atitude {
  id: string;
  texto: string;
  /** "retencao" enquanto o cliente está; "recuperacao" quando já saiu. */
  tipo: "retencao" | "recuperacao";
}

export interface RiscoDeCancelamento {
  nivel: NivelDeRisco;
  pontos: number;
  motivos: MotivoDoRisco[];
  atitudes: Atitude[];
}

export const ROTULO_DO_NIVEL: Record<NivelDeRisco, string> = {
  alto: "Chance alta de cancelar",
  medio: "Chance média de cancelar",
  baixo: "Chance baixa de cancelar",
  cancelou: "Já cancelou — recuperação",
};

const AMEACA =
  /(procurar|buscar|ir para|mudar para|migrar para|trocar (de|por)|contratar) (outr[oa]|um novo|uma nova|a concorrencia|concorrente)( (sistema|plataforma|empresa|cardapio|app))?|concorrente|vou (sair|embora|parar de usar)|nao (vou|quero|pretendo) (mais )?continuar|ultima chance|nao (indico|recomendo)|arrependid[oa] de ter contratado/;
const FINANCEIRO = /cobran[cç]a indevida|cobrad[oa] (a mais|duas vezes|em dobro|indevidamente)|estorno|reembolso|devolu[cç][aã]o do (valor|dinheiro)|boleto|fatura|mensalidade/;

const PESO: Record<string, number> = {
  pedido: 50,
  ameaca: 35,
  "operacao-parada": 20,
  juridico: 20,
  prejuizo: 15,
  "cobranca-pos-cancelamento": 20,
  financeiro: 12,
  "prazo-descumprido": 12,
  reincidencia: 15,
  reincidencia2: 25,
  detrator: 15,
  churn: 30,
  tom: 10,
  prazo: 10,
  "nao-voltaria": 20,
};

const ATITUDES: Record<string, Atitude[]> = {
  base: [
    { id: "ligar", tipo: "retencao", texto: "Ligue ainda neste dia útil, antes de responder no portal — cancelamento se reverte na voz, não por escrito." },
  ],
  pedido: [
    { id: "motivo-real", tipo: "retencao", texto: "Pergunte o motivo real e o que faria o cliente ficar; resolva o problema antes de falar em condição." },
    { id: "proposta", tipo: "retencao", texto: "Se couber proposta (desconto, mês sem custo, troca de plano), faça por voz e registre no caso o que foi combinado e até quando." },
  ],
  ameaca: [
    { id: "dono", tipo: "retencao", texto: "Dê um responsável com nome e um próximo contato marcado — quem ameaça trocar quer ver que alguém assumiu." },
  ],
  "operacao-parada": [
    { id: "urgente", tipo: "retencao", texto: "Operação parada: acione a área técnica na hora e dê notícia a cada poucas horas até voltar — é o motivo que mais leva a cancelar." },
  ],
  juridico: [
    { id: "juridico", tipo: "retencao", texto: "Com Procon ou advogado no relato, alinhe com a liderança antes de qualquer proposta por escrito." },
  ],
  financeiro: [
    { id: "valor", tipo: "retencao", texto: "Acerte a cobrança ou o estorno primeiro, com prazo e comprovante — retenção sem corrigir o valor não se sustenta." },
  ],
  "cobranca-pos-cancelamento": [
    { id: "cobranca-apos", tipo: "retencao", texto: "Cobrança depois de cancelar: cancele a cobrança e confirme por escrito no privado; só depois pergunte se dá para reconquistar." },
  ],
  reincidencia: [
    { id: "historico", tipo: "retencao", texto: "Leia as reclamações anteriores antes de ligar e reconheça a repetição — ninguém fica depois de explicar a mesma coisa de novo." },
  ],
  detrator: [
    { id: "nps", tipo: "retencao", texto: "É o mesmo cliente do NPS baixo: trate as duas coisas no mesmo contato e registre nos dois." },
  ],
  "prazo-descumprido": [
    { id: "prazo-concreto", tipo: "retencao", texto: "Um prazo já foi quebrado: dê um prazo novo que dá para cumprir e avise antes de ele vencer." },
  ],
  avaliar: [
    { id: "avaliacao", tipo: "retencao", texto: "Retido? Só então peça a avaliação — com o problema resolvido e o combinado cumprido." },
  ],
  cancelou: [
    { id: "resolver-mesmo-assim", tipo: "recuperacao", texto: "Mesmo cancelado, resolva a reclamação e responda bem: a avaliação conta na nota e o cliente conta para os outros." },
    { id: "motivo", tipo: "recuperacao", texto: "Registre o motivo do cancelamento na causa raiz — é o que o Produto precisa para ninguém mais sair por ele." },
    { id: "reconquista", tipo: "recuperacao", texto: "Recuperação: um contato entre 7 e 15 dias depois, com o problema resolvido e uma condição de volta." },
  ],
};

/** O nível e os motivos de uma reclamação. */
export function riscoDeCancelamento(e: EntradaDoRisco): RiscoDeCancelamento {
  const texto = `${e.titulo}\n${e.relato}`;
  const normal = normalizarTexto(texto);
  const motivos: MotivoDoRisco[] = [];
  const add = (id: string, textoDoMotivo: string, trecho?: string) => {
    if (!motivos.some((m) => m.id === id)) motivos.push({ id, texto: textoDoMotivo, peso: PESO[id] ?? 10, trecho });
  };

  const sinais = sinaisDoTexto(texto);
  const cancelou = sinais.find((s) => s.tipo === "cancelado");
  const pedido = sinais.find((s) => s.tipo === "pedido");
  const criteriosDoTexto = criteriosPeloTexto(texto);
  const criterios = new Set([...(e.criterios ?? []), ...criteriosDoTexto.map((c) => c.criterio)]);
  const trechoDo = (id: string) => criteriosDoTexto.find((c) => c.criterio === id)?.trecho;

  if (pedido || /cancel/i.test(`${e.categoria ?? ""} ${e.subcategoria ?? ""}`) || criterios.has("cancelamento")) {
    add("pedido", "pediu para cancelar", pedido?.trecho || trechoDo("cancelamento"));
  }
  const ameaca = AMEACA.exec(normal);
  if (ameaca) add("ameaca", "fala em trocar de sistema ou não continuar", ameaca[0]);
  if (criterios.has("operacao-parada")) add("operacao-parada", "operação parada", trechoDo("operacao-parada"));
  if (criterios.has("juridico")) add("juridico", "Procon, advogado ou ação", trechoDo("juridico"));
  if (criterios.has("prejuizo")) add("prejuizo", "prejuízo financeiro do estabelecimento", trechoDo("prejuizo"));
  if (criterios.has("cobranca-pos-cancelamento")) add("cobranca-pos-cancelamento", "cobrança depois de cancelar", trechoDo("cobranca-pos-cancelamento"));
  if (criterios.has("financeiro") || FINANCEIRO.test(normal)) add("financeiro", "cobrança ou valor em disputa", trechoDo("financeiro"));
  if (criterios.has("prazo-descumprido")) add("prazo-descumprido", "prazo combinado não cumprido", trechoDo("prazo-descumprido"));
  if ((e.reincidencia ?? 0) >= 2) add("reincidencia2", `${(e.reincidencia ?? 0) + 1}ª reclamação do mesmo CPF/CNPJ em 90 dias`);
  else if ((e.reincidencia ?? 0) === 1) add("reincidencia", "2ª reclamação do mesmo CPF/CNPJ em 90 dias");
  if (e.detratorRecente !== null && e.detratorRecente !== undefined) add("detrator", `deu nota ${e.detratorRecente} no NPS nos últimos 60 dias`);
  if (e.churn) add("churn", "marcado como risco de churn");
  const irritacao = normal.match(/\b(absurd|descaso|vergonh|pessim|horrivel|ridicul|lixo|revoltad|indignad|inadmissivel|inaceitavel|desrespeit|enganad|golpe|nunca mais)/g)?.length ?? 0;
  if (irritacao >= 2) add("tom", "relato muito irritado");
  if (e.prazoEstourado) add("prazo", "o prazo do atendimento já estourou");
  if (e.avaliado && !e.voltaria) add("nao-voltaria", "avaliou dizendo que não voltaria a fazer negócio");

  let pontos = motivos.reduce((s, m) => s + m.peso, 0);
  /* Avaliou dizendo que voltaria: o risco cai bastante — ficou. */
  if (e.avaliado && e.voltaria) pontos = Math.max(0, pontos - 30);
  pontos = Math.min(100, pontos);

  const nivel: NivelDeRisco = cancelou ? "cancelou" : pontos >= 50 ? "alto" : pontos >= 25 ? "medio" : "baixo";

  const atitudes: Atitude[] = [];
  const juntar = (lista?: Atitude[]) => {
    for (const a of lista ?? []) if (!atitudes.some((x) => x.id === a.id)) atitudes.push(a);
  };
  if (nivel === "cancelou") {
    juntar(ATITUDES.cancelou);
    if (motivos.some((m) => m.id === "cobranca-pos-cancelamento" || m.id === "financeiro")) juntar(ATITUDES["cobranca-pos-cancelamento"]);
  } else if (nivel !== "baixo") {
    juntar(ATITUDES.base);
    for (const m of [...motivos].sort((a, b) => b.peso - a.peso)) {
      const chave = m.id === "reincidencia2" ? "reincidencia" : m.id === "prejuizo" ? "financeiro" : m.id;
      juntar(ATITUDES[chave]);
    }
    juntar(ATITUDES.avaliar);
  }

  return {
    nivel,
    pontos,
    motivos: [...motivos].sort((a, b) => b.peso - a.peso),
    atitudes: atitudes.slice(0, 5),
  };
}
