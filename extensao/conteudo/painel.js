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

  /**
   * O que o corpo está mostrando: "contato", "fila" ou "painel".
   *
   * Sem isto, `consultar()` do detector de página sobrescreveria a fila
   * que a pessoa acabou de abrir — o WhatsApp troca de conversa sozinho
   * e o painel voltaria ao contato no meio da leitura.
   */
  let vista = "contato";

  /**
   * Na aba de um canal, mostrar só os casos deste cliente.
   *
   * Ligado por padrão quando há contato identificado: quem abre a aba
   * do Reclame Aqui **com uma conversa na tela** quer o histórico
   * daquela pessoa naquele canal, não a fila da operação inteira. Sem
   * contato, não há o que restringir e a fila aparece cheia.
   */
  let soDoCliente = true;

  /** Filtros da fila: etapa (casos) e segmento (NPS). */
  let etapaFiltro = "";
  let segmentoFiltro = "";

  /**
   * Recorte vindo dos contadores do painel do dia.
   *
   * "", "sem-resposta", "replicas" ou "risco". Os quatro números do
   * painel eram leitura morta — mostravam "4 sem resposta" e a pergunta
   * seguinte, "quais?", só tinha resposta abrindo a aplicação.
   */
  let recorteFiltro = "";

  /**
   * A vista de caso veio de uma lista?
   *
   * É o que o botão "voltar" precisa saber. Antes a pergunta era `canal
   * === "todos"`, que passou a significar outra coisa quando os
   * contadores do painel ganharam fila própria.
   */
  let veioDaFila = false;

  /** A vista de onde o caso foi aberto — "fila", "atividades"... */
  let vistaAnterior = "contato";

  /**
   * Recorte da aba de Atividades: "", "proximos" ou "concluidas".
   *
   * Vazio é o que está vencendo — hoje e o atrasado junto. Uma agenda
   * que só mostra "hoje" esconde exatamente o que não foi feito ontem.
   */
  let escopoAtividades = "";

  /** Caso aberto para leitura dentro do painel. */
  let detalhe = null;

  /* ============================================================
     MONTAGEM
  ============================================================ */

  /**
   * O painel está no documento **e** inteiro?
   *
   * Não basta o hospedeiro estar na árvore: uma montagem que estourou
   * no meio deixa o `<div>` no lugar com o shadow vazio, e aí `montar()`
   * sairia cedo para sempre — o sintoma de "só reinstalando".
   */
  function montado() {
    return Boolean(
      hospedeiro &&
        document.documentElement.contains(hospedeiro) &&
        raiz &&
        hospedeiro.shadowRoot?.contains(raiz) &&
        raiz.querySelector(".gatilho")
    );
  }

  function montar() {

    if (montado()) return;

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
          <button class="icone-botao" data-acao="voltar-da-vista"
                  title="Voltar" style="display:none">&#8592;</button>
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
          <button type="button" data-acao="canal" data-canal="painel"
                  aria-pressed="false" title="Nota, contadores e alertas do dia">Painel</button>
          <!--
            Atividades é aba própria, e não só um bloco do Painel.

            No Painel a agenda divide espaço com a nota, os contadores e
            os alertas — cabem as de hoje e nada mais. A pergunta "o que
            eu tenho para fazer, e o que ficou para trás" é uma tela
            inteira: pede o atrasado junto, o que vem pela frente, e o
            caso vinculado a um clique de distância.
          -->
          <button type="button" data-acao="canal" data-canal="atividades"
                  aria-pressed="false" title="O que está marcado: hoje, atrasado e o que vem">Atividades</button>
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

    /**
     * Gaveta nova nasce fechada — e o estado tem de saber disso.
     *
     * `aberto` é variável de módulo e sobrevive à remontagem que a
     * página provoca ao trocar a árvore. Ficando `true` sobre uma
     * gaveta recém-criada (que não tem a classe `aberta`), o primeiro
     * clique no botão chamava `fechar()` de uma coisa já fechada: nada
     * acontecia, e só o segundo clique abria.
     */
    aberto = false;

    gaveta = raiz.querySelector(".gaveta");
    corpo = raiz.querySelector(".corpo");
    selo = raiz.querySelector(".selo");
    campoBusca = raiz.querySelector(".busca input");
    linhaQuem = raiz.querySelector(".quem");

    /**
     * O botão de abrir é o **primeiro** a ser ligado.
     *
     * É a armadilha já registrada — montar primeiro, checar depois. Se
     * qualquer linha daqui para baixo estourar, o painel fica pela
     * metade, mas continua abrindo; e o `hospedeiro` já está no
     * documento, então `garantir()` não remontaria nunca mais. Um
     * painel meio montado que abre é recuperável; um que não abre só
     * sai reinstalando.
     */
    raiz
      .querySelector(".gatilho")
      ?.addEventListener("click", alternar);

    raiz.addEventListener("click", (evento) => {

      const alvo = evento.target.closest("[data-acao]");

      if (!alvo) return;

      const acao = alvo.dataset.acao;

      if (acao === "fechar") fechar();
      if (acao === "recarregar") recarregarVista(true);
      if (acao === "buscar") buscarManual();
      if (acao === "opcoes") CW.enviar({ tipo: "opcoes" });
      if (acao === "tema") girarTema();
      if (acao === "auto") alternarAuto(alvo.checked);
      if (acao === "fixar") alternarFixado();
      if (acao === "ancorar") ancorar();
      if (acao === "capturar") abrirCaptura();
      if (acao === "cadastrar-canal") cadastrarNesteCanal();
      if (acao === "anotar-caso") anotarCaso(alvo);
      if (acao === "anotar-tarefa") anotarTarefa(alvo);
      if (acao === "cancelar-captura") {
        captura = null;
        consultar(false);
      }
      if (acao === "criar-caso") criarCaso(alvo);
      if (acao === "reler") reler();
      if (acao === "canal") trocarCanal(alvo);
      if (acao === "ver") abrirDetalhe(alvo.dataset.protocolo);
      if (acao === "voltar-da-vista") voltarDaVista();
      if (acao === "anotar-detalhe") anotarNoDetalhe(alvo);
      if (acao === "anotar-dia") anotarODia(alvo);
      if (acao === "triar") triarCaso(alvo);
      if (acao === "concluir") concluirTarefa(alvo);
      if (acao === "nps-contato") gravarContatoDoNps(alvo);

      if (acao === "fila-recorte") {
        abrirRecorte(alvo.dataset.recorte ?? "");
      }

      if (acao === "recorte") {
        recorteFiltro = alvo.dataset.valor ?? "";
        etapaFiltro = "";
        carregarFila();
      }

      if (acao === "escopo-atividade") {
        escopoAtividades = alvo.dataset.valor ?? "";
        carregarAtividades();
      }

      if (acao === "reabrir") reabrirTarefa(alvo);

      if (acao === "escopo") {
        soDoCliente = alvo.dataset.valor === "cliente";
        carregarFila();
      }

      if (acao === "etapa") {
        etapaFiltro = alvo.dataset.valor;
        carregarFila();
      }

      if (acao === "segmento") {
        segmentoFiltro = alvo.dataset.valor;
        carregarFila();
      }

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
      if (acao === "resumir-caso") resumirCaso(alvo);

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

      /**
       * Mover para uma etapa qualquer é `change`, não `click`: escolher
       * num `<select>` pelo teclado não gera clique nenhum.
       */
      if (
        evento.target?.dataset?.acao === "mover-para"
      ) {
        const destino = evento.target.value;

        // Volta ao rótulo para o seletor não ficar preso no destino.
        evento.target.selectedIndex = 0;

        if (destino) {
          moverCaso(evento.target, destino);
        }

        return;
      }

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

    // Ancorou: volta a empurrar, se a gaveta estiver aberta.
    empurrarPagina(aberto);

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
    let soltou = false;
    let deltaX = 0;
    let deltaY = 0;
    let inicioX = 0;
    let inicioY = 0;

    /**
     * Quanto a mão precisa andar para soltar a gaveta do canto.
     *
     * O comentário acima sempre prometeu isso, mas a implementação
     * soltava no **primeiro** `pointermove` — e um clique de mouse
     * quase nunca é imóvel. Bastavam dois pixels de tremor para o
     * painel virar janela flutuante sem ninguém ter pedido.
     */
    const LIMIAR = 5;

    topo.addEventListener("pointerdown", (evento) => {

      // Botões do cabeçalho continuam sendo botões.
      if (evento.target.closest("[data-acao]")) return;

      const caixa = gaveta.getBoundingClientRect();

      deltaX = evento.clientX - caixa.left;
      deltaY = evento.clientY - caixa.top;

      inicioX = evento.clientX;
      inicioY = evento.clientY;

      arrastando = true;
      soltou = false;
      topo.setPointerCapture(evento.pointerId);
      evento.preventDefault();
    });

    topo.addEventListener("pointermove", (evento) => {

      if (!arrastando) return;

      if (!soltou) {

        const andou =
          Math.abs(evento.clientX - inicioX) +
          Math.abs(evento.clientY - inicioY);

        if (andou < LIMIAR) return;

        soltou = true;
        gaveta.classList.add("arrastando");
      }

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

      // Não passou do limiar: foi clique, não arrasto. Nada muda.
      if (!soltou) return;

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

    /**
     * Janela menor não pode engolir o painel.
     *
     * A posição é gravada em `storage.sync` e viaja: quem soltou a
     * gaveta num monitor de 2560px abre o notebook de 1366 no dia
     * seguinte e ela estaria fora da tela. `aplicarPosicao` já prende à
     * viewport — só faltava alguém chamá-la quando a viewport muda.
     */
    window.addEventListener(
      "resize",
      CW.debounce(() => {

        if (!config.posicao) return;

        const posicao = aplicarPosicao(config.posicao);

        if (
          posicao &&
          (posicao.x !== config.posicao.x ||
            posicao.y !== config.posicao.y)
        ) {
          config.posicao = posicao;
          CW.enviar({
            tipo: "salvar",
            parcial: { posicao },
          });
        }
      }, 250)
    );
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

      /**
       * A página acompanha a nova largura.
       *
       * Sem isto, alargar a gaveta a fazia cobrir de novo o pedaço de
       * site que o empurrão tinha aberto — e o empurrão só voltaria a
       * bater no próximo abrir.
       */
      empurrarPagina(aberto);

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

  /**
   * O que o empurrão estreitou, e a largura que o elemento tinha antes.
   *
   * Guardado por elemento para poder desfazer exatamente: mexer no
   * estilo embutido de uma página alheia sem saber devolver é como
   * deixar a casa dos outros de móvel arrastado.
   */
  const empurrados = new Map();

  /**
   * Empurra a página para o lado enquanto a gaveta está aberta.
   *
   * A primeira versão punha `margin-right` no elemento raiz, que é o que
   * funciona num site de fluxo normal. **No WhatsApp Web não funcionava**
   * — e era o site que mais precisava, porque a gaveta cobre justamente
   * a coluna das mensagens. Medido na página real: com 380px de margem
   * no `<html>`, o `<html>` vai para 900px e o `#app` continua em 1280.
   *
   * O motivo é que o `#app` é `position: absolute` com `inset: 0` e sem
   * ancestral posicionado — então o bloco que o contém é a **viewport**,
   * não o `<html>`. Largura de `<html>` não o alcança; largura própria,
   * sim (`calc(100vw - 380px)` levou os mesmos 1280 para 900).
   *
   * Então o empurrão faz as duas coisas: a margem no raiz, que resolve o
   * site de fluxo normal, e uma passada pelos filhos diretos de `<html>`
   * e `<body>` procurando quem esteja preso à viewport ocupando-a
   * inteira. Quem está, ganha largura própria. É medição em vez de lista
   * de sites: um portal que mude o nome da `div` amanhã continua sendo
   * empurrado.
   *
   * Só vale para a gaveta ancorada: solta, ela já é uma janela flutuante
   * e o empurrão só encolheria a página sem motivo. E é preferência —
   * quem prefere a sobreposição desliga nas Opções.
   */
  function empurrarPagina(ligar) {

    const raizDoSite = document.documentElement;

    if (!raizDoSite) return;

    const deveEmpurrar =
      ligar &&
      config.empurrar !== false &&
      !config.posicao;

    if (!deveEmpurrar) {

      raizDoSite.style.marginRight = "";
      raizDoSite.style.transition = "";

      for (const [elemento, antes] of empurrados) {
        elemento.style.width = antes.width;
        elemento.style.transition = antes.transition;
      }

      empurrados.clear();
      return;
    }

    const px = config.largura || 380;

    raizDoSite.style.transition =
      "margin-right .22s cubic-bezier(.32,.72,0,1)";

    raizDoSite.style.marginRight = `${px}px`;

    const largura = `calc(100vw - ${px}px)`;

    // Já estreitado: só acompanha a nova largura da gaveta.
    for (const [elemento] of empurrados) {

      if (!elemento.isConnected) {
        empurrados.delete(elemento);
        continue;
      }

      elemento.style.width = largura;
    }

    for (const elemento of presosAViewport()) {

      if (empurrados.has(elemento)) continue;

      empurrados.set(elemento, {
        width: elemento.style.width,
        transition: elemento.style.transition,
      });

      elemento.style.transition =
        "width .22s cubic-bezier(.32,.72,0,1)";

      elemento.style.width = largura;
    }
  }

  const SEM_LAYOUT = [
    "SCRIPT",
    "STYLE",
    "LINK",
    "HEAD",
    "TEMPLATE",
    "NOSCRIPT",
  ];

  /**
   * Quem está preso à viewport ocupando-a inteira.
   *
   * Desce a árvore a partir do `<html>`, mas **só por dentro de quem
   * ocupa a tela toda** — é o que mantém a varredura barata numa página
   * de milhares de nós: a primeira `div` estreita corta o galho inteiro.
   * O teto de profundidade é a segunda trava.
   *
   * Não olha só os filhos diretos porque o alvo raramente está ali: no
   * WhatsApp Web o `#app` é neto (`body > div.page-version > #app`), e
   * uma varredura de um nível só voltava de mãos vazias — medido.
   */
  function presosAViewport() {

    const achados = [];
    const larguraDaTela = window.innerWidth;

    const visitar = (elemento, profundidade) => {

      if (profundidade > 5) return;

      for (const filho of elemento.children) {

        // O nosso próprio painel, e o que não desenha nada.
        if (filho === hospedeiro) continue;
        if (SEM_LAYOUT.includes(filho.tagName)) continue;

        /**
         * Só quem ocupa a viewport inteira.
         *
         * Um menu flutuante de 200px também é `absolute`, e estreitá-lo
         * não teria sentido nenhum. A folga de 4px é para
         * arredondamento de zoom.
         */
        if (
          filho.getBoundingClientRect().width <
          larguraDaTela - 4
        ) {
          continue;
        }

        const estilo = getComputedStyle(filho);

        if (
          estilo.position === "absolute" ||
          estilo.position === "fixed"
        ) {
          achados.push(filho);
        }

        visitar(filho, profundidade + 1);
      }
    };

    visitar(document.documentElement, 0);

    return achados;
  }

  function abrir() {

    aberto = true;
    gaveta?.classList.add("aberta");

    empurrarPagina(true);

    // Fila ou painel já desenhados continuam onde estão.
    if (vista !== "contato") return;

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

    empurrarPagina(false);

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

      /*
        O documento entra na chave junto com o resto.

        Fora dela, o painel trataria "mesmo cliente, agora com CPF"
        como a mesma consulta de antes e não refaria a busca — perdendo
        justamente o identificador mais forte no momento em que ele
        aparece.
      */
      documento: novo?.documento ?? "",

      canalDaPagina: novo?.canalDaPagina ?? "",
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

    /**
     * Contato novo com uma aba de canal aberta.
     *
     * A aba "só deste cliente" é sobre **este** contato — trocar de
     * conversa e continuar mostrando os casos do anterior é pior do que
     * não mostrar nada. As demais vistas ficam: quem está lendo um caso
     * ou o painel do dia não pediu para ser interrompido.
     */
    if (vista === "fila" && soDoCliente) {
      if (aberto) carregarFila();
      return;
    }

    if (vista !== "contato") return;

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

  /**
   * O canal do site em que o painel está.
   *
   * "Reclame Aqui" no portal, "WhatsApp" no WhatsApp Web, "ManyChat" no
   * ManyChat. Cada detector informa o seu — é o que permite perguntar
   * "este cliente já passou por aqui?" em vez de só "este cliente
   * existe?".
   */
  function canalDaPagina() {
    return consulta?.canalDaPagina ?? captura?.origem ?? "";
  }

  /**
   * O cliente existe, mas **não neste canal**.
   *
   * Um consumidor que reclamou no Reclame Aqui e agora chama no
   * WhatsApp é a mesma pessoa numa jornada diferente, e o painel dizia
   * só "já tem 2 casos" — sem oferecer registrar a passagem por aqui.
   * O histórico por canal é o que a ficha do cliente mostra depois.
   */
  function blocoOutroCanal(dados) {

    const daPagina = canalDaPagina();

    if (!daPagina || !dados?.cliente) return "";

    const casos = dados.casos ?? [];

    if (casos.length === 0) return "";

    const jaAqui = casos.some(
      (caso) => caso.canal === daPagina
    );

    if (jaAqui) return "";

    const outros = [
      ...new Set(casos.map((caso) => caso.canal)),
    ].filter(Boolean);

    return [
      '<div class="bloco">',
      '  <div class="aviso">',
      `    Este cliente já está em <strong>${CW.escapar(outros.join(", "))}</strong>, mas ainda não em <strong>${CW.escapar(daPagina)}</strong>.`,
      '  </div>',
      `  <button class="acao" data-acao="cadastrar-canal" style="width:100%;margin-top:0">Cadastrar neste canal (${CW.escapar(daPagina)})</button>`,
      '</div>',
    ].join("");
  }

  /**
   * Abre a prévia já apontada para o canal desta página.
   *
   * Reaproveita o que a consulta sabe do cliente — nome e telefone — em
   * vez de pedir para redigitar o que já está na tela.
   */
  function cadastrarNesteCanal() {

    const daPagina = canalDaPagina();

    const cliente = ultimoDado?.cliente;

    captura = {
      ...(captura ?? {}),
      origem: daPagina,
      id: "",
      cliente:
        captura?.cliente || cliente?.nome || "",
      telefone:
        captura?.telefone ||
        consulta?.telefone ||
        "",
      email: captura?.email || consulta?.email || "",
      titulo: "",
      texto: "",
      criadoEm: "",
      categoria: "",
      subcategoria: "",
      prioridade: "Alta",
      documento: "",
      formulario: [],
      formularioRecolhido: false,
    };

    abrirCaptura();
  }

  function parametros() {
    return {
      telefone: consulta?.telefone ?? "",
      nome: consulta?.nome ?? "",
      protocolo: consulta?.protocolo ?? "",
      email: consulta?.email ?? "",

      /*
        O documento vai junto quando a tela o conhece.

        O Reclame Aqui mostra CPF ou CNPJ no RA Forms, e o leitor já o
        extraía — mas ele parava aqui e nunca chegava à busca. É o
        identificador mais forte que a base tem: 340 das 342
        reclamações carregam um, e ele é o único que sobrevive a
        alguém trocar de telefone.
      */
      documento: consulta?.documento ?? "",

      termo: consulta?.termo ?? "",
      canal,
    };
  }

  /**
   * O botão de canal abre a **fila** do canal, não um filtro da busca.
   *
   * A primeira versão só reescopava a consulta do contato aberto — e
   * como quase todo cliente tem caso num canal só, os três botões
   * davam o mesmo resultado. O botão prometia canal e entregava filtro.
   *
   * Agora cada um responde "o que está aberto aqui agora?", que é uma
   * pergunta que não depende de haver conversa nenhuma na tela. Clicar
   * no que já está aberto volta para o contato.
   */
  function trocarCanal(alvo) {

    const pedido = alvo.dataset.canal;

    if (pedido === "painel") {
      if (vista === "painel") return voltarAoContato();
      vista = "painel";
      canal = "todos";
      refletirCanal();
      carregarPainel();
      return;
    }

    if (pedido === "atividades") {
      if (vista === "atividades") {
        return voltarAoContato();
      }
      vista = "atividades";
      canal = "todos";
      refletirCanal();
      carregarAtividades();
      return;
    }

    if (vista !== "contato" && canal === pedido) {
      return voltarAoContato();
    }

    canal = pedido;
    vista = "fila";
    veioDaFila = true;

    // Filtro é do canal que estava aberto; trocar de aba zera.
    etapaFiltro = "";
    segmentoFiltro = "";
    recorteFiltro = "";

    /**
     * Com contato na tela, a aba abre **naquele cliente**.
     *
     * É o que o Isaac pediu: abrir a aba do Reclame Aqui com uma
     * conversa aberta tem de mostrar o que aquela pessoa já reclamou
     * ali, não a fila geral. O chip "toda a fila" desfaz num clique.
     */
    soDoCliente = temOndeProcurar();

    refletirCanal();
    carregarFila();
  }

  /**
   * Um contador do painel do dia abre a lista por trás do número.
   *
   * O recorte é da operação inteira, não de um canal — é a mesma conta
   * que produziu o número no painel. Por isso `canal = "todos"`: filtrar
   * por Reclame Aqui aqui faria a lista ser menor que o número clicado,
   * e um painel que se contradiz ensina a não confiar nele.
   */
  function abrirRecorte(recorte) {

    vista = "fila";
    canal = "todos";
    veioDaFila = true;
    soDoCliente = false;

    etapaFiltro = "";
    segmentoFiltro = "";

    recorteFiltro = NOME_DO_RECORTE[recorte]
      ? recorte
      : "";

    refletirCanal();
    carregarFila();
  }

  /**
   * Volta um passo: do caso para a lista de onde ele veio.
   *
   * Sem isto, ler um caso a partir da fila e fechar o detalhe jogava a
   * pessoa de volta no contato — perdendo o filtro e a rolagem da fila.
   */
  function voltarDaVista() {

    if (vista !== "caso") return voltarAoContato();

    detalhe = null;

    /**
     * Volta para a lista de onde o caso foi aberto.
     *
     * A aba de Atividades também abre caso, então "de onde vim" deixou
     * de ser sinônimo de fila.
     */
    if (vistaAnterior === "atividades") {
      vista = "atividades";
      refletirCanal();
      carregarAtividades();
      return;
    }

    if (vistaAnterior === "painel") {
      vista = "painel";
      refletirCanal();
      carregarPainel();
      return;
    }

    /**
     * A marca é o caminho percorrido, não o canal.
     *
     * Era `canal === "todos"`, o que funcionava enquanto "todos"
     * significasse "nenhuma aba aberta". Os contadores do painel abrem
     * fila justamente com `canal = "todos"` — e sem esta distinção,
     * abrir um caso a partir dali e voltar jogava a pessoa no contato,
     * perdendo a lista.
     */
    if (!veioDaFila) return voltarAoContato();

    vista = "fila";
    refletirCanal();
    carregarFila();
  }

  function voltarAoContato() {

    vista = "contato";
    canal = "todos";
    veioDaFila = false;
    vistaAnterior = "contato";
    recorteFiltro = "";

    refletirCanal();

    if (ultimoDado) render(ultimoDado);
    else consultar(false);
  }

  function refletirCanal() {

    /**
     * O voltar só existe quando há de onde voltar.
     *
     * Um botão permanente que não faz nada na tela inicial ensina a
     * pessoa a ignorá-lo — e aí ele não serve quando passa a servir.
     */
    const voltar = raiz?.querySelector(
      '[data-acao="voltar-da-vista"]'
    );

    if (voltar) {
      voltar.style.display =
        vista === "contato" ? "none" : "";
    }

    const ativo =
      vista === "painel"
        ? "painel"
        : vista === "atividades"
          ? "atividades"
          : canal;

    for (const botao of raiz.querySelectorAll(
      '[data-acao="canal"]'
    )) {
      botao.setAttribute(
        "aria-pressed",
        botao.dataset.canal === ativo &&
          vista !== "contato"
          ? "true"
          : "false"
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

    /**
     * A fila e o painel não são sobrescritos pelo detector.
     *
     * O WhatsApp troca de conversa sozinho e o Reclame Aqui redesenha a
     * página; os dois chamam `definirContexto`, que chama isto. Sem a
     * trava, a fila que a pessoa acabou de abrir sumia no meio da
     * leitura e voltava o contato.
     */
    if (vista !== "contato") return;

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

    // Desenhou com o guardado: busca o atual sem piscar a tela.
    if (resposta.vencido) {
      atualizarAtras(() => consultar(true));
    }
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

      /*
        E o dossiê, que aqui nasce da transcrição.

        Cliente sem reclamação cadastrada é quem mais ganha com isto:
        ler o atendimento inteiro antes de responder é o que evita que
        a conversa vire reclamação pública.
      */
      corpo.insertAdjacentHTML(
        "beforeend",
        blocoDossie("")
      );

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
    partes.push(blocoOutroCanal(dados));
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
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">

              <a class="tag marca" data-acao="abrir"
                 data-url="${CW.escapar(est.url)}"
                 style="cursor:pointer">abrir cadastro &rarr;</a>

              ${
                /*
                  Cada link só aparece quando o cadastro tem a URL.

                  Botão que leva a lugar nenhum é pior do que botão
                  ausente: quem clica uma vez e não vai a lugar algum
                  para de clicar nos outros. Sem o campo gravado no
                  estabelecimento, o botão simplesmente não é desenhado.
                */
                est.portal
                  ? `<a class="tag marca" data-acao="abrir"
                        data-url="${CW.escapar(est.portal)}"
                        title="Abrir a conta deste restaurante no portal da Cardápio Web"
                        style="cursor:pointer">portal Cardápio Web &rarr;</a>`
                  : ""
              }

              ${
                /*
                  O Crisp é para o ManyChat.

                  Ali o canal é o ManyChat, mas a conversa fica no
                  Crisp — e sem este botão a única saída que o painel
                  oferecia era WhatsApp, que é outro canal e costuma ser
                  outra pessoa.
                */
                est.crisp
                  ? `<a class="tag marca" data-acao="abrir"
                        data-url="${CW.escapar(est.crisp)}"
                        title="Abrir a conversa deste restaurante no Crisp"
                        style="cursor:pointer">Crisp &rarr;</a>`
                  : ""
              }

            </div>
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
          ciclos.length > 1,
          dados.estabelecimento?.whatsappNps ?? null
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

    partes.push(blocoAnotar(dados));

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
      <div class="caso ${classe}" data-acao="ver"
           data-protocolo="${CW.escapar(caso.protocolo)}">
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

    const leitura = lerConversa();

    /**
     * O leitor passou a devolver o motivo junto.
     *
     * Antes devolvia só a lista, e "0 mensagens" não distinguia
     * conversa vazia de leitor quebrado — a mesma falha foi reportada
     * três vezes sem que desse para dizer qual das duas era. A forma
     * antiga (um array) continua aceita: uma extensão nova contra uma
     * versão antiga do detector não pode parar de funcionar.
     */
    const mensagens = Array.isArray(leitura)
      ? leitura
      : (leitura?.mensagens ?? []);

    const motivo = Array.isArray(leitura)
      ? undefined
      : leitura?.motivo;

    const rotulo = botao.textContent;

    /**
     * Zero mensagens e "duas mensagens" são problemas diferentes.
     *
     * Zero quase sempre é o leitor: o WhatsApp Web troca a marcação sem
     * avisar, e o seletor para de casar. Dizer "conversa curta demais"
     * nesse caso manda procurar o defeito no lugar errado — a conversa
     * está cheia, quem não está lendo é a extensão.
     */
    if (mensagens.length === 0) {
      avisar(
        `Não consegui ler nenhuma mensagem${motivo ? ` — ${motivo}` : ""}. Isso é a extensão, não a conversa. Role a conversa para cima e tente de novo; se continuar, me avise com esta mensagem.`,
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

      const onde = resposta.base
        ? ` (endereço configurado: ${resposta.base})`
        : "";

      avisar(
        /API_KEY|IA configurada/i.test(motivo)
          ? `${motivo}${onde} A chave precisa existir no ambiente que a extensão chama — se o endereço é o da Vercel, é lá que ela tem de estar.`
          : `${motivo}${onde}`,
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
  /**
   * A escada do NPS, quando o servidor ainda não disse qual é.
   *
   * As etapas viraram cadastro, então a lista verdadeira vem junto da
   * resposta (`etapasNps`), como já acontecia com as do quadro do
   * Reclame Aqui. Isto aqui é só o que rotula os botões numa versão da
   * aplicação antiga demais para mandar a lista — sem ele, uma
   * extensão nova contra uma aplicação velha esconderia os botões de
   * avançar e voltar sem explicar por quê.
   */
  const FLUXO_NPS_PADRAO = [
    "Novo",
    "Em tratativa",
    "[Aguardando Resposta]",
  ];

  /** A escada do NPS que o servidor mandou nesta vista. */
  function escadaDoNps() {

    const doServidor =
      filaAtual?.etapasNps ?? ultimoDado?.etapasNps;

    return Array.isArray(doServidor) && doServidor.length
      ? doServidor
      : FLUXO_NPS_PADRAO;
  }

  /**
   * O contato que falta, para digitar ali mesmo.
   *
   * Só aparece quando o ciclo não tem telefone nem e-mail — que é
   * exatamente quando ele não casa com nenhuma conversa e desaparece do
   * painel de quem está atendendo a pessoa.
   */
  function campoDeContatoDoNps(nps) {

    if (nps.temContato) return "";

    return [
      '    <div class="etapas" style="border-top-style:solid">',
      `      <input class="campo" id="nps-contato-${CW.escapar(nps.id)}" type="text" style="margin-top:0;flex:1" placeholder="Telefone ou e-mail deste cliente" />`,
      `      <button class="passo" style="flex:0 0 auto" data-acao="nps-contato" data-id="${CW.escapar(nps.id)}">gravar</button>`,
      '    </div>',
      '    <p class="sub" style="margin-top:5px">A pesquisa não trouxe contato para este ciclo — sem ele, o painel não o encontra pela conversa.</p>',
    ].join("");
  }

  function passosDoNps(nps) {

    if (nps.encerrado) {
      return '    <div class="etapas"><span class="passo vazio">ciclo encerrado — reabrir é pela tela do NPS</span></div>';
    }

    const fluxo = escadaDoNps();

    const i = fluxo.indexOf(nps.status);

    if (i < 0) return "";

    const antes = fluxo[i - 1];
    const depois = fluxo[i + 1];

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
  /**
   * O cartão de um ciclo de NPS.
   *
   * `whatsapp` chega de fora porque o link é do **estabelecimento**, e
   * não do ciclo: o número de quem responde a pesquisa é cadastro do
   * restaurante. Vem pronto do servidor, montado e validado lá.
   */
  function blocoNps(
    nps,
    escrever,
    compacto = false,
    whatsapp = null
  ) {

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

      /*
        O WhatsApp do NPS, no mesmo padrão do portal e do Crisp: só
        aparece quando o cadastro tem o número.

        Fica dentro do cartão do ciclo, e não no bloco do
        estabelecimento, porque a ação é "falar com quem deu esta nota"
        — quem abre o painel no NPS está atendendo a pesquisa, e o
        número da recepção da loja não serve para isso.
      */
      whatsapp && !nps.encerrado
        ? `    <a class="tag marca" data-acao="abrir"
                data-url="${CW.escapar(whatsapp)}"
                title="Abrir o WhatsApp de quem respondeu a pesquisa"
                style="cursor:pointer;margin-top:8px;display:inline-block">WhatsApp do NPS &rarr;</a>`
        : "",

      escrever ? passosDoNps(nps) : "",
      escrever ? campoDeContatoDoNps(nps) : "",
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
     ANOTAR
  ============================================================ */

  /**
   * Anotar no caso e marcar na agenda, sem abrir a aplicação.
   *
   * As duas coisas que se escreve no meio de um atendimento. A
   * anotação vai para a mesma linha do tempo que a gaveta do caso
   * mostra; a tarefa, para a agenda que a própria extensão cobra por
   * notificação.
   *
   * **Não é resposta ao consumidor.** É registro interno — a extensão
   * segue sem mandar mensagem em site nenhum.
   */
  function blocoAnotar(dados) {

    if (!podeEscrever(dados)) return "";

    const casos = dados?.casos ?? [];

    if (casos.length === 0) return "";

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Anotar</div>',
      '  <div class="cartao">',
      '    <label class="rotulo" for="anota-caso">No caso</label>',
      '    <select class="campo" id="anota-caso" style="margin-top:0">',
      ...casos.map(
        (caso) =>
          `      <option value="${CW.escapar(caso.protocolo)}">${CW.escapar(caso.protocolo)} — ${CW.escapar(caso.titulo.slice(0, 46))}</option>`
      ),
      '    </select>',
      '    <textarea class="campo" id="anota-texto" rows="3" placeholder="O que aconteceu neste atendimento"></textarea>',
      '    <div class="linha" style="margin-top:9px;align-items:center">',
      '      <span class="sub">Entra na linha do tempo do caso.</span>',
      '      <button class="acao" style="margin-top:0" data-acao="anotar-caso">Anotar</button>',
      '    </div>',
      '    <p class="sub falha" id="anota-erro"></p>',
      '  </div>',

      '  <div class="cartao" style="margin-top:7px">',
      '    <label class="rotulo" for="anota-tarefa">Lembrar depois</label>',
      '    <input class="campo" id="anota-tarefa" type="text" style="margin-top:0" placeholder="Ex.: cobrar retorno do time de pagamentos" />',
      '    <div style="display:grid;grid-template-columns:1.2fr .9fr;gap:8px">',
      '      <input class="campo" id="anota-quando" type="date" />',
      // Opcional: nem toda pendência tem hora marcada.
      '      <input class="campo" id="anota-hora" type="time" title="Opcional — deixe em branco para o dia inteiro" />',
      '    </div>',
      '    <select class="campo" id="anota-tipo">',
      '      <option value="Follow-up">Follow-up</option>',
      '      <option value="Cobrança interna">Cobrança interna</option>',
      '      <option value="Solicitação de avaliação">Solicitação de avaliação</option>',
      '      <option value="Pendência">Pendência</option>',
      '    </select>',
      '    <div class="linha" style="margin-top:9px;align-items:center">',
      '      <span class="sub">Vai para a agenda, com o caso vinculado.</span>',
      '      <button class="acao" style="margin-top:0" data-acao="anotar-tarefa">Marcar</button>',
      '    </div>',
      '    <p class="sub falha" id="tarefa-erro"></p>',
      '  </div>',
      '</div>',
    ].join("");
  }

  async function anotarCaso(botao) {

    const erro = corpo.querySelector("#anota-erro");

    const texto = (
      corpo.querySelector("#anota-texto")?.value ?? ""
    ).trim();

    if (erro) erro.textContent = "";

    if (!texto) {
      if (erro) {
        erro.textContent = "Escreva a anotação antes.";
      }
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "Anotando...";

    const resposta = await CW.enviar({
      tipo: "anotar",
      anotacao: {
        tipo: "caso",
        protocolo:
          corpo.querySelector("#anota-caso")?.value,
        texto,
      },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      if (erro) {
        erro.textContent =
          resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao anotar.";
      }
      return;
    }

    avisar(
      `Anotação gravada em ${resposta.dados.protocolo}.`,
      "ok"
    );

    const campo = corpo.querySelector("#anota-texto");

    if (campo) campo.value = "";
  }

  async function anotarTarefa(botao) {

    const erro = corpo.querySelector("#tarefa-erro");

    const titulo = (
      corpo.querySelector("#anota-tarefa")?.value ?? ""
    ).trim();

    if (erro) erro.textContent = "";

    if (!titulo) {
      if (erro) {
        erro.textContent = "A tarefa precisa de um título.";
      }
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "Marcando...";

    const resposta = await CW.enviar({
      tipo: "anotar",
      anotacao: {
        tipo: "agenda",
        titulo,
        quando:
          corpo.querySelector("#anota-quando")?.value,
        hora: corpo.querySelector("#anota-hora")?.value,
        tipoDeTarefa:
          corpo.querySelector("#anota-tipo")?.value,
        protocolo:
          corpo.querySelector("#anota-caso")?.value,
      },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      if (erro) {
        erro.textContent =
          resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao marcar.";
      }
      return;
    }

    avisar(
      `Marcado na agenda para ${CW.data(resposta.dados.quando)}${
        resposta.dados.hora
          ? ` às ${resposta.dados.hora}`
          : ""
      }.`,
      "ok"
    );

    const campo = corpo.querySelector("#anota-tarefa");

    if (campo) campo.value = "";
  }

  /* ============================================================
     FILA DO CANAL
  ============================================================ */

  const NOME_DO_CANAL = {
    "reclame-aqui": "Reclame Aqui",
    nps: "NPS",
    social: "Redes Sociais",
    todos: "Todos os canais",
  };

  /** Rótulo de cada recorte do painel, para a fila dizer o que mostra. */
  const NOME_DO_RECORTE = {
    "sem-resposta": "Sem resposta",
    replicas: "Réplicas",
    risco: "Risco de churn",
  };

  async function carregarFila() {

    corpo.innerHTML = `<div class="carregando">Carregando ${CW.escapar(
      NOME_DO_CANAL[canal] ?? canal
    )}…</div>`;

    /**
     * Duas fontes para a mesma aba, e a diferença é a pergunta.
     *
     * "Só deste cliente" é `contexto`, que casa telefone, nome e
     * e-mail. A fila é `fila`, que ordena por urgência e não conhece
     * contato nenhum. Tentar servir as duas com uma rota só faria uma
     * delas trabalhar contra a própria definição.
     */
    const resposta = soDoCliente
      ? await CW.enviar({
          tipo: "contexto",
          consulta: { ...parametros(), canal },
          forcar: true,
        })
      : await CW.enviar({
          tipo: "fila",
          canal,
          etapa: etapaFiltro,
          segmento: segmentoFiltro,
          recorte: recorteFiltro,
        });

    if (!resposta.ok) {
      renderFalha(resposta);
      return;
    }

    if (resposta.dados?.erro) {
      vazio("Não deu para carregar", resposta.dados.erro);
      return;
    }

    if (soDoCliente) {
      ultimoDado = resposta.dados;
      filaAtual = { etapas: resposta.dados.etapas };
      desenharFilaDoCliente(resposta.dados);
      return;
    }

    filaAtual = resposta.dados;

    desenharFila(resposta.dados);
  }

  /** O chip que alterna entre o cliente da tela e a fila inteira. */
  function chipsDeEscopo() {

    if (!temOndeProcurar()) return "";

    return [
      '<div class="chips">',
      `  <button class="chip" data-acao="escopo" data-valor="cliente" aria-pressed="${soDoCliente}">Só deste cliente</button>`,
      `  <button class="chip" data-acao="escopo" data-valor="fila" aria-pressed="${!soDoCliente}">Toda a fila</button>`,
      '</div>',
    ].join("");
  }

  /**
   * Os casos daquele cliente, no canal escolhido.
   *
   * Reaproveita o desenho do cartão da vista de contato — é o mesmo
   * objeto, com os mesmos botões de etapa e o mesmo "abrir".
   */
  function desenharFilaDoCliente(dados) {

    const casos = dados.casos ?? [];

    const nome = dados.cliente?.nome;

    if (canal === "nps") {
      return desenharNpsDoCliente(dados);
    }

    corpo.innerHTML = [
      '<div class="bloco">',
      `  <div class="rotulo">${CW.escapar(NOME_DO_CANAL[canal] ?? canal)}${nome ? ` · ${CW.escapar(nome)}` : ""}</div>`,
      chipsDeEscopo(),
      casos.length === 0
        ? `  <p class="sub" style="margin-top:9px">Este cliente não tem caso em ${CW.escapar(NOME_DO_CANAL[canal] ?? canal)}.</p>`
        : casos.map(desenharCaso).join(""),
      '</div>',
    ].join("");

    corpo.scrollTop = 0;
  }

  /** Os ciclos de NPS daquele cliente, com o contato editável. */
  function desenharNpsDoCliente(dados) {

    const ciclos = dados.npsLista ?? [];

    corpo.innerHTML = [
      '<div class="bloco">',
      `  <div class="rotulo">NPS${dados.cliente?.nome ? ` · ${CW.escapar(dados.cliente.nome)}` : ""}</div>`,
      chipsDeEscopo(),
      '</div>',
      ciclos.length === 0
        ? '<div class="bloco"><p class="sub">Nenhum ciclo de NPS para este contato. O WhatsApp da pesquisa é outro número — se souber que é a mesma pessoa, abra o ciclo pela fila e grave o telefone ali.</p></div>'
        : ciclos
            .map((ciclo) =>
              blocoNps(
                ciclo,
                podeEscrever(dados),
                true,
                dados.estabelecimento?.whatsappNps ?? null
              )
            )
            .join(""),
    ].join("");

    corpo.scrollTop = 0;
  }

  /** Última fila carregada — as etapas dela rotulam os botões. */
  let filaAtual = null;

  function desenharFila(dados) {

    const itens = dados.itens ?? [];

    /** O recorte, quando há, é quem dá nome à lista. */
    const titulo =
      NOME_DO_RECORTE[dados.recorte] ??
      NOME_DO_CANAL[dados.canal] ??
      dados.canal;

    /**
     * Lista vazia com filtro na tela **mantém** os filtros.
     *
     * `vazio()` limpa o corpo, e trocar de recorte a partir dali só
     * seria possível voltando ao painel e clicando outro número — o
     * caminho longo para desfazer um clique.
     */
    if (itens.length === 0) {

      const filtros = filtrosDaFila(dados);

      if (!filtros) {
        vazio(
          `Nada em ${titulo}`,
          "A fila deste canal está limpa."
        );
        return;
      }

      corpo.innerHTML = [
        '<div class="bloco">',
        `  <div class="rotulo">${CW.escapar(titulo)} · nada em aberto</div>`,
        chipsDeEscopo(),
        filtros,
        '  <p class="sub" style="margin-top:9px">Nenhum caso neste recorte. Escolha outro acima.</p>',
        '</div>',
      ].join("");

      corpo.scrollTop = 0;
      return;
    }

    corpo.innerHTML = [
      '<div class="bloco">',
      `  <div class="rotulo">${CW.escapar(titulo)} · ${dados.total} em aberto</div>`,
      chipsDeEscopo(),
      filtrosDaFila(dados),
      `  <p class="sub" style="margin-bottom:9px">${
        dados.canal === "nps"
          ? "Ciclos que ainda pedem ação, do prazo mais apertado para o mais folgado."
          : "Fora do prazo primeiro, depois quem vence antes."
      }${
        dados.total > itens.length
          ? ` Mostrando ${itens.length}.`
          : ""
      }</p>`,
      '</div>',
      itens
        .map(
          dados.canal === "nps"
            ? (item) =>
                blocoNps(item, podeMover(), true)
            : desenharDaFila
        )
        .join(""),
    ].join("");

    corpo.scrollTop = 0;
  }

  /**
   * "Em qual etapa cada canal está" — em chips, com a contagem.
   *
   * A contagem vem da fila **inteira**, não do recorte: se ela mudasse
   * junto com o filtro, escolher "Novo" mostraria "0" em todas as
   * outras e a barra deixaria de servir para navegar.
   */
  function filtrosDaFila(dados) {

    if (dados.canal === "nps") {

      const contagem = dados.porSegmento ?? {};

      return [
        '<div class="chips">',
        `  <button class="chip" data-acao="segmento" data-valor="" aria-pressed="${!segmentoFiltro}">Todos ${dados.totalGeral ?? 0}</button>`,
        ...["Detrator", "Passivo", "Promotor"].map(
          (nome) =>
            `  <button class="chip" data-acao="segmento" data-valor="${nome}" aria-pressed="${segmentoFiltro === nome}">${nome}es ${contagem[nome] ?? 0}</button>`
        ),
        '</div>',
      ]
        .join("")
        .replace("Passivoes", "Passivos");
    }

    const contagem = dados.porEtapa ?? {};

    const etapas = (dados.etapas ?? []).filter(
      (nome) => (contagem[nome] ?? 0) > 0
    );

    const chipsDeEtapa =
      etapas.length === 0
        ? ""
        : [
            '<div class="chips">',
            `  <button class="chip" data-acao="etapa" data-valor="" aria-pressed="${!etapaFiltro}">Todas ${dados.totalGeral ?? 0}</button>`,
            ...etapas.map(
              (nome) =>
                `  <button class="chip" data-acao="etapa" data-valor="${CW.escapar(nome)}" aria-pressed="${etapaFiltro === nome}">${CW.escapar(nome)} ${contagem[nome]}</button>`
            ),
            '</div>',
          ].join("");

    /**
     * Os recortes do painel, quando a fila veio de um contador.
     *
     * Só aí: numa fila de canal eles seriam mais três chips competindo
     * com as etapas, que é a pergunta daquela tela.
     */
    if (dados.canal !== "todos") return chipsDeEtapa;

    const porRecorte = dados.porRecorte ?? {};

    return [
      '<div class="chips">',
      `  <button class="chip" data-acao="recorte" data-valor="" aria-pressed="${!recorteFiltro}">Em aberto ${dados.totalDoCanal ?? 0}</button>`,
      ...Object.entries(NOME_DO_RECORTE).map(
        ([id, rotulo]) =>
          `  <button class="chip" data-acao="recorte" data-valor="${id}" aria-pressed="${recorteFiltro === id}">${CW.escapar(rotulo)} ${porRecorte[id] ?? 0}</button>`
      ),
      '</div>',
      chipsDeEtapa,
    ].join("");
  }

  /* ============================================================
     O CASO, LIDO DENTRO DO PAINEL
  ============================================================ */

  /**
   * Abrir o caso sem sair da conversa.
   *
   * O painel mostrava o cartão e, para ler o relato, mandava abrir a
   * aplicação noutra aba — o que derrota metade do propósito da
   * extensão. O relato do consumidor é justamente o que se precisa ler
   * antes de responder.
   */
  async function abrirDetalhe(protocolo, emSilencio = false) {

    /**
     * De onde viemos, para o voltar saber para onde volta.
     *
     * Sem isto, abrir um caso a partir da aba de Atividades e fechar o
     * detalhe jogava a pessoa no contato — perdendo a lista e o
     * recorte que ela tinha escolhido.
     */
    if (vista !== "caso") vistaAnterior = vista;

    vista = "caso";

    refletirCanal();

    if (!emSilencio) {
      corpo.innerHTML = `<div class="carregando">Abrindo ${CW.escapar(protocolo)}…</div>`;
    }

    const resposta = await CW.enviar({
      tipo: "detalhe",
      protocolo,
      forcar: emSilencio,
    });

    if (!resposta.ok) {
      renderFalha(resposta);
      return;
    }

    if (resposta.dados?.erro) {
      vazio("Não deu para abrir", resposta.dados.erro);
      return;
    }

    detalhe = resposta.dados;

    // Triagem é de um caso só: trocar de caso descarta a anterior.
    if (triagem && triagem.protocolo !== protocolo) {
      triagem = null;
    }

    if (
      resumoDoCaso &&
      resumoDoCaso.protocolo !== protocolo
    ) {
      resumoDoCaso = null;
    }

    desenharDetalhe(detalhe);

    /**
     * Desenhou com dado velho: atualiza atrás.
     *
     * É o que faz a gaveta abrir instantânea sem mostrar informação
     * desatualizada por muito tempo — a tela aparece com o que já se
     * tinha e se corrige sozinha um instante depois.
     */
    if (resposta.vencido) {
      atualizarAtras(() => abrirDetalhe(protocolo, true));
    }
  }

  /**
   * Refaz a consulta em segundo plano, sem piscar a tela.
   *
   * `requestIdleCallback` porque isto nunca é urgente: o usuário já
   * está lendo o resultado. Onde ele não existe, um `setTimeout` curto
   * dá o mesmo efeito.
   */
  function atualizarAtras(fn) {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => fn(), { timeout: 3000 });
    } else {
      setTimeout(fn, 300);
    }
  }

  function desenharDetalhe(d) {

    const partes = [
      '<div class="bloco">',
      '  <button class="copiar" data-acao="voltar-da-vista" style="margin-bottom:10px">&larr; voltar</button>',
      '  <div class="cartao">',
      '    <div class="linha">',
      `      <span class="sub">${CW.escapar(d.protocolo)}</span>`,
      `      <span class="tag ${
        d.sla.situacao === "estourado"
          ? "perigo"
          : d.sla.situacao === "atencao"
            ? "atencao"
            : "neutro"
      }">${CW.escapar(d.sla.rotulo)}</span>`,
      '    </div>',
      `    <div class="nome" style="font-size:13.5px;margin-top:4px">${CW.escapar(d.titulo)}</div>`,
      `    <div class="sub" style="margin-top:5px">${CW.escapar(d.cliente)} · ${CW.escapar(d.status)}${d.responsavel ? ` · ${CW.escapar(d.responsavel)}` : " · sem responsável"}</div>`,
      `    <div class="sub" style="margin-top:3px">${CW.escapar(d.canal)} · ${CW.escapar(d.categoria)}${d.subcategoria ? ` / ${CW.escapar(d.subcategoria)}` : ""} · ${CW.data(d.criadoEm)}</div>`,
      d.avaliado
        ? `    <div class="sub" style="margin-top:3px">Avaliado: nota ${d.nota ?? "—"} · ${d.resolvido ? "resolvido" : "não resolvido"} · ${d.voltaria ? "voltaria a fazer negócio" : "não voltaria"}</div>`
        : '    <div class="sub" style="margin-top:3px">Ainda sem avaliação do consumidor.</div>',
      botoesDeEtapa({
        protocolo: d.protocolo,
        status: d.status,
      }),
      '  </div>',
      '</div>',
    ];

    /* ---- resumo do caso ---- */

    /*
      Vem antes da triagem de propósito.

      A ordem na tela é a ordem da cabeça de quem atende: primeiro "o
      que é isto", depois "o que eu faço". Uma sugestão de resposta
      acima do resumo faria a pessoa decidir antes de entender.
    */
    partes.push(blocoDossie(d.protocolo));

    /* ---- triagem ---- */

    if (d.relato) {
      partes.push(
        '<div class="bloco">',
        '  <div class="rotulo">Responder ou analisar?</div>',
        triagem && triagem.protocolo === d.protocolo
          ? blocoTriagem(triagem)
          : [
              /*
                Duas velocidades, e a diferença é dita em segundos.

                A triagem é a chamada mais lenta da extensão: é a que
                pede julgamento, e por isso roda no modelo maior.
                Medido, ~10 s contra ~1 s no menor. Nem sempre valem os
                dez — quem já leu a reclamação e só quer uma segunda
                opinião prefere a resposta agora; quem vai decidir em
                cima dela, não.

                O rótulo diz o tempo porque é isso que se está
                escolhendo: "rápido" sozinho não deixa ninguém decidir.
              */
              '  <div class="etapas" style="margin-top:0">',
              '    <button class="passo" data-acao="triar" data-protocolo="' +
                CW.escapar(d.protocolo) +
                '" style="flex:1">Ler com calma (~10 s)</button>',
              '    <button class="passo" data-acao="triar" data-rapido="1" data-protocolo="' +
                CW.escapar(d.protocolo) +
                '" style="flex:1">Ler rápido (~1 s)</button>',
              '  </div>',
              '  <p class="sub" style="margin-top:6px">Lê o relato e os textos aprovados e diz se dá para responder agora ou se precisa de apuração. Sugere — não grava nem envia nada. A leitura rápida usa o modelo menor: responde na hora e erra mais no julgamento.</p>',
            ].join(""),
        '</div>'
      );
    }

    if (d.relato) {
      partes.push(
        '<div class="bloco">',
        '  <div class="rotulo">Relato do consumidor</div>',
        `  <div class="macro"><pre style="max-height:none">${CW.escapar(d.relato)}</pre></div>`,
        '</div>'
      );
    }

    if (d.respostaPublica) {
      partes.push(
        '<div class="bloco">',
        '  <div class="rotulo">Nossa resposta pública</div>',
        `  <div class="macro"><pre style="max-height:none">${CW.escapar(d.respostaPublica)}</pre></div>`,
        '</div>'
      );
    }

    /* ---- anotações do caso ---- */

    partes.push(
      '<div class="bloco">',
      `  <div class="rotulo">Anotações (${(d.anotacoes ?? []).length})</div>`,
      ...(d.anotacoes ?? []).map(
        (nota) => `
      <div class="cartao" style="margin-bottom:6px">
        <div class="sub" style="color:var(--texto)">${CW.escapar(nota.texto)}</div>
        <div class="sub" style="margin-top:4px">${CW.escapar(nota.autor)} · ${CW.data(nota.quando)}</div>
      </div>`
      ),
      podeMover()
        ? [
            '  <div class="cartao">',
            `    <textarea class="campo" id="detalhe-nota" rows="3" style="margin-top:0" placeholder="O que aconteceu neste atendimento"></textarea>`,
            '    <div class="linha" style="margin-top:9px;align-items:center">',
            '      <span class="sub">Entra na linha do tempo do caso.</span>',
            `      <button class="acao" style="margin-top:0" data-acao="anotar-detalhe" data-protocolo="${CW.escapar(d.protocolo)}">Anotar</button>`,
            '    </div>',
            '    <p class="sub falha" id="detalhe-erro"></p>',
            '  </div>',
          ].join("")
        : "",
      '</div>'
    );

    partes.push(
      '<div class="bloco">',
      `  <button class="acao" data-acao="abrir" data-url="${CW.escapar(d.url)}" style="width:100%;margin-top:0">Abrir na aplicação</button>`,
      d.urlPortal
        ? `  <button class="copiar" data-acao="abrir" data-url="${CW.escapar(d.urlPortal)}" style="width:100%;margin-top:7px;padding:8px">Ver no portal</button>`
        : "",
      '</div>'
    );

    corpo.innerHTML = partes.filter(Boolean).join("");
    corpo.scrollTop = 0;
  }

  /**
   * A leitura da IA sobre o caso aberto.
   *
   * Guardada por caso — sair do detalhe e voltar não deve gastar outra
   * chamada ao modelo, e a triagem do caso A não pode aparecer no caso
   * B.
   */
  let triagem = null;

  /**
   * O resumo do caso aberto, quando alguém pediu.
   *
   * Guardado por caso, como a triagem: sair do detalhe e voltar não
   * deve gastar outra chamada ao modelo, e o resumo do caso A não pode
   * aparecer no caso B.
   */
  let resumoDoCaso = null;

  /**
   * O resumo, em dois cartões separados.
   *
   * Separados e não num texto corrido: são duas perguntas diferentes, e
   * quem volta a um caso conhecido lê só a segunda. Num parágrafo só,
   * ela ficaria no fim — depois do que a pessoa já sabe.
   */
  /**
   * O dossiê, em blocos que respondem perguntas diferentes.
   *
   * A ordem é a da cabeça de quem abre o caso: "onde estou" (geral),
   * "o que mudou" (último), "o que faço agora" (próxima resposta e
   * pendências), "me dá o texto" (as três respostas) e, por último, a
   * história inteira — que é longa e fica recolhida, porque quem já
   * conhece o caso não quer rolar por ela toda vez.
   */
  /**
   * O convite ao dossiê, com o campo da transcrição.
   *
   * Uma função e não um trecho inline porque agora aparece em dois
   * lugares: no caso aberto e na tela de contato. **Cliente sem
   * reclamação cadastrada também precisa de dossiê** — é justamente
   * antes de virar reclamação que ler o histórico ainda muda o
   * desfecho, e a primeira versão recusava esse caso.
   *
   * `protocolo` vem vazio quando não há caso; o servidor entende e
   * monta o dossiê a partir da transcrição e do contato.
   */
  function blocoDossie(protocolo) {

    const pronto =
      resumoDoCaso &&
      (resumoDoCaso.protocolo ?? "") === (protocolo ?? "");

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Dossiê do atendimento</div>',

      pronto
        ? blocoResumoDoCaso(resumoDoCaso)
        : [
            '  <div class="etapas" style="margin-top:0">',
            '    <button class="passo" data-acao="resumir-caso" data-protocolo="' +
              CW.escapar(protocolo ?? "") +
              '" style="flex:1">Montar dossiê (~15 s)</button>',
            '    <button class="passo" data-acao="resumir-caso" data-rapido="1" data-protocolo="' +
              CW.escapar(protocolo ?? "") +
              '" style="flex:1">Resumo rápido (~2 s)</button>',
            '  </div>',

            protocolo
              ? '  <p class="sub" style="margin-top:6px">Lê o relato, a resposta pública e a linha do tempo interna. Devolve o dossiê completo, o que mudou, o que falta resolver e três respostas prontas para revisar. Só lê — não grava nem envia nada.</p>'
              : '  <p class="sub" style="margin-top:6px">Este contato não tem reclamação cadastrada. Cole o atendimento do Crisp abaixo e o dossiê sai dele — é o que mais ajuda antes de o assunto virar reclamação.</p>',

            /*
              O campo da transcrição fica recolhido.

              Ele é grande e não é usado toda vez; aberto por padrão,
              empurraria o resto do painel para baixo em todo caso que
              não precisa dele. Fechado, quem precisa clica.
            */
            `
  <details style="margin-top:8px" ${protocolo ? "" : "open"}>
    <summary style="cursor:pointer;font-size:12px;font-weight:600;padding:5px 0">Colar transcrição do Crisp (opcional)</summary>
    <textarea class="campo" id="dossie-transcricao" rows="4"
              style="margin-top:5px;font-family:inherit"
              placeholder="Cole aqui a transcrição exportada do Crisp. Ela entra no dossiê como parte da história — o que foi prometido, quem atendeu, onde travou."></textarea>
    <p class="sub" style="margin-top:5px;color:var(--suave)">Fica só nesta consulta: não é gravada em lugar nenhum.</p>
  </details>`,
          ].join(""),

      '</div>',
    ].join("");
  }

  function blocoResumoDoCaso(r) {

    const bloco = (titulo, conteudo, estilo = "") =>
      conteudo
        ? [
            `  <div class="cartao" style="margin-top:7px;${estilo}">`,
            `    <div class="rotulo" style="margin-bottom:5px">${titulo}</div>`,
            conteudo,
            '  </div>',
          ].join("")
        : "";

    const paragrafo = (texto) =>
      `    <p class="sub" style="color:var(--texto)">${CW.escapar(texto)}</p>`;

    return [

      /* ---- situar ---- */

      '  <div class="cartao">',
      '    <div class="rotulo" style="margin-bottom:5px">Onde estou</div>',
      paragrafo(r.geral),
      '  </div>',

      r.comTranscricao
        ? `  <div class="sub" style="margin-top:6px;color:var(--suave)">Transcrição do Crisp lida (${r.tamanhoDaTranscricao} caracteres).</div>`
        : "",

      r.semCaso
        ? '  <div class="sub" style="margin-top:6px;color:var(--suave)">Sem reclamação cadastrada — o dossiê saiu do atendimento.</div>'
        : "",

      bloco(
        "O que aconteceu por último",
        [
          paragrafo(r.ultimo),

          /*
            Quantos fatos internos existiam para ler.

            Sem este número, "nada aconteceu depois do relato" e "o
            resumo não recebeu a linha do tempo" ficam iguais na tela —
            e são coisas bem diferentes para quem vai decidir.
          */
          typeof r.fatos === "number"
            ? `    <div class="sub" style="margin-top:6px;color:var(--suave)">${
                r.fatos === 0
                  ? "Nenhuma anotação ou movimentação interna registrada."
                  : `Lido sobre ${r.fatos} registro(s) internos.`
              }</div>`
            : "",
        ].join("")
      ),

      /* ---- agir ---- */

      bloco(
        "Para a próxima resposta",
        paragrafo(r.proximaResposta)
      ),

      (r.pendencias ?? []).length > 0
        ? bloco(
            "O que precisa ser resolvido",
            r.pendencias
              .map(
                (item) =>
                  `    <div class="sub" style="color:var(--suave)">• ${CW.escapar(item)}</div>`
              )
              .join("")
          )
        : "",

      (r.pontos ?? []).length > 0
        ? bloco(
            "Fatos que pesam",
            r.pontos
              .map(
                (item) =>
                  `    <div class="sub" style="color:var(--suave)">• ${CW.escapar(item)}</div>`
              )
              .join("")
          )
        : "",

      /* ---- os três textos ---- */

      (r.respostas ?? []).length > 0
        ? [
            '  <div class="rotulo" style="margin-top:10px;margin-bottom:5px">Enviar ao cliente — escolha a que faz sentido</div>',
            ...r.respostas.map(
              (item) => `
  <div class="macro" style="margin-top:7px">
    <div class="linha">
      <span style="font-weight:600;font-size:12.5px">${CW.escapar(item.titulo)}</span>
      <button class="copiar" data-acao="copiar" data-texto="${CW.escapar(item.texto)}">copiar</button>
    </div>
    <div class="sub" style="margin:3px 0 6px;color:var(--suave)">${CW.escapar(item.quando)}</div>
    <pre style="max-height:none">${CW.escapar(item.texto)}</pre>
  </div>`
            ),
          ].join("")
        : "",

      /* ---- a história inteira, recolhida ---- */

      r.dossie
        ? `
  <details style="margin-top:9px">
    <summary style="cursor:pointer;font-size:12.5px;font-weight:600;padding:7px 0">Dossiê completo — tudo que aconteceu</summary>
    <div class="cartao" style="margin-top:5px">
      <p class="sub" style="color:var(--texto);white-space:pre-wrap">${CW.escapar(r.dossie)}</p>
    </div>
  </details>`
        : "",

      r.rapido
        ? '  <p class="sub" style="margin-top:6px;color:var(--suave)">Resumo rápido: modelo menor, responde na hora e resume com menos cuidado.</p>'
        : "",
    ]
      .filter(Boolean)
      .join("");
  }

  async function resumirCaso(botao) {

    const rapido = botao.dataset.rapido === "1";
    const rotulo = botao.textContent;

    botao.disabled = true;

    /* O rótulo de espera diz quanto vai demorar — ver a triagem. */
    botao.textContent = rapido
      ? "Lendo…"
      : "Montando… (~15 s)";

    /**
     * A transcrição é lida na hora do clique, do campo aberto.
     *
     * Guardá-la em estado seria uma cópia a mais para manter em dia — e
     * ela vale para esta consulta só, então o campo é a fonte.
     */
    const campoTranscricao = corpo.querySelector(
      "#dossie-transcricao"
    );

    const resposta = await CW.enviar({
      tipo: "resumoCaso",
      protocolo: botao.dataset.protocolo,
      transcricao: campoTranscricao?.value ?? "",
      nome: consulta?.nome ?? "",
      telefone: consulta?.telefone ?? "",
      rapido,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao resumir o caso.",
        "perigo"
      );
      return;
    }

    resumoDoCaso = resposta.dados;

    if (detalhe) desenharDetalhe(detalhe);
  }

  function blocoTriagem(t) {

    const responder = t.decisao === "responder";

    return [
      '  <div class="cartao">',
      '    <div class="linha">',
      `      <span class="tag ${responder ? "ok" : "atencao"}">${responder ? "dá para responder" : "precisa de análise"}</span>`,
      `      <span class="tag ${t.gravidade === "alta" ? "perigo" : "neutro"}">gravidade ${CW.escapar(t.gravidade)}</span>`,
      '    </div>',
      `    <div class="sub" style="margin-top:6px;color:var(--texto)">${CW.escapar(t.assunto)}</div>`,
      `    <p class="sub" style="margin-top:4px">${CW.escapar(t.porque)}</p>`,

      (t.oQueFalta ?? []).length > 0
        ? [
            '    <div class="rotulo" style="margin-top:10px">O que verificar</div>',
            ...t.oQueFalta.map(
              (item) =>
                `    <div class="sub" style="color:var(--suave)">• ${CW.escapar(item)}</div>`
            ),
            t.areaSugerida
              ? `    <div class="sub" style="margin-top:5px">Sugerido para: <strong>${CW.escapar(t.areaSugerida)}</strong></div>`
              : "",
          ].join("")
        : "",

      '  </div>',

      '  <div class="macro" style="margin-top:7px">',
      '    <div class="linha">',
      '      <span style="font-weight:600;font-size:12.5px">Rascunho para revisar</span>',
      `      <button class="copiar" data-acao="copiar" data-texto="${CW.escapar(t.rascunho)}">copiar</button>`,
      '    </div>',
      `    <pre style="max-height:none">${CW.escapar(t.rascunho)}</pre>`,
      '  </div>',

      /*
        Por qual via a leitura veio.

        A rápida acerta menos no julgamento, e quem lê o resultado
        precisa saber qual das duas está lendo antes de decidir em cima
        dela.
      */
      `  <p class="sub" style="margin-top:6px">Sugestão da IA (${CW.escapar(t.provedor ?? "—")}${t.rapido ? " · leitura rápida" : ""}). Confira antes de enviar — nada foi gravado.</p>`,

      /*
        Depois de ler rápido, a leitura com calma fica a um clique.

        É o desfecho que o modo rápido precisa ter: ele serve para
        decidir se vale gastar os dez segundos, e isso só é verdade se
        o caminho de volta estiver ali.
      */
      '  <div class="etapas" style="margin-top:7px">',
      `    <button class="passo" data-acao="triar" data-protocolo="${CW.escapar(t.protocolo)}" style="flex:1">${t.rapido ? "Ler com calma (~10 s)" : "Ler de novo"}</button>`,
      t.rapido
        ? ""
        : `    <button class="passo" data-acao="triar" data-rapido="1" data-protocolo="${CW.escapar(t.protocolo)}" style="flex:1">Ler rápido (~1 s)</button>`,
      '  </div>',
    ]
      .filter(Boolean)
      .join("");
  }

  async function triarCaso(botao) {

    const rotulo = botao.textContent;

    const rapido = botao.dataset.rapido === "1";

    botao.disabled = true;

    /**
     * O rótulo de espera diz quanto vai demorar.
     *
     * "Lendo…" num botão que fica dez segundos parado parece travado.
     * Dizer o tempo é a diferença entre esperar e clicar de novo.
     */
    botao.textContent = rapido
      ? "Lendo…"
      : "Lendo… (~10 s)";

    const resposta = await CW.enviar({
      tipo: "triagem",
      protocolo: botao.dataset.protocolo,
      rapido,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao triar.",
        "perigo"
      );
      return;
    }

    triagem = resposta.dados;

    if (detalhe) desenharDetalhe(detalhe);
  }

  async function anotarNoDetalhe(botao) {

    const erro = corpo.querySelector("#detalhe-erro");

    const texto = (
      corpo.querySelector("#detalhe-nota")?.value ?? ""
    ).trim();

    if (erro) erro.textContent = "";

    if (!texto) {
      if (erro) erro.textContent = "Escreva a anotação antes.";
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "Anotando...";

    const resposta = await CW.enviar({
      tipo: "anotar",
      anotacao: {
        tipo: "caso",
        protocolo: botao.dataset.protocolo,
        texto,
      },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      if (erro) {
        erro.textContent =
          resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao anotar.";
      }
      return;
    }

    // Recarrega para a anotação aparecer na linha do tempo acima.
    abrirDetalhe(botao.dataset.protocolo);
  }

  /**
   * Um caso na fila.
   *
   * Traz o cliente no lugar da etiqueta de canal: na fila de um canal
   * só, dizer o canal em cada linha é ruído — quem é a pessoa, não.
   */
  function desenharDaFila(caso) {

    const grave = caso.sla.situacao === "estourado";

    return `
      <div class="caso ${grave ? "grave" : ""}" data-acao="ver"
           data-protocolo="${CW.escapar(caso.protocolo)}">
        <div class="linha">
          <span class="sub">${CW.escapar(caso.protocolo)}</span>
          <span class="tag ${
            grave
              ? "perigo"
              : caso.sla.situacao === "atencao"
                ? "atencao"
                : "neutro"
          }">${CW.escapar(caso.sla.rotulo)}</span>
        </div>
        <div class="titulo-caso">${CW.escapar(caso.titulo)}</div>
        <div class="sub" style="margin-top:3px">
          ${CW.escapar(caso.cliente)} ·
          ${CW.escapar(caso.status)}${
            caso.responsavel
              ? ` · ${CW.escapar(caso.responsavel)}`
              : " · sem responsável"
          }
        </div>
        ${botoesDeEtapa(caso)}
      </div>`;
  }

  /* ============================================================
     PAINEL DO DIA
  ============================================================ */

  async function carregarPainel() {

    corpo.innerHTML = `<div class="carregando">Carregando o painel…</div>`;

    const resposta = await CW.enviar({ tipo: "resumo" });

    if (!resposta.ok) {
      renderFalha(resposta);
      return;
    }

    const dados = resposta.dados;
    const rep = dados.reputacao ?? {};

    const partes = [
      '<div class="bloco">',
      '  <div class="rotulo">Nota do Reclame Aqui</div>',
      '  <div class="cartao">',
      '    <div class="linha">',
      `      <span class="nome" style="font-size:22px">${
        rep.indisponivel ? "—" : CW.escapar(rep.nota)
      }</span>`,
      `      <span class="tag ${rep.ra1000 ? "laranja" : "marca"}">${CW.escapar(
        rep.ra1000 ? "RA1000" : (rep.faixa ?? "")
      )}</span>`,
      '    </div>',
      `    <div class="sub">${CW.data(rep.inicio)} a ${CW.data(rep.fim)}</div>`,
      '  </div>',
      /*
        Os quatro números abrem a lista.

        Eram leitura morta: o painel dizia "4 sem resposta" e a pergunta
        seguinte — quais? — só tinha resposta abrindo a aplicação em
        outra aba. Cada um leva ao mesmo recorte em
        `/api/extensao/fila`, com a mesma conta dos dois lados.
      */
      '  <div class="numeros">',
      ...[
        ["", "abertos", dados.contagens?.abertos ?? 0, "Tudo que está em aberto, em todos os canais"],
        ["sem-resposta", "s/ resposta", dados.contagens?.semResposta ?? 0, "Reclamações ainda na coluna Novo"],
        ["replicas", "réplicas", dados.contagens?.replicas ?? 0, "Aguardando nossa réplica"],
        ["risco", "risco", dados.contagens?.risco ?? 0, "Casos abertos com risco de churn"],
      ].map(
        ([recorte, rotulo, valor, dica]) =>
          `    <button class="numero" type="button" data-acao="fila-recorte" data-recorte="${recorte}" title="${CW.escapar(dica)}"><b>${valor}</b><span>${rotulo}</span></button>`
      ),
      '  </div>',
      '</div>',
    ];

    if (dados.nps && dados.nps.total > 0) {
      partes.push(
        '<div class="bloco">',
        '  <div class="rotulo">NPS · últimos 30 dias</div>',
        '  <div class="cartao">',
        '    <div class="linha">',
        `      <span class="nome">${dados.nps.nota}</span>`,
        `      <span class="sub">média ${String(dados.nps.media).replace(".", ",")} · ${dados.nps.total} resposta(s)</span>`,
        '    </div>',
        `    <div class="sub" style="margin-top:4px">${dados.nps.detratores} detrator(es) · ${dados.nps.passivos} passivo(s) · ${dados.nps.promotores} promotor(es)</div>`,
        `    <div class="sub" style="margin-top:4px">${dados.nps.abertos} em aberto${
          dados.nps.estourados > 0
            ? ` · <strong style="color:var(--perigo)">${dados.nps.estourados} fora do prazo</strong>`
            : ""
        }</div>`,
        '  </div>',
        '</div>'
      );
    }

    if ((dados.alertas ?? []).length > 0) {
      partes.push(
        '<div class="bloco">',
        '  <div class="rotulo">Alertas</div>',
        ...dados.alertas.map(
          (item) => `
        <div class="sugestao ${item.tom}" data-acao="abrir" data-url="${CW.escapar(item.url)}" style="cursor:pointer">
          <span class="marca-tom"></span>
          <span>
            <strong style="font-size:12.5px">${CW.escapar(item.titulo)}</strong><br />
            <span class="sub">${CW.escapar(item.detalhe)}</span>
          </span>
        </div>`
        ),
        '</div>'
      );
    }

    /* ---- agenda do dia ---- */

    const agenda = await CW.enviar({ tipo: "agenda" });

    const tarefas = agenda.ok
      ? (agenda.dados?.itens ?? [])
      : [];

    partes.push(
      '<div class="bloco">',
      `  <div class="rotulo">Agenda${tarefas.length ? ` · ${tarefas.length}` : ""}</div>`,
      tarefas.length === 0
        ? '  <p class="sub">Nada em aberto para hoje.</p>'
        : tarefas
            .map(
              (t) => `
      <div class="cartao" style="margin-bottom:6px">
        <div class="linha">
          <span class="sub" style="color:var(--texto);font-weight:600">${CW.escapar(t.titulo)}</span>
          ${
            t.atrasada
              ? `<span class="tag perigo">${CW.data(t.quando)}</span>`
              : `<span class="tag neutro">hoje</span>`
          }
        </div>
        <div class="sub" style="margin-top:3px">
          ${CW.escapar(t.tipo)}${t.hora ? ` · ${CW.escapar(t.hora)}` : ""}${t.protocolo ? ` · ${CW.escapar(t.protocolo)}` : ""}${t.responsavel ? ` · ${CW.escapar(t.responsavel)}` : ""}
        </div>
        <div class="etapas">
          <button class="passo" data-acao="concluir" data-id="${CW.escapar(t.id)}">concluir</button>
          ${
            t.protocolo
              ? `<button class="passo" data-acao="ver" data-protocolo="${CW.escapar(t.protocolo)}">abrir o caso</button>`
              : '<span class="passo vazio">sem caso ligado</span>'
          }
        </div>
      </div>`
            )
            .join(""),
      '</div>'
    );

    /* ---- marcar uma atividade ---- */

    // O mesmo bloco da aba de Atividades: duas cópias divergiriam na
    // primeira vez que alguém acrescentasse um tipo de tarefa.
    if (podeMover()) {
      partes.push(blocoNovaAtividade());
    }

    /* ---- resumo da conversa, quando o site oferece ---- */

    if (lerConversa) {
      partes.push(blocoResumo());
    }

    corpo.innerHTML = partes.filter(Boolean).join("");
    corpo.scrollTop = 0;
  }

  /** A anotação do dia — tarefa de agenda sem caso ligado. */
  async function anotarODia(botao) {

    const erro = corpo.querySelector("#dia-erro");

    const titulo = (
      corpo.querySelector("#dia-tarefa")?.value ?? ""
    ).trim();

    if (erro) erro.textContent = "";

    if (!titulo) {
      if (erro) {
        erro.textContent = "A tarefa precisa de um título.";
      }
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "Marcando...";

    const resposta = await CW.enviar({
      tipo: "anotar",
      anotacao: {
        tipo: "agenda",
        titulo,
        quando: corpo.querySelector("#dia-quando")?.value,
        hora: corpo.querySelector("#dia-hora")?.value,
        tipoDeTarefa:
          corpo.querySelector("#dia-tipo")?.value,
      },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      if (erro) {
        erro.textContent =
          resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao marcar.";
      }
      return;
    }

    avisar(
      `Marcado para ${CW.data(resposta.dados.quando)}${
        resposta.dados.hora
          ? ` às ${resposta.dados.hora}`
          : ""
      }.`,
      "ok"
    );

    recarregarVista();
  }

  /* ============================================================
     ATIVIDADES
  ============================================================ */

  const NOME_DO_ESCOPO = {
    "": "Vencendo",
    proximos: "Próximas",
    concluidas: "Concluídas",
  };

  /**
   * A aba de Atividades.
   *
   * O que está marcado, ligado à agenda da aplicação: o que é de hoje,
   * o que ficou para trás, o que vem pela frente — e o caso vinculado a
   * um clique de distância.
   *
   * Existe separada do Painel porque ali a agenda divide espaço com a
   * nota, os contadores e os alertas: cabem as tarefas de hoje e mais
   * nada. E a pergunta que essa lista responde não é "como estamos", é
   * "o que eu faço agora" — que é a tela em que se passa a manhã.
   *
   * Ela **não** duplica a agenda do Painel: as duas leem a mesma rota,
   * `/api/extensao/agenda`, com recortes diferentes.
   */
  async function carregarAtividades() {

    corpo.innerHTML = `<div class="carregando">Carregando as atividades…</div>`;

    const resposta = await CW.enviar({
      tipo: "agenda",
      escopo: escopoAtividades,
    });

    if (!resposta.ok) {
      renderFalha(resposta);
      return;
    }

    const dados = resposta.dados ?? {};
    const itens = dados.itens ?? [];
    const contagens = dados.contagens ?? {};

    /**
     * O atrasado primeiro, sempre.
     *
     * O servidor já ordena por vencimento, o que numa lista de hoje +
     * atrasado põe o atrasado na frente naturalmente. A ordenação aqui
     * é para o caso de a data ser a mesma: quem já venceu não pode
     * ficar embaixo de quem vence às 18h.
     */
    const ordenados = [...itens].sort((a, b) => {
      if (Boolean(a.atrasada) !== Boolean(b.atrasada)) {
        return a.atrasada ? -1 : 1;
      }
      return String(a.quando).localeCompare(
        String(b.quando)
      );
    });

    const partes = [
      '<div class="bloco">',
      `  <div class="rotulo">Atividades · ${CW.escapar(NOME_DO_ESCOPO[dados.escopo ?? ""] ?? "Vencendo")}</div>`,

      '  <div class="chips">',
      ...[
        ["", "Vencendo", contagens.pendentes ?? 0],
        ["proximos", "Próximas", contagens.proximos ?? 0],
        [
          "concluidas",
          "Concluídas",
          contagens.concluidas ?? 0,
        ],
      ].map(
        ([id, rotulo, quantidade]) =>
          `    <button class="chip" data-acao="escopo-atividade" data-valor="${id}" aria-pressed="${escopoAtividades === id}">${rotulo} ${quantidade}</button>`
      ),
      '  </div>',

      contagens.atrasadas > 0 && escopoAtividades !== ""
        ? `  <p class="sub" style="margin-top:8px;color:var(--perigo)"><strong>${contagens.atrasadas} atrasada(s)</strong> esperando em "Vencendo".</p>`
        : "",

      '</div>',
    ];

    if (ordenados.length === 0) {

      partes.push(
        '<div class="bloco">',
        `  <p class="sub">${
          escopoAtividades === "concluidas"
            ? "Nada concluído nos últimos sete dias."
            : escopoAtividades === "proximos"
              ? "Nada marcado para as próximas duas semanas."
              : "Nada em aberto para hoje, e nada atrasado."
        }</p>`,
        '</div>'
      );

    } else {

      partes.push(
        ...ordenados.map((t) => cartaoDeAtividade(t))
      );
    }

    /* ---- marcar uma nova, sem sair da aba ---- */

    if (podeMover()) {
      partes.push(blocoNovaAtividade());
    }

    partes.push(
      `<button class="acao" data-acao="abrir" data-url="${CW.escapar(dados.url ?? "")}" style="width:100%">Abrir a agenda na aplicação</button>`
    );

    corpo.innerHTML = partes.filter(Boolean).join("");
    corpo.scrollTop = 0;
  }

  /** Uma tarefa, com o caso vinculado e a baixa. */
  function cartaoDeAtividade(t) {

    const etiqueta = t.concluida
      ? '<span class="tag ok">concluída</span>'
      : t.atrasada
        ? `<span class="tag perigo">${CW.data(t.quando)}</span>`
        : `<span class="tag neutro">${CW.data(t.quando)}</span>`;

    return `
      <div class="cartao" style="margin-bottom:7px">
        <div class="linha">
          <span class="sub" style="color:var(--texto);font-weight:600">${CW.escapar(t.titulo)}</span>
          ${etiqueta}
        </div>
        <div class="sub" style="margin-top:3px">
          ${CW.escapar(t.tipo ?? "")}${t.hora ? ` · ${CW.escapar(t.hora)}` : ""}${t.responsavel ? ` · ${CW.escapar(t.responsavel)}` : ""}
        </div>
        ${
          t.protocolo
            ? `<div class="sub" style="margin-top:3px">${CW.escapar(t.protocolo)}${t.caso ? ` — ${CW.escapar(t.caso)}` : ""}</div>`
            : ""
        }
        <div class="etapas">
          ${
            t.concluida
              ? `<button class="passo" data-acao="reabrir" data-id="${CW.escapar(t.id)}">reabrir</button>`
              : `<button class="passo" data-acao="concluir" data-id="${CW.escapar(t.id)}">concluir</button>`
          }
          ${
            t.protocolo
              ? `<button class="passo" data-acao="ver" data-protocolo="${CW.escapar(t.protocolo)}">abrir o caso</button>`
              : '<span class="passo vazio">sem caso ligado</span>'
          }
        </div>
      </div>`;
  }

  /** Marcar uma atividade nova, sem sair da aba. */
  function blocoNovaAtividade() {
    return [
      '<div class="bloco">',
      '  <div class="rotulo">Marcar uma atividade</div>',
      '  <div class="cartao">',
      '    <input class="campo" id="dia-tarefa" type="text" style="margin-top:0" placeholder="Ex.: cobrar o time de pagamentos sobre o caso do pixel" />',
      /*
        Data e hora lado a lado.

        A agenda sempre teve a coluna de horário e a tela sempre soube
        mostrá-la — quem marcava pela extensão é que não tinha onde
        digitar, e a tarefa nascia só com o dia. "Ligar amanhã" e
        "ligar amanhã às 9h" são compromissos diferentes, e o segundo é
        o que dá para encaixar entre dois atendimentos.

        A hora é opcional: nem toda pendência tem hora marcada, e
        exigir uma inventaria compromisso que ninguém assumiu.
      */
      '    <div style="display:grid;grid-template-columns:1.2fr .9fr;gap:8px">',
      '      <input class="campo" id="dia-quando" type="date" />',
      '      <input class="campo" id="dia-hora" type="time" title="Opcional — deixe em branco para o dia inteiro" />',
      '    </div>',
      '    <select class="campo" id="dia-tipo">',
      '      <option value="Pendência">Pendência</option>',
      '      <option value="Follow-up">Follow-up</option>',
      '      <option value="Cobrança interna">Cobrança interna</option>',
      '      <option value="Solicitação de avaliação">Solicitação de avaliação</option>',
      '    </select>',
      '    <div class="linha" style="margin-top:9px;align-items:center">',
      '      <span class="sub">Vai para a agenda, sem caso ligado.</span>',
      '      <button class="acao" style="margin-top:0" data-acao="anotar-dia">Marcar</button>',
      '    </div>',
      '    <p class="sub falha" id="dia-erro"></p>',
      '  </div>',
      '</div>',
    ].join("");
  }

  /* ============================================================
     AGENDA
  ============================================================ */

  async function concluirTarefa(botao) {

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "...";

    const resposta = await CW.enviar({
      tipo: "concluirTarefa",
      id: botao.dataset.id,
      concluida: true,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao concluir.",
        "perigo"
      );
      return;
    }

    avisar("Tarefa concluída.", "ok");

    // A tarefa saiu da lista da vista em que estamos, seja qual for.
    recarregarVista();
  }

  /**
   * Desfaz a baixa.
   *
   * A rota sempre soube desfazer (`concluida: false`) — é o que torna o
   * clique em "concluir" seguro. Faltava o botão, e ele só faz sentido
   * numa lista que mostra o que já foi concluído, que é a aba de
   * Atividades.
   */
  async function reabrirTarefa(botao) {

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "...";

    const resposta = await CW.enviar({
      tipo: "concluirTarefa",
      id: botao.dataset.id,
      concluida: false,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao reabrir.",
        "perigo"
      );
      return;
    }

    avisar("Tarefa reaberta.", "ok");

    recarregarVista();
  }

  /**
   * Grava o telefone que a pesquisa não trouxe.
   *
   * O Wootric só manda o número quando o cliente o cadastrou no portal,
   * e em boa parte das respostas ele vem vazio. Sem número, o ciclo não
   * casa com conversa nenhuma do WhatsApp e some do painel justamente
   * quando alguém está falando com a pessoa.
   */
  async function gravarContatoDoNps(botao) {

    const id = botao.dataset.id;

    const campo = corpo.querySelector(
      `#nps-contato-${CSS.escape(id)}`
    );

    const valor = (campo?.value ?? "").trim();

    if (!valor) {
      avisar(
        "Digite o telefone ou o e-mail antes.",
        "atencao"
      );
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "...";

    /**
     * Um campo só para os dois: ter arroba é a diferença. Dois campos
     * numa gaveta de 380 px seria pedir escolha que o texto já entrega.
     */
    const resposta = await CW.enviar({
      tipo: "registrarNps",
      registro: {
        id,
        acao: "contato",
        ...(valor.includes("@")
          ? { email: valor }
          : { telefone: valor }),
      },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao gravar o contato.",
        "perigo"
      );
      return;
    }

    avisar(
      "Contato gravado — agora este ciclo casa com a conversa.",
      "ok"
    );

    recarregarVista();
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
  /** As etapas do quadro, venham do contato ou da fila. */
  function etapasDoQuadro() {
    return (
      filaAtual?.etapas ??
      ultimoDado?.etapas ??
      []
    );
  }

  function vizinha(status, direcao) {

    const etapas = etapasDoQuadro();

    const i = etapas.indexOf(status);

    if (i < 0) return "";

    const alvo = direcao === "avancar" ? i + 1 : i - 1;

    return alvo >= 0 && alvo < etapas.length
      ? etapas[alvo]
      : "";
  }

  /**
   * Quem pode gravar, na vista que estiver aberta.
   *
   * Na fila não há resposta de contexto — o papel vem do que a última
   * consulta trouxe, e na falta dela o painel oferece: o servidor
   * recusa `LEITURA` de qualquer jeito, e esconder o botão por falta de
   * informação seria pior do que mostrá-lo e receber a recusa.
   */
  function podeMover() {
    return (
      !ultimoDado?.usuario ||
      ultimoDado.usuario.papel !== "LEITURA"
    );
  }

  /**
   * Os controles de etapa de um caso.
   *
   * Dois botões para o passo vizinho **e** um seletor para qualquer
   * etapa: um caso costuma pular colunas — quem respondeu e já resolveu
   * não passa por "Em atendimento" só para chegar em "Resolvido", e
   * obrigar dois cliques para isso fazia o botão atrapalhar.
   */
  function botoesDeEtapa(caso) {

    if (!podeMover()) return "";

    const etapas = etapasDoQuadro();

    if (etapas.length === 0) return "";

    const antes = vizinha(caso.status, "voltar");
    const depois = vizinha(caso.status, "avancar");

    return [
      '<div class="etapas">',
      antes
        ? `<button class="passo" data-acao="mover" data-protocolo="${CW.escapar(caso.protocolo)}" data-direcao="voltar" title="Voltar para ${CW.escapar(antes)}">&larr; ${CW.escapar(antes)}</button>`
        : '<span class="passo vazio">início do fluxo</span>',
      depois
        ? `<button class="passo" data-acao="mover" data-protocolo="${CW.escapar(caso.protocolo)}" data-direcao="avancar" title="Avançar para ${CW.escapar(depois)}">${CW.escapar(depois)} &rarr;</button>`
        : '<span class="passo vazio">fim do fluxo</span>',
      '</div>',
      `<select class="campo etapa-direta" data-acao="mover-para" data-protocolo="${CW.escapar(caso.protocolo)}" title="Mover para qualquer etapa">`,
      `  <option value="">mover para…</option>`,
      ...etapas
        .filter((nome) => nome !== caso.status)
        .map(
          (nome) =>
            `  <option value="${CW.escapar(nome)}">${CW.escapar(nome)}</option>`
        ),
      '</select>',
    ].join("");
  }

  async function moverCaso(botao, para) {

    const rotulo = botao.textContent;

    if (!para) {
      botao.disabled = true;
      botao.textContent = "...";
    }

    const resposta = await CW.enviar({
      tipo: "moverCaso",
      protocolo: botao.dataset.protocolo,
      direcao: botao.dataset.direcao,
      para,
    });

    if (!para) {
      botao.disabled = false;
      botao.textContent = rotulo;
    }

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

    recarregarVista();
  }

  /**
   * Recarrega o que está na tela, e não sempre o contato.
   *
   * O botão de atualizar chamava `consultar(true)` direto — e
   * `consultar` sai cedo quando a vista não é a de contato. O resultado
   * era o pior possível: numa aba de canal ou no detalhe, o botão de
   * atualizar não fazia **nada**, sem dizer por quê.
   */
  function recarregarVista(naMao = false) {

    if (vista === "fila") return carregarFila();
    if (vista === "painel") return carregarPainel();
    if (vista === "atividades") {
      return carregarAtividades();
    }

    if (vista === "caso") {
      return detalhe
        ? abrirDetalhe(detalhe.protocolo)
        : voltarAoContato();
    }

    consultar(true);

    void naMao;
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

    recarregarVista();
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
   * Dele, **só o documento é gravado** — CPF ou CNPJ. É o único campo
   * que casa com algo daqui: o cadastro de estabelecimentos guarda o
   * mesmo número, e a reclamação passa a guardar também, o que monta o
   * vínculo sem ninguém escolher na mão. O e-mail de acesso e o nome do
   * proprietário continuam só na tela: não há onde gravá-los sem
   * inventar cadastro.
   *
   * Casar por nome não funcionaria: o export do Reclame Aqui grava o
   * reclamante no lugar da empresa, então o nome da reclamação é o do
   * consumidor.
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
      captura.documento
        ? `  <p class="sub" style="margin-bottom:8px">O Reclame Aqui coleta isto antes de publicar. O <strong>CPF/CNPJ</strong> é gravado no caso e vincula ao estabelecimento; o restante fica só aqui, para análise.</p>`
        : '  <p class="sub" style="margin-bottom:8px">O Reclame Aqui coleta isto antes de publicar. <strong>Não é gravado</strong> — está aqui para análise.</p>',
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

    /**
     * O documento não é campo do formulário, então vai por fora.
     *
     * Ele não é editável de propósito: é identificador, não descrição.
     * Um dígito trocado à mão não daria erro — daria vínculo com o
     * restaurante errado, que é pior do que vínculo nenhum.
     */
    const resposta = await CW.enviar({
      tipo: "criarCaso",
      caso: {
        ...dados,
        documento: captura?.documento ?? "",

        /**
         * O COD vai junto e vira o protocolo no servidor.
         *
         * É o identificador que o export do portal também traz; o número
         * do "ID:" não aparece lá. Sem mandá-lo, a reclamação capturada
         * aqui e a mesma reclamação vinda da planilha entrariam como
         * dois casos.
         */
        cod: captura?.cod ?? "",
      },
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

    /** Reanexa o painel se a página o tiver removido — ou quebrado. */
    garantir() {

      if (montado()) {

        /**
         * A página pode ter trocado a árvore por baixo do empurrão.
         *
         * O WhatsApp Web recria o `#app` em algumas navegações, e o
         * elemento novo nasce com a largura da viewport inteira — a
         * gaveta voltaria a cobrir a conversa sem ninguém ter mexido
         * em nada.
         */
        if (aberto) empurrarPagina(true);

        return;
      }

      hospedeiro?.remove();
      hospedeiro = null;
      raiz = null;

      montar();
    },
  };
})();
