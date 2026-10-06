/**
 * A base do painel — parte do painel da extensão.
 *
 * O painel era um arquivo só, de 6.797 linhas. Virou sete, um por
 * tela, carregados na ordem do manifesto e vivendo no mesmo mundo
 * isolado do navegador. O que um arquivo precisa do outro passa por
 * `P`, o objeto que `painel-base.js` cria: é a lista explícita do que
 * atravessa a fronteira, e o que não está nela é local de verdade.
 *
 * A divisão foi feita com parser e aplicada por deslocamento no texto:
 * nenhuma linha mudou de conteúdo além do endereço desses nomes.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || CW.painel) return;

  /** O que o painel compartilha entre os seus sete arquivos. */
  const P = (window.__cwPainel = {});


  const MARCA = `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5"
        stroke="currentColor" stroke-width="2"/>
  <circle cx="12" cy="10.8" r="3.5" fill="#F9A11B"/>
  <path d="M7.4 16.5c1.2 1.3 2.8 2 4.6 2s3.4-.7 4.6-2"
        stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round"/>
</svg>`;

  P.hospedeiro = null;
  P.raiz = null;
  let gaveta = null;
  P.corpo = null;
  P.selo = null;
  P.campoBusca = null;
  let linhaQuem = null;

  P.aberto = false;
  P.config = {
    autoAbrir: false,
    tema: "auto",
    largura: 380,
  };

  /** Reclamação lida da página, esperando confirmação para virar caso. */
  P.captura = null;

  /**
   * Como reler a página sob demanda.
   *
   * Só o `hugme.js` fornece. Existe porque o bloco de informações
   * adicionais do Reclame Aqui nasce recolhido, e expandir não muda o
   * endereço — que é a chave que dispara a leitura automática.
   */
  P.releitor = null;

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
  P.diagnostico = null;

  /**
   * Como ler a conversa aberta, quando o site sabe fazer isso.
   *
   * Só o WhatsApp fornece. Fica como função, e não como dado, de
   * propósito: a leitura acontece no clique — o painel nunca segura o
   * texto de uma conversa que ninguém pediu para resumir.
   */
  P.lerConversa = null;

  /** Último resumo pedido nesta conversa. */
  P.resumo = null;

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
  P.autoPermitido = false;

  /**
   * Fechou na mão? Não reabre sozinho.
   *
   * Vale até o contato realmente mudar. Sem esta trava, fechar o painel
   * era inútil: a próxima leitura do detector o trazia de volta.
   */
  P.fechadoNaMao = false;

  /** Consulta corrente e a chave que evita repetir a mesma busca. */
  P.consulta = null;
  P.chaveConsulta = "";
  P.ultimoDado = null;

  /**
   * "Guardar a conversa": null (o botão), { confirmar: n } (a pergunta,
   * com quantas mensagens vão), "gravando", ou o resultado do servidor.
   * Volta ao começo quando o contato muda.
   */
  P.guardarConversa = null;

  /**
   * Canal escolhido no rodapé: "todos", "reclame-aqui", "nps", "social".
   *
   * Entra na chave da consulta — trocar de aba tem de refazer a busca,
   * senão o painel mostraria o recorte anterior sob o rótulo novo.
   */
  P.canal = "todos";

  /**
   * O que o corpo está mostrando: "contato", "fila" ou "painel".
   *
   * Sem isto, `consultar()` do detector de página sobrescreveria a fila
   * que a pessoa acabou de abrir — o WhatsApp troca de conversa sozinho
   * e o painel voltaria ao contato no meio da leitura.
   */
  P.vista = "contato";

  /**
   * Na aba de um canal, mostrar só os casos deste cliente.
   *
   * Ligado por padrão quando há contato identificado: quem abre a aba
   * do Reclame Aqui **com uma conversa na tela** quer o histórico
   * daquela pessoa naquele canal, não a fila da operação inteira. Sem
   * contato, não há o que restringir e a fila aparece cheia.
   */
  P.soDoCliente = true;

  /** Filtros da fila: etapa (casos) e segmento (NPS). */
  P.etapaFiltro = "";
  P.segmentoFiltro = "";

  /**
   * Recorte vindo dos contadores do painel do dia.
   *
   * "", "sem-resposta", "replicas" ou "risco". Os quatro números do
   * painel eram leitura morta — mostravam "4 sem resposta" e a pergunta
   * seguinte, "quais?", só tinha resposta abrindo a aplicação.
   */
  P.recorteFiltro = "";

  /**
   * A vista de caso veio de uma lista?
   *
   * É o que o botão "voltar" precisa saber. Antes a pergunta era `canal
   * === "todos"`, que passou a significar outra coisa quando os
   * contadores do painel ganharam fila própria.
   */
  P.veioDaFila = false;

  /** A vista de onde o caso foi aberto — "fila", "atividades"... */
  P.vistaAnterior = "contato";

  /**
   * Recorte da aba de Atividades: "", "proximos" ou "concluidas".
   *
   * Vazio é o que está vencendo — hoje e o atrasado junto. Uma agenda
   * que só mostra "hoje" esconde exatamente o que não foi feito ontem.
   */
  P.escopoAtividades = "";

  /** Caso aberto para leitura dentro do painel. */
  P.detalhe = null;

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
  P.montado = function montado() {
    return Boolean(
      P.hospedeiro &&
        document.documentElement.contains(P.hospedeiro) &&
        P.raiz &&
        P.hospedeiro.shadowRoot?.contains(P.raiz) &&
        P.raiz.querySelector(".gatilho")
    );
  };

  P.montar = function montar() {

    if (P.montado()) return;

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

    P.hospedeiro = document.createElement("div");

    P.hospedeiro.id = "cw-reputacao-painel";

    // No documentElement, e não no body: o WhatsApp Web troca o
    // conteúdo do body em navegações internas.
    document.documentElement.appendChild(P.hospedeiro);

    const shadow = P.hospedeiro.attachShadow({ mode: "open" });

    const estilo = document.createElement("style");
    estilo.textContent = CW.CSS;
    shadow.appendChild(estilo);

    P.raiz = document.createElement("div");
    P.raiz.className = "raiz";

    P.raiz.innerHTML = `
      <button class="gatilho" title="CW Reputação" type="button">
        <span style="color:#fff;display:grid;place-items:center">${MARCA}</span>
        <span class="selo"></span>
      </button>

      <aside class="gaveta" tabindex="-1">
        <div class="punho" title="Arraste para redimensionar"></div>
        <header class="topo">
          <span class="topo-marca">${MARCA}</span>
          <span class="topo-texto">
            <span class="titulo">CW Reputação</span>
            <span class="quem">verificando conexão…</span>
          </span>
          <span class="espaco"></span>
          <button class="icone-botao" data-acao="recarregar"
                  title="Consultar de novo" type="button">${CW.icone("recarregar")}</button>
          <button class="icone-botao" data-acao="menu" aria-haspopup="menu"
                  aria-expanded="false" title="Mais opções" type="button">${CW.icone("mais")}</button>
          <button class="icone-botao" data-acao="fechar"
                  title="Fechar (Esc)" type="button">${CW.icone("fechar")}</button>
        </header>

        <!--
          O menu do cabeçalho (1.135).

          Fixar, tema, voltar à lateral, abrir sozinho, botão no canto,
          atalhos e opções moravam espalhados entre o cabeçalho (com
          emoji) e um rodapé próprio que tomava uma linha inteira da
          gaveta. Aqui ficam juntos, a um clique, e a gaveta ganha altura
          para o que importa.
        -->
        <div class="menu-painel" role="menu" hidden>
          <button type="button" role="menuitemcheckbox" data-acao="fixar" aria-checked="false">
            ${CW.icone("fixar")}<span>Manter aberto</span><span class="menu-estado"></span>
          </button>
          <button type="button" role="menuitem" data-acao="tema">
            ${CW.icone("tema")}<span>Tema</span><span class="menu-estado" data-estado="tema">automático</span>
          </button>
          <label class="auto" role="menuitemcheckbox" title="Abrir o painel sozinho ao trocar de conversa (só no WhatsApp Web)">
            ${CW.icone("abrir")}<span>Abrir sozinho na conversa</span>
            <input type="checkbox" data-acao="auto" />
          </label>
          <button type="button" role="menuitem" data-acao="ancorar" style="display:none">
            ${CW.icone("lateral")}<span>Voltar para a lateral</span>
          </button>
          <button type="button" role="menuitem" data-acao="botao-no-canto" hidden>
            ${CW.icone("canto")}<span>Botão redondo no canto</span>
          </button>
          <hr />
          <button type="button" role="menuitem" data-acao="atalhos">
            ${CW.icone("teclado")}<span>Atalhos</span><span class="menu-estado"><kbd>?</kbd></span>
          </button>
          <button type="button" role="menuitem" data-acao="opcoes">
            ${CW.icone("opcoes")}<span>Opções da extensão</span>
          </button>
        </div>

        <div class="busca">
          <span class="busca-icone">${CW.icone("buscar", 15)}</span>
          <input type="text" placeholder="Telefone, nome ou protocolo  /"
                 spellcheck="false" aria-label="Buscar cliente" />
          <button type="button" data-acao="buscar">Buscar</button>
        </div>

        <div class="corpo"></div>

        <p class="ajuda-atalhos" hidden>
          <kbd>/</kbd> busca · <kbd>1</kbd>–<kbd>6</kbd> abas · <kbd>Esc</kbd> fecha ·
          <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> abre de qualquer tela
        </p>

        <!--
          A barra de abas, com ícone (1.135).

          "Cliente" é a conversa aberta. Até a 1.134 não havia aba para
          ela: o contato era o que sobrava quando nenhuma aba estava
          marcada, e voltar dependia de clicar de novo na aba ativa — um
          gesto que ninguém adivinha.

          Os canais não são a mesma fila, e o NPS é o motivo: a pesquisa
          fala com o cliente por um WhatsApp próprio, então uma conversa
          aberta ali não casa com reclamação nenhuma do Reclame Aqui.
        -->
        <nav class="canais" aria-label="Telas do painel">
          <button type="button" data-acao="canal" data-canal="contato"
                  aria-pressed="false" title="A conversa aberta (1)">${CW.icone("cliente", 17)}<span>Cliente</span></button>
          <button type="button" data-acao="canal" data-canal="reclame-aqui"
                  aria-pressed="false" title="Reclame Aqui (2)">${CW.icone("ra", 17)}<span>RA</span><i class="conta" hidden></i></button>
          <button type="button" data-acao="canal" data-canal="nps"
                  aria-pressed="false" title="NPS (3)">${CW.icone("nps", 17)}<span>NPS</span><i class="conta" hidden></i></button>
          <button type="button" data-acao="canal" data-canal="social"
                  aria-pressed="false" title="Redes Sociais (4)">${CW.icone("redes", 17)}<span>Redes</span></button>
          <button type="button" data-acao="canal" data-canal="painel"
                  aria-pressed="false" title="Nota, contadores e alertas do dia (5)">${CW.icone("painel", 17)}<span>Painel</span></button>
          <button type="button" data-acao="canal" data-canal="atividades"
                  aria-pressed="false" title="O que está marcado: hoje, atrasado e o que vem (6)">${CW.icone("agenda", 17)}<span>Agenda</span><i class="conta" hidden></i></button>
        </nav>
      </aside>`;

    shadow.appendChild(P.raiz);

    /**
     * Gaveta nova nasce fechada — e o estado tem de saber disso.
     *
     * `aberto` é variável de módulo e sobrevive à remontagem que a
     * página provoca ao trocar a árvore. Ficando `true` sobre uma
     * gaveta recém-criada (que não tem a classe `aberta`), o primeiro
     * clique no botão chamava `fechar()` de uma coisa já fechada: nada
     * acontecia, e só o segundo clique abria.
     */
    P.aberto = false;

    gaveta = P.raiz.querySelector(".gaveta");
    P.corpo = P.raiz.querySelector(".corpo");
    P.selo = P.raiz.querySelector(".selo");
    P.campoBusca = P.raiz.querySelector(".busca input");
    linhaQuem = P.raiz.querySelector(".quem");

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
    P.raiz
      .querySelector(".gatilho")
      ?.addEventListener("click", () => {
        /* O clique que fecha um arrasto não abre nem fecha o painel. */
        if (botaoAcabouDeArrastar) {
          botaoAcabouDeArrastar = false;
          return;
        }
        alternar();
      });

    P.raiz.addEventListener("click", (evento) => {

      /* Clicou fora do menu aberto: ele fecha, como todo menu. */
      if (!evento.target.closest(".menu-painel, [data-acao='menu']")) {
        alternarMenu(false);
      }

      const alvo = evento.target.closest("[data-acao]");

      if (!alvo) return;

      const acao = alvo.dataset.acao;

      /*
        O menu do cabeçalho: abre e fecha no próprio botão, e qualquer
        escolha dentro dele o fecha — menos o tema, que se escolhe
        clicando até chegar no que se quer, e o interruptor de abrir
        sozinho, que é uma caixa de marcar.
      */
      if (acao === "menu") {
        alternarMenu();
        return;
      }
      if (alvo.closest(".menu-painel") && acao !== "tema" && acao !== "auto") {
        alternarMenu(false);
      }

      if (acao === "fechar") P.fechar();
      if (acao === "recarregar") P.recarregarVista(true);
      if (acao === "buscar") P.buscarManual();
      if (acao === "opcoes") CW.enviar({ tipo: "opcoes" });
      if (acao === "tema") girarTema();
      if (acao === "auto") alternarAuto(alvo.checked);
      if (acao === "fixar") alternarFixado();
      if (acao === "ancorar") ancorar();
      if (acao === "botao-no-canto") botaoNoCanto();
      if (acao === "tom") P.trocarTom(alvo);
      if (acao === "copiar-tom") P.copiarTom(alvo);
      if (acao === "registrar-impacto") P.registrarImpacto(alvo);
      if (acao === "capturar") P.abrirCaptura();
      if (acao === "atalhos") alternarAjudaDosAtalhos();
      if (acao === "completar-conversa") P.completarPelaConversa(alvo);
      if (acao === "aba-contato") P.trocarAbaDoContato(alvo);
      if (acao === "salvar-edicao-caso") P.salvarEdicaoDoCaso?.(alvo);
      if (acao === "copiloto-de-novo") P.pedirCopiloto?.(true);
      if (acao === "pausar-guardar") P.alternarPausaDeGuardar();
      if (acao === "vincular") P.vincularContato(alvo);
      if (acao === "desvincular") P.desvincularContato();
      if (acao === "cadastrar-canal") P.cadastrarNesteCanal();
      if (acao === "anotar-caso") P.anotarCaso(alvo);
      if (acao === "acao-rapida") P.alternarAcaoRapida?.(alvo);
      if (acao === "anotar-tarefa") P.anotarTarefa(alvo);
      if (acao === "cancelar-captura") {
        P.captura = null;
        P.consultar(false);
      }
      if (acao === "criar-caso") P.criarCaso(alvo);
      if (acao === "reler") P.reler();
      if (acao === "canal") P.trocarCanal(alvo);
      if (acao === "ver") P.abrirDetalhe(alvo.dataset.protocolo);
      if (acao === "voltar-da-vista") P.voltarDaVista();
      if (acao === "anotar-detalhe") P.anotarNoDetalhe(alvo);
      if (acao === "anotar-dia") P.anotarODia(alvo);
      if (acao === "triar") P.triarCaso(alvo);
      if (acao === "concluir") P.concluirTarefa(alvo);
      if (acao === "nps-contato") P.gravarContatoDoNps(alvo);
      if (acao === "wpp-frente") P.gravarWhatsappDaFrente(alvo);
      if (acao === "anotar-nps") P.anotarNoNps(alvo);

      if (acao === "fila-recorte") {
        P.abrirRecorte(alvo.dataset.recorte ?? "");
      }

      if (acao === "recorte") {
        P.recorteFiltro = alvo.dataset.valor ?? "";
        P.etapaFiltro = "";
        P.carregarFila();
      }

      if (acao === "escopo-atividade") {
        P.escopoAtividades = alvo.dataset.valor ?? "";

        /*
          Sair da fila e voltar relê do servidor.

          O que a lista mostra é o que **ainda** falta: guardar a
          resposta entre idas e vindas mostraria como pendente o caso
          que a pessoa acabou de responder. A leitura do modelo cai
          junto, porque ela descreve aquela fila e não a de agora.
        */
        P.pendencias = null;
        P.resumoDasPendencias = null;

        P.carregarAtividades();
      }

      if (acao === "reabrir") P.reabrirTarefa(alvo);

      if (acao === "escopo") {
        P.soDoCliente = alvo.dataset.valor === "cliente";
        P.carregarFila();
      }

      if (acao === "etapa") {
        P.etapaFiltro = alvo.dataset.valor;
        P.carregarFila();
      }

      if (acao === "segmento") {
        P.segmentoFiltro = alvo.dataset.valor;
        P.carregarFila();
      }

      // Avançar e voltar etapa, nos três canais.
      if (acao === "mover") P.moverCaso(alvo);
      if (acao === "nps-mover") P.moverNps(alvo);

      if (acao === "diagnostico") {
        P.copiar(
          alvo,
          [
            `# ${location.href}`,
            "",
            (P.diagnostico?.() ?? "").slice(0, 8000),
          ].join("\n")
        );
      }
      if (acao === "resumir") P.resumirConversa(alvo);
      if (acao === "resumir-caso") P.resumirCaso(alvo);

      if (acao === "tratativa") P.registrarTratativa(alvo);
      if (acao === "guardar-conversa") P.confirmarGuardarConversa();
      if (acao === "guardar-conversa-sim") P.executarGuardarConversa();
      if (acao === "guardar-conversa-nao") {
        P.guardarConversa = null;
        P.redesenharComResumo();
      }
      if (acao === "abrir-url" && /^https?:\/\//.test(alvo.dataset.url ?? "")) {
        CW.enviar({ tipo: "abrir", url: alvo.dataset.url });
      }

      if (acao === "resumir-pendencias") {
        P.resumirPendencias(alvo);
      }

      /*
        Recolher e reabrir só mexem no estado e redesenham.

        Nada vai ao servidor: o conteúdo já está em memória, e é essa a
        razão de o botão existir — reler custaria quinze segundos e uma
        chamada ao modelo para ver de novo o que já foi montado.
      */
      if (acao === "salvar-dossie") {
        P.guardarDossie(alvo);
      }

      if (acao === "recolher-dossie") {
        P.dossieRecolhido = true;
        P.recarregarVista();
      }

      if (acao === "expandir-dossie") {
        P.dossieRecolhido = false;
        P.recarregarVista();
      }

      if (acao === "recolher-resumo") {
        P.resumoRecolhido = true;
        P.recarregarVista();
      }

      if (acao === "expandir-resumo") {
        P.resumoRecolhido = false;
        P.recarregarVista();
      }

      // NPS: as duas escritas da tratativa, e os botões que as compõem.
      if (
        acao === "nps-humor" ||
        acao === "nps-resolvido"
      ) {
        P.alternarEscolha(alvo);
      }

      if (acao === "nps-registrar") {
        P.registrarNps(alvo, "pos-contato");
      }

      if (acao === "nps-tentativa") {
        P.registrarNps(alvo, "tentativa");
      }

      if (acao === "abrir") {
        CW.enviar({ tipo: "abrir", url: alvo.dataset.url });
      }

      /* A pergunta ao assistente sobre o cliente aberto (1.125). */
      if (acao === "perguntar-assistente") {
        P.perguntarAoAssistente?.(alvo);
      }

      /* Uma tela da plataforma pelo caminho, no endereço configurado (o dossiê do caso, por exemplo). */
      if (acao === "abrir-na-plataforma") {
        CW.enviar({ tipo: "abrirNaPlataforma", caminho: alvo.dataset.caminho ?? "/" });
      }

      if (acao === "copiar") {
        P.copiar(alvo, alvo.dataset.texto ?? "");
      }

      /* Um formulário recolhido atrás do botão: o botão abre e fecha o que vem logo depois dele. */
      if (acao === "alternar-proximo") {
        const alvoDoBotao = alvo.nextElementSibling;
        if (alvoDoBotao) {
          alvoDoBotao.hidden = !alvoDoBotao.hidden;
          alvo.setAttribute("aria-expanded", String(!alvoDoBotao.hidden));
          if (!alvoDoBotao.hidden) alvoDoBotao.querySelector("input, textarea")?.focus();
        }
      }

      /* Texto longo recolhido (o relato): o botão logo depois da caixa abre e fecha. */
      if (acao === "alternar-recolhido") {
        const caixa = alvo.previousElementSibling;
        if (caixa) {
          const recolhido = caixa.classList.toggle("recolhido");
          alvo.textContent = recolhido ? "ler o relato inteiro" : "recolher";
        }
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
    /* Enter no campo da pergunta ao assistente pergunta (Shift+Enter quebra a linha). */
    P.raiz.addEventListener("keydown", (evento) => {
      if (evento.target?.dataset?.acao === "pergunta-assistente-campo" && evento.key === "Enter" && !evento.shiftKey) {
        evento.preventDefault();
        P.perguntarAoAssistente?.(evento.target);
      }
    });

    P.raiz.addEventListener("change", (evento) => {

      /* A subcategoria segue a categoria no formulário do caso (1.127). */
      if (evento.target?.dataset?.campoCaso === "categoria") {
        P.atualizarSubcategorias?.(evento.target);
        return;
      }

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
          P.moverCaso(evento.target, destino);
        }

        return;
      }

      /**
       * A transcrição do Crisp, lida do arquivo escolhido.
       *
       * Lida aqui e não na hora do clique porque `file.text()` é
       * assíncrono: se a leitura começasse junto com o pedido do
       * dossiê, o pedido sairia com a transcrição pela metade em
       * arquivo grande. Lendo na escolha, quando o botão for clicado o
       * texto já está inteiro na memória.
       */
      if (evento.target?.id === "dossie-arquivo") {

        const aviso = P.corpo.querySelector(
          "#dossie-arquivo-info"
        );

        const arquivo = evento.target.files?.[0];

        if (!arquivo) {
          P.transcricaoImportada = null;
          if (aviso) {
            aviso.textContent =
              "Nenhum arquivo escolhido.";
          }
          return;
        }

        if (aviso) {
          aviso.textContent = "Lendo o arquivo…";
        }

        arquivo
          .text()
          .then((texto) => {

            P.transcricaoImportada = {
              nome: arquivo.name,
              texto,
            };

            if (aviso) {
              aviso.textContent =
                arquivo.name +
                " · " +
                texto.length.toLocaleString("pt-BR") +
                " caracteres. Entra no próximo dossiê.";
            }
          })
          .catch(() => {

            P.transcricaoImportada = null;

            if (aviso) {
              aviso.textContent =
                "Não deu para ler este arquivo. Ele precisa ser texto — o .txt que o Crisp exporta.";
            }
          });

        return;
      }

      if (evento.target?.id !== "cap-categoria") return;

      const seletor = P.corpo.querySelector(
        "#cap-subcategoria"
      );

      if (seletor) {
        seletor.innerHTML = P.opcoesDeSubcategoria(
          evento.target.value
        );
      }
    });

    P.campoBusca.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") P.buscarManual();
      // O WhatsApp captura teclas globalmente; sem isto, digitar no
      // campo dispara atalhos dele.
      evento.stopPropagation();
    });

    P.campoBusca.addEventListener("keyup", (e) =>
      e.stopPropagation()
    );

    /*
      O mesmo para as caixas de texto do painel (a resposta em três tons,
      a nota do caso, o valor do impacto): o que se digita ali não pode
      virar atalho do WhatsApp nem do HugMe.
    */
    for (const tipo of ["keydown", "keyup", "keypress"]) {
      P.raiz.addEventListener(tipo, (evento) => {
        const campo = evento.composedPath()[0]?.tagName;
        if (campo === "TEXTAREA" || campo === "INPUT") evento.stopPropagation();
      });
    }

    ligarAtalhos();
    ligarRedimensionamento();
    ligarArrasto();
    ligarArrastoDoBotao();

    P.refletirCanal();

    // A fonte é registrada no documento — @font-face não vale no shadow.
    CW.registrarFonte?.();

    P.vazio(
      "Nenhum contato identificado",
      "Abra uma conversa ou use a busca acima."
    );

    identificar();
  };

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
    if (P.raiz) {
      P.raiz.dataset.tema = TEMAS.includes(tema)
        ? tema
        : "auto";
      const estado = P.raiz.querySelector('[data-estado="tema"]');
      if (estado) estado.textContent = ROTULO_CURTO_DO_TEMA[P.raiz.dataset.tema];
    }
  }

  const ROTULO_CURTO_DO_TEMA = { auto: "automático", claro: "claro", escuro: "escuro" };

  /* ---------- o menu do cabeçalho ---------- */

  function alternarMenu(abrir) {
    const menu = P.raiz?.querySelector(".menu-painel");
    const botao = P.raiz?.querySelector('[data-acao="menu"]');
    if (!menu) return;
    const vaiAbrir = abrir ?? menu.hidden;
    menu.hidden = !vaiAbrir;
    botao?.setAttribute("aria-expanded", String(vaiAbrir));
    if (vaiAbrir) menu.querySelector("button:not([hidden])")?.focus({ preventScroll: true });
  }

  P.fecharMenu = () => alternarMenu(false);

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

    P.config.fixado = !P.config.fixado;

    if (P.config.fixado) {
      P.fechadoNaMao = false;
      P.abrir();
    }

    refletirFixado();

    CW.enviar({
      tipo: "salvar",
      parcial: { fixado: P.config.fixado },
    });
  }

  function refletirFixado() {

    const botao = P.raiz?.querySelector(
      '[data-acao="fixar"]'
    );

    if (!botao) return;

    botao.setAttribute("aria-checked", String(Boolean(P.config.fixado)));

    const estado = botao.querySelector(".menu-estado");
    if (estado) estado.innerHTML = P.config.fixado ? CW.icone("ok", 14) : "";

    botao.title = P.config.fixado
      ? "Fixado — não minimiza sozinho. Clique para soltar."
      : "Manter aberto (não minimizar sozinho)";
  }

  function aplicarPosicao(posicao) {

    if (!gaveta) return;

    const botaoAncorar = P.raiz?.querySelector(
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
    const largura = P.config.largura || 380;

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

  /* ---------- o botão redondo, arrastável (Fase 28) ---------- */

  /** Tamanho do botão, para prendê-lo dentro da janela. */
  const TAMANHO_DO_BOTAO = 48;

  let botaoAcabouDeArrastar = false;

  const siteAtual = () => location.hostname || "local";

  /** Prende a posição à janela: um botão fora da tela não teria como voltar. */
  function presoNaJanela(pos) {
    return {
      x: Math.round(Math.min(Math.max(Number(pos.x) || 0, 4), Math.max(window.innerWidth - TAMANHO_DO_BOTAO - 4, 4))),
      y: Math.round(Math.min(Math.max(Number(pos.y) || 0, 4), Math.max(window.innerHeight - TAMANHO_DO_BOTAO - 4, 4))),
    };
  }

  function desenharBotao(pos) {
    const botao = P.raiz?.querySelector(".gatilho");
    const voltar = P.raiz?.querySelector('[data-acao="botao-no-canto"]');
    if (!botao) return;
    if (!pos) {
      botao.classList.remove("movido");
      if (voltar) voltar.hidden = true;
      return;
    }
    botao.style.setProperty("--bx", `${pos.x}px`);
    botao.style.setProperty("--by", `${pos.y}px`);
    botao.classList.add("movido");
    if (voltar) voltar.hidden = false;
  }

  /** A posição deste site, presa à janela de agora. */
  function aplicarPosicaoDoBotao() {
    const guardada = P.config?.botaoPorSite?.[siteAtual()];
    desenharBotao(guardada ? presoNaJanela(guardada) : null);
  }

  function gravarPosicaoDoBotao(pos) {
    const mapa = { ...(P.config?.botaoPorSite ?? {}) };
    if (pos) mapa[siteAtual()] = pos;
    else delete mapa[siteAtual()];
    P.config = { ...(P.config ?? {}), botaoPorSite: mapa };
    CW.enviar({ tipo: "salvar", parcial: { botaoPorSite: mapa } });
  }

  function botaoNoCanto() {
    desenharBotao(null);
    gravarPosicaoDoBotao(null);
  }

  /**
   * Arrastar o botão para qualquer canto.
   *
   * O mesmo cuidado da gaveta: só vira arrasto depois de a mão andar
   * alguns pixels — um clique trêmulo continua abrindo o painel. Soltou,
   * a posição fica gravada para este site.
   */
  function ligarArrastoDoBotao() {
    const botao = P.raiz?.querySelector(".gatilho");
    if (!botao) return;

    const LIMIAR = 6;
    let apertado = false;
    let moveu = false;
    let inicioX = 0;
    let inicioY = 0;
    let deltaX = 0;
    let deltaY = 0;

    botao.addEventListener("pointerdown", (evento) => {
      if (evento.button !== 0) return;
      const caixa = botao.getBoundingClientRect();
      deltaX = evento.clientX - caixa.left;
      deltaY = evento.clientY - caixa.top;
      inicioX = evento.clientX;
      inicioY = evento.clientY;
      apertado = true;
      moveu = false;
      botao.setPointerCapture(evento.pointerId);
    });

    botao.addEventListener("pointermove", (evento) => {
      if (!apertado) return;
      if (!moveu) {
        if (Math.abs(evento.clientX - inicioX) + Math.abs(evento.clientY - inicioY) < LIMIAR) return;
        moveu = true;
        botao.classList.add("arrastando");
      }
      desenharBotao(presoNaJanela({ x: evento.clientX - deltaX, y: evento.clientY - deltaY }));
    });

    const soltar = (evento) => {
      if (!apertado) return;
      apertado = false;
      botao.classList.remove("arrastando");
      try {
        botao.releasePointerCapture(evento.pointerId);
      } catch {
        // Já liberado.
      }
      if (!moveu) return;
      botaoAcabouDeArrastar = true;
      /* Alguns navegadores não mandam o clique depois do arrasto: a trava não pode ficar para o próximo clique de verdade. */
      setTimeout(() => (botaoAcabouDeArrastar = false), 300);
      const pos = presoNaJanela({ x: evento.clientX - deltaX, y: evento.clientY - deltaY });
      desenharBotao(pos);
      gravarPosicaoDoBotao(pos);
    };

    botao.addEventListener("pointerup", soltar);
    botao.addEventListener("pointercancel", soltar);

    window.addEventListener("resize", CW.debounce(aplicarPosicaoDoBotao, 200));
  }

  /** Volta a gaveta para a lateral direita. */
  function ancorar() {

    P.config.posicao = null;
    aplicarPosicao(null);

    // Ancorou: volta a empurrar, se a gaveta estiver aberta.
    P.empurrarPagina(P.aberto);

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

    const topo = P.raiz.querySelector(".topo");

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

      P.config.posicao = posicao ?? null;

      CW.enviar({
        tipo: "salvar",
        parcial: { posicao: P.config.posicao },
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

        if (!P.config.posicao) return;

        const posicao = aplicarPosicao(P.config.posicao);

        if (
          posicao &&
          (posicao.x !== P.config.posicao.x ||
            posicao.y !== P.config.posicao.y)
        ) {
          P.config.posicao = posicao;
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

    P.config.autoAbrir = Boolean(ligado);

    if (!ligado) P.fechadoNaMao = true;

    CW.enviar({
      tipo: "salvar",
      parcial: { autoAbrir: P.config.autoAbrir },
    });
  }

  P.refletirAuto = function refletirAuto() {

    const caixa = P.raiz?.querySelector(
      '[data-acao="auto"]'
    );

    if (caixa) caixa.checked = Boolean(P.config.autoAbrir);

    const rodape = P.raiz?.querySelector(".auto");

    /**
     * Fora do WhatsApp o painel nunca abre sozinho, então oferecer o
     * interruptor ali seria prometer um comportamento que não existe.
     */
    if (rodape) {
      rodape.style.display = P.autoPermitido ? "" : "none";
    }
  };

  function girarTema() {

    const atual = P.raiz?.dataset.tema ?? "auto";

    const proximo =
      TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length];

    aplicarTema(proximo);

    P.config.tema = proximo;

    CW.enviar({
      tipo: "salvar",
      parcial: { tema: proximo },
    });

    const botao = P.raiz?.querySelector(
      '[data-acao="tema"]'
    );

    if (botao) {
      botao.title = `Tema: ${ROTULO_TEMA[proximo]}`;
    }

    CW.notificar?.(`Tema ${ROTULO_CURTO_DO_TEMA[proximo]}`);
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

    const punho = P.raiz.querySelector(".punho");

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

      P.config.largura = largura;

      /**
       * A página acompanha a nova largura.
       *
       * Sem isto, alargar a gaveta a fazia cobrir de novo o pedaço de
       * site que o empurrão tinha aberto — e o empurrão só voltaria a
       * bater no próximo abrir.
       */
      P.empurrarPagina(P.aberto);

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

      P.config = resposta.dados;

      aplicarTema(P.config.tema);
      aplicarLargura(P.config.largura);
      aplicarPosicao(P.config.posicao);
      aplicarPosicaoDoBotao();
      P.refletirAuto();
      refletirFixado();

      /**
       * Fixado volta aberto.
       *
       * É o que fecha o buraco da "minimização sozinha": a remontagem
       * do painel depois de a página trocar a árvore não desfaz mais a
       * escolha de quem o deixou aberto.
       */
      if (P.config.fixado) P.abrir();
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

    /* A extensão está na frente do que está publicado. */
    versao: "a aplicação no ar é mais antiga",
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
  P.empurrarPagina = function empurrarPagina(ligar) {

    const raizDoSite = document.documentElement;

    if (!raizDoSite) return;

    const deveEmpurrar =
      ligar &&
      P.config.empurrar !== false &&
      !P.config.posicao;

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

    const px = P.config.largura || 380;

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
  };

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
        if (filho === P.hospedeiro) continue;
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

  P.abrir = function abrir() {

    P.aberto = true;
    gaveta?.classList.add("aberta");

    /* Os números nas abas, no máximo a cada 5 minutos (1.135). */
    P.atualizarContadoresDasAbas?.();

    P.empurrarPagina(true);

    // Fila ou painel já desenhados continuam onde estão.
    if (P.vista !== "contato") return;

    /**
     * Com o painel fechado a consulta já aconteceu — é ela que acende o
     * contador no botão. Sem redesenhar aqui, abrir a gaveta mostrava
     * uma tela em branco justamente quando havia algo a mostrar.
     */
    if (P.ultimoDado) {
      P.render(P.ultimoDado);
      return;
    }

    P.consultar(false);
  };

  P.fechar = function fechar({ naMao = true } = {}) {

    P.aberto = false;
    gaveta?.classList.remove("aberta");

    P.empurrarPagina(false);

    // Fechar na mão vale como decisão: não reabre até o contato mudar.
    if (naMao) P.fechadoNaMao = true;
  };

  /* ============================================================
     OS ATALHOS DENTRO DO PAINEL
  ============================================================ */

  /**
   * Teclas soltas só valem com o foco dentro do painel.
   *
   * O WhatsApp Web e o HugMe têm atalhos próprios, e uma tecla ouvida
   * na página inteira ia disputar com eles (e com o que se digita na
   * conversa). Dentro da gaveta não há disputa: abrir pelo Alt+Shift+C
   * já põe o foco nela, e clicar em qualquer coisa do painel também.
   */
  const ABA_DA_TECLA = { 1: "contato", 2: "reclame-aqui", 3: "nps", 4: "social", 5: "painel", 6: "atividades" };

  function ligarAtalhos() {
    P.raiz.addEventListener("keydown", (evento) => {

      const alvo = evento.composedPath()[0];
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.tagName === "SELECT" ||
        alvo?.isContentEditable;

      if (digitando || evento.ctrlKey || evento.metaKey || evento.altKey) return;

      let tratou = true;

      const menuAberto = P.raiz.querySelector(".menu-painel:not([hidden])");

      /* No caso aberto, ← e → andam pela lista de onde ele veio (1.135). */
      const navegar =
        P.vista === "caso" && (evento.key === "ArrowLeft" || evento.key === "ArrowRight")
          ? P.raiz.querySelector(`[data-navegar="${evento.key === "ArrowLeft" ? "anterior" : "proximo"}"]`)
          : null;

      if (navegar) navegar.click();
      else if (evento.key === "/") P.campoBusca?.focus();
      else if (evento.key === "Escape" && menuAberto) alternarMenu(false);
      else if (evento.key === "Escape") P.fechar();
      else if (evento.key === "?") alternarAjudaDosAtalhos();
      else if (ABA_DA_TECLA[evento.key]) {
        P.raiz
          .querySelector(`[data-acao="canal"][data-canal="${ABA_DA_TECLA[evento.key]}"]`)
          ?.click();
      } else tratou = false;

      if (tratou) {
        evento.preventDefault();
        evento.stopPropagation();
      }
    });
  }

  function alternarAjudaDosAtalhos() {
    const ajuda = P.raiz?.querySelector(".ajuda-atalhos");
    if (ajuda) ajuda.hidden = !ajuda.hidden;
  }

  function alternar() {
    if (P.aberto) P.fechar();
    else {
      P.fechadoNaMao = false;
      P.abrir();
    }
  }

  /* ============================================================
     O ATALHO DE TECLADO
  ============================================================ */

  /**
   * `Alt+Shift+C` abre e fecha o painel.
   *
   * O atalho é declarado no manifesto e despachado pelo service worker,
   * e não por um `keydown` nosso na página. A diferença importa: o
   * WhatsApp Web e o HugMe capturam teclas para os próprios atalhos, e
   * um ouvinte na página perderia a combinação conforme o foco — que é o
   * jeito mais rápido de um atalho virar "às vezes funciona". Pelo
   * manifesto ele chega sempre, e quem quiser trocar a combinação troca
   * em `chrome://extensions/shortcuts`.
   *
   * O painel é garantido antes de alternar: numa página em que ele ainda
   * não montou (nenhum contato reconhecido), o atalho monta e abre em vez
   * de não fazer nada.
   */
  try {
    chrome.runtime.onMessage.addListener((mensagem) => {

      if (mensagem?.tipo !== "alternarPainel") return;

      if (!P.montado()) P.montar();

      alternar();

      /* Pelo atalho, o foco vai junto: 1–5, / e Esc já funcionam. */
      if (P.aberto) gaveta?.focus({ preventScroll: true });
    });
  } catch {
    /*
      `chrome.runtime` morto acontece de verdade: ao recarregar a
      extensão, o script de conteúdo antigo continua na página com o
      canal já fechado. Sem atalho é melhor do que sem painel.
    */
  }
})();
