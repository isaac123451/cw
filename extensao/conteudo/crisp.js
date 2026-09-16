/**
 * Detector do Crisp — o chat do site e do aplicativo.
 *
 * **O que faz.** Diz ao painel quem está do outro lado da conversa
 * aberta (e-mail, telefone, apelido) e ensina o painel a **ler** aquela
 * conversa, para o botão "Guardar a conversa na plataforma" funcionar
 * aqui do mesmo jeito que funciona no WhatsApp.
 *
 * **O que não faz.** Não lê nada sozinho. `definirLeitorDeConversa`
 * recebe uma *função*, não o texto: enquanto ninguém clicar em
 * "Resumir" ou "Guardar", nenhuma mensagem sai desta página. É a mesma
 * regra registrada em `LEIA-ME.md` e o motivo de o detector não guardar
 * o conteúdo em lugar nenhum.
 *
 * **Por que camadas de seletor.** A marcação do Crisp é gerada e muda
 * entre versões. Cada leitura tenta do mais específico ao mais genérico
 * e **diz por qual camada passou** (`via`) — sem isso, "0 mensagens" não
 * distingue conversa vazia de leitor quebrado, que foi a confusão que
 * fez a mesma falha ser reportada três vezes no leitor do WhatsApp.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  CW.painel.montar();

  const INTERVALO = 2500;

  /* ============================================================
     QUEM ESTÁ DO OUTRO LADO
  ============================================================ */

  function emailNaTela() {

    const link = document.querySelector('a[href^="mailto:"]');

    const doLink = (link?.getAttribute("href") ?? "")
      .replace(/^mailto:/i, "")
      .split("?")[0]
      .trim();

    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(doLink)) return doLink;

    /*
      O Crisp mostra o e-mail do visitante como texto na barra lateral
      quando ele não virou link. A varredura fica no começo do texto
      visível de propósito: e-mail citado **dentro** de uma mensagem é
      de outra pessoa, e casar por ele traria a ficha errada.
    */
    const lateral = document.querySelector(
      "[class*='profile' i], [class*='sidebar' i], [class*='perfil' i]"
    );

    const texto = (lateral?.innerText ?? "").slice(0, 1500);

    const achado = texto.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);

    return achado ? achado[0] : "";
  }

  function telefoneNaTela() {

    const link = document.querySelector('a[href^="tel:"]');

    if (link) {
      const so = CW.digitos(link.getAttribute("href"));
      if (so.length >= 10) return so;
    }

    const lateral = document.querySelector(
      "[class*='profile' i], [class*='sidebar' i], [class*='perfil' i]"
    );

    const texto = (lateral?.innerText ?? "")
      .replace(CW.INVISIVEIS, "")
      .slice(0, 1500);

    const SEP = "[\\s\\-().\\u00A0\\u2010-\\u2015\\u2212]*";

    const achado = texto.match(
      new RegExp(`\\+?55${SEP}\\d{2}${SEP}\\d{4,5}${SEP}\\d{4}`)
    );

    return achado ? CW.digitos(achado[0]) : "";
  }

  /** O apelido do visitante, como o Crisp o mostra no topo da conversa. */
  function nomeNaTela() {

    const candidatos = [
      "[class*='nickname' i]",
      "[class*='conversation-header' i] [class*='name' i]",
      "[class*='identity' i] [class*='name' i]",
      "header h1",
      "h1",
    ];

    for (const seletor of candidatos) {

      const texto = CW.texto(document.querySelector(seletor), 80);

      /* "Visitante", "Anônimo": rótulo do Crisp, não nome de gente. */
      if (texto.length >= 2 && !/^(visitante|visitor|an[ôo]nimo|anonymous|crisp|inbox)$/i.test(texto)) {
        return texto;
      }
    }

    return "";
  }

  /* ============================================================
     A CONVERSA
  ============================================================ */

  /** Onde as mensagens ficam, do mais específico ao mais genérico. */
  const LINHAS = [
    "[data-smart-id]",
    "[class*='conversation-box-message' i]",
    "[class*='message-wrapper' i]",
    "[class*='message' i][class*='item' i]",
    "[class*='message' i]",
  ];

  /** Textos do Crisp que não são mensagem de ninguém. */
  const RUIDO =
    /^(hoje|ontem|today|yesterday|digitando|is typing|entrou no chat|left the chat|resolvida|resolved)\.?$/i;

  function limpar(texto) {
    return String(texto ?? "")
      .replace(CW.INVISIVEIS, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * De quem é a linha.
   *
   * O Crisp marca o lado de três formas conforme a versão: um atributo
   * explícito, uma classe com "operator"/"user", ou só o alinhamento. As
   * três são tentadas em ordem — e quando nenhuma responde, a linha
   * volta como do **cliente**, que é o lado que não pode sumir de uma
   * conversa guardada como evidência.
   */
  function ladoDaMarca(marca, classes) {

    const m = String(marca ?? "").toLowerCase();

    if (/operator|agent|me\b/.test(m)) return "nos";
    if (/user|visitor|client/.test(m)) return "cliente";

    const c = String(classes ?? "").toLowerCase();

    if (/operator|agent|--right|is-me|outgoing/.test(c)) return "nos";
    if (/visitor|--left|incoming/.test(c)) return "cliente";

    /* "user" sozinho, por último: casa dentro de "user-agent". */
    if (/\buser\b/.test(c)) return "cliente";

    return "cliente";
  }

  function deQuemE(linha) {
    return ladoDaMarca(
      linha.getAttribute?.("data-from") ?? linha.getAttribute?.("data-type") ?? "",
      linha.className ?? ""
    );
  }

  /**
   * O carimbo da linha, no formato que a plataforma lê.
   *
   * "DD/MM/AAAA, HH:MM", sempre em Brasília — a conversão sai daqui com
   * `timeZone` explícito, e não do relógio da máquina: a plataforma
   * inteira trabalha em horário de Brasília, e uma máquina em outro
   * fuso gravaria a conversa com as horas deslocadas sem ninguém notar.
   */
  function carimboDoBruto(bruto) {

    if (!bruto) return "";

    /* Época em milissegundos (o formato interno do Crisp) ou ISO. */
    const numero = Number(bruto);

    const quando = Number.isFinite(numero) && numero > 1e11
      ? new Date(numero)
      : new Date(bruto);

    if (Number.isNaN(quando.getTime())) {
      /* Já veio escrito: "14/09/2026 10:32" passa direto. */
      return /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(bruto) ? limpar(bruto) : "";
    }

    return quando.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function carimboDaLinha(linha) {
    return carimboDoBruto(
      linha.querySelector?.("time[datetime]")?.getAttribute("datetime") ??
        linha.getAttribute?.("data-timestamp") ??
        linha.querySelector?.("[data-timestamp]")?.getAttribute("data-timestamp") ??
        linha.querySelector?.("[title]")?.getAttribute("title") ??
        ""
    );
  }

  /**
   * Um id estável para a linha, para guardar de novo só trazer as novas.
   *
   * `data-smart-id` é o identificador do próprio Crisp e é o melhor que
   * existe. Sem ele, a mensagem vai **sem id** — e a plataforma dedupe
   * pela assinatura (lado, minuto e texto), que é o caminho que já
   * existe para os arquivos exportados.
   */
  function idDaLinha(linha) {
    const id =
      linha.getAttribute?.("data-smart-id") ??
      linha.getAttribute?.("data-fingerprint") ??
      linha.getAttribute?.("data-id") ??
      "";
    return id ? `crisp:${String(id).slice(0, 180)}` : "";
  }

  /**
   * Lê as mensagens visíveis da conversa aberta.
   *
   * Só é chamada por clique — o painel a recebe como função.
   */
  function lerMensagens() {

    let encontro = null;

    for (const seletor of LINHAS) {

      const achados = Array.from(document.querySelectorAll(seletor)).filter(
        (el) => limpar(el.innerText).length > 0
      );

      /*
        Uma linha só quase nunca é a conversa — é um cartão solto da
        lista. Duas já é conversa; e quando só há uma mensagem mesmo, a
        camada genérica seguinte a pega.
      */
      if (achados.length >= 2) {
        encontro = { seletor, achados };
        break;
      }

      if (achados.length === 1 && !encontro) {
        encontro = { seletor, achados };
      }
    }

    if (!encontro) {
      return {
        mensagens: [],
        via: "",
        motivo:
          "não achei as mensagens nesta tela — abra uma conversa no Crisp e tente de novo",
      };
    }

    /*
      Uma linha pode conter outra (o container e a bolha casam com o
      mesmo seletor genérico). Ficar com a mais interna evita guardar a
      mesma mensagem duas vezes, uma delas com o texto de todas.
    */
    const folhas = encontro.achados.filter(
      (el) => !encontro.achados.some((outro) => outro !== el && el.contains(outro))
    );

    const mensagens = [];

    for (const linha of folhas) {

      const texto = limpar(linha.innerText);

      if (!texto || RUIDO.test(texto)) continue;

      mensagens.push({
        de: deQuemE(linha),
        texto: texto.slice(0, 1200),
        hora: "",
        id: idDaLinha(linha),
        carimbo: carimboDaLinha(linha),
        autor: "",
      });
    }

    return {
      mensagens,
      via: encontro.seletor,
      motivo:
        mensagens.length > 0
          ? undefined
          : `li ${folhas.length} linha(s) por "${encontro.seletor}", e nenhuma sobrou depois da limpeza`,
    };
  }

  CW.painel.definirLeitorDeConversa?.(lerMensagens);

  /** Os leitores, expostos para a conferência (`check:lugares`). */
  CW.crisp = { ladoDaMarca, carimboDoBruto };

  /* ============================================================
     O LAÇO
  ============================================================ */

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    const email = emailNaTela();
    const telefone = telefoneNaTela();
    const nome = nomeNaTela();

    const chave = `${email}|${telefone}|${nome}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    if (!email && !telefone && !nome) {
      CW.painel.definirContexto({
        canalDaPagina: "Crisp",
        rotulo: "nenhuma conversa aberta",
      });
      return;
    }

    /**
     * O contato já vira rascunho de caso.
     *
     * Guardado, não enviado: é o que deixa o painel oferecer "cadastrar
     * neste canal" no instante em que descobre que aquele e-mail só tem
     * caso no Reclame Aqui — sem pedir para redigitar o que está na
     * tela.
     */
    CW.painel.definirCaptura({
      origem: "Crisp",
      cliente: nome || email || telefone,
      telefone,
      email,
      titulo: "",
      texto: "",
      prioridade: "Normal",
      url: location.href,
    });

    CW.painel.definirContexto({
      canalDaPagina: "Crisp",
      email,
      telefone,
      nome,
      rotulo: nome || email || telefone,
    });
  }

  function verificarComRede() {
    try {
      verificar();
    } catch (erro) {
      console.warn("[CW] detector do Crisp falhou nesta volta", erro);
    }
  }

  setInterval(verificarComRede, INTERVALO);

  verificarComRede();
})();
