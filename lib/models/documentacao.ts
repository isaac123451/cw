import {
  markdownDosPassos,
  secoesDoDocumento,
  tituloSemEmoji,
  type PlaybookStep,
} from "@/lib/models/playbook";

/**
 * Procurar na documentação — a parte que é só texto.
 *
 * **O problema que isto resolve.** O assistente sabia os números da
 * operação e não sabia as regras dela. Perguntado "qual o prazo de uma
 * urgente?", respondia pelo que parece razoável — e o que parece
 * razoável é justamente o que a documentação existe para substituir.
 * Um prazo inventado com a confiança de quem sabe é pior que "não sei".
 *
 * **Por que aqui, e não no serviço.** Nada nesta busca precisa de banco:
 * entra o texto dos documentos e a pergunta, saem as seções que casam.
 * Ficando em `lib/models`, a conferência roda sem servidor e a tela pode
 * usar a mesma função sem arrastar o Prisma para o navegador — que é a
 * regra que já custou 21 telas respondendo 500 nesta base.
 *
 * **Sem modelo de IA.** É contagem de termos, sem acento e sem palavra
 * vazia. Não gasta chamada, não depende de chave e dá o mesmo resultado
 * em qualquer instalação.
 */

export interface TrechoDaDocumentacao {
  /** "Atendimento no Reclame Aqui" — o documento. */
  documento: string;
  slug: string;
  /** "2. Prazos e Classificação de Criticidade (SLA)". */
  secao: string;
  /** O endereço da seção: `/documentacao?doc=<slug>#<ancora>`. */
  ancora: string;
  texto: string;
  /** Quanto a seção casou com a pergunta — para ordenar e para conferir. */
  pontos: number;
}

/** O documento como esta busca precisa dele. */
export interface DocumentoProcuravel {
  slug: string;
  title: string;
  conteudo?: string | null;
  steps?: PlaybookStep[] | null;
  rules?: string[] | null;
}

/**
 * Palavras que aparecem em toda pergunta e não dizem nada sobre o
 * assunto. Sem tirá-las, "qual o prazo de uma reclamação urgente?" casa
 * com qualquer seção que tenha "de" e "uma" — que são todas.
 */
const VAZIAS = new Set([
  "que", "qual", "quais", "quando", "onde", "como", "quanto", "quantos",
  "para", "por", "pelo", "pela", "com", "sem", "uma", "uns", "umas",
  "dos", "das", "nos", "nas", "aos", "seu", "sua", "seus", "suas",
  "meu", "minha", "isso", "isto", "esse", "essa", "este", "esta",
  "the", "and", "tem", "ter", "ser", "sao", "num", "numa",
  "mais", "menos", "muito", "pouco", "todo", "toda", "todos", "todas",
  "aqui", "ali", "agora", "entao", "porque", "posso", "devo", "deve",
  "fazer", "faco", "faz", "quero", "preciso", "vamos", "vou", "estou",
  "documento", "documentacao", "plataforma", "sistema",
]);

/** Sem acento, minúsculo, só letras e números. */
export function normalizar(texto: string) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Os termos que valem a pena procurar numa pergunta.
 *
 * Três letras é o piso: "sla" e "nps" precisam passar, "os" e "em" não.
 */
export function termosDaPergunta(pergunta: string) {
  const vistos = new Set<string>();
  for (const palavra of normalizar(pergunta).split(" ")) {
    if (palavra.length < 3) continue;
    if (VAZIAS.has(palavra)) continue;
    vistos.add(palavra);
  }
  return [...vistos];
}

/**
 * Quanto cada termo vale, pelo quanto ele é raro.
 *
 * **Isto não é refinamento, é a diferença entre achar e não achar.** Sem
 * pesar, "qual o prazo de primeiro contato de uma reclamação urgente?"
 * trazia "Passo 3 — Primeiro Contato" das Redes Sociais na frente da
 * seção "2. Prazos e Classificação de Criticidade (SLA)" — porque
 * "primeiro" e "contato" estão no título de meia dúzia de seções,
 * enquanto "prazo" e "urgente" estão em duas. As palavras que aparecem
 * em toda seção não distinguem nada; as raras são o assunto.
 *
 * E é o mesmo peso que faz "quando pedir moderação?" achar a seção que
 * fala de moderação em vez de qualquer uma que diga "reclamação".
 */
export function pesosDosTermos(
  secoes: { titulo: string; texto: string }[],
  termos: string[]
) {
  const pesos = new Map<string, number>();

  for (const termo of termos) {
    const re = new RegExp(`\\b${termo}`);

    const onde = secoes.filter(
      (s) => re.test(normalizar(s.titulo)) || re.test(normalizar(s.texto))
    ).length;

    /*
      log(total / aparições): um termo em todas as seções vale ~0, um
      termo em uma só vale o máximo. O +1 evita divisão por zero e o
      piso de 0,2 impede que um termo comum zere a conta inteira.
    */
    pesos.set(
      termo,
      Math.max(0.2, Math.log((secoes.length + 1) / (onde + 1)))
    );
  }

  return pesos;
}

/**
 * Quanto uma seção responde a esses termos.
 *
 * Título vale mais que corpo — uma seção chamada "Prazos e
 * Classificação de Criticidade" é sobre prazo, enquanto a palavra
 * "prazo" solta no meio de outra seção é só uma menção.
 *
 * Devolve também **quantos termos distintos** casaram: é esse número, e
 * não a pontuação, que decide se a seção entra. Uma seção enorme onde um
 * único termo aparece quinze vezes pontua alto e não responde nada.
 */
export function pontuarSecao(
  secao: { titulo: string; texto: string },
  termos: string[],
  pesos?: Map<string, number>
) {
  const titulo = normalizar(secao.titulo);
  const corpo = normalizar(secao.texto);

  let pontos = 0;
  let distintos = 0;
  let maiorPeso = 0;
  let pesoTotal = 0;
  let pesoCasado = 0;

  for (const termo of termos) {
    const noTitulo = (titulo.match(new RegExp(`\\b${termo}`, "g")) ?? []).length;
    const noCorpo = (corpo.match(new RegExp(`\\b${termo}`, "g")) ?? []).length;

    const peso = pesos?.get(termo) ?? 1;

    pesoTotal += peso;

    if (noTitulo + noCorpo > 0) {
      distintos += 1;
      pesoCasado += peso;
      maiorPeso = Math.max(maiorPeso, peso);
    }

    /*
      O título pesa dez, o corpo satura em três.

      A proporção não é chute: com título valendo 6 e corpo até 4 por
      termo, uma seção que menciona de passagem quatro palavras da
      pergunta passava na frente da seção **chamada** pelo assunto. O
      título de uma seção é a única parte que alguém escreveu para dizer
      do que ela trata.
    */
    const bruto = noTitulo * 10 + Math.min(noCorpo, 3);

    pontos += bruto * peso;
  }

  /*
    Cobrir mais da pergunta vale mais.

    Duas seções com a mesma pontuação bruta não são igualmente úteis se
    uma responde três pedaços da pergunta e a outra repete um.
  */
  const cobertura = termos.length
    ? 0.5 + (0.5 * distintos) / termos.length
    : 1;

  return {
    pontos: Math.round(pontos * cobertura * 10) / 10,
    distintos,
    maiorPeso: Math.round(maiorPeso * 100) / 100,
    /** Quanto do "peso" da pergunta esta seção cobre, de 0 a 1. */
    pesoCoberto: pesoTotal ? pesoCasado / pesoTotal : 0,
  };
}

/**
 * Um termo raro sozinho basta.
 *
 * "Quando pedir moderação de uma reclamação?" tem três termos, e a única
 * seção que fala de moderação casa só com ele — "pedir" e "reclamação"
 * não estão lá. Exigindo dois, ela ficava de fora e entrava no lugar
 * dela uma seção do NPS que dizia "reclamação" e "pedir" sem ter nada a
 * ver com moderação. A palavra que quase não aparece em lugar nenhum é
 * justamente a que identifica o assunto.
 */
const PESO_DE_TERMO_RARO = 1;

/**
 * Quanto do peso da pergunta a seção precisa cobrir.
 *
 * "Qual o telefone do dentista?" casava com "Passo 3: Primeiro Contato
 * Humanizado (Preferencialmente WhatsApp / **Telefone**)" — a palavra
 * está no título, e o título vale dez. Mas *dentista*, que é do que a
 * pergunta trata, não aparece em lugar nenhum: a seção cobre um terço do
 * que foi perguntado e responde zero.
 *
 * Contar peso, e não palavras, é o que faz a conta funcionar quando a
 * palavra que sobra é justamente a rara.
 */
const PESO_COBERTO_MINIMO = 0.4;

/**
 * Quantos termos distintos uma seção precisa casar para entrar.
 *
 * Com uma ou duas palavras na pergunta, uma basta. De três em diante,
 * exigir duas é o que separa "a seção fala disso" de "a seção menciona
 * uma palavra que você usou".
 */
export function minimoDeTermos(termos: string[]) {
  return termos.length >= 3 ? 2 : 1;
}

/**
 * O piso, em relação à melhor seção.
 *
 * Existe para a lista parar onde a relevância para. Sem ele, uma
 * pergunta bem respondida por uma seção arrastava outras duas que só
 * repetiam uma palavra comum — e o modelo, vendo três trechos, tende a
 * tratar os três como resposta.
 */
const FRACAO_MINIMA = 0.3;

/**
 * O piso absoluto, para a pergunta que não é sobre a documentação.
 *
 * Só o piso relativo não basta: "qual a receita de bolo de cenoura?"
 * casava com a seção "Objetivo" do NPS, porque *receita* também é o
 * dinheiro que entra. Uma pontuação de 2,7 é o ruído de uma palavra
 * solta, e um trecho irrelevante no prompt é um convite para o modelo
 * responder a partir dele.
 */
const PONTOS_MINIMOS = 5;

/** Uma seção sem corpo não tem o que citar. */
const CORPO_MINIMO = 40;

/**
 * Os trechos que respondem a esta pergunta, entre os documentos dados.
 *
 * Vazio quando nada casa — e vazio é uma resposta: é o que faz o agente
 * dizer "a documentação não cobre isso" em vez de preencher o buraco.
 */
export function trechosDaDocumentacao(
  documentos: DocumentoProcuravel[],
  pergunta: string,
  limite = 3
): TrechoDaDocumentacao[] {

  const termos = termosDaPergunta(pergunta);

  if (termos.length === 0) return [];

  /*
    Todas as seções primeiro: o peso de cada termo depende de em quantas
    delas ele aparece, e isso só se sabe olhando o conjunto.
  */
  const todas: (TrechoDaDocumentacao & { titulo: string })[] = [];

  for (const doc of documentos) {

    const conteudo =
      doc.conteudo ??
      markdownDosPassos({ steps: doc.steps ?? [], rules: doc.rules ?? [] });

    if (!conteudo) continue;

    for (const secao of secoesDoDocumento(conteudo)) {

      if (secao.texto.trim().length < CORPO_MINIMO) continue;

      todas.push({
        documento: tituloSemEmoji(doc.title),
        slug: doc.slug,
        secao: tituloSemEmoji(secao.titulo),
        titulo: secao.titulo,
        ancora: secao.ancora,
        texto: secao.texto,
        pontos: 0,
      });
    }
  }

  if (todas.length === 0) return [];

  const pesos = pesosDosTermos(
    todas.map((s) => ({ titulo: s.titulo, texto: s.texto })),
    termos
  );

  const minimo = minimoDeTermos(termos);
  const achados: TrechoDaDocumentacao[] = [];

  for (const secao of todas) {

    const { pontos, distintos, maiorPeso, pesoCoberto } = pontuarSecao(
      { titulo: secao.titulo, texto: secao.texto },
      termos,
      pesos
    );

    if (pontos === 0) continue;

    if (pesoCoberto < PESO_COBERTO_MINIMO) continue;

    const qualifica = distintos >= minimo || maiorPeso >= PESO_DE_TERMO_RARO;

    if (!qualifica) continue;

    /* `titulo` é o título cru, com emoji — quem sai daqui leva `secao`. */
    achados.push({
      documento: secao.documento,
      slug: secao.slug,
      secao: secao.secao,
      ancora: secao.ancora,
      texto: secao.texto,
      pontos,
    });
  }

  achados.sort((a, b) => b.pontos - a.pontos);

  const piso = Math.max(
    PONTOS_MINIMOS,
    (achados[0]?.pontos ?? 0) * FRACAO_MINIMA
  );

  return achados.filter((a) => a.pontos >= piso).slice(0, limite);
}

/**
 * Os trechos como o modelo os recebe.
 *
 * O texto vai inteiro até um teto — cortar uma regra no meio é como não
 * ter a regra —, e o corte aparece como reticências para o modelo saber
 * que há mais e não afirmar que aquilo é tudo.
 */
export function trechosParaOPrompt(
  trechos: TrechoDaDocumentacao[],
  tetoPorTrecho = 2200
) {
  return trechos
    .map((t) => {
      const texto =
        t.texto.length > tetoPorTrecho
          ? `${t.texto.slice(0, tetoPorTrecho)}\n[…a seção continua na página]`
          : t.texto;

      return `### ${t.documento} → ${t.secao}\n(endereço: /documentacao?doc=${t.slug}#${t.ancora})\n\n${texto}`;
    })
    .join("\n\n---\n\n");
}
