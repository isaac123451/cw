/**
 * O painel.
 *
 * Uma gaveta à direita da tela, dentro de um Shadow DOM próprio, com um
 * botão flutuante para abrir e fechar. É a mesma peça nas três
 * superfícies — WhatsApp Web, Hugme/Reclame Aqui e ManyChat. O que muda
 * de um site para outro é só **quem descobre o contato**; daqui para
 * baixo, tudo é igual.
 *
 * O painel lê e mostra. A única coisa que ele grava é um caso novo, e
 * só depois de você conferir a prévia e confirmar — nunca sozinho.
 * Mensagem ele não manda em site nenhum, o que é o que o mantém do lado
 * seguro da regra do WhatsApp.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || CW.painel) return;

  const MARCA = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5"
        stroke="currentColor" stroke-width="2"/>
  <circle cx="12" cy="10.8" r="3.5" fill="#F9A11B"/>
  <path d="M7.4 16.5c1.2 1.3 2.8 2 4.6 2s3.4-.7 4.6-2"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round"/>
</svg>`;

  let hospedeiro = null;
  let raiz = null;
  let gaveta = null;
  let corpo = null;
  let selo = null;
  let campoBusca = null;
  let linhaQuem = null;

  let aberto = false;
  let config = {
    autoAbrir: false,
    tema: "auto",
    largura: 380,
  };

  /** Reclamação lida da página, esperando confirmação para virar caso. */
  let captura = null;

  /**
   * Como reler a página sob demanda.
   *
   * Só o `hugme.js` fornece. Existe porque o bloco de informações
   * adicionais do Reclame Aqui nasce recolhido, e expandir não muda o
   * endereço — que é a chave que dispara a leitura automática.
   */
  let releitor = null;

  /**
   * Como entregar o texto cru da página.
   *
   * Existe para o caso em que o detector não acha nada numa página que
   * visivelmente tem uma reclamação: `innerText` decide a quebra de
   * linha pelo layout, e um portal pode entregar as mesmas etiquetas em
   * uma linha ou em quatro. Sem ver o texto que a página realmente
   * produziu, consertar o leitor é adivinhação — e adivinhar leitor de
   * página já custou três defeitos aqui.
   */
  let diagnostico = null;

  /**
   * Como ler a conversa aberta, quando o site sabe fazer isso.
   *
   * Só o WhatsApp fornece. Fica como função, e não como dado, de
   * propósito: a leitura acontece no clique — o painel nunca segura o
   * texto de uma conversa que ninguém pediu para resumir.
   */
  let lerConversa = null;

  /** Último resumo pedido nesta conversa. */
  let resumo = null;

  /**
   * Só o WhatsApp Web pode abrir o painel sozinho.
   *
   * Nos outros sites o painel abre por clique, e só. O motivo é
   * concreto: no WhatsApp a troca de conversa é um evento nítido e
   * raro, enquanto no Hugme e no ManyChat o que muda é o texto de uma
   * página que se redesenha sozinha — tratar isso como "novo contato"
   * fazia a gaveta reabrir a cada segundo e meio, por cima do trabalho
   * de quem estava lendo a reclamação.
   */
  let autoPermitido = false;

  /**
   * Fechou na mão? Não reabre sozinho.
   *
   * Vale até o contato realmente mudar. Sem esta trava, fechar o painel
   * era inútil: a próxima leitura do detector o trazia de volta.
   */
  let fechadoNaMao = false;

  /** Consulta corrente e a chave que evita repetir a mesma busca. */
  let consulta = null;
  let chaveConsulta = "";
  let ultimoDado = null;

  /**
   * Canal escolhido no rodapé: "todos", "reclame-aqui", "nps", "social".
   *
   * Entra na chave da consulta — trocar de aba tem de refazer a busca,
   * senão o painel mostraria o recorte anterior sob o rótulo novo.
   */
  let canal = "todos";

  /* ============================================================
     MONTAGEM
  ============================================================ */

  function montar() {

    if (
      hospedeiro &&
      document.documentElement.contains(hospedeiro)
    ) {
      return;
    }

    /**
     * Sobrou um painel de uma montagem anterior? Some com ele.
     *
     * Sem isto, uma página que remove e recria a árvore acumularia um
     * painel por ciclo — vários botões flutuantes empilhados, cada um
     * com o seu próprio detector.
     */
    for (const antigo of document.querySelectorAll(
      "#cw-reputacao-painel"
    )) {
      antigo.remove();
    }

    hospedeiro = document.createElement("div");

    hospedeiro.id = "cw-reputacao-painel";

    // No documentElement, e não no body: o WhatsApp Web troca o
    // conteúdo do body em navegações internas.
    document.documentElement.appendChild(hospedeiro);

    const shadow = hospedeiro.attachShadow({ mode: "open" });

    const estilo = document.createElement("style");
    estilo.textContent = CW.CSS;
    shadow.appendChild(estilo);

    raiz = document.createElement("div");
    raiz.className = "raiz";

    raiz.innerHTML = `
      <button class="gatilho" title="CW Reputação" type="button">
        <span style="color:#fff;display:grid;place-items:center">${MARCA}</span>
        <span class="selo"></span>
      </button>

      <aside class="gaveta">
        <div class="punho" title="Arraste para redimensionar"></div>
        <header class="topo">
          <span style="color:#fff;display:grid;place-items:center">${MARCA}</span>
          <span>
            <span class="titulo">CW Reputação</span><br>
            <span class="quem">verificando conexão…</span>
          </span>
          <span class="espaco"></span>
          <button class="icone-botao" data-acao="fixar"
                  title="Manter aberto (não minimizar sozinho)"
                  type="button">&#128204;</button>
          <button class="icone-botao" data-acao="ancorar"
                  title="Voltar para a lateral direita"
                  type="button" style="display:none">&#8677;</button>
          <button class="icone-botao" data-acao="tema"
                  title="Tema: automático, claro ou escuro"
                  type="button">&#9681;</button>
          <button class="icone-botao" data-acao="recarregar"
                  title="Consultar de novo" type="button">&#8635;</button>
          <button class="icone-botao" data-acao="fechar"
                  title="Fechar" type="button">&times;</button>
        </header>

        <div class="busca">
          <input type="text" placeholder="Telefone, nome ou protocolo"
                 spellcheck="false" />
          <button type="button" data-acao="buscar">Buscar</button>
        </div>

        <div class="corpo"></div>

        <!--
          O rodapé de canais.

          Os três não são a mesma fila, e o NPS é o motivo: a pesquisa
          fala com o cliente por um **WhatsApp próprio**, então uma
          conversa aberta ali não casa com reclamação nenhuma do Reclame
          Aqui. Sem separar, o painel dizia "nada encontrado" para um
          cliente que estava ali, com ciclo de NPS aberto.
        -->
        <nav class="canais">
          <button type="button" data-acao="canal" data-canal="reclame-aqui"
                  aria-pressed="false">Reclame Aqui</button>
          <button type="button" data-acao="canal" data-canal="nps"
                  aria-pressed="false">NPS</button>
          <button type="button" data-acao="canal" data-canal="social"
                  aria-pressed="false">Redes Sociais</button>
        </nav>

        <footer class="rodape-painel">
          <label class="auto" title="Abrir o painel sozinho ao trocar de conversa (só no WhatsApp Web)">
            <input type="checkbox" data-acao="auto" />
            <span>abrir sozinho</span>
          </label>
          <a data-acao="opcoes">Opções</a>
        </footer>
      </aside>`;

    shadow.appendChild(raiz);

    gaveta = raiz.querySelector(".gaveta");
    corpo = raiz.querySelector(".corpo");
    selo = raiz.querySelector(".selo");
    campoBusca = raiz.querySelector(".busca input");
    linhaQuem = raiz.querySelector(".quem");

    raiz
      .querySelector(".gatilho")
      .addEventListener("click", alternar);

    raiz.addEventListener("click", (evento) => {

      const alvo = evento.target.closest("[data-acao]");

      if (!alvo) return;

      const acao = alvo.dataset.acao;

      if (acao === "fechar") fechar();
      if (acao === "recarregar") consultar(true);
      if (acao === "buscar") buscarManual();
      if (acao === "opcoes") CW.enviar({ tipo: "opcoes" });
      if (acao === "tema") girarTema();
      if (acao === "auto") alternarAuto(alvo.checked);
      if (acao === "fixar") alternarFixado();
      if (acao === "ancorar") ancorar();
      if (acao === "capturar") abrirCaptura();
      if (acao === "cancelar-captura") {
        captura = null;
        consultar(false);
      }
      if (acao === "criar-caso") criarCaso(alvo);
      if (acao === "reler") reler();
      if (acao === "canal") trocarCanal(alvo);

      // Avançar e voltar etapa, nos três canais.
      if (acao === "mover") moverCaso(alvo);
      if (acao === "nps-mover") moverNps(alvo);

      if (acao === "diagnostico") {
        copiar(
          alvo,
          [
            `# ${location.href}`,
            "",
            (diagnostico?.() ?? "").slice(0, 8000),
          ].join("\n")
        );
      }
      if (acao === "resumir") resumirConversa(alvo);

      // NPS: as duas escritas da tratativa, e os botões que as compõem.
      if (
        acao === "nps-humor" ||
        acao === "nps-resolvido"
      ) {
        alternarEscolha(alvo);
      }

      if (acao === "nps-registrar") {
        registrarNps(alvo, "pos-contato");
      }

      if (acao === "nps-tentativa") {
        registrarNps(alvo, "tentativa");
      }

      if (acao === "abrir") {
        CW.enviar({ tipo: "abrir", url: alvo.dataset.url });
      }

      if (acao === "copiar") {
        copiar(alvo, alvo.dataset.texto ?? "");
      }
    });

    /**
     * A subcategoria segue a categoria escolhida.
     *
     * Listener de `change` e não de `click`: trocar num `<select>` com o
     * teclado não gera clique, e a lista ficaria com as subcategorias da
     * categoria anterior — que é como se grava "Cobrança indevida"
     * dentro de "Entrega".
     */
    raiz.addEventListener("change", (evento) => {

      if (evento.target?.id !== "cap-categoria") return;

      const seletor = corpo.querySelector(
        "#cap-subcategoria"
      );

      if (seletor) {
        seletor.innerHTML = opcoesDeSubcategoria(
          evento.target.value
        );
      }
    });

    campoBusca.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") buscarManual();
      // O WhatsApp captura teclas globalmente; sem isto, digitar no
      // campo dispara atalhos dele.
      evento.stopPropagation();
    });

    campoBusca.addEventListener("keyup", (e) =>
      e.stopPropagation()
    );

    ligarRedimensionamento();
    ligarArrasto();

    refletirCanal();

    // A fonte é registrada no documento — @font-face não vale no shadow.
    CW.registrarFonte?.();

    vazio(
      "Nenhum contato identificado",
      "Abra uma conversa ou use a busca acima."
    );

    identificar();
  }

  /* ============================================================
     TEMA E LARGURA
  ============================================================ */

  const TEMAS = ["auto", "claro", "escuro"];

  const ROTULO_TEMA = {
    auto: "automático (segue o sistema)",
    claro: "claro",
    escuro: "escuro",
  };

  /** O atributo é o que a folha de estilo lê; sem ele, tudo fica claro. */
  function aplicarTema(tema) {
    if (raiz) {
      raiz.dataset.tema = TEMAS.includes(tema)
        ? tema
        : "auto";
    }
  }

  function aplicarLargura(px) {

    const valor = Math.min(
      Math.max(Number(px) || 380, 320),
      720
    );

    gaveta?.style.setProperty("--largura", `${valor}px`);

    return valor;
  }

  /* ---------- fixar e arrastar ---------- */

  /**
   * Fixar = não minimizar sozinho.
   *
   * O painel se remonta quando a página troca a árvore (o WhatsApp Web
   * faz isso em algumas navegações), e remontado ele nascia fechado —
   * o que, de fora, parece uma minimização espontânea. Fixado, ele
   * volta aberto do jeito que estava.
   */
  function alternarFixado() {

    config.fixado = !config.fixado;

    if (config.fixado) {
      fechadoNaMao = false;
      abrir();
    }

    refletirFixado();

    CW.enviar({
      tipo: "salvar",
      parcial: { fixado: config.fixado },
    });
  }

  function refletirFixado() {

    const botao = raiz?.querySelector(
      '[data-acao="fixar"]'
    );

    if (!botao) return;

    botao.style.background = config.fixado
      ? "rgba(255,255,255,.4)"
      : "";

    botao.title = config.fixado
      ? "Fixado — não minimiza sozinho. Clique para soltar."
      : "Manter aberto (não minimizar sozinho)";
  }

  function aplicarPosicao(posicao) {

    if (!gaveta) return;

    const botaoAncorar = raiz?.querySelector(
      '[data-acao="ancorar"]'
    );

    if (!posicao) {
      gaveta.classList.remove("solta");
      if (botaoAncorar) botaoAncorar.style.display = "none";
      return;
    }

    /**
     * Preso à viewport: uma janela arrastada para fora da tela some, e
     * o único jeito de trazê-la de volta seria reinstalar a extensão.
     */
    const largura = config.largura || 380;

    const x = Math.min(
      Math.max(Number(posicao.x) || 0, 0),
      Math.max(window.innerWidth - largura, 0)
    );

    const y = Math.min(
      Math.max(Number(posicao.y) || 0, 0),
      Math.max(window.innerHeight - 120, 0)
    );

    gaveta.style.setProperty("--x", `${x}px`);
    gaveta.style.setProperty("--y", `${y}px`);
    gaveta.classList.add("solta");

    if (botaoAncorar) botaoAncorar.style.display = "";

    return { x, y };
  }

  /** Volta a gaveta para a lateral direita. */
  function ancorar() {

    config.posicao = null;
    aplicarPosicao(null);

    CW.enviar({
      tipo: "salvar",
      parcial: { posicao: null },
    });
  }

  /**
   * Arrastar pelo cabeçalho.
   *
   * O primeiro movimento é o que solta a gaveta do canto — antes disso
   * ela continua ancorada, para um clique acidental no cabeçalho não
   * virar uma janela flutuante.
   */
  function ligarArrasto() {

    const topo = raiz.querySelector(".topo");

    if (!topo) return;

    let arrastando = false;
    let deltaX = 0;
    let deltaY = 0;

    topo.addEventListener("pointerdown", (evento) => {

      // Botões do cabeçalho continuam sendo botões.
      if (evento.target.closest("[data-acao]")) return;

      const caixa = gaveta.getBoundingClientRect();

      deltaX = evento.clientX - caixa.left;
      deltaY = evento.clientY - caixa.top;

      arrastando = true;
      gaveta.classList.add("arrastando");
      topo.setPointerCapture(evento.pointerId);
      evento.preventDefault();
    });

    topo.addEventListener("pointermove", (evento) => {

      if (!arrastando) return;

      aplicarPosicao({
        x: evento.clientX - deltaX,
        y: evento.clientY - deltaY,
      });
    });

    const soltar = (evento) => {

      if (!arrastando) return;

      arrastando = false;
      gaveta.classList.remove("arrastando");

      try {
        topo.releasePointerCapture(evento.pointerId);
      } catch {
        // Já liberado.
      }

      const posicao = aplicarPosicao({
        x: evento.clientX - deltaX,
        y: evento.clientY - deltaY,
      });

      config.posicao = posicao ?? null;

      CW.enviar({
        tipo: "salvar",
        parcial: { posicao: config.posicao },
      });
    };

    topo.addEventListener("pointerup", soltar);
    topo.addEventListener("pointercancel", soltar);

    // Duplo clique no cabeçalho reancora — atalho de quem se perdeu.
    topo.addEventListener("dblclick", (evento) => {
      if (evento.target.closest("[data-acao]")) return;
      ancorar();
    });
  }

  /**
   * O interruptor do rodapé.
   *
   * Está no painel, e não só na tela de opções, porque é o ajuste que
   * alguém quer mudar exatamente no momento em que o painel incomoda —
   * e nesse momento abrir opções em outra aba é fricção demais.
   */
  function alternarAuto(ligado) {

    config.autoAbrir = Boolean(ligado);

    if (!ligado) fechadoNaMao = true;

    CW.enviar({
      tipo: "salvar",
      parcial: { autoAbrir: config.autoAbrir },
    });
  }

  function refletirAuto() {

    const caixa = raiz?.querySelector(
      '[data-acao="auto"]'
    );

    if (caixa) caixa.checked = Boolean(config.autoAbrir);

    const rodape = raiz?.querySelector(".auto");

    /**
     * Fora do WhatsApp o painel nunca abre sozinho, então oferecer o
     * interruptor ali seria prometer um comportamento que não existe.
     */
    if (rodape) {
      rodape.style.display = autoPermitido ? "" : "none";
    }
  }

  function girarTema() {

    const atual = raiz?.dataset.tema ?? "auto";

    const proximo =
      TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length];

    aplicarTema(proximo);

    config.tema = proximo;

    CW.enviar({
      tipo: "salvar",
      parcial: { tema: proximo },
    });

    const botao = raiz?.querySelector(
      '[data-acao="tema"]'
    );

    if (botao) {
      botao.title = `Tema: ${ROTULO_TEMA[proximo]}`;
    }
  }

  /**
   * Arrastar a borda esquerda para redimensionar.
   *
   * A largura fica no `--largura` do elemento, não numa classe: o valor
   * é contínuo, e o painel é usado em telas que vão de um notebook a um
   * monitor de 32". O limite de 320 a 720 existe para nenhuma dessas
   * pontas produzir uma gaveta inutilizável.
   */
  function ligarRedimensionamento() {

    const punho = raiz.querySelector(".punho");

    if (!punho) return;

    let arrastando = false;

    punho.addEventListener("pointerdown", (evento) => {
      arrastando = true;
      punho.classList.add("ativo");
      punho.setPointerCapture(evento.pointerId);
      evento.preventDefault();
    });

    punho.addEventListener("pointermove", (evento) => {
      if (!arrastando) return;
      // A gaveta está colada à direita: a largura é o que sobra dali.
      aplicarLargura(window.innerWidth - evento.clientX);
    });

    const soltar = (evento) => {

      if (!arrastando) return;

      arrastando = false;
      punho.classList.remove("ativo");

      try {
        punho.releasePointerCapture(evento.pointerId);
      } catch {
        // Ponteiro já liberado — nada a fazer.
      }

      const largura = aplicarLargura(
        window.innerWidth - evento.clientX
      );

      config.largura = largura;

      CW.enviar({
        tipo: "salvar",
        parcial: { largura },
      });
    };

    punho.addEventListener("pointerup", soltar);
    punho.addEventListener("pointercancel", soltar);
  }

  async function identificar() {

    const resposta = await CW.enviar({ tipo: "config" });

    if (resposta.ok) {

      config = resposta.dados;

      aplicarTema(config.tema);
      aplicarLargura(config.largura);
      aplicarPosicao(config.posicao);
      refletirAuto();
      refletirFixado();

      /**
       * Fixado volta aberto.
       *
       * É o que fecha o buraco da "minimização sozinha": a remontagem
       * do painel depois de a página trocar a árvore não desfaz mais a
       * escolha de quem o deixou aberto.
       */
      if (config.fixado) abrir();
    }

    const sessao = await CW.enviar({ tipo: "sessao" });

    if (!linhaQuem) return;

    /**
     * "Não conectado" sozinho não ajuda ninguém.
     *
     * São quatro motivos diferentes com a mesma cara, e cada um pede
     * uma ação diferente: configurar o endereço, conceder a permissão,
     * subir a aplicação ou entrar na conta. O cabeçalho tem espaço para
     * dizer qual é.
     */
    if (!sessao.ok) {
      linhaQuem.textContent =
        MOTIVO_SEM_SESSAO[sessao.codigo] ??
        "não conectado";
      linhaQuem.title = sessao.erro ?? "";
      return;
    }

    const dados = sessao.dados;

    linhaQuem.title = "";

    linhaQuem.textContent = dados.usuario
      ? `${dados.usuario.nome} · ${dados.usuario.papel.toLowerCase()}`
      : dados.demonstracao
        ? "modo demonstração"
        : "não conectado";
  }

  const MOTIVO_SEM_SESSAO = {
    "sem-endereco": "endereço não configurado",
    "sem-permissao": "sem permissão de acesso",
    rede: "aplicação fora do ar",
    resposta: "endereço responde outra coisa",
    http: "a aplicação recusou",
    sessao: "sessão expirada — entre no CW",
    recarregue: "recarregue esta página",
  };

  /* ============================================================
     ABRIR E FECHAR
  ============================================================ */

  function abrir() {

    aberto = true;
    gaveta?.classList.add("aberta");

    /**
     * Com o painel fechado a consulta já aconteceu — é ela que acende o
     * contador no botão. Sem redesenhar aqui, abrir a gaveta mostrava
     * uma tela em branco justamente quando havia algo a mostrar.
     */
    if (ultimoDado) {
      render(ultimoDado);
      return;
    }

    consultar(false);
  }

  function fechar({ naMao = true } = {}) {

    aberto = false;
    gaveta?.classList.remove("aberta");

    // Fechar na mão vale como decisão: não reabre até o contato mudar.
    if (naMao) fechadoNaMao = true;
  }

  function alternar() {
    if (aberto) fechar();
    else {
      fechadoNaMao = false;
      abrir();
    }
  }

  /* ============================================================
     CONSULTA
  ============================================================ */

  /**
   * Recebe o que o site detectou.
   *
   * A chave evita o efeito colateral mais chato: o DOM do WhatsApp
   * muda dezenas de vezes por segundo, e sem ela cada mudança viraria
   * uma consulta nova da mesma conversa.
   */
  function definirContexto(novo) {

    const chave = JSON.stringify({
      telefone: novo?.telefone ?? "",
      nome: novo?.nome ?? "",
      protocolo: novo?.protocolo ?? "",
      email: novo?.email ?? "",
    });

    if (chave === chaveConsulta) return;

    chaveConsulta = chave;
    consulta = novo;
    ultimoDado = null;

    // Contato novo de verdade: a recusa anterior não vale mais.
    fechadoNaMao = false;

    // E o resumo da conversa anterior não descreve esta.
    resumo = null;

    marcarSelo(null);

    if (aberto) {
      consultar(false);
      return;
    }

    /**
     * Abrir sozinho pede três condições ao mesmo tempo: estar num site
     * onde isso faz sentido (só o WhatsApp), a preferência estar
     * ligada, e a pessoa não ter fechado o painel há pouco. Qualquer
     * uma que falte, o painel fica onde está e só acende o contador.
     */
    if (autoPermitido && config.autoAbrir && !fechadoNaMao) {
      abrir();
      return;
    }

    // Fechado: consulta assim mesmo, só para o selo do botão avisar
    // que existe algo daquele contato do lado de cá.
    consultarEmSilencio();
  }

  function parametros() {
    return {
      telefone: consulta?.telefone ?? "",
      nome: consulta?.nome ?? "",
      protocolo: consulta?.protocolo ?? "",
      email: consulta?.email ?? "",
      termo: consulta?.termo ?? "",
      canal,
    };
  }

  /**
   * Troca a aba do rodapé e refaz a consulta.
   *
   * Clicar na aba já ativa volta para "todos" — é o caminho de saída
   * sem precisar de um quarto botão só para isso.
   */
  function trocarCanal(alvo) {

    const pedido = alvo.dataset.canal;

    canal = canal === pedido ? "todos" : pedido;

    refletirCanal();

    ultimoDado = null;

    if (temOndeProcurar()) consultar(true);
  }

  function refletirCanal() {
    for (const botao of raiz.querySelectorAll(
      '[data-acao="canal"]'
    )) {
      botao.setAttribute(
        "aria-pressed",
        botao.dataset.canal === canal ? "true" : "false"
      );
    }
  }

  /**
   * Um contexto pode chegar sem nada procurável — conversa em grupo,
   * aba do Hugme fora de uma reclamação. Aí o rótulo explica o motivo,
   * em vez de a consulta sair vazia e voltar erro do servidor.
   */
  function temOndeProcurar() {
    return Object.values(parametros()).some(
      (valor) => String(valor).trim() !== ""
    );
  }

  async function consultar(forcar) {

    if (!consulta || !temOndeProcurar()) {
      vazio(
        "Nenhum contato identificado",
        consulta?.rotulo
          ? `Sem contato para consultar (${consulta.rotulo}). Use a busca acima.`
          : "Abra uma conversa ou use a busca acima.",
        /**
         * Numa página que visivelmente tem uma reclamação, "não achei
         * nada" é defeito do leitor, não da página. O botão copia o
         * texto que o navegador realmente produziu, que é a única forma
         * de consertar sem adivinhar.
         */
        diagnostico
          ? '<button class="copiar" data-acao="diagnostico" style="margin-top:12px">Copiar o texto lido da página</button>'
          : undefined
      );
      marcarSelo(null);
      return;
    }

    corpo.innerHTML = `<div class="carregando">Consultando o CW Reputação…</div>`;

    const resposta = await CW.enviar({
      tipo: "contexto",
      consulta: parametros(),
      forcar: Boolean(forcar),
    });

    if (!resposta.ok) {
      renderFalha(resposta);
      marcarSelo(null);
      return;
    }

    ultimoDado = resposta.dados;
    render(resposta.dados);
  }

  /** Igual, mas sem mexer no que está na tela. */
  async function consultarEmSilencio() {

    if (!temOndeProcurar()) {
      marcarSelo(null);
      return;
    }

    const resposta = await CW.enviar({
      tipo: "contexto",
      consulta: parametros(),
    });

    if (!resposta.ok) return;

    ultimoDado = resposta.dados;

    marcarSelo(resposta.dados?.cliente?.abertos ?? 0);
  }

  function marcarSelo(quantidade) {

    if (!selo) return;

    if (!quantidade) {
      selo.classList.remove("visivel");
      selo.textContent = "";
      return;
    }

    selo.textContent = String(Math.min(quantidade, 99));
    selo.classList.add("visivel");
  }

  function buscarManual() {

    const termo = campoBusca.value.trim();

    if (termo === "") return;

    chaveConsulta = `manual:${termo}`;
    consulta = { termo, rotulo: `busca: ${termo}` };
    ultimoDado = null;

    consultar(true);
  }

  /* ============================================================
     DESENHO
  ============================================================ */

  function vazio(titulo, detalhe, botao) {
    corpo.innerHTML = `
      <div class="vazio">
        <b>${CW.escapar(titulo)}</b>
        ${CW.escapar(detalhe)}
        ${botao ?? ""}
      </div>`;
  }

  function renderFalha(resposta) {

    const codigo = resposta.codigo;

    const botoes = {
      "sem-endereco": `<button class="acao" data-acao="opcoes">Configurar endereço</button>`,
      "sem-permissao": `<button class="acao" data-acao="opcoes">Conceder permissão</button>`,
      sessao: `<button class="acao" data-acao="abrir" data-url="${CW.escapar(
        (resposta.base ?? "") + "/login"
      )}">Entrar no CW Reputação</button>`,
      rede: `<button class="acao" data-acao="recarregar">Tentar de novo</button>`,
      resposta: `<button class="acao" data-acao="opcoes">Conferir o endereço</button>`,
    };

    vazio(
      "Não deu para consultar",
      resposta.erro ?? "Falha desconhecida.",
      botoes[codigo] ??
        `<button class="acao" data-acao="recarregar">Tentar de novo</button>`
    );
  }

  const TOM_CONFIANCA = {
    exata: ["ok", "confirmado"],
    provavel: ["atencao", "provável"],
    ambigua: ["perigo", "ambíguo"],
    nenhuma: ["neutro", "sem correspondência"],
  };

  function render(dados) {

    if (!dados?.cliente) {

      /**
       * Nada aqui **e** uma reclamação lida na página: é exatamente o
       * caso de alimentar o Kanban. O botão só aparece nessa
       * combinação — oferecer "criar" quando o caso já existe seria
       * convidar à duplicata.
       */
      const doPortal =
        captura && captura.id && captura.titulo;

      /**
       * Numa conversa basta ter com quem falar: o caso nasce do nada,
       * com o contato já preenchido. No portal exige-se o que foi lido,
       * senão o formulário abriria vazio e sem serventia.
       */
      const daConversa =
        captura &&
        captura.origem &&
        captura.origem !== "Reclame Aqui" &&
        (captura.cliente || captura.telefone);

      const podeCapturar = doPortal || daConversa;

      vazio(
        "Nada encontrado",
        doPortal
          ? `A reclamação ${captura.id} não está no CW Reputação.`
          : daConversa
            ? `${captura.cliente || captura.telefone} não tem caso registrado.`
            : consulta?.rotulo
              ? `Sem registro para ${consulta.rotulo}.`
              : "Este contato não tem caso registrado.",
        podeCapturar
          ? `<button class="acao" data-acao="capturar">${
              doPortal
                ? "Ler e adicionar ao Kanban"
                : "Cadastrar caso"
            }</button>`
          : undefined
      );

      // Sem caso, mas com conversa aberta: resumir ainda ajuda.
      corpo.insertAdjacentHTML("beforeend", blocoResumo());

      marcarSelo(null);
      return;
    }

    const cliente = dados.cliente;

    const [tom, rotuloConfianca] =
      TOM_CONFIANCA[dados.confianca] ?? TOM_CONFIANCA.nenhuma;

    const partes = [];

    if (dados.aviso) {
      partes.push(
        `<div class="aviso">${CW.escapar(dados.aviso)}</div>`
      );
    }

    // O resumo vem primeiro: responde "o que está havendo aqui".
    partes.push(blocoResumo());

    // Depois, o atalho de capturar a reclamação que está na tela.
    partes.push(blocoCaptura(dados));

    /* ---- cliente ---- */

    partes.push(`
      <div class="bloco">
        <div class="rotulo">Cliente</div>
        <div class="cartao">
          <div class="linha">
            <span class="nome">${CW.escapar(cliente.nome)}</span>
            <span class="tag ${tom}">${rotuloConfianca}</span>
          </div>
          <div class="sub">
            ${[
              cliente.cidade &&
                `${CW.escapar(cliente.cidade)}/${CW.escapar(
                  cliente.estado ?? ""
                )}`,
              cliente.telefone && CW.escapar(cliente.telefone),
              cliente.categoriaTop &&
                CW.escapar(cliente.categoriaTop),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div class="sub" style="margin-top:4px">
            ${CW.escapar(dados.porQue ?? "")}
          </div>
          <div class="numeros">
            <div class="numero"><b>${cliente.total}</b><span>casos</span></div>
            <div class="numero"><b>${cliente.abertos}</b><span>abertos</span></div>
            <div class="numero"><b>${
              cliente.notaMedia ?? "—"
            }</b><span>nota</span></div>
            <div class="numero"><b>${
              cliente.naoResolvidos
            }</b><span>sem solução</span></div>
          </div>
          <div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap">
            ${
              cliente.risco
                ? `<span class="tag perigo">risco de cancelamento</span>`
                : ""
            }
            <a class="tag marca" data-acao="abrir"
               data-url="${CW.escapar(cliente.url)}"
               style="cursor:pointer">abrir ficha &rarr;</a>
          </div>
        </div>
      </div>`);

    /* ---- estabelecimento ---- */

    if (dados.estabelecimento) {
      const est = dados.estabelecimento;

      partes.push(`
        <div class="bloco">
          <div class="rotulo">Estabelecimento</div>
          <div class="cartao">
            <div class="linha">
              <span class="nome">${CW.escapar(est.nome)}</span>
              <span class="tag ${
                est.status === "Em risco" ? "perigo" : "marca"
              }">${CW.escapar(est.status)}</span>
            </div>
            <div class="sub">
              ${[
                CW.escapar(est.plano),
                est.mrr && CW.dinheiro(est.mrr),
                est.responsavel && CW.escapar(est.responsavel),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <a class="tag marca" data-acao="abrir"
               data-url="${CW.escapar(est.url)}"
               style="cursor:pointer;margin-top:8px">abrir cadastro &rarr;</a>
          </div>
        </div>`);
    }

    /* ---- NPS ---- */

    /**
     * Na aba de NPS, **todos** os ciclos; fora dela, só o mais recente.
     *
     * Quem abriu a aba está atendendo pelo WhatsApp da pesquisa, e ali
     * o histórico é o assunto: uma pessoa que respondeu três vezes tem
     * três ciclos, e mostrar só o último esconderia se ela já tinha
     * reclamado do mesmo antes. Nas outras abas o NPS é contexto de
     * canto, e um cartão basta.
     */
    const ciclos =
      canal === "nps"
        ? (dados.npsLista ?? [])
        : dados.nps
          ? [dados.nps]
          : [];

    for (const ciclo of ciclos) {
      partes.push(
        blocoNps(
          ciclo,
          podeEscrever(dados),
          ciclos.length > 1
        )
      );
    }

    /* ---- sugestões ---- */

    if ((dados.sugestoes ?? []).length > 0) {
      partes.push(`
        <div class="bloco">
          <div class="rotulo">O que fazer</div>
          ${dados.sugestoes
            .map(
              (item) => `
            <div class="sugestao ${item.tom}">
              <span class="marca-tom"></span>
              <span>${CW.escapar(item.texto)}</span>
            </div>`
            )
            .join("")}
        </div>`);
    }

    /* ---- casos ---- */

    if ((dados.casos ?? []).length > 0) {
      partes.push(`
        <div class="bloco">
          <div class="rotulo">
            Reclamações (${dados.totalCasos})
          </div>
          ${dados.casos.map(desenharCaso).join("")}
        </div>`);
    }

    /* ---- macros ---- */

    if ((dados.macros ?? []).length > 0) {
      partes.push(`
        <div class="bloco">
          <div class="rotulo">Textos aprovados</div>
          ${dados.macros
            .map(
              (macro) => `
            <div class="macro">
              <div class="linha">
                <span style="font-weight:600;font-size:12.5px">${CW.escapar(
                  macro.titulo
                )}</span>
                <button class="copiar" data-acao="copiar"
                        data-texto="${CW.escapar(macro.texto)}">copiar</button>
              </div>
              <pre>${CW.escapar(macro.texto)}</pre>
            </div>`
            )
            .join("")}
        </div>`);
    }

    corpo.innerHTML = partes.join("");
    corpo.scrollTop = 0;

    marcarSelo(cliente.abertos);
  }

  function desenharCaso(caso) {

    const grave =
      caso.sla.situacao === "estourado" ||
      caso.movimentacao?.situacao === "estourado" ||
      caso.risco;

    const classe = !caso.aberto
      ? "fechado"
      : grave
        ? "grave"
        : "";

    const etiquetas = [
      `<span class="tag neutro">${CW.escapar(caso.status)}</span>`,
    ];

    if (caso.aberto) {
      etiquetas.push(
        `<span class="tag ${
          caso.sla.situacao === "estourado"
            ? "perigo"
            : caso.sla.situacao === "atencao"
              ? "atencao"
              : "ok"
        }">${CW.escapar(caso.sla.rotulo)}</span>`
      );
    }

    if (typeof caso.nota === "number") {
      etiquetas.push(
        `<span class="tag ${
          caso.nota >= 7 ? "ok" : "perigo"
        }">nota ${caso.nota}</span>`
      );
    }

    if (caso.movimentacao) {
      etiquetas.push(
        `<span class="tag ${
          caso.movimentacao.situacao === "estourado"
            ? "perigo"
            : "laranja"
        }">${CW.escapar(caso.movimentacao.rotulo)}</span>`
      );
    }

    if (caso.risco) {
      etiquetas.push(
        `<span class="tag perigo">risco</span>`
      );
    }

    /**
     * Os botões de etapa ficam **dentro** do cartão, e funcionam.
     *
     * O cartão inteiro tem `data-acao="abrir"`, mas o despachante usa
     * `closest("[data-acao]")` a partir do que foi clicado — o botão
     * está mais perto que o cartão, então ele ganha. Sem isso, tentar
     * avançar a etapa abriria o caso na aplicação, que é exatamente o
     * que estes botões existem para evitar.
     */
    return `
      <div class="caso ${classe}" data-acao="abrir"
           data-url="${CW.escapar(caso.url)}">
        <div class="linha">
          <span class="sub">${CW.escapar(caso.protocolo)}</span>
          <span class="sub">${CW.data(caso.criadoEm)}</span>
        </div>
        <div class="titulo-caso">${CW.escapar(caso.titulo)}</div>
        <div class="rodape">${etiquetas.join("")}</div>
        ${botoesDeEtapa(caso)}
      </div>`;
  }

  /* ============================================================
     COPIAR
  ============================================================ */

  async function copiar(botao, texto) {

    const original = botao.textContent;

    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /**
       * `navigator.clipboard` exige a página em foco, e clicar dentro
       * do Shadow DOM nem sempre conta. O caminho antigo continua
       * funcionando nesse caso.
       */
      const area = document.createElement("textarea");
      area.value = texto;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    botao.textContent = "copiado";

    setTimeout(() => {
      botao.textContent = original;
    }, 1400);
  }

  /* ============================================================
     PÚBLICO
  ============================================================ */

  /* ============================================================
     RESUMO DA CONVERSA
  ============================================================ */

  const HUMOR = {
    1: "\u{1F621} Irritado",
    2: "\u{1F641} Insatisfeito",
    3: "\u{1F610} Neutro",
    4: "\u{1F642} Satisfeito",
    5: "\u{1F929} Encantado",
  };

  /**
   * Lê a conversa aberta e pede um retrato ao servidor.
   *
   * Acontece **no clique**, e o botão diz o que vai ler antes de ler.
   * O que volta é estruturado — resumo, humor, pendência, próximo
   * passo e um rascunho de resposta —, e o rascunho é texto para
   * copiar: a extensão não envia mensagem em lugar nenhum.
   */
  async function resumirConversa(botao) {

    if (!lerConversa) return;

    const mensagens = lerConversa();

    const rotulo = botao.textContent;

    /**
     * Zero mensagens e "duas mensagens" são problemas diferentes.
     *
     * Zero quase sempre é o leitor: o WhatsApp Web troca a marcação sem
     * avisar, e `div[data-id]` para de casar. Dizer "conversa curta
     * demais" nesse caso manda procurar o defeito no lugar errado — a
     * conversa está cheia, quem não está lendo é a extensão.
     */
    if (mensagens.length === 0) {
      avisar(
        "Não consegui ler nenhuma mensagem desta conversa. Isso é a extensão, não a conversa: o WhatsApp Web mudou a marcação. Recarregue a página; se continuar, me avise.",
        "perigo"
      );
      return;
    }

    if (mensagens.length < 2) {
      avisar(
        "Só consegui ler uma mensagem — pouco para resumir. Role a conversa para cima e tente de novo.",
        "atencao"
      );
      return;
    }

    botao.disabled = true;
    botao.textContent = `lendo ${mensagens.length} mensagens\u2026`;

    /**
     * O retrato do cliente vai junto para o rascunho não inventar
     * protocolo nem prazo: o modelo responde com o que existe.
     */
    const contexto = ultimoDado?.cliente
      ? [
          `Cliente: ${ultimoDado.cliente.nome}`,
          `${ultimoDado.cliente.total} caso(s), ${ultimoDado.cliente.abertos} aberto(s)`,
          ...(ultimoDado.casos ?? [])
            .slice(0, 3)
            .map((c) => `${c.protocolo} \u2014 ${c.status} \u2014 ${c.titulo}`),
        ].join("\n")
      : undefined;

    const resposta = await CW.enviar({
      tipo: "resumirConversa",
      conversa: {
        mensagens,
        contato: {
          nome: consulta?.nome,
          telefone: consulta?.telefone,
        },
        contexto,
      },
    });

    botao.disabled = false;

    botao.textContent = rotulo;

    /**
     * O motivo vai no recado, não no rótulo do botão.
     *
     * Antes a mensagem de erro virava o texto do botão por dois
     * segundos e meio. Num botão de 350 px, "ANTHROPIC_API_KEY não
     * configurada — o resumo precisa dela" é ilegível, e o efeito era
     * o botão parecer que simplesmente não faz nada.
     */
    if (!resposta.ok || resposta.dados?.erro) {

      const motivo =
        resposta.dados?.erro ??
        resposta.erro ??
        "Falha desconhecida ao resumir.";

      avisar(
        /ANTHROPIC_API_KEY/i.test(motivo)
          ? `${motivo} Ela é opcional no deploy — se a aplicação está na Vercel, precisa ser adicionada lá em Settings → Environment Variables.`
          : motivo,
        "perigo"
      );

      return;
    }

    resumo = resposta.dados;

    if (ultimoDado) render(ultimoDado);
    else desenharResumo();
  }

  /** O bloco do resumo, usado pelas duas telas que podem mostrá-lo. */
  function blocoResumo() {

    if (!lerConversa) return "";

    if (!resumo) {
      return [
        '<div class="bloco">',
        '  <button class="copiar" data-acao="resumir" style="width:100%;padding:8px">',
        '    Resumir conversa',
        '  </button>',
        '  <p class="sub" style="margin-top:6px">',
        '    Lê as mensagens visíveis desta conversa e devolve o resumo, o humor e um rascunho de resposta. Só acontece quando você clica.',
        '  </p>',
        '</div>',
      ].join("");
    }

    const tom =
      resumo.humor <= 2
        ? "perigo"
        : resumo.humor === 3
          ? "neutro"
          : "ok";

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Resumo da conversa</div>',
      '  <div class="cartao">',
      '    <div class="linha">',
      `      <span class="nome" style="font-size:13px">${CW.escapar(resumo.assunto ?? "Conversa")}</span>`,
      `      <span class="tag ${tom}">${HUMOR[resumo.humor] ?? "\u2014"}</span>`,
      '    </div>',
      `    <p class="sub" style="margin-top:6px;color:var(--suave)">${CW.escapar(resumo.resumo ?? "")}</p>`,
      `    <p class="sub" style="margin-top:8px"><strong>Pendência:</strong> ${CW.escapar(resumo.pendencia ?? "\u2014")}</p>`,
      `    <p class="sub" style="margin-top:4px"><strong>Próximo passo:</strong> ${CW.escapar(resumo.proximoPasso ?? "\u2014")}</p>`,
      '    <p class="sub" style="margin-top:8px">',
      resumo.resolvido
        ? '      <span class="tag ok">parece resolvido</span>'
        : '      <span class="tag atencao">ainda não resolvido</span>',
      `      <span style="margin-left:6px">${resumo.mensagensLidas ?? 0} mensagens lidas</span>`,
      '    </p>',
      '  </div>',
      '  <div class="macro" style="margin-top:7px">',
      '    <div class="linha">',
      '      <span style="font-weight:600;font-size:12.5px">Rascunho de resposta</span>',
      `      <button class="copiar" data-acao="copiar" data-texto="${CW.escapar(resumo.resposta ?? "")}">copiar</button>`,
      '    </div>',
      `    <pre style="max-height:none">${CW.escapar(resumo.resposta ?? "")}</pre>`,
      '  </div>',
      '  <button class="copiar" data-acao="resumir" style="width:100%;margin-top:7px;padding:7px">Resumir de novo</button>',
      '</div>',
    ].join("");
  }

  function desenharResumo() {
    corpo.innerHTML = blocoResumo();
    corpo.scrollTop = 0;
  }

  /* ============================================================
     NPS — REGISTRAR A TRATATIVA
  ============================================================ */

  /**
   * A régua de humor, igual à de `lib/models/nps.ts`.
   *
   * Repetida aqui porque script de conteúdo não importa módulo do
   * servidor. O servidor continua sendo quem valida — manda um valor
   * fora de 1 a 5 e ele guarda nulo, então esta cópia desalinhada
   * causaria um botão inerte, nunca um dado inventado.
   */
  const HUMORES = [
    {
      valor: 1,
      emoji: "\u{1F621}",
      rotulo: "Irritado",
      dica: "Saiu do contato pior do que entrou. Escalar.",
    },
    {
      valor: 2,
      emoji: "\u{1F641}",
      rotulo: "Insatisfeito",
      dica: "Ouviu, mas não comprou a solução.",
    },
    {
      valor: 3,
      emoji: "\u{1F610}",
      rotulo: "Neutro",
      dica: "Resolveu sem encantar. Não vira defensor.",
    },
    {
      valor: 4,
      emoji: "\u{1F642}",
      rotulo: "Satisfeito",
      dica: "Recuperado. Vale pedir a reavaliação.",
    },
    {
      valor: 5,
      emoji: "\u{1F929}",
      rotulo: "Encantado",
      dica: "Virou promotor no contato — pedir review e indicação.",
    },
  ];

  const CANAIS = ["Telefone", "WhatsApp", "E-mail"];

  /**
   * Os passos de andamento do ciclo de NPS.
   *
   * Só esta metade: encerrar depende do tipo e do checklist do guia, e
   * alguns finais exigem o cliente ter confirmado. Um botão "avançar"
   * que atravessasse isso produziria encerramento sem lastro — o
   * oposto do que o indicador de resolução mede. O servidor recusa
   * igual, e explica por quê.
   */
  const FLUXO_NPS = [
    "Novo",
    "Em tratativa",
    "[Aguardando Resposta]",
  ];

  function passosDoNps(nps) {

    if (nps.encerrado) {
      return '    <div class="etapas"><span class="passo vazio">ciclo encerrado — reabrir é pela tela do NPS</span></div>';
    }

    const i = FLUXO_NPS.indexOf(nps.status);

    if (i < 0) return "";

    const antes = FLUXO_NPS[i - 1];
    const depois = FLUXO_NPS[i + 1];

    return [
      '    <div class="etapas">',
      antes
        ? `      <button class="passo" data-acao="nps-mover" data-id="${CW.escapar(nps.id)}" data-direcao="voltar">&larr; ${CW.escapar(antes)}</button>`
        : '      <span class="passo vazio">início do ciclo</span>',
      depois
        ? `      <button class="passo" data-acao="nps-mover" data-id="${CW.escapar(nps.id)}" data-direcao="avancar">${CW.escapar(depois)} &rarr;</button>`
        : '      <span class="passo vazio">encerrar é pela tela</span>',
      '    </div>',
    ].join("");
  }

  /**
   * Quem pode gravar.
   *
   * O servidor recusa `LEITURA` de qualquer jeito; esconder o
   * formulário evita oferecer um botão que só devolve 403. Sem sessão
   * (modo demonstração) também não há o que gravar.
   */
  function podeEscrever(dados) {
    return (
      Boolean(dados?.usuario) &&
      dados.usuario.papel !== "LEITURA"
    );
  }

  /**
   * O ciclo de NPS do cliente — e o que fazer com ele daqui.
   *
   * O painel já mostrava nota, status e prazo; o que faltava era poder
   * registrar sem trocar de aba. Quem acabou de ligar está no WhatsApp,
   * e registro que exige abrir outra aplicação é registro que não
   * acontece.
   *
   * Duas coisas, e só estas duas: a tentativa (liguei, não atenderam) e
   * o pós-contato (falei, e o cliente ficou assim). Encerrar continua
   * sendo da tela, que tem o checklist — encerramento em gaveta de 380
   * px vira encerramento sem lastro.
   */
  function blocoNps(nps, escrever, compacto = false) {

    const humorAtual = HUMORES.find(
      (h) => h.valor === nps.humor
    );

    const registrado = nps.posContatoEm
      ? [
          humorAtual
            ? `${humorAtual.emoji} ${humorAtual.rotulo}`
            : "",
          nps.resolvido === true
            ? "situação resolvida"
            : nps.resolvido === false
              ? "não resolvida"
              : "",
          `registrado ${CW.data(nps.posContatoEm)}${
            nps.posContatoPor
              ? ` por ${nps.posContatoPor}`
              : ""
          }`,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    const partes = [
      '<div class="bloco">',
      compacto
        ? `  <div class="rotulo">NPS · ${CW.data(nps.respondidoEm)}</div>`
        : '  <div class="rotulo">NPS</div>',
      '  <div class="cartao">',
      '    <div class="linha">',
      `      <span class="nome">${nps.nota}/10</span>`,
      `      <span class="tag ${
        nps.encerrado
          ? "neutro"
          : nps.nota <= 6
            ? "perigo"
            : "atencao"
      }">${CW.escapar(nps.status)}</span>`,
      '    </div>',
      '    <div class="sub">',
      `      ${CW.escapar(nps.tipo ?? "sem classificação")} ·`,
      `      ${nps.tentativas} tentativa(s) ·`,
      `      prazo ${CW.data(nps.prazoPrimeiroContato)}`,
      '    </div>',
      registrado
        ? `    <div class="sub" style="margin-top:6px;color:var(--suave)">${CW.escapar(registrado)}</div>`
        : "",
      escrever ? passosDoNps(nps) : "",
      '  </div>',
    ];

    if (!escrever) {
      partes.push('</div>');
      return partes.filter(Boolean).join("");
    }

    /* ---- pós-contato ---- */

    partes.push(
      '  <div class="cartao" style="margin-top:7px">',
      '    <div class="rotulo" style="margin-bottom:5px">Depois do contato</div>',
      `    <p class="sub" style="margin-bottom:9px">A nota ${nps.nota} é de <strong>antes</strong> e não muda — é ela que compõe o NPS. A régua abaixo mede outra coisa: se o contato moveu a agulha.</p>`,
      '    <div class="humores">',
      ...HUMORES.map(
        (h) => `
      <button class="humor" type="button" data-acao="nps-humor"
              data-valor="${h.valor}"
              aria-pressed="${h.valor === nps.humor ? "true" : "false"}"
              title="${CW.escapar(h.dica)}">
        <span class="emoji">${h.emoji}</span>
        <span class="legenda">${CW.escapar(h.rotulo)}</span>
      </button>`
      ),
      '    </div>',
      '    <div class="escolhas">',
      '      <span class="sub">A situação foi resolvida?</span>',
      `      <button class="escolha sim" type="button" data-acao="nps-resolvido" data-valor="sim" aria-pressed="${nps.resolvido === true ? "true" : "false"}">Sim</button>`,
      `      <button class="escolha nao" type="button" data-acao="nps-resolvido" data-valor="nao" aria-pressed="${nps.resolvido === false ? "true" : "false"}">Não</button>`,
      '    </div>',
      `    <input class="campo" id="nps-nota" type="text" placeholder="O que ficou combinado (opcional)" value="${CW.escapar(nps.notaPosContato ?? "")}" />`,
      '    <div class="linha" style="margin-top:9px;align-items:center">',
      '      <span class="sub">Marcar “Sim” também confirma o checklist.</span>',
      `      <button class="acao" style="margin-top:0" data-acao="nps-registrar" data-id="${CW.escapar(nps.id)}">${nps.posContatoEm ? "Atualizar" : "Registrar"}</button>`,
      '    </div>',
      '    <p class="sub falha" id="nps-erro"></p>',
      '  </div>'
    );

    /* ---- tentativa ---- */

    if (!nps.encerrado) {
      partes.push(
        '  <div class="cartao" style="margin-top:7px">',
        '    <div class="rotulo" style="margin-bottom:5px">Não atendeu?</div>',
        '    <p class="sub" style="margin-bottom:9px">Cada tentativa registrada conta para a regra das três em 7 dias, que é o que autoriza encerrar por falta de retorno.</p>',
        '    <select class="campo" id="nps-canal">',
        ...CANAIS.map(
          (c) => `      <option value="${c}">${c}</option>`
        ),
        '    </select>',
        '    <input class="campo" id="nps-tentativa" type="text" placeholder="Ex.: ligou, caiu na caixa postal" />',
        '    <div class="linha" style="margin-top:9px;align-items:center">',
        `      <span class="sub">${nps.tentativas} até agora.</span>`,
        `      <button class="copiar" data-acao="nps-tentativa" data-id="${CW.escapar(nps.id)}">Registrar tentativa</button>`,
        '    </div>',
        '    <p class="sub falha" id="nps-erro-tentativa"></p>',
        '  </div>'
      );
    }

    partes.push('</div>');

    return partes.filter(Boolean).join("");
  }

  /* ============================================================
     AVANÇAR E VOLTAR ETAPA
  ============================================================ */

  /**
   * A etapa vizinha, só para **rotular** o botão.
   *
   * Quem decide de verdade é o servidor, em `/api/extensao/mover`: a
   * ordem das colunas é cadastro e muda na tela de configurações, e uma
   * extensão instalada há três semanas teria uma cópia velha. Aqui a
   * lista serve para o botão dizer "→ Em atendimento" em vez de um
   * "avançar" que não diz para onde.
   */
  function vizinha(status, direcao) {

    const etapas = ultimoDado?.etapas ?? [];

    const i = etapas.indexOf(status);

    if (i < 0) return "";

    const alvo = direcao === "avancar" ? i + 1 : i - 1;

    return alvo >= 0 && alvo < etapas.length
      ? etapas[alvo]
      : "";
  }

  /** Os dois botões de etapa de um caso. */
  function botoesDeEtapa(caso) {

    if (!podeEscrever(ultimoDado)) return "";

    const antes = vizinha(caso.status, "voltar");
    const depois = vizinha(caso.status, "avancar");

    if (!antes && !depois) return "";

    return [
      '<div class="etapas">',
      antes
        ? `<button class="passo" data-acao="mover" data-protocolo="${CW.escapar(caso.protocolo)}" data-direcao="voltar" title="Voltar para ${CW.escapar(antes)}">&larr; ${CW.escapar(antes)}</button>`
        : '<span class="passo vazio">início do fluxo</span>',
      depois
        ? `<button class="passo" data-acao="mover" data-protocolo="${CW.escapar(caso.protocolo)}" data-direcao="avancar" title="Avançar para ${CW.escapar(depois)}">${CW.escapar(depois)} &rarr;</button>`
        : '<span class="passo vazio">fim do fluxo</span>',
      '</div>',
    ].join("");
  }

  async function moverCaso(botao) {

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "...";

    const resposta = await CW.enviar({
      tipo: "moverCaso",
      protocolo: botao.dataset.protocolo,
      direcao: botao.dataset.direcao,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    const r = resposta.dados;

    if (!resposta.ok || r?.erro) {
      avisar(resposta.erro ?? r?.erro, "perigo");
      return;
    }

    if (!r.movido) {
      avisar(r.aviso, "atencao");
      return;
    }

    /**
     * A nota some ao voltar de "Resolvido"/"Não resolvido" — regra de
     * `moverPara`. Avisar não é enfeite: apagar avaliação em silêncio é
     * a definição de efeito colateral, e ela pesa na reputação.
     */
    avisar(
      `${r.protocolo}: ${r.de} → ${r.status}.${
        r.notaRemovida
          ? " A avaliação saiu junto, porque o caso voltou para antes dela."
          : ""
      }`,
      r.notaRemovida ? "atencao" : "ok"
    );

    consultar(true);
  }

  async function moverNps(botao) {

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "...";

    const resposta = await CW.enviar({
      tipo: "registrarNps",
      registro: {
        id: botao.dataset.id,
        acao: "status",
        direcao: botao.dataset.direcao,
      },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    const r = resposta.dados;

    if (!resposta.ok || r?.erro) {
      avisar(resposta.erro ?? r?.erro, "perigo");
      return;
    }

    if (!r.movido) {
      avisar(r.aviso, "atencao");
      return;
    }

    avisar(`NPS: ${r.de} → ${r.status}.`, "ok");

    consultar(true);
  }

  /**
   * Um aviso curto no topo do corpo, que some sozinho.
   *
   * O painel não tem onde empilhar notificação, e um `alert()` dentro
   * do WhatsApp Web sequestra a página inteira.
   */
  function avisar(texto, tom = "ok") {

    if (!texto || !corpo) return;

    const antigo = corpo.querySelector(".recado");

    antigo?.remove();

    const caixa = document.createElement("div");

    caixa.className = `recado ${tom}`;
    caixa.textContent = texto;

    corpo.prepend(caixa);

    setTimeout(() => caixa.remove(), 7000);
  }

  /**
   * Alterna um grupo de botões de escolha.
   *
   * O estado vive no DOM (`aria-pressed`), e não numa variável: é a
   * mesma decisão do formulário de captura — o que vale é o que está na
   * tela. Clicar no que já está marcado desmarca, que é como se corrige
   * um clique errado sem recarregar o painel.
   */
  function alternarEscolha(alvo) {

    const marcado =
      alvo.getAttribute("aria-pressed") === "true";

    for (const irmao of corpo.querySelectorAll(
      `[data-acao="${alvo.dataset.acao}"]`
    )) {
      irmao.setAttribute("aria-pressed", "false");
    }

    alvo.setAttribute(
      "aria-pressed",
      marcado ? "false" : "true"
    );
  }

  function escolhido(grupo) {

    const alvo = corpo.querySelector(
      `[data-acao="${grupo}"][aria-pressed="true"]`
    );

    return alvo ? alvo.dataset.valor : null;
  }

  /**
   * Grava e recarrega o retrato.
   *
   * A releitura não é enfeite: `firstContactAt`, o status e a contagem
   * de tentativas mudam do lado do servidor, e mostrar o estado antigo
   * logo depois de registrar é o jeito mais rápido de fazer alguém
   * registrar duas vezes.
   */
  async function registrarNps(botao, acao) {

    const seletorErro =
      acao === "tentativa"
        ? "#nps-erro-tentativa"
        : "#nps-erro";

    const erro = corpo.querySelector(seletorErro);

    if (erro) erro.textContent = "";

    const registro = { id: botao.dataset.id, acao };

    if (acao === "tentativa") {

      registro.canal =
        corpo.querySelector("#nps-canal")?.value ??
        CANAIS[0];

      registro.nota = (
        corpo.querySelector("#nps-tentativa")?.value ?? ""
      ).trim();

      if (!registro.nota) {
        if (erro) {
          erro.textContent =
            "Descreva a tentativa — ex.: ligou, caiu na caixa postal.";
        }
        return;
      }

    } else {

      const humor = escolhido("nps-humor");
      const resolvido = escolhido("nps-resolvido");

      registro.humor = humor ? Number(humor) : null;

      registro.resolvido =
        resolvido === "sim"
          ? true
          : resolvido === "nao"
            ? false
            : null;

      registro.nota = (
        corpo.querySelector("#nps-nota")?.value ?? ""
      ).trim();

      if (
        registro.humor === null &&
        registro.resolvido === null
      ) {
        if (erro) {
          erro.textContent =
            "Marque como o cliente ficou, ou se a situação foi resolvida.";
        }
        return;
      }
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "Gravando...";

    const resposta = await CW.enviar({
      tipo: "registrarNps",
      registro,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      if (erro) {
        erro.textContent =
          resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao registrar.";
      }
      return;
    }

    /**
     * O servidor devolve o retrato novo, então o painel troca só o
     * bloco de NPS — redesenhar tudo custaria a posição da rolagem e o
     * resumo da conversa, que não têm nada a ver com este registro.
     */
    if (resposta.dados?.nps && ultimoDado) {
      ultimoDado = {
        ...ultimoDado,
        nps: resposta.dados.nps,
      };

      render(ultimoDado);
    }
  }

  /**
   * Atalho para capturar a reclamação aberta.
   *
   * Fica visível **mesmo quando o painel achou alguém** — porque achar
   * um cliente por nome não quer dizer que aquela reclamação exista do
   * nosso lado. Some só quando o caso encontrado é exatamente esta
   * reclamação, onde capturar de novo não teria efeito nenhum.
   */
  function blocoCaptura(dados) {

    if (!captura?.id || !captura?.titulo) return "";

    const jaEstaAqui = (dados?.casos ?? []).some(
      (caso) =>
        caso.id === captura.id ||
        caso.protocolo === `RA-${captura.id}`
    );

    if (jaEstaAqui) {
      return [
        '<div class="bloco">',
        `  <p class="sub">Esta reclamação (${CW.escapar(captura.id)}) já está no CW Reputação.</p>`,
        '</div>',
      ].join("");
    }

    return [
      '<div class="bloco">',
      '  <button class="copiar" data-acao="capturar" style="width:100%;padding:8px">',
      `    Ler reclamação ${CW.escapar(captura.id)} e adicionar ao Kanban`,
      '  </button>',
      '</div>',
    ].join("");
  }

  /* ============================================================
     CAPTURA — LER A RECLAMAÇÃO E CRIAR NO KANBAN
  ============================================================ */

  const PRIORIDADES = ["Crítica", "Alta", "Média", "Baixa"];

/**
 * Canais que a extensão sabe criar.
 *
 * "Reclame Aqui" vai para o quadro do RA; os demais para Redes Sociais.
 * A lista é curta de propósito — cada canal aqui precisa existir do
 * outro lado, senão o caso nasce fora dos dois módulos e some.
 */
const ORIGENS = [
  "Reclame Aqui",
  "WhatsApp",
  "ManyChat",
  "Instagram",
  "Facebook",
];

  /**
   * Formulário de conferência.
   *
   * A leitura de página é palpite educado: portal muda marcação sem
   * avisar, e o que vier torto tem de ser corrigível antes de virar
   * registro. Por isso **tudo** aqui é editável — inclusive o que foi
   * lido certo. É a diferença entre uma captura que a operação confia e
   * uma que ela precisa auditar depois no Kanban.
   */
  function abrirCaptura() {

    if (!captura) return;

    const doPortal =
      !captura.origem ||
      captura.origem === "Reclame Aqui";

    const uf = ufDeduzida();

    const campo = (
      nome,
      rotulo,
      valor,
      tipo = "input"
    ) => `
      <div style="margin-bottom:9px">
        <label class="rotulo" for="cap-${nome}">${rotulo}</label>
        ${
          tipo === "textarea"
            ? `<textarea class="campo" id="cap-${nome}" data-campo="${nome}" rows="7"
                 style="margin-top:0;resize:vertical">${CW.escapar(valor ?? "")}</textarea>`
            : `<input class="campo" id="cap-${nome}" data-campo="${nome}" type="text"
                 style="margin-top:0" value="${CW.escapar(valor ?? "")}" />`
        }
      </div>`;

    const lista = (nome, rotulo, opcoes, atual) => `
      <div style="margin-bottom:9px">
        <label class="rotulo" for="cap-${nome}">${rotulo}</label>
        <select class="campo" id="cap-${nome}" data-campo="${nome}" style="margin-top:0">
          ${opcoes
            .map(
              (opcao) =>
                `<option value="${CW.escapar(opcao)}"${opcao === atual ? " selected" : ""}>${CW.escapar(opcao || "—")}</option>`
            )
            .join("")}
        </select>
      </div>`;

    corpo.innerHTML = `
      <div class="bloco">
        <div class="rotulo">${
          doPortal ? "Prévia do que foi lido" : "Novo caso"
        }</div>

        <p class="sub" style="margin-bottom:11px">
          ${
            doPortal
              ? "Confira antes de criar. O que estiver errado, corrija aqui — a leitura da página é aproximada, e o que for gravado é o que está nestes campos."
              : "O contato veio da conversa; o resto é com você. Descreva o caso como ele deve aparecer no quadro."
          }
        </p>

        ${
          doPortal && (captura.cod || captura.hora)
            ? `<p class="sub" style="margin:-5px 0 11px">Lido da reclamação: ${[
                captura.cod &&
                  `COD <strong>${CW.escapar(captura.cod)}</strong>`,
                captura.id &&
                  `ID <strong>${CW.escapar(captura.id)}</strong>`,
                captura.hora &&
                  `publicada às <strong>${CW.escapar(captura.hora)}</strong>`,
              ]
                .filter(Boolean)
                .join(" · ")}.</p>`
            : ""
        }

        ${lista(
          "origem",
          "Origem",
          ORIGENS,
          captura.origem ?? "Reclame Aqui"
        )}

        ${campo(
          "id",
          doPortal
            ? "Id no portal"
            : "Id (deixe vazio para gerar)",
          captura.id
        )}
        ${campo("cliente", "Cliente", captura.cliente)}
        ${
          !captura.cliente && doPortal
            ? '<p class="sub" style="margin:-4px 0 9px">Não achei o nome do consumidor nesta página. Ele aparece acima da etiqueta “Nome social” — se não estiver lá, preencha à mão.</p>'
            : ""
        }

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${campo("telefone", "Telefone", captura.telefone)}
          ${campo("email", "E-mail", captura.email)}
        </div>

        ${campo("titulo", "Título", captura.titulo)}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${campo("criadoEm", "Publicada em (AAAA-MM-DD)", captura.criadoEm)}
          ${lista(
            "prioridade",
            "Prioridade",
            PRIORIDADES,
            captura.prioridade ?? "Alta"
          )}
        </div>

        ${blocoClassificacao()}

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">
          ${campo("cidade", "Cidade", captura.cidade)}
          ${campo("estado", "UF", uf.uf)}
        </div>
        ${
          uf.origem
            ? `<p class="sub" style="margin:-4px 0 9px">A página não mostra a UF: esta veio ${CW.escapar(uf.origem)}. Confira antes de criar.</p>`
            : ""
        }

        ${campo("texto", "Relato do consumidor", captura.texto, "textarea")}

        ${
          captura.statusPortal
            ? `<p class="sub" style="margin-bottom:11px">No portal está como <strong>${CW.escapar(captura.statusPortal)}</strong>.</p>`
            : ""
        }

        <p class="sub" style="margin-bottom:11px">
          Entra na coluna <strong>Novo</strong>, sem nota e sem avaliação — um caso recém-aberto não tem nenhuma das duas.
        </p>

        <div style="display:flex;gap:8px">
          <button class="acao" data-acao="criar-caso" style="margin-top:0;flex:1">
            Criar no Kanban
          </button>
          <button class="copiar" data-acao="cancelar-captura">
            Cancelar
          </button>
        </div>

        <p class="sub falha" id="cap-erro"></p>
      </div>

      ${blocoInformacoesAdicionais()}`;

    corpo.scrollTop = 0;
  }

  /**
   * Categoria e subcategoria, vindas do cadastro da ferramenta.
   *
   * **Não são lidas da página**: o Reclame Aqui não classifica a
   * reclamação, e o que parecia rótulo de categoria era pergunta de
   * formulário — "Está com problema com Cardápio Web?" chegou a virar
   * categoria no primeiro teste. Digitar à mão é pior ainda: o ranking
   * por categoria passa a contar "Financeiro" e "financeiro" como dois
   * problemas.
   *
   * Sem cadastro carregado (consulta que falhou, modo demonstração), cai
   * no campo aberto em vez de sumir com a classificação.
   */
  function blocoClassificacao() {

    const cadastros = ultimoDado?.cadastros;

    if (!cadastros?.categorias?.length) {
      return `
        <div style="margin-bottom:9px">
          <label class="rotulo" for="cap-categoria">Categoria</label>
          <input class="campo" id="cap-categoria" data-campo="categoria" type="text"
                 style="margin-top:0" value="${CW.escapar(captura.categoria ?? "")}"
                 placeholder="Não classificado" />
        </div>`;
    }

    const categorias = [
      "Não classificado",
      ...cadastros.categorias,
    ];

    const atual = categorias.includes(captura.categoria)
      ? captura.categoria
      : "Não classificado";

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="margin-bottom:9px">
          <label class="rotulo" for="cap-categoria">Categoria</label>
          <select class="campo" id="cap-categoria" data-campo="categoria" style="margin-top:0">
            ${categorias
              .map(
                (nome) =>
                  `<option value="${CW.escapar(nome)}"${nome === atual ? " selected" : ""}>${CW.escapar(nome)}</option>`
              )
              .join("")}
          </select>
        </div>
        <div style="margin-bottom:9px">
          <label class="rotulo" for="cap-subcategoria">Subcategoria</label>
          <select class="campo" id="cap-subcategoria" data-campo="subcategoria" style="margin-top:0">
            ${opcoesDeSubcategoria(atual, captura.subcategoria)}
          </select>
        </div>
      </div>`;
  }

  /**
   * A UF que a página não mostra.
   *
   * Vem das reclamações que já estão na base para aquela cidade, e só
   * quando todas concordam — o servidor deixa de fora cidade que
   * aparece com dois estados. Sugere, não decide: o campo continua
   * editável, e o aviso ao lado diz de onde veio.
   */
  function ufDeduzida() {

    if (captura.estado) {
      return { uf: captura.estado, origem: "" };
    }

    const mapa =
      ultimoDado?.cadastros?.ufPorCidade ?? null;

    const daCidade = captura.cidade
      ? (mapa?.[
          String(captura.cidade).trim().toLowerCase()
        ] ?? "")
      : "";

    if (daCidade) {
      return {
        uf: daCidade,
        origem:
          "das reclamações que já estão na base para esta cidade",
      };
    }

    const doDdd =
      CW.ra?.ufPeloTelefone?.(captura.telefone) ?? "";

    if (doDdd) {
      return {
        uf: doDdd,
        origem: "do DDD do telefone do consumidor",
      };
    }

    return { uf: "", origem: "" };
  }

  function opcoesDeSubcategoria(categoria, atual) {

    const todas =
      ultimoDado?.cadastros?.subcategorias ?? [];

    const daCategoria = todas.filter(
      (item) => item.categoria === categoria
    );

    return [
      `<option value="">—</option>`,
      ...daCategoria.map(
        (item) =>
          `<option value="${CW.escapar(item.nome)}"${item.nome === atual ? " selected" : ""}>${CW.escapar(item.nome)}</option>`
      ),
    ].join("");
  }

  /**
   * O formulário que o Reclame Aqui coleta antes de publicar.
   *
   * Mostra e **não grava**. Traz o CNPJ de cadastro no portal, o e-mail
   * de acesso e o nome do proprietário — que é justamente o vínculo
   * cliente ↔ estabelecimento que hoje falta na base. Onde cada um desses
   * campos deve ser gravado ainda não foi decidido, e escrever antes de
   * decidir criaria dado torto em três tabelas de uma vez.
   */
  function blocoInformacoesAdicionais() {

    if (captura.formularioRecolhido) {
      return [
        '<div class="bloco">',
        '  <div class="aviso">',
        '    Esta reclamação tem informações adicionais que ainda estão recolhidas na página. Clique em <strong>Exibir</strong> lá e depois em “reler a página”.',
        '  </div>',
        '  <button class="copiar" data-acao="reler" style="width:100%;padding:8px">Reler a página</button>',
        '</div>',
      ].join("");
    }

    const itens = captura.formulario ?? [];

    if (itens.length === 0) return "";

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Informações adicionais da reclamação</div>',
      '  <p class="sub" style="margin-bottom:8px">O Reclame Aqui coleta isto antes de publicar. <strong>Não é gravado</strong> — está aqui para análise.</p>',
      '  <div class="cartao">',
      ...itens.map(
        (item, i) => `
      <div style="${i > 0 ? "margin-top:9px;padding-top:9px;border-top:1px solid var(--borda)" : ""}">
        <div class="sub" style="color:var(--suave);font-weight:600">${CW.escapar(item.pergunta)}</div>
        <div class="linha" style="margin-top:3px;align-items:center">
          <span class="sub" style="color:var(--texto)">${CW.escapar(item.resposta)}</span>
          <button class="copiar" data-acao="copiar" data-texto="${CW.escapar(item.resposta)}">copiar</button>
        </div>
      </div>`
      ),
      '  </div>',
      '  <button class="copiar" data-acao="reler" style="width:100%;margin-top:7px;padding:7px">Reler a página</button>',
      '</div>',
    ].join("");
  }

  /** Lê o formulário — o que vale é o que está na tela, não o lido. */
  function lerFormulario() {

    const dados = { url: location.href };

    for (const campo of corpo.querySelectorAll(
      "[data-campo]"
    )) {
      dados[campo.dataset.campo] = campo.value.trim();
    }

    return dados;
  }

  /**
   * Relê a página sem perder o que já foi corrigido.
   *
   * Um campo que a pessoa mexeu vale mais do que o mesmo campo lido de
   * novo — ela viu a página e o leitor não. Então a releitura entra como
   * base, e por cima dela voltam só os campos que **divergem** da
   * leitura anterior, que é exatamente a definição de "alguém editou
   * isto".
   */
  function reler() {

    if (!releitor) return;

    const digitado = lerFormulario();
    const anterior = captura ?? {};
    const nova = releitor() ?? {};

    for (const [chave, valor] of Object.entries(
      digitado
    )) {

      if (chave === "url") continue;

      if (valor !== String(anterior[chave] ?? "")) {
        nova[chave] = valor;
      }
    }

    captura = nova;

    abrirCaptura();
  }

  async function criarCaso(botao) {

    const dados = lerFormulario();
    const erro = corpo.querySelector("#cap-erro");

    const doPortal =
      !dados.origem || dados.origem === "Reclame Aqui";

    if (!dados.cliente || !dados.titulo) {
      if (erro) {
        erro.textContent =
          "Cliente e título são obrigatórios.";
      }
      return;
    }

    /**
     * Id só é exigido no Reclame Aqui, onde o portal dá o número. Num
     * caso que nasce de conversa, o servidor gera o protocolo.
     */
    if (doPortal && !dados.id) {
      if (erro) {
        erro.textContent =
          "Id do portal é obrigatório numa reclamação do Reclame Aqui.";
      }
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "Criando...";

    const resposta = await CW.enviar({
      tipo: "criarCaso",
      caso: dados,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok) {
      if (erro) {
        erro.textContent =
          resposta.erro ?? "Falha ao criar.";
      }
      return;
    }

    const r = resposta.dados;

    if (r?.erro) {
      if (erro) erro.textContent = r.erro;
      return;
    }

    captura = null;

    vazio(
      r?.jaExistia
        ? "Esta reclamação já estava no Kanban"
        : "Criada no Kanban",
      r?.jaExistia
        ? [
            `${r.protocolo} está em "${r.status}"${r.responsavel ? ` com ${r.responsavel}` : ""}. Nada foi sobrescrito.`,
            // Duplicata pega pelo conteúdo merece a explicação do porquê.
            r.aviso ?? "",
          ]
            .filter(Boolean)
            .join(" ")
        : `${r.protocolo} entrou na coluna Novo.`,
      r?.url
        ? `<button class="acao" data-acao="abrir" data-url="${CW.escapar(r.url)}">Abrir o caso</button>`
        : undefined
    );

    // O retrato do servidor mudou: a próxima consulta tem de ser nova.
    setTimeout(() => consultar(true), 900);
  }

  CW.painel = {
    montar,
    definirContexto,
    abrir,
    fechar,

    /**
     * Reclamação lida da página pelo detector do site.
     *
     * Guardada, não enviada: nada vai para o servidor sem alguém
     * clicar em "Criar no Kanban".
     */
    definirCaptura(dados) {
      captura = dados ?? null;
    },

    /**
     * O site informa **como** reler a página.
     *
     * Só o `hugme.js` fornece. É o que faz o botão "reler a página"
     * funcionar depois de alguém expandir as informações adicionais da
     * reclamação, que nascem recolhidas e não mudam o endereço.
     */
    definirReleitor(fn) {
      releitor = typeof fn === "function" ? fn : null;
    },

    /**
     * O site informa como entregar o texto cru da página.
     *
     * Recebe uma função, e não o texto: enquanto ninguém clicar em
     * "copiar o texto lido", nada é lido nem guardado. É a mesma regra
     * do leitor de conversa.
     */
    definirDiagnostico(fn) {
      diagnostico = typeof fn === "function" ? fn : null;
    },

    /**
     * O site informa **como** ler a conversa aberta.
     *
     * Recebe uma função, não o texto: enquanto ninguém clicar em
     * "Resumir", nenhuma mensagem é lida.
     */
    definirLeitorDeConversa(fn) {
      lerConversa = typeof fn === "function" ? fn : null;
    },

    /**
     * Autoriza o painel a abrir sozinho neste site.
     *
     * Só o `whatsapp.js` chama. É o que impede a gaveta de pular na
     * frente de quem está lendo uma reclamação no Hugme.
     */
    permitirAutoAbrir() {
      autoPermitido = true;
      refletirAuto();
    },

    /** Reanexa o painel se a página o tiver removido. */
    garantir() {
      if (
        !hospedeiro ||
        !document.documentElement.contains(hospedeiro)
      ) {
        hospedeiro = null;
        raiz = null;
        montar();
      }
    },
  };
})();
