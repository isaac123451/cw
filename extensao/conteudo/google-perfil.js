/**
 * Google Perfil da Empresa — registrar a avaliação sem sair da página.
 *
 * **O problema que resolve.** A tela de Avaliações do CW pede estrelas,
 * autor, texto e data. Todos os quatro estão na frente de quem está
 * lendo a avaliação no Google — e eram redigitados. Redigitar erra a
 * data (o Google escreve "há 2 semanas") e erra o nome, e é o nome que
 * casa a avaliação com o promotor do NPS que foi convidado a avaliar.
 *
 * **Só no clique, e em dois tempos.** O botão aparece no cartão; o
 * primeiro clique mostra **o que vai ser gravado** — inclusive a data
 * que o script deduziu do "há 2 semanas" —, o segundo grava. Nada sai
 * daqui por abrir a página.
 *
 * **A regra não mora aqui.** A classificação (crítica, negativa,
 * neutra, positiva), a marca de repetição do mesmo problema e o
 * casamento com o promotor do NPS são feitos pela aplicação, no mesmo
 * serviço que a tela usa. A extensão só entrega os quatro campos.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW) return;

  const MARCA = "data-cw-google";

  /* ============================================================
     LER O CARTÃO
  ============================================================ */

  /**
   * As estrelas, pelo rótulo de acessibilidade.
   *
   * É o único lugar em que o número existe como número: as estrelas
   * desenhadas são ícones, e contá-las depende do tema. "4 estrelas",
   * "Classificado como 4 de 5".
   */
  function estrelasDoRotulo(rotulo) {

    /*
      A casa decimal precisa ser consumida pelo padrão, e não ignorada.
      "Rated 1.0 out of 5" tem dois dígitos antes do "out of 5", e sem o
      `(?:[.,]\d)?` quem casava era o **zero** — a avaliação de uma
      estrela virava nota inválida e o botão dizia não ter lido a nota.
    */
    const achado =
      String(rotulo ?? "").match(/(\d)(?:[.,]\d)?\s*(?:de\s*5|estrela|star|out of 5)/i) ??
      String(rotulo ?? "").match(/(?:classificad\w+|rated)[^\d]{0,12}(\d)/i);

    const n = achado ? Number(achado[1]) : 0;

    return n >= 1 && n <= 5 ? n : 0;
  }

  function estrelasDe(cartao) {

    for (const el of cartao.querySelectorAll("[aria-label]")) {

      const n = estrelasDoRotulo(el.getAttribute("aria-label"));

      if (n) return n;
    }

    return 0;
  }

  /**
   * O nome de quem avaliou.
   *
   * O `alt` da foto é o mais estável ("Foto do perfil de Maria Silva").
   * Depois, o primeiro texto curto do cartão que não é data nem nota.
   */
  function nomeDoAlt(alt) {
    return String(alt ?? "")
      .trim()
      .replace(/^(foto (do )?perfil( de)?|profile photo( of)?|imagem de)\s*/i, "")
      .trim();
  }

  function autorDe(cartao) {

    for (const img of cartao.querySelectorAll("img[alt]")) {

      const limpo = nomeDoAlt(img.getAttribute("alt"));

      if (limpo.length >= 2 && limpo.length <= 80) return limpo;
    }

    for (const el of cartao.querySelectorAll("a, div, span")) {

      const texto = CW.texto(el, 80);

      if (
        texto.length >= 2 &&
        texto.length <= 60 &&
        !/\d/.test(texto) &&
        !/(estrela|star|avalia|review|local guide|guia local|respond)/i.test(texto)
      ) {
        return texto;
      }
    }

    return "";
  }

  /** Quanto tempo cada unidade vale, para virar data. */
  const UNIDADES = [
    [/\b(ano|anos|year|years)\b/i, 365],
    [/\b(m[êe]s|meses|month|months)\b/i, 30],
    [/\b(semana|semanas|week|weeks)\b/i, 7],
    [/\b(dia|dias|day|days)\b/i, 1],
    [/\b(hora|horas|hour|hours|minuto|minutos|agora|now)\b/i, 0],
  ];

  /** Por extenso, porque o Google escreve "há um mês" e não "há 1 mês". */
  const NUMEROS = {
    um: 1, uma: 1, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4,
    cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
    doze: 12,
  };

  /**
   * "há 2 semanas" → a data, em `AAAA-MM-DD`.
   *
   * É aproximação, e por isso ela aparece na confirmação antes de
   * gravar: quem está lendo o cartão vê a data que vai para a ficha e
   * pode desistir. O mês vale 30 dias e o ano 365 — é o que o "há um
   * mês" do Google significa, sem fingir uma precisão que ele não tem.
   */
  function dataDoTexto(bruto) {

    const texto = String(bruto ?? "").slice(0, 1200);

    /* Uma data escrita por extenso, quando houver, vale mais. */
    const escrita = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

    if (escrita) {
      return `${escrita[3]}-${escrita[2].padStart(2, "0")}-${escrita[1].padStart(2, "0")}`;
    }

    for (const [padrao, dias] of UNIDADES) {

      const linha = texto.match(
        new RegExp(`(h[áa]|faz)?\\s*([\\wêéá]+)\\s*${padrao.source}`, "i")
      );

      if (!linha) continue;

      const bruto = (linha[2] ?? "").toLowerCase();

      const quantidade = Number(bruto) || NUMEROS[bruto] || 1;

      const quando = new Date(Date.now() - quantidade * dias * 86400000);

      return quando.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    }

    /* Sem pista nenhuma: hoje, e a confirmação mostra isso. */
    return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  }

  function dataDe(cartao) {
    return dataDoTexto(cartao.innerText ?? "");
  }

  /**
   * Os leitores, expostos para a conferência.
   *
   * `check:lugares` roda os três contra textos de cartão reais — é a
   * mesma porta que o `ra-campos.js` abre para o `check:ra`, e existe
   * pelo mesmo motivo: leitor de página alheia que ninguém exercita
   * quebra calado.
   */
  CW.google = { estrelasDoRotulo, nomeDoAlt, dataDoTexto };

  /**
   * O texto da avaliação.
   *
   * O maior parágrafo do cartão que não é o nome, a data nem a nossa
   * resposta. Quando o Google recolhe o texto com "Mais", vai o que
   * está visível — e é por isso que a confirmação mostra o tamanho.
   */
  function textoDe(cartao, autor) {

    let maior = "";

    for (const el of cartao.querySelectorAll("span, div, p")) {

      /* Só folhas: um container traz o cartão inteiro junto. */
      if (el.querySelector("span, div, p")) continue;

      const texto = CW.texto(el, 1500);

      if (texto === autor) continue;
      if (/^(resposta do propriet[áa]rio|response from the owner)/i.test(texto)) break;
      if (/(estrela|star|local guide|guia local)/i.test(texto) && texto.length < 40) continue;
      if (/^(h[áa]|faz)\s|\b(atr[áa]s|ago)$/i.test(texto)) continue;

      if (texto.length > maior.length) maior = texto;
    }

    return maior.length >= 3 ? maior : "";
  }

  /* ============================================================
     O BOTÃO
  ============================================================ */

  function estilo(botao, tom) {
    const cores = {
      acao: ["#111827", "#111827", "#ffffff"],
      espera: ["#fafafa", "#e4e4e7", "#3f3f46"],
      ok: ["#f0fdf4", "#bbf7d0", "#14532d"],
      erro: ["#fef2f2", "#fecaca", "#7f1d1d"],
    };
    const [fundo, borda, cor] = cores[tom] ?? cores.espera;
    botao.style.background = fundo;
    botao.style.borderColor = borda;
    botao.style.color = cor;
  }

  function montarBotao(cartao) {

    const caixa = document.createElement("div");
    caixa.setAttribute(MARCA, "barra");
    caixa.style.cssText = [
      "margin: 8px 0 4px",
      "font: 500 12.5px/1.45 ui-sans-serif, system-ui, sans-serif",
      "display: flex",
      "align-items: center",
      "gap: 8px",
      "flex-wrap: wrap",
    ].join(";");

    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Registrar no CW";
    botao.style.cssText = [
      "padding: 5px 10px",
      "border-radius: 8px",
      "border: 1px solid #111827",
      "cursor: pointer",
      "font: inherit",
    ].join(";");
    estilo(botao, "acao");

    const recado = document.createElement("span");
    recado.style.cssText = "opacity:.85";

    caixa.append(botao, recado);
    cartao.append(caixa);

    /* Dois tempos: o primeiro clique mostra o que vai ser gravado. */
    let confirmado = false;
    let leitura = null;

    botao.addEventListener("click", async (evento) => {

      evento.preventDefault();
      evento.stopPropagation();

      if (!confirmado) {

        const autor = autorDe(cartao);

        leitura = {
          estrelas: estrelasDe(cartao),
          autor,
          texto: textoDe(cartao, autor),
          publicadaEm: dataDe(cartao),
          identificado: Boolean(autor),
          link: location.href,
        };

        if (!leitura.estrelas || !leitura.autor) {
          recado.textContent = leitura.autor
            ? "não consegui ler a nota deste cartão"
            : "não consegui ler o nome de quem avaliou";
          estilo(botao, "erro");
          return;
        }

        const [a, m, d] = leitura.publicadaEm.split("-");

        recado.textContent = `${leitura.estrelas}★ · ${leitura.autor} · ${d}/${m}/${a}${
          leitura.texto ? ` · ${leitura.texto.length} caracteres` : " · sem texto"
        }`;

        botao.textContent = "Confirmar";
        estilo(botao, "espera");
        confirmado = true;
        return;
      }

      botao.disabled = true;
      botao.textContent = "Registrando…";

      const resposta = await CW.enviar({
        tipo: "registrarAvaliacaoGoogle",
        corpo: leitura,
      });

      botao.disabled = false;

      if (!resposta?.ok || resposta.dados?.erro) {
        botao.textContent = "Tentar de novo";
        recado.textContent =
          resposta?.dados?.erro ?? resposta?.erro ?? "não deu para registrar";
        estilo(botao, "erro");
        return;
      }

      const d = resposta.dados;

      botao.textContent = d.repetida ? "já estava no CW" : "registrada";
      botao.disabled = true;
      estilo(botao, "ok");

      recado.textContent = d.repetida
        ? "esta avaliação já tinha sido registrada"
        : `${d.classificacao}${d.criticidade ? ` · ${d.criticidade}` : ""}${
            d.promotor ? ` · promotor ${d.promotor.nome} do NPS` : ""
          }`;
    });
  }

  /* ============================================================
     ACHAR OS CARTÕES
  ============================================================ */

  /**
   * Um cartão de avaliação é o menor bloco que tem **nota e texto**.
   *
   * Partir do rótulo das estrelas e subir até o bloco que também tem o
   * nome é o caminho que sobrevive a troca de classe: o Google renomeia
   * as classes a cada versão, mas o rótulo de acessibilidade da nota
   * precisa continuar existindo.
   */
  function cartoes() {

    const achados = new Set();

    for (const el of document.querySelectorAll('[aria-label*="estrela" i], [aria-label*="star" i]')) {

      let alvo = el;

      for (let passo = 0; passo < 6 && alvo; passo += 1) {

        const tem =
          alvo.querySelector("img[alt]") &&
          (alvo.innerText ?? "").trim().length > 20;

        if (tem) break;

        alvo = alvo.parentElement;
      }

      if (alvo && !alvo.hasAttribute(MARCA)) achados.add(alvo);
    }

    return Array.from(achados);
  }

  function varrer() {

    for (const cartao of cartoes()) {

      /* Um cartão dentro de outro receberia dois botões. */
      if (cartao.querySelector(`[${MARCA}="barra"]`)) continue;

      cartao.setAttribute(MARCA, "cartao");
      montarBotao(cartao);
    }
  }

  function varrerComRede() {
    try {
      varrer();
    } catch (erro) {
      console.warn("[CW] leitura do Perfil da Empresa falhou nesta volta", erro);
    }
  }

  /*
    Uma varredura a cada 2 s, e não um observador: a lista de avaliações
    do Google redesenha a cada rolagem, e um `MutationObserver` na
    página inteira dispararia milhares de vezes por minuto.
  */
  setInterval(varrerComRede, 2000);

  varrerComRede();
})();
