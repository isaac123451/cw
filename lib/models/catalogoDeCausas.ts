import { AREAS_INTERNAS } from "@/lib/models/mensagens";
import type { FrenteId } from "@/lib/models/frentes";
import { normalizarTexto, PARADAS, regrasDeCausa, trechoDoPadrao, type RegraDeTexto } from "@/lib/models/sugestaoPorTexto";

/**
 * O catálogo de causas raiz tirado da base (Fase 27).
 *
 * "Crie causas raiz conforme os casos que já tiveram para direcionar
 * corretamente." A lista de partida — Bug, Cobrança, Atendimento — diz o
 * tipo do problema, não para quem ligar: "Bug" é a impressora que não
 * imprime (Suporte N2), o iFood que não integra (Suporte N2) e o sistema
 * fora do ar (Desenvolvimento). As famílias abaixo são os assuntos que
 * se repetem nos relatos do Reclame Aqui, nos comentários do NPS, nas
 * redes e no Google de uma plataforma de cardápio digital e delivery,
 * cada uma com a área que resolve e o prazo interno.
 *
 * Ninguém cadastra daqui: `propostaDoCatalogo` conta quantos registros
 * reais caem em cada família, com dois exemplos, e a pessoa aprova o
 * que vira causa — com a área e o prazo que ela disser.
 */

/** Quem resolve: o próprio time de atendimento ou uma das áreas acionáveis. */
export const AREAS_DAS_CAUSAS = ["Atendimento", ...AREAS_INTERNAS.map((a) => a.nome)] as const;

/** Prazos internos oferecidos, em horas corridas de relógio útil. */
export const PRAZOS_DAS_CAUSAS = [4, 24, 48, 72, 168] as const;

export function rotuloDoPrazo(horas?: number | null) {
  if (!horas) return "sem prazo";
  if (horas % 24 === 0) return horas === 24 ? "1 dia útil" : `${horas / 24} dias úteis`;
  return `${horas} h úteis`;
}

export interface FamiliaDeCausa {
  id: string;
  /** O nome que vira a causa no catálogo. */
  nome: string;
  descricao: string;
  area: (typeof AREAS_DAS_CAUSAS)[number];
  prazoHoras: number;
  /** As palavras que a pessoa lê — o `padrao` é a versão que a máquina usa. */
  palavras: string[];
  /** Sobre texto normalizado: minúsculo, sem acento. */
  padrao: RegExp;
  /** As causas genéricas da lista de partida que esta família detalha. */
  detalha: string[];
}

/*
  A ordem importa: o registro vai para a primeira família que casa, da
  mais específica para a mais genérica. "Cobraram depois que cancelei"
  é cobrança pós-cancelamento, não cancelamento; "cupom fiscal" é nota
  fiscal, não cupom de desconto; o pedido de pizza que não chegou é do
  restaurante, não da taxa de entrega.
*/
export const FAMILIAS_DE_CAUSA: FamiliaDeCausa[] = [
  {
    id: "consumidor-final",
    nome: "Pedido do consumidor ao restaurante",
    descricao: "Quem reclama é o cliente do restaurante: o pedido não chegou, veio errado ou foi cancelado pela loja. O caso é orientar e encaminhar ao estabelecimento.",
    area: "Atendimento",
    prazoHoras: 24,
    palavras: ["meu pedido não chegou", "meu pedido veio errado", "pedi uma pizza", "o restaurante cancelou"],
    /*
      Só o que é fala de quem comprou: "meu pedido não chegou", "pedi uma
      pizza". O lojista também fala de pedido e de pizza ("os pedidos de
      pizza não imprimem") — e esse é caso de impressão, não daqui.
    */
    padrao: /\bmeu pedido (nao|veio|atras|foi cancelad|chegou)|(restaurante|lanchonete|pizzaria|hamburgueria|estabelecimento) (cancelou|nao (entregou|me respond|devolv))|nao recebi (o |meu )?pedido|pedi (uma|um|o|a) (pizza|lanche|comida|marmita|acai|hamburguer|esfiha)|(comida|lanche|pizza) (chegou|veio) (fri|errad|estragad)/,
    detalha: ["Logística", "Outro"],
  },
  {
    id: "repasse",
    nome: "Repasse e pagamento online",
    descricao: "O dinheiro das vendas pelo pagamento online (Pix, cartão no app) não caiu, caiu menor ou ficou retido.",
    area: "Financeiro",
    prazoHoras: 24,
    palavras: ["repasse", "pagamento online", "Pix não caiu", "saldo retido", "antecipação", "saque"],
    padrao: /\brepasses?\b|pagamentos? (online|pelo app|pelo site)|\bpix\b.{0,30}(nao (caiu|chegou|recebi)|retid|preso)|(dinheiro|saldo|valor)(es)? (esta |ficou |foi )?(retid|preso|bloquead)|antecipac|\bsaques?\b|conta digital|subconta|nao (recebi|caiu|cairam) (o |os |meu |meus )?(repasse|valor|dinheiro|pagamento)s?\b/,
    detalha: ["Cobrança", "Bug"],
  },
  {
    id: "cobranca-pos-cancelamento",
    nome: "Cobrança depois de cancelar",
    descricao: "Cancelou e continuou sendo cobrado, renovação automática contestada ou multa de fidelidade.",
    area: "Financeiro",
    prazoHoras: 24,
    palavras: ["cancelei e continuam cobrando", "renovação automática", "multa de fidelidade"],
    padrao: /(cancelei|cancelad[oa]|cancelamento (feito|solicitado|realizado|confirmado)|apos (o )?cancelamento|depois (do|de) cancelar).{0,80}(cobra|debit|boleto|fatura|mensalidade)|(cobra|debit|boleto|fatura|mensalidade).{0,80}(apos|depois d[oe]) (o )?cancel|renovac(ao|oes) automatica|renovou (sozinh|automatic)|multa (de|por) (cancelamento|rescisao|fidelidade)|clausula de fidelidade/,
    detalha: ["Cobrança"],
  },
  {
    id: "cancelamento",
    nome: "Pedido de cancelamento do plano",
    descricao: "Quer cancelar o contrato, sair do plano ou trocar de sistema — risco de churn.",
    area: "Comercial",
    prazoHoras: 24,
    palavras: ["cancelar o plano", "cancelar o contrato", "rescisão", "trocar de sistema"],
    padrao: /cancel(ar|amento|ei) (o |do |meu |minha |a |da )?(contrato|plano|assinatura|servico|sistema|conta)|(quero|vou|preciso|gostaria de|desejo) cancelar|rescis|trocar de (sistema|plataforma|empresa)|nao (vou |quero )?renovar/,
    detalha: ["Expectativa não atendida", "Preço"],
  },
  {
    id: "fiscal",
    nome: "Nota fiscal e emissão fiscal",
    descricao: "Nota fiscal do plano, NFC-e das vendas, certificado digital e SAT.",
    area: "Financeiro",
    prazoHoras: 48,
    palavras: ["nota fiscal", "NFC-e", "cupom fiscal", "certificado digital", "SAT"],
    padrao: /nota fiscal|notas fiscais|\bnfc ?-?e\b|\bnf ?-?e\b|cupom fiscal|\bsat\b|emissao fiscal|emitir (a )?nota|certificado digital/,
    detalha: ["Bug", "Cobrança"],
  },
  {
    id: "cobranca",
    nome: "Cobrança e mensalidade",
    descricao: "Mensalidade, boleto, reajuste, valor cobrado a mais, estorno e reembolso.",
    area: "Financeiro",
    prazoHoras: 48,
    palavras: ["cobrança indevida", "mensalidade", "boleto", "reajuste", "estorno", "reembolso"],
    padrao: /cobran[ca]|cobrad|cobrando|mensalidade|\bboletos?\b|\bfaturas?\b|reajuste|\bestorn|reembols|debitad|cartao de credito|valor(es)? (errad|indevid|a mais|abusiv)|\bjuros\b/,
    detalha: ["Cobrança", "Preço"],
  },
  {
    id: "impressao",
    nome: "Impressão de pedidos",
    descricao: "A impressora não imprime o pedido, imprime duplicado ou a comanda sai errada.",
    area: "Suporte N2",
    prazoHoras: 24,
    palavras: ["impressora", "não imprime", "comanda", "impressão"],
    padrao: /impressora|impressao|impressoes|imprim|comanda/,
    detalha: ["Bug"],
  },
  {
    id: "integracao",
    nome: "Integração com iFood e marketplaces",
    descricao: "O pedido do iFood (ou de outro app) não entra, entra duplicado ou a integração caiu.",
    area: "Suporte N2",
    prazoHoras: 24,
    palavras: ["iFood", "integração", "Anota AI", "99Food", "marketplace"],
    padrao: /\bi ?food\b|integrac|integrad|anota ?ai|\b99 ?food\b|\brappi\b|\bkeeta\b|aiqfome|marketplace/,
    detalha: ["Bug"],
  },
  {
    id: "whatsapp",
    nome: "WhatsApp e robô de atendimento",
    descricao: "O robô do WhatsApp não responde, o número foi banido ou a mensagem automática saiu errada.",
    area: "Desenvolvimento",
    prazoHoras: 24,
    palavras: ["WhatsApp", "robô", "chatbot", "número banido"],
    padrao: /whats ?app|\bzap\b|\brobo\b|chat ?bot|atendente virtual|mensage(m|ns) automatica|(numero|whats) (foi )?(banid|bloquead)/,
    detalha: ["Bug"],
  },
  {
    id: "fora-do-ar",
    nome: "Sistema fora do ar ou lento",
    descricao: "Instabilidade, lentidão, erro na tela ou o sistema parado no horário de pico.",
    area: "Desenvolvimento",
    prazoHoras: 4,
    palavras: ["fora do ar", "instabilidade", "lento", "travando", "erro", "não funciona"],
    padrao: /fora do ar|instabilidade|instave(l|is)|\blent(o|a|idao)\b|travand|\btrava(do|da|ndo)?\b|(sistema|app|aplicativo|site) (caiu|parou|nao (abre|carrega|funciona))|nao carrega|\bbugs?\b|\berros?\b|falhas? (no|na|do|da) (sistema|app|aplicativo|site)|nao funciona|parou de funcionar/,
    detalha: ["Bug"],
  },
  {
    id: "cardapio",
    nome: "Cardápio, produtos e preços",
    descricao: "Produto que some, preço ou adicional errado, foto que não aparece, loja que aparece fechada.",
    area: "Suporte N2",
    prazoHoras: 24,
    palavras: ["produto sumiu", "preço errado", "adicionais", "foto", "loja aparece fechada"],
    padrao: /(meu|no|o|do|nosso|seu) cardapio(?! ?web)|produtos? (sumi|nao aparec|errad|fora|indisponive)|\bfotos? (dos? produtos?|nao)|adicionais|complementos?|precos? (errad|diferente|nao)|horario de funcionamento|(loja|cardapio) (fechad|aparece fechad)/,
    detalha: ["Bug", "Usabilidade"],
  },
  {
    id: "entrega",
    nome: "Taxa e área de entrega",
    descricao: "Taxa de entrega calculada errada, bairro fora da área, raio e frete.",
    area: "Suporte N2",
    prazoHoras: 24,
    palavras: ["taxa de entrega", "área de entrega", "bairro", "frete", "entregador"],
    padrao: /taxa de entrega|taxas de entrega|area de entrega|raio de entrega|\bfrete\b|entregador|motoboy|\bbairros?\b/,
    detalha: ["Logística"],
  },
  {
    id: "cupom",
    nome: "Cupom, desconto e fidelidade",
    descricao: "Cupom que não aplica, desconto errado, cashback ou programa de fidelidade dos clientes.",
    area: "Suporte N2",
    prazoHoras: 24,
    palavras: ["cupom", "desconto", "promoção", "cashback", "programa de fidelidade"],
    padrao: /\bcupo(m|ns)\b|desconto|promoc|cashback|programa de fidelidade|cartao fidelidade/,
    detalha: ["Bug"],
  },
  {
    id: "implantacao",
    nome: "Implantação e ativação",
    descricao: "Implantação atrasada, treinamento, migração, cardápio não cadastrado ou conta não ativada depois de pagar.",
    area: "Implantação",
    prazoHoras: 72,
    palavras: ["implantação", "ativação", "treinamento", "migração", "não foi liberado"],
    padrao: /implantac|implantad|ativac|treinamento|onboarding|migrac|configurac(ao|oes) inicia|cadastr(ar|o|aram) (o |do |meu )?cardapio|nao (foi |foram )?(liberad|ativad)|aguardando (a )?(liberac|ativac)/,
    detalha: ["Implantação"],
  },
  {
    id: "venda",
    nome: "Promessa da venda",
    descricao: "O vendedor prometeu o que o sistema não faz, ou o contratado é diferente do anunciado.",
    area: "Comercial",
    prazoHoras: 48,
    palavras: ["o vendedor disse", "prometeram", "propaganda enganosa", "diferente do contratado"],
    padrao: /vendedor|consultor|propaganda enganosa|prometeram|prometid[oa]|diferente do (anunciad|combinad|contratad)|venda casada|me venderam|na hora (da venda|de vender)/,
    detalha: ["Expectativa não atendida"],
  },
  {
    id: "demora",
    nome: "Demora e falta de retorno",
    descricao: "O suporte não responde, some ou demora dias para dar retorno.",
    area: "Atendimento",
    prazoHoras: 4,
    palavras: ["sem retorno", "ninguém responde", "demora", "dias esperando"],
    padrao: /sem (nenhum |qualquer )?(retorno|resposta|suporte)|ninguem (me )?(responde|retorna|atende|resolve)|nao (me )?(respondem|retornam|atendem)|demora(m|ndo)? (a|para|pra|no|em) (responder|atender|retornar|resolver)|(horas|dias) (esperando|aguardando|sem)|suporte (nao responde|sumiu|inexistente|demora)|falta de (retorno|suporte|resposta)|\bdemora/,
    detalha: ["Atendimento"],
  },
  {
    id: "postura",
    nome: "Postura no atendimento",
    descricao: "Atendente grosseiro, despreparado ou que ignorou o cliente.",
    area: "Atendimento",
    prazoHoras: 24,
    palavras: ["atendimento ruim", "grosseiro", "despreparo", "descaso"],
    padrao: /atendimento (ruim|pessimo|horrivel|despreparad|grosseir|fraco)|atendente|grosseir|mal educad|falta de respeito|descaso|despreparo|ignorad|pouco caso/,
    detalha: ["Atendimento"],
  },
  {
    id: "uso",
    nome: "Dúvida de uso",
    descricao: "Não sabe configurar ou usar uma função que existe.",
    area: "Suporte N2",
    prazoHoras: 48,
    palavras: ["como faço", "não sei configurar", "difícil de usar", "complicado"],
    padrao: /como (faco|fazer|configur|cadastr|altero|mudo|coloco)|nao sei (como|usar|mexer)|dificil de (usar|mexer|entender)|complicad|confus|nao consigo (configurar|cadastrar|alterar|encontrar|achar)/,
    detalha: ["Usabilidade"],
  },
  {
    id: "funcao-que-falta",
    nome: "Função que falta",
    descricao: "Sugestão ou pedido de uma função que o sistema não tem.",
    area: "Desenvolvimento",
    prazoHoras: 168,
    palavras: ["sugestão", "poderia ter", "não tem a opção", "falta a função"],
    padrao: /\bsugest|\bsugir|poderia(m)? (ter|melhorar|colocar|adicionar)|seria (bom|otimo|legal|interessante)|nao tem (a |uma )?(opcao|funcao|como)|falta (a |uma )?(opcao|funcao|funcionalidade)|gostaria que (tivesse|houvesse)|limitad/,
    detalha: ["Usabilidade", "Expectativa não atendida"],
  },
];

const chave = (s: string) => normalizarTexto(s).trim().replace(/\s+/g, " ");

/** A primeira família que casa com o texto — a mais específica. */
export function familiaDoTexto(texto: string): FamiliaDeCausa | undefined {
  const normal = normalizarTexto(texto);
  return FAMILIAS_DE_CAUSA.find((f) => f.padrao.test(normal));
}

/** A família de uma causa já cadastrada, pelo nome. */
export function familiaDaCausa(nome: string): FamiliaDeCausa | undefined {
  const k = chave(nome);
  return FAMILIAS_DE_CAUSA.find((f) => chave(f.nome) === k);
}

/* ============================================================
   A PROPOSTA
============================================================ */

export interface TextoDaBase {
  frente: FrenteId;
  texto: string;
  /** "RA 123456", "NPS — Pizzaria Tal, nota 3". */
  ref: string;
}

export interface ExemploDaProposta {
  frente: FrenteId;
  ref: string;
  trecho: string;
}

export interface LinhaDaProposta {
  familia: FamiliaDeCausa;
  total: number;
  porFrente: Record<FrenteId, number>;
  exemplos: ExemploDaProposta[];
  /** A causa do catálogo que já tem este nome, se houver. */
  jaNoCatalogo?: string;
  /** As causas genéricas do catálogo atual que esta detalha. */
  detalhaAtuais: string[];
}

export interface PropostaDoCatalogo {
  base: number;
  basePorFrente: Record<FrenteId, number>;
  linhas: LinhaDaProposta[];
  /** O que não coube em nenhuma família: as palavras que mais se repetem, para virar causa nova. */
  semFamilia: { total: number; palavras: { palavra: string; registros: number }[]; exemplos: ExemploDaProposta[] };
}

/** Abaixo disto, a família aparece mas vem desmarcada: pouco caso para virar causa sozinha. */
export const MINIMO_PARA_PROPOR = 3;

const zerado = (): Record<FrenteId, number> => ({ "reclame-aqui": 0, redes: 0, nps: 0, google: 0 });

/**
 * Dois exemplos por família, de frentes diferentes quando existe — a
 * causa que aparece no Reclame Aqui e no NPS convence mais que dois
 * relatos do mesmo canal.
 */
function escolherExemplos(lista: ExemploDaProposta[], quantos: number) {
  const escolhidos: ExemploDaProposta[] = [];
  for (const e of lista) {
    if (escolhidos.length >= quantos) break;
    if (!escolhidos.some((x) => x.frente === e.frente)) escolhidos.push(e);
  }
  for (const e of lista) {
    if (escolhidos.length >= quantos) break;
    if (!escolhidos.includes(e)) escolhidos.push(e);
  }
  return escolhidos;
}

/* Palavras que aparecem em quase todo relato e não dizem assunto. */
const VAZIAS = new Set(
  "cliente clientes pedido pedidos sistema problema problemas empresa atendimento suporte conta loja estou nada porem agora entao fazer feito vez vezes favor obrigado obrigada boa bom dia tarde noite ainda mesmo mesma outro outra ficar fica tudo todos todas qualquer cada algum alguma nenhum nenhuma pessoa pessoas meses mes semana semanas horas hora desde entre sempre nunca apenas depois antes pois assim estava estavam foram fosse seria sera sendo tive teve tinha tenho temos disse falou falaram informou informaram sobre contato resolver resolvido resposta retorno".split(" ")
);

function palavrasDoTexto(texto: string) {
  return new Set(
    normalizarTexto(texto)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4 && !PARADAS.has(p) && !VAZIAS.has(p) && !/^\d+$/.test(p))
  );
}

export function propostaDoCatalogo(registros: TextoDaBase[], catalogoAtual: string[]): PropostaDoCatalogo {
  const atuais = new Map(catalogoAtual.map((n) => [chave(n), n]));
  const porFamilia = new Map<string, { total: number; porFrente: Record<FrenteId, number>; exemplos: ExemploDaProposta[] }>();
  const basePorFrente = zerado();
  const sobras: TextoDaBase[] = [];
  let base = 0;

  for (const r of registros) {
    const texto = r.texto.trim();
    if (texto.length < 12) continue;
    base += 1;
    basePorFrente[r.frente] += 1;
    const familia = familiaDoTexto(texto);
    if (!familia) {
      sobras.push(r);
      continue;
    }
    const atual = porFamilia.get(familia.id) ?? { total: 0, porFrente: zerado(), exemplos: [] };
    atual.total += 1;
    atual.porFrente[r.frente] += 1;
    /* Guarda alguns candidatos por frente; a escolha final dos dois acontece no fim. */
    if (atual.exemplos.filter((e) => e.frente === r.frente).length < 2) {
      atual.exemplos.push({ frente: r.frente, ref: r.ref, trecho: trechoDoPadrao(texto, familia.padrao, 60) || texto.slice(0, 140) });
    }
    porFamilia.set(familia.id, atual);
  }

  const linhas: LinhaDaProposta[] = FAMILIAS_DE_CAUSA.flatMap((familia) => {
    const achado = porFamilia.get(familia.id);
    if (!achado) return [];
    return [
      {
        familia,
        total: achado.total,
        porFrente: achado.porFrente,
        exemplos: escolherExemplos(achado.exemplos, 2),
        jaNoCatalogo: atuais.get(chave(familia.nome)),
        detalhaAtuais: familia.detalha.filter((d) => atuais.has(chave(d))).map((d) => atuais.get(chave(d))!),
      },
    ];
  }).sort((a, b) => b.total - a.total);

  const contagem = new Map<string, number>();
  for (const s of sobras) for (const p of palavrasDoTexto(s.texto)) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  const palavras = [...contagem.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([palavra, n]) => ({ palavra, registros: n }));

  return {
    base,
    basePorFrente,
    linhas,
    semFamilia: {
      total: sobras.length,
      palavras,
      exemplos: escolherExemplos(sobras.map((s) => ({ frente: s.frente, ref: s.ref, trecho: s.texto.replace(/\s+/g, " ").slice(0, 160) })), 3),
    },
  };
}

/* ============================================================
   APROVAR
============================================================ */

export interface CausaAprovada {
  nome: string;
  descricao: string;
  area: string;
  prazoHoras: number;
  palavras: string[];
}

/** O que vai para o banco quando a pessoa aprova uma linha — com a área e o prazo que ela escolheu. */
export function causaDaLinha(linha: LinhaDaProposta, escolha?: { area?: string; prazoHoras?: number }): CausaAprovada {
  return {
    nome: linha.familia.nome,
    descricao: linha.familia.descricao,
    area: escolha?.area ?? linha.familia.area,
    prazoHoras: escolha?.prazoHoras ?? linha.familia.prazoHoras,
    palavras: linha.familia.palavras,
  };
}

/**
 * As regras de texto de cada causa do catálogo.
 *
 * A causa que nasceu de uma família usa a expressão da família; a que
 * alguém criou à mão usa as palavras que ela guardou; a lista de partida
 * continua com o dicionário antigo (`regrasDeCausa`).
 */
export function regrasDoCatalogo(causas: { name: string; palavras?: string[] }[]): RegraDeTexto[] {
  const regras: RegraDeTexto[] = [];
  const semRegra: string[] = [];
  for (const c of causas) {
    const familia = familiaDaCausa(c.name);
    if (familia) {
      regras.push({ rotulo: c.name, padrao: familia.padrao, motivo: `palavras de ${c.name.toLowerCase()}`, peso: 0.4 });
      continue;
    }
    const proprias = (c.palavras ?? []).map((p) => normalizarTexto(p).trim()).filter((p) => p.length >= 3);
    if (proprias.length) {
      const escapadas = proprias.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      regras.push({ rotulo: c.name, padrao: new RegExp(escapadas.join("|")), motivo: `cita ${proprias.slice(0, 2).join(" ou ")}`, peso: 0.4 });
      continue;
    }
    semRegra.push(c.name);
  }
  return [...regras, ...regrasDeCausa(semRegra)];
}
