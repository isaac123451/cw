/**
 * O leitor das páginas públicas do Reclame Aqui — sem DOM.
 *
 * Roda no service worker, que não tem `DOMParser`, e no Node, onde o
 * `npm run check:vigia` o exercita contra amostras com a estrutura exata
 * das páginas de verdade. Por isso é texto e JSON, e nada de
 * `document`.
 *
 * **Lê os dados, não o layout.** As duas páginas trazem o que mostram
 * num bloco de dados que o próprio site usa para se montar:
 *
 * - a **lista** (`/empresa/<empresa>/lista-reclamacoes/`) é Next.js, e
 *   as reclamações estão em `__NEXT_DATA__` → `complaints.LAST`, cinco
 *   por página, com código, data, título e se foi respondida/avaliada;
 * - a **reclamação** (`/<empresa>/<qualquer-coisa>_<código>/`) é Astro,
 *   e o objeto inteiro está no atributo `props` de uma `astro-island` —
 *   relato completo, cidade, a resposta da empresa e a avaliação.
 *
 * Classe CSS muda toda semana; esses dois blocos são o contrato entre o
 * servidor deles e a página deles, e mudam muito menos. Quando mudarem,
 * `lerLista`/`lerReclamacao` devolvem `null` e o vigia diz na tela que
 * não reconheceu a página — em vez de gravar lixo.
 *
 * Medido em 11/09/2026: o portal abre a reclamação pelo código mesmo
 * com o título errado no endereço, então `x_<código>` basta.
 */

export const EMPRESA = "cardapio-web-servicos-de-tecnologia";

export const ORIGEM = "https://www.reclameaqui.com.br";

export const CODIGO = /^[A-Za-z0-9_-]{16}$/;

export function enderecoDaLista(pagina = 1) {
  return `${ORIGEM}/empresa/${EMPRESA}/lista-reclamacoes/${
    pagina > 1 ? `?pagina=${pagina}` : ""
  }`;
}

export function enderecoDaReclamacao(codigo) {
  return `${ORIGEM}/${EMPRESA}/x_${codigo}/`;
}

/**
 * A tela antirrobô do Cloudflare.
 *
 * O servidor da plataforma toma esta tela sempre; o Chrome de uma
 * pessoa, quase nunca. Quando acontece, o vigia **para e avisa** — não
 * tenta atravessar. Abrir o portal numa aba resolve, e a próxima volta
 * segue sozinha.
 */
export function ehDesafio(status, html) {
  const inicio = String(html ?? "").slice(0, 30000);

  return (
    /<title>\s*Just a moment/i.test(inicio) ||
    /_cf_chl_opt|challenge-platform|cf-chl-/i.test(inicio) ||
    ((status === 403 || status === 503) && /cloudflare/i.test(inicio))
  );
}

function caractere(codigo) {
  return codigo > 0 && codigo <= 0x10ffff
    ? String.fromCodePoint(codigo)
    : "";
}

/**
 * Desfaz o escape de **um** nível de atributo HTML.
 *
 * Um nível só, e a ordem importa: `&amp;` por último. A resposta da
 * empresa vem com as próprias entidades (`&#8212;`), que no atributo
 * aparecem como `&amp;#8212;`. Desfazer `&amp;` primeiro transformaria
 * isso em travessão aqui — e o servidor, que desfaz o nível do texto,
 * receberia um texto diferente do que o portal publicou.
 */
export function desescapar(texto) {
  return String(texto ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => caractere(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => caractere(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&(#39|apos);/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * A serialização de props do Astro.
 *
 * Todo valor vira `[tipo, valor]`: `0` é valor simples (ou objeto cujos
 * campos seguem a mesma regra), `1` é lista, `3` é data em texto. É por
 * isso que `score` chega como `[0,"10"]` e a lista de interações como
 * `[1,[[0,{…}],…]]`.
 *
 * **E `[0]`, sozinho, é `undefined`.** Medido em 11/09/2026: "voltaria a
 * fazer negócio" vem `[0,true]` quando a página mostra "Sim" e `[0]`
 * quando mostra "Não". Tratado como lista, `[0]` num campo de nota viraria
 * `Number([0])` — zero, uma nota que ninguém deu.
 */
export function desfazerAstro(valor) {
  if (Array.isArray(valor) && valor.length === 1 && valor[0] === 0) {
    return undefined;
  }

  if (
    !Array.isArray(valor) ||
    valor.length !== 2 ||
    typeof valor[0] !== "number"
  ) {
    return valor;
  }

  const [tipo, dado] = valor;

  if (tipo === 1) {
    return Array.isArray(dado) ? dado.map(desfazerAstro) : [];
  }

  if (
    tipo === 0 &&
    dado &&
    typeof dado === "object" &&
    !Array.isArray(dado)
  ) {
    return Object.fromEntries(
      Object.entries(dado).map(([chave, v]) => [chave, desfazerAstro(v)])
    );
  }

  return dado;
}

/**
 * Uma página da lista: o que ela mostra de cada reclamação.
 *
 * `null` quando a página não é a lista da Cardápio Web — mudou de
 * formato, ou o portal redirecionou para outro lugar.
 */
export function lerLista(html) {
  const bloco = String(html ?? "").match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );

  if (!bloco) return null;

  let dados;

  try {
    dados = JSON.parse(bloco[1]);
  } catch {
    return null;
  }

  if (dados?.query?.shortname !== EMPRESA) return null;

  const reclamacoes = dados?.props?.pageProps?.complaints;

  if (!Array.isArray(reclamacoes?.LAST)) return null;

  return {
    total: Number(reclamacoes.count) || null,
    itens: reclamacoes.LAST.map((item) => ({
      codigo: String(item?.id ?? ""),
      status: String(item?.status ?? ""),
      avaliada: item?.evaluated === true,
      criadaEm: String(item?.created ?? ""),
      titulo: String(item?.title ?? ""),
    })).filter((item) => CODIGO.test(item.codigo)),
  };
}

/**
 * A página de uma reclamação, no formato que o servidor valida.
 *
 * O texto vai **como o portal escreveu**, com `<br />`: quem transforma
 * em texto de gente é o servidor (`textoDoPortal`), num lugar só e com
 * prova. Aqui só se desfaz a embalagem da página.
 */
export function lerReclamacao(html) {
  for (const achado of String(html ?? "").matchAll(/\sprops="([^"]*)"/g)) {
    if (!achado[1].includes("&quot;complaint&quot;")) continue;

    let props;

    try {
      props = JSON.parse(desescapar(achado[1]));
    } catch {
      continue;
    }

    const c = desfazerAstro(props?.complaint);

    if (!c || typeof c !== "object" || !Array.isArray(c.interactions)) {
      continue;
    }

    const nota = c.score === "" || c.score == null ? NaN : Number(c.score);

    return {
      codigo: String(c.id ?? ""),
      numero: Number(c.legacyId) || undefined,
      empresa: String(c.companyShortname ?? ""),
      slug: String(c.url ?? ""),
      titulo: String(c.title ?? ""),
      relato: String(c.description ?? ""),
      criadaEm: String(c.created ?? ""),
      status: String(c.status ?? ""),
      cidade: c.userCity ? String(c.userCity) : undefined,
      estado: c.userState ? String(c.userState) : undefined,
      avaliada: c.evaluated === true,
      resolvida: c.solved === true,
      nota: Number.isFinite(nota) ? nota : undefined,

      /*
        "Voltaria a fazer negócio" chega `true` quando sim e `undefined`
        quando não (o `[0]` do Astro): comparar com `true` é a leitura
        que não se engana com a segunda forma.
      */
      voltaria: c.dealAgain === true,

      problema: c.problemType?.name ? String(c.problemType.name) : undefined,

      interacoes: c.interactions.map((i) => ({
        tipo: String(i?.type ?? ""),
        em: String(i?.created ?? ""),
        texto: String(i?.message ?? ""),
      })),
    };
  }

  return null;
}
