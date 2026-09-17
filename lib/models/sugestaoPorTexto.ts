/**
 * Sugestão de triagem pelo texto — e o que a operação já corrigiu.
 *
 * **O pedido.** "A parte de triagem dos casos achei interessante, você
 * pode enxergar margens que possa melhorar." E, do roadmap: a sugestão
 * aprende com a correção, e a tela mostra a taxa de acerto.
 *
 * **Como aprende sem tabela nova.** Cada caso salvo é um exemplo: o
 * relato e o assunto que ficou gravado. Quem corrige a sugestão e salva
 * cria o exemplo que decide a próxima parecida. A sugestão é o voto dos
 * casos mais parecidos (TF-IDF e cosseno — conta, não modelo externo),
 * somado a regras por palavra quando há poucos exemplos (o NPS tem quatro
 * comentários classificados hoje; o Reclame Aqui, 356 relatos).
 *
 * **A taxa de acerto é medida, não prometida:** cada exemplo recente é
 * tirado da base e sugerido pelos outros; conta quantas vezes a
 * sugestão bateu com o que a pessoa gravou.
 *
 * Sem banco e sem React: a conferência roda sobre qualquer lista.
 */

/* ============================================================
   TEXTO
============================================================ */

const PARADAS = new Set(
  "a o e é de da do das dos em no na nos nas um uma uns umas que se por para pra com sem como mais mas ou ao aos à às eu ele ela eles elas nós vocês você voce vc vcs me te lhe nos seu sua seus suas meu minha meus minhas isso isto esse essa este esta aquele aquela já ja foi ser ter tem tenho tinha estou está esta estão estava muito muita pouco quando onde porque pois então entao também tambem só so até ate sobre depois antes ainda aqui ali lá la dia dias hoje ontem nao não sim empresa cardapio cardápio web".split(" ")
);

export function normalizarTexto(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Radical grosseiro: plural e as terminações mais comuns do português. */
function radical(p: string) {
  if (p.length <= 4) return p;
  return p
    .replace(/(coes|cao|ções|ção)$/, "c")
    .replace(/(mente)$/, "")
    .replace(/(ando|endo|indo|ados|adas|ado|ada|idos|idas|ido|ida)$/, "")
    .replace(/(s)$/, "");
}

export function tokensDoTexto(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !PARADAS.has(p) && !/^\d+$/.test(p))
    .map(radical);
}

/* ============================================================
   ÍNDICE
============================================================ */

export interface Exemplo {
  id: string;
  texto: string;
  rotulo: string;
  /** Para mostrar "parecido com RA-123". */
  referencia?: string;
}

export interface Indice {
  idf: Map<string, number>;
  docs: { exemplo: Exemplo; vetor: Map<string, number>; norma: number }[];
}

function vetorDe(tokens: string[], idf: Map<string, number>) {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vetor = new Map<string, number>();
  let soma = 0;
  for (const [t, n] of tf) {
    const peso = (1 + Math.log(n)) * (idf.get(t) ?? 0);
    if (peso > 0) {
      vetor.set(t, peso);
      soma += peso * peso;
    }
  }
  return { vetor, norma: Math.sqrt(soma) };
}

export function criarIndice(exemplos: Exemplo[]): Indice {
  const tokens = exemplos.map((e) => tokensDoTexto(e.texto));
  const df = new Map<string, number>();
  for (const lista of tokens) for (const t of new Set(lista)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = exemplos.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 0.5)));
  return {
    idf,
    docs: exemplos.map((exemplo, i) => ({ exemplo, ...vetorDe(tokens[i], idf) })).filter((d) => d.norma > 0),
  };
}

export interface Parecido {
  id: string;
  referencia?: string;
  rotulo: string;
  semelhanca: number;
}

export function parecidos(indice: Indice, texto: string, k = 7, excluirId?: string): Parecido[] {
  const { vetor, norma } = vetorDe(tokensDoTexto(texto), indice.idf);
  if (norma === 0) return [];
  const notas: Parecido[] = [];
  for (const d of indice.docs) {
    if (d.exemplo.id === excluirId) continue;
    let produto = 0;
    const [menor, maior] = vetor.size < d.vetor.size ? [vetor, d.vetor] : [d.vetor, vetor];
    for (const [t, p] of menor) {
      const q = maior.get(t);
      if (q) produto += p * q;
    }
    if (produto > 0) notas.push({ id: d.exemplo.id, referencia: d.exemplo.referencia, rotulo: d.exemplo.rotulo, semelhanca: produto / (norma * d.norma) });
  }
  return notas.sort((a, b) => b.semelhanca - a.semelhanca).slice(0, k);
}

/* ============================================================
   SUGESTÃO
============================================================ */

export interface RegraDeTexto {
  rotulo: string;
  padrao: RegExp;
  /** Quanto a regra vale contra os exemplos. 1 ≈ um caso muito parecido. */
  peso?: number;
  motivo: string;
}

export interface Sugestao {
  valor: string;
  /** 0 a 1: a fatia do voto que o valor levou. */
  confianca: number;
  motivo: string;
  parecidos: Parecido[];
}

/** Abaixo disto, "parecido" é coincidência de uma palavra comum. */
const SEMELHANCA_MINIMA = 0.12;

export function sugerir(
  texto: string,
  { indice, regras = [], k = 7, excluirId, valoresValidos }: { indice?: Indice; regras?: RegraDeTexto[]; k?: number; excluirId?: string; valoresValidos?: string[] }
): Sugestao | null {
  if (!texto.trim()) return null;
  const votos = new Map<string, number>();
  const motivos = new Map<string, string[]>();
  const valido = (v: string) => !valoresValidos || valoresValidos.includes(v);

  const vizinhos = indice ? parecidos(indice, texto, k, excluirId).filter((p) => p.semelhanca >= SEMELHANCA_MINIMA && valido(p.rotulo)) : [];
  for (const p of vizinhos) votos.set(p.rotulo, (votos.get(p.rotulo) ?? 0) + p.semelhanca);

  const normal = normalizarTexto(texto);
  for (const r of regras) {
    if (!valido(r.rotulo) || !r.padrao.test(normal)) continue;
    votos.set(r.rotulo, (votos.get(r.rotulo) ?? 0) + (r.peso ?? 0.35));
    motivos.set(r.rotulo, [...(motivos.get(r.rotulo) ?? []), r.motivo]);
  }

  if (votos.size === 0) return null;
  const total = [...votos.values()].reduce((a, b) => a + b, 0);
  const [valor, pontos] = [...votos.entries()].sort((a, b) => b[1] - a[1])[0];
  const doValor = vizinhos.filter((p) => p.rotulo === valor);
  const partes = [
    doValor.length ? `parecido com ${doValor.length} caso(s) já classificado(s) assim` : null,
    ...(motivos.get(valor) ?? []),
  ].filter(Boolean);

  return { valor, confianca: pontos / total, motivo: partes.join("; "), parecidos: doValor.slice(0, 3) };
}

/**
 * A taxa de acerto, tirando cada exemplo da base e sugerindo pelos outros.
 *
 * `cobertura` é a fatia em que houve sugestão; `taxa`, a fatia das
 * sugestões que bateram. Os dois importam: sugerir só quando é óbvio
 * dá taxa alta e ajuda pouco.
 */
export function medirAcerto(
  exemplos: Exemplo[],
  opcoes: { regras?: RegraDeTexto[]; valoresValidos?: string[]; ultimos?: number } = {}
): { base: number; sugeridos: number; acertos: number; taxa: number | null; cobertura: number | null } {
  const indice = criarIndice(exemplos);
  const amostra = exemplos.slice(0, opcoes.ultimos ?? 200);
  let sugeridos = 0;
  let acertos = 0;
  for (const e of amostra) {
    const s = sugerir(e.texto, { indice, regras: opcoes.regras, excluirId: e.id, valoresValidos: opcoes.valoresValidos });
    if (!s) continue;
    sugeridos += 1;
    if (s.valor === e.rotulo) acertos += 1;
  }
  return {
    base: amostra.length,
    sugeridos,
    acertos,
    taxa: sugeridos ? acertos / sugeridos : null,
    cobertura: amostra.length ? sugeridos / amostra.length : null,
  };
}

/* ============================================================
   REGRAS POR FRENTE
============================================================ */

/**
 * Critérios de criticidade do Reclame Aqui lidos no relato.
 *
 * O texto normalizado não tem acento: as expressões também não.
 */
export const CRITERIOS_NO_TEXTO: { criterio: string; padrao: RegExp; motivo: string }[] = [
  { criterio: "juridico", padrao: /\bprocon\b|consumidor\.gov|defesa do consumidor|\badvogad|\bjudicial|\bna justica\b|pequenas causas|juizado|\bprocess(ar|arei|o contra)\b|entrar com (uma )?acao/, motivo: "fala em Procon, advogado ou ação" },
  { criterio: "exposicao", padrao: /\bimprensa\b|\bjornal\b|\breportagem\b|viraliz|\bvou (postar|expor|divulgar)|redes sociais (todas|inteiras)|todo mundo (vai )?saber/, motivo: "ameaça expor ou fala em imprensa" },
  { criterio: "operacao-parada", padrao: /(sistema|loja|restaurante|delivery|cardapio|operacao|tudo) (esta |ficou |totalmente )?(parad|fora do ar|travad)|nao (consigo|conseguimos) (vender|receber pedido|trabalhar|abrir a loja)|perdendo (vendas|pedidos)|nenhum pedido (entra|chega)/, motivo: "descreve a operação parada" },
  { criterio: "cancelamento", padrao: /\bcancel(ar|amento|ei)\b|quero (sair|rescindir)|rescis|trocar de (sistema|plataforma|empresa)|\bconcorrente\b|nao renov/, motivo: "fala em cancelar ou trocar de sistema" },
  { criterio: "financeiro", padrao: /cobran[ca]a (indevida|duplicada|em duplicidade|errada)|cobrad[oa]s? (duas vezes|a mais|indevidamente|sem autoriza)|\bestorno\b|\breembols|valor (errado|incorreto|a mais)|debitad/, motivo: "fala em cobrança indevida, estorno ou valor errado" },
  { criterio: "funcionalidade", padrao: /nao (imprime|imprimi|funciona|abre|carrega|sincroniza|integra)|parou de (funcionar|imprimir|integrar)|integracao (caiu|parou|com o ifood)|\bbug\b|\berro\b ao/, motivo: "uma função deixou de funcionar" },
  { criterio: "prazo-descumprido", padrao: /prometeram|prometido|combinad[oa] e nao|prazo (venceu|nao cumprido|passou)|ate hoje nada|ninguem (retornou|resolveu)|sem retorno ha|faz (\d+|uma|duas|tres) semanas?/, motivo: "cobra um prazo ou retorno prometido" },
];

export function criteriosPeloTexto(texto: string) {
  const normal = normalizarTexto(texto);
  return CRITERIOS_NO_TEXTO.filter((c) => c.padrao.test(normal)).map(({ criterio, motivo }) => ({ criterio, motivo }));
}

/** Os tipos do guia do NPS, pelo comentário e pela nota. */
export function regrasDeTipoNps(nota: number): RegraDeTexto[] {
  return [
    { rotulo: "Erro no Sistema", padrao: /\bbug\b|\berro\b|nao (funciona|imprime|abre|carrega|sincroniza)|\btrava(ndo)?\b|fora do ar|\blento\b|instabilidade/, motivo: "descreve falha do sistema" },
    { rotulo: "Falta de Retorno", padrao: /(sem|nao tive|nao recebi|ninguem (me )?deu|aguardando) (retorno|resposta)|demora(m)? (a|para|pra) responder|ninguem (responde|retorna)|suporte (demora|nao responde)/, motivo: "reclama de falta de retorno" },
    { rotulo: "Erro Processual", padrao: /cobran[ca]a|cobrad|implantac|treinamento|contrato|migracao|cadastro errado|\bfatura/, motivo: "fala de cobrança, implantação ou contrato" },
    { rotulo: "Sugestão", padrao: /\bsugir|\bsugest|poderia(m)? (ter|melhorar|colocar|adicionar)|seria (bom|legal|otimo) (se|ter)|falta (uma|um|a opcao)|gostaria que (tivesse|houvesse)/, motivo: "propõe uma melhoria", peso: 0.45 },
    { rotulo: "Engano", padrao: /(sem querer|cliquei errado|nota errada|me enganei|foi engano|errei a nota)/, motivo: "diz que a nota foi engano", peso: 0.8 },
    ...(nota >= 9
      ? [{ rotulo: "Elogio", padrao: /otim|excelente|parab|muito bom|maravilh|recomend|adoro|amo|perfeit|melhor sistema|atendimento (top|nota 10)|nota 10/, motivo: "elogio com nota alta", peso: 0.5 }]
      : []),
    ...(nota <= 6 ? [{ rotulo: "Reclamação", padrao: /pessim|horrivel|ruim|decepcion|insatisf|problema|reclam|nao gostei|nao resolve/, motivo: "reclamação com nota baixa", peso: 0.3 }] : []),
  ];
}

/** Causa raiz pelas palavras de cada causa cadastrada (as do NPS valem para Google e Redes). */
export function regrasDeCausa(causas: string[]): RegraDeTexto[] {
  const dicionario: Record<string, RegExp> = {
    atendimento: /atendiment|suporte|atendente|\bchat\b|responder|retorno/,
    bug: /\bbug\b|\berro\b|nao funciona|travando|trava|fora do ar|falha/,
    implantacao: /implantac|instalac|configurac inicial|treinamento|onboarding|comecar a usar/,
    cobranca: /cobran[ca]|cobrad|fatura|boleto|mensalidade|estorno|reembols|\bvalor/,
    financeiro: /cobran[ca]|fatura|boleto|pagamento|estorno|reembols/,
    "expectativa nao atendida": /esperava|prometeram|nao era o que|propaganda|vendedor disse/,
    integracao: /integrac|ifood|anota ai|whatsapp|impressora/,
    produto: /funcionalidade|recurso|nao tem (a opcao|como)|limitac/,
    entrega: /entrega|motoboy|entregador|atraso/,
  };
  return causas.flatMap((causa) => {
    const chave = normalizarTexto(causa);
    const padrao = dicionario[chave];
    return padrao ? [{ rotulo: causa, padrao, motivo: `palavras de ${causa.toLowerCase()}`, peso: 0.3 }] : [];
  });
}

/**
 * Os assuntos da documentação pelas palavras do relato.
 *
 * Medido nos 356 relatos em 17/09/2026: sozinhas, acertam 52%; somadas
 * aos casos parecidos (peso 0,3), levam a sugestão de 62% para 64,6% e a
 * cobertura de 82% para 97,5% — contra 50% de chutar sempre Atendimento.
 */
export const REGRAS_DE_ASSUNTO: RegraDeTexto[] = [
  { rotulo: "Financeiro", padrao: /cobran[ca]|cobrad|boleto|mensalidade|fatura|estorno|reembols|debit|cartao de credito|valor(es)? (cobrad|errad|indevid)|pagamento|multa|juros|reajuste/, motivo: "fala de cobrança, pagamento ou estorno", peso: 0.3 },
  { rotulo: "Sistema", padrao: /nao (funciona|imprime|abre|carrega|sincroniza|integra)|\bbug\b|\berro\b|travando|trava|lento|lentidao|impressora|instabilidade|fora do ar|aplicativo|atualizac|integrac/, motivo: "descreve falha ou limite do sistema", peso: 0.3 },
  { rotulo: "Implantação", padrao: /implantac|treinamento|configurac(ao|oes) inicia|migrac|cadastrar (o )?cardapio|onboarding/, motivo: "fala de implantação ou treinamento", peso: 0.3 },
  { rotulo: "Cancelamento", padrao: /\bcancel(ar|amento)\b.*(contrato|plano|assinatura)|rescis|fidelidade/, motivo: "fala em cancelar o contrato", peso: 0.3 },
  { rotulo: "Comercial", padrao: /vendedor|consultor comercial|proposta|promet(eram|ido) na venda|contratei (achando|pensando)/, motivo: "fala da venda ou do vendedor", peso: 0.3 },
  { rotulo: "Atendimento", padrao: /atendiment|suporte|ninguem (responde|retorna)|sem (resposta|retorno)|\bchat\b|protocolo|demora (no|para) (atender|responder)/, motivo: "fala do atendimento ou do suporte", peso: 0.3 },
];

/**
 * O trecho do texto original em que a expressão casou, com um pouco de
 * contexto — para a pessoa ver por que o critério foi sugerido.
 */
export function trechoDoPadrao(texto: string, padrao: RegExp, margem = 50) {
  /* Normaliza caractere a caractere para manter a posição do original. */
  let normal = "";
  const posicao: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizarTexto(texto[i]);
    for (let j = 0; j < n.length; j++) {
      normal += n[j];
      posicao.push(i);
    }
  }
  const achado = new RegExp(padrao.source, padrao.flags.replace("g", "")).exec(normal);
  if (!achado) return "";
  const inicio = posicao[achado.index] ?? 0;
  const fim = (posicao[achado.index + achado[0].length - 1] ?? inicio) + 1;
  const de = Math.max(0, inicio - margem);
  const ate = Math.min(texto.length, fim + margem);
  return `${de > 0 ? "…" : ""}${texto.slice(de, ate).replace(/\s+/g, " ").trim()}${ate < texto.length ? "…" : ""}`;
}
