/**
 * O atalho de respostas prontas, ao lado da caixa de mensagem.
 *
 * **O que ele resolve.** Os textos aprovados já apareciam na gaveta do
 * painel, mas com três limites que só incomodam de verdade com o
 * cliente na linha: eram no máximo três, filtrados pela categoria do
 * caso, e sumiam por completo quando o contato não tinha reclamação
 * nenhuma. E o botão era "copiar" — quem estava atendendo tinha de
 * abrir a gaveta, achar o texto, copiar, voltar e colar.
 *
 * Aqui a lista é inteira, tem busca, mora onde a pergunta acontece — a
 * um clique da caixa de mensagem — e **escreve na caixa**.
 *
 * **O que ele continua não fazendo: enviar.** O texto entra no campo e
 * para ali. Quem aperta enviar é a pessoa, sempre. É a mesma linha que
 * a extensão inteira respeita, e ela importa mais neste arquivo do que
 * em qualquer outro, porque este é o único que escreve na página.
 *
 * **Por que duas raízes de sombra.** O botão precisa ficar em fluxo
 * com os botões do WhatsApp, dentro do rodapé deles; a janela precisa
 * flutuar acima de tudo. Uma raiz só forçaria uma das duas a ceder — e
 * o CSS do WhatsApp, que é agressivo, entraria por essa fresta.
 */
(() => {
  const CW = window.CWReputacao;

  /**
   * Sem a folha de estilo não há atalho.
   *
   * `estilo.js` vem antes deste arquivo na lista do manifesto. A
   * checagem é contra a ordem ser trocada sem querer — o que produziria
   * um botão sem estilo nenhum dentro do rodapé alheio, que é pior do
   * que botão nenhum.
   */
  if (!CW?.CSS_ATALHO) return;

  /** O mesmo compasso do detector de conversa. */
  const INTERVALO = 1200;

  /**
   * Onde o WhatsApp deixa a caixa de mensagem.
   *
   * Em camadas, pelo motivo de sempre: a marcação deles muda sem
   * aviso. As duas primeiras são presas ao `footer` de propósito — a
   * busca de conversas no topo também é um `contenteditable` com
   * `role="textbox"`, e escrever nela seria escrever no lugar errado.
   */
  const ONDE_ESCREVE = [
    'footer [contenteditable="true"][role="textbox"]',
    '#main footer [contenteditable="true"]',
    '[data-testid="conversation-compose-box-input"]',
    'footer [contenteditable="true"]',
  ];

  function caixa() {
    for (const seletor of ONDE_ESCREVE) {
      const achado = document.querySelector(seletor);
      if (achado) return achado;
    }

    return null;
  }

  const RAIO = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z"/></svg>`;

  /* ============================================================
     ESTADO
  ============================================================ */

  let hospedeiroBotao = null;
  let botao = null;

  let hospedeiroJanela = null;
  let janela = null;

  let aberto = false;

  /** A última lista que o servidor devolveu, e para qual contato. */
  let lista = [];
  let chaveDaLista = "";

  /** Índice marcado pelo teclado. */
  let marcado = 0;

  let filtro = "";

  /** Endereço da Base de Conhecimento, dito pelo servidor. */
  let enderecoDaBase = "";

  /* ============================================================
     CONTEXTO
  ============================================================ */

  /**
   * Quem está do outro lado, segundo o painel.
   *
   * Este arquivo não lê a conversa: quem lê é o `whatsapp.js`, e quem
   * guarda o que o servidor respondeu é o `painel.js`. Duas leituras da
   * mesma tela produziriam duas verdades sobre o mesmo contato.
   */
  function contexto() {
    const atual = CW.painel?.contextoAtual?.() ?? {};

    return {
      cliente: atual.cliente || atual.nome || "",
      protocolo: atual.protocolo || "",
    };
  }

  function chaveDoContexto() {
    const { cliente, protocolo } = contexto();
    return `${cliente}|${protocolo}`;
  }

  /* ============================================================
     O BOTÃO NO RODAPÉ
  ============================================================ */

  /**
   * O filho direto do rodapé que contém a caixa de mensagem.
   *
   * O botão entra **antes** dele, como irmão. É a única posição que
   * funciona nos dois jeitos que o WhatsApp já montou este rodapé: numa
   * linha, o botão aparece à esquerda do campo, ao lado do clipe; numa
   * coluna, vira uma faixa fina logo acima do campo. Nos dois casos
   * nada do arranjo interno deles é tocado.
   */
  function ondeEncaixar() {
    const escrita = caixa();

    if (!escrita) return null;

    const rodape = escrita.closest("footer");

    if (!rodape) return null;

    let linha = escrita;

    while (
      linha.parentElement &&
      linha.parentElement !== rodape
    ) {
      linha = linha.parentElement;
    }

    return linha.parentElement === rodape
      ? { rodape, linha }
      : { rodape, linha: null };
  }

  function montarBotao() {
    const lugar = ondeEncaixar();

    if (!lugar) return false;

    hospedeiroBotao = document.createElement("div");
    hospedeiroBotao.id = "cw-reputacao-atalho";

    /* Sem estilo próprio a página decide o tamanho do nosso host. */
    hospedeiroBotao.style.display = "flex";
    hospedeiroBotao.style.alignItems = "center";
    hospedeiroBotao.style.flex = "0 0 auto";

    const sombra = hospedeiroBotao.attachShadow({
      mode: "open",
    });

    const estilo = document.createElement("style");
    estilo.textContent = CW.CSS_ATALHO;
    sombra.appendChild(estilo);

    const raiz = document.createElement("div");
    raiz.className = "tema";
    raiz.dataset.tema = "auto";

    raiz.innerHTML = `
      <button type="button" class="gatilho-atalho"
              aria-expanded="false"
              title="Respostas rápidas do CW Reputação — os textos aprovados da Base de Conhecimento (Ctrl + /)">
        ${RAIO}<span class="rotulo">Respostas rápidas</span>
      </button>`;

    sombra.appendChild(raiz);

    botao = raiz.querySelector(".gatilho-atalho");

    botao.addEventListener("click", (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      if (aberto) {
        fechar();
      } else {
        abrir();
      }
    });

    if (lugar.linha) {
      lugar.rodape.insertBefore(
        hospedeiroBotao,
        lugar.linha
      );
    } else {
      lugar.rodape.appendChild(hospedeiroBotao);
    }

    return true;
  }

  function botaoMontado() {
    return Boolean(
      hospedeiroBotao &&
        hospedeiroBotao.isConnected &&
        hospedeiroBotao.shadowRoot?.querySelector(
          ".gatilho-atalho"
        )
    );
  }

  /**
   * Reanexa o botão quando o WhatsApp reconstrói o rodapé.
   *
   * Acontece a cada troca de conversa. Sem isto o atalho aparece uma
   * vez e some no primeiro clique em outro contato — que é como uma
   * ferramenta ganha fama de não funcionar.
   */
  function garantir() {
    if (!caixa()) {
      /* Sem conversa aberta não há onde encaixar nada. */
      if (aberto) fechar();
      return;
    }

    if (botaoMontado()) return;

    /* Sobra de uma montagem anterior, para não empilhar botões. */
    for (const antigo of document.querySelectorAll(
      "#cw-reputacao-atalho"
    )) {
      antigo.remove();
    }

    hospedeiroBotao = null;
    botao = null;

    montarBotao();
  }

  /* ============================================================
     A JANELA
  ============================================================ */

  function montarJanela() {
    hospedeiroJanela = document.createElement("div");
    hospedeiroJanela.id = "cw-reputacao-atalho-janela";

    /* No documentElement: o WhatsApp troca o conteúdo do body. */
    document.documentElement.appendChild(hospedeiroJanela);

    const sombra = hospedeiroJanela.attachShadow({
      mode: "open",
    });

    const estilo = document.createElement("style");
    estilo.textContent = CW.CSS_ATALHO;
    sombra.appendChild(estilo);

    const raiz = document.createElement("div");
    raiz.className = "tema";
    raiz.dataset.tema = "auto";

    raiz.innerHTML = `
      <div class="janela-atalho" role="dialog"
           aria-label="Respostas rápidas">
        <header>
          <span class="titulo">Respostas rápidas</span>
          <span class="para"></span>
          <button type="button" class="fechar"
                  title="Fechar">&times;</button>
        </header>

        <div class="procura">
          <input type="text" spellcheck="false"
                 placeholder="Buscar por título ou trecho…" />
        </div>

        <div class="lista"></div>

        <footer>
          <span class="dica">↑ ↓ para escolher · Enter para colar</span>
          <button type="button" data-acao="gerenciar">Gerenciar</button>
        </footer>
      </div>`;

    sombra.appendChild(raiz);

    janela = raiz.querySelector(".janela-atalho");

    janela
      .querySelector(".fechar")
      .addEventListener("click", fechar);

    janela
      .querySelector('[data-acao="gerenciar"]')
      .addEventListener("click", () => {
        CW.enviar({
          tipo: "abrir",
          url: enderecoDaBase,
        });
        fechar();
      });

    const procura = janela.querySelector(
      ".procura input"
    );

    procura.addEventListener("input", () => {
      filtro = procura.value;
      marcado = 0;
      desenhar();
    });

    procura.addEventListener("keydown", pelasTeclas);

    janela
      .querySelector(".lista")
      .addEventListener("click", (evento) => {
        const alvo =
          evento.target.closest?.(".item");

        if (!alvo) return;

        usar(alvo.dataset.id);
      });
  }

  function janelaMontada() {
    return Boolean(
      hospedeiroJanela &&
        hospedeiroJanela.isConnected &&
        janela
    );
  }

  /**
   * A janela sobe a partir do botão, e nunca sai da tela.
   *
   * Ancorada por `bottom` e não por `top`: ela cresce para cima
   * conforme a lista, e o rodapé do WhatsApp é o único ponto fixo desta
   * tela.
   */
  function posicionar() {
    if (!janelaMontada() || !botao) return;

    const alvo = hospedeiroBotao.getBoundingClientRect();

    const largura = Math.min(
      400,
      window.innerWidth - 24
    );

    const esquerda = Math.max(
      12,
      Math.min(
        alvo.left,
        window.innerWidth - largura - 12
      )
    );

    janela.style.left = `${Math.round(esquerda)}px`;
    janela.style.bottom = `${Math.round(
      window.innerHeight - alvo.top + 8
    )}px`;
  }

  /* ============================================================
     ABRIR, FECHAR, DESENHAR
  ============================================================ */

  async function abrir() {
    if (!botaoMontado()) return;

    if (!janelaMontada()) montarJanela();

    aberto = true;
    botao.setAttribute("aria-expanded", "true");
    hospedeiroJanela.style.display = "";

    posicionar();

    const procura = janela.querySelector(
      ".procura input"
    );

    procura.value = filtro;
    procura.focus();
    procura.select();

    const chave = chaveDoContexto();

    /**
     * Lista velha do mesmo contato aparece na hora.
     *
     * Ela é substituída assim que o servidor responder. Esperar a rede
     * para mostrar o que já se tem transformaria um clique em meio
     * segundo de tela branca, toda vez.
     */
    if (chave === chaveDaLista && lista.length > 0) {
      desenhar();
    } else {
      lista = [];
      desenhar("carregando");
    }

    await carregar(chave);
  }

  function fechar() {
    aberto = false;

    if (botao) {
      botao.setAttribute("aria-expanded", "false");
    }

    if (hospedeiroJanela) {
      hospedeiroJanela.style.display = "none";
    }
  }

  async function carregar(chave) {
    const { cliente, protocolo } = contexto();

    const resposta = await CW.enviar({
      tipo: "respostas",
      consulta: {
        canal: "WhatsApp",
        cliente,
        protocolo,
      },
    });

    /* A pessoa fechou enquanto carregava, ou trocou de conversa. */
    if (!aberto || chave !== chaveDoContexto()) return;

    if (!resposta.ok) {
      lista = [];
      desenhar(
        resposta.erro ??
          "Não consegui falar com o CW Reputação."
      );
      return;
    }

    lista = resposta.dados?.itens ?? [];
    chaveDaLista = chave;
    enderecoDaBase = resposta.dados?.url ?? "";

    marcado = 0;
    desenhar();
  }

  /** Minúsculas e sem acento — a busca não pode depender da digitação. */
  function achatar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  }

  /**
   * O filtro roda aqui, e não no servidor.
   *
   * A rota aceita `busca` — e ela é usada pela conferência —, mas
   * filtrar a cada tecla contra a rede daria uma lista que pisca. A
   * lista inteira são vinte e poucos textos: cabe na memória e responde
   * no mesmo quadro.
   */
  function visiveis() {
    const termo = achatar(filtro).trim();

    if (termo === "") return lista;

    return lista.filter((item) =>
      achatar(
        `${item.titulo} ${item.texto} ${item.canal} ${item.categoria}`
      ).includes(termo)
    );
  }

  function desenhar(estado) {
    if (!janelaMontada()) return;

    const { cliente, protocolo } = contexto();

    janela.querySelector(".para").textContent = cliente
      ? protocolo
        ? `para ${cliente} · ${protocolo}`
        : `para ${cliente}`
      : "contato não identificado";

    const alvo = janela.querySelector(".lista");

    if (estado === "carregando") {
      alvo.innerHTML = `<p class="vazio">Buscando os textos…</p>`;
      return;
    }

    if (typeof estado === "string") {
      alvo.innerHTML = `<p class="vazio">${CW.escapar(
        estado
      )}</p>`;
      return;
    }

    const itens = visiveis();

    if (itens.length === 0) {
      alvo.innerHTML = `<p class="vazio">${
        lista.length === 0
          ? "Nenhum texto aprovado cadastrado ainda."
          : "Nenhum texto com esse termo."
      }</p>`;
      return;
    }

    if (marcado >= itens.length) marcado = 0;

    alvo.innerHTML = itens
      .map((item, indice) => desenharItem(item, indice))
      .join("");

    rolarAteOMarcado();
  }

  function desenharItem(item, indice) {
    /**
     * O aviso do que a colagem **não** preenche.
     *
     * Variável que sobrou e trecho entre colchetes são coisas
     * diferentes: a primeira é dado que faltou (sem caso, sem
     * protocolo), a segunda é um pedido de escrita que o autor do texto
     * deixou de propósito. As duas precisam aparecer antes do clique —
     * depois de colar, quem lê é o cliente.
     */
    const avisos = [];

    if (item.faltando?.length > 0) {
      avisos.push(
        `falta ${item.faltando
          .map((token) => token.replace(/[{}]/g, ""))
          .join(", ")}`
      );
    }

    if (item.preencher?.length > 0) {
      avisos.push(
        `${item.preencher.length} a escrever`
      );
    }

    return `
      <button type="button" class="item"
              data-id="${CW.escapar(item.id)}"
              data-marcado="${
                indice === marcado ? "sim" : "nao"
              }">
        <span class="linha">
          <span class="nome">${CW.escapar(
            item.titulo
          )}</span>
          <span class="etiqueta canal">${CW.escapar(
            item.canal
          )}</span>
          ${avisos
            .map(
              (aviso) =>
                `<span class="etiqueta falta">${CW.escapar(
                  aviso
                )}</span>`
            )
            .join("")}
        </span>
        <span class="previa">${CW.escapar(
          item.texto
        )}</span>
      </button>`;
  }

  function rolarAteOMarcado() {
    janela
      .querySelectorAll(".item")
      [marcado]?.scrollIntoView({ block: "nearest" });
  }

  /* ============================================================
     TECLADO
  ============================================================ */

  function pelasTeclas(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      fechar();
      caixa()?.focus();
      return;
    }

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      marcado = Math.min(
        marcado + 1,
        visiveis().length - 1
      );
      desenhar();
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      marcado = Math.max(marcado - 1, 0);
      desenhar();
      return;
    }

    if (evento.key === "Enter") {
      evento.preventDefault();

      const escolhido = visiveis()[marcado];

      if (escolhido) usar(escolhido.id);
    }
  }

  /* ============================================================
     COLAR NA CAIXA
  ============================================================ */

  function esperarQuadro() {
    return new Promise((resolver) =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolver)
      )
    );
  }

  /**
   * Põe o texto na caixa de mensagem, em três camadas.
   *
   * A caixa do WhatsApp não é um `<textarea>`: é um editor rico, e
   * escrever no `innerText` dele muda o que aparece na tela **sem** o
   * editor ficar sabendo — a mensagem some no primeiro Enter. Então
   * ninguém escreve no DOM aqui; o que se faz é **avisar o editor**,
   * pelos mesmos eventos que uma pessoa geraria.
   *
   *  1. Um evento de colagem. É o que preserva quebra de linha, e é o
   *     caminho que o editor deles trata melhor.
   *  2. `insertText`, que nasce como um `beforeinput` — o mesmo que
   *     digitar produz.
   *  3. Sem nenhum dos dois, o texto vai para a área de transferência
   *     e a janela diz para colar com Ctrl+V. Pedir um Ctrl+V é ruim;
   *     dizer "colei" sem ter colado é muito pior.
   *
   * A conferência entre camadas é feita **um quadro depois**: o editor
   * atualiza o DOM em microtarefa, e comparar na mesma volta faria a
   * camada 2 rodar em cima de uma colagem que deu certo — inserindo o
   * texto duas vezes.
   */
  async function colar(texto) {
    const escrita = caixa();

    if (!escrita) {
      return {
        ok: false,
        motivo:
          "não achei a caixa de mensagem — abra uma conversa",
      };
    }

    escrita.focus();

    /* Cursor no fim do que já estiver escrito: não apaga rascunho. */
    try {
      const selecao = window.getSelection();
      const faixa = document.createRange();
      faixa.selectNodeContents(escrita);
      faixa.collapse(false);
      selecao.removeAllRanges();
      selecao.addRange(faixa);
    } catch {
      /* Sem seleção, as camadas abaixo ainda funcionam. */
    }

    const antes = escrita.innerText ?? "";

    try {
      const dados = new DataTransfer();
      dados.setData("text/plain", texto);

      escrita.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dados,
        })
      );
    } catch {
      /* Navegador sem ClipboardEvent construível: vai para a camada 2. */
    }

    await esperarQuadro();

    if ((escrita.innerText ?? "") !== antes) {
      return { ok: true };
    }

    try {
      document.execCommand("insertText", false, texto);
    } catch {
      /* Idem: cai na camada 3. */
    }

    await esperarQuadro();

    if ((escrita.innerText ?? "") !== antes) {
      return { ok: true };
    }

    try {
      await navigator.clipboard.writeText(texto);

      return {
        ok: false,
        motivo:
          "não consegui escrever na caixa; o texto está copiado — cole com Ctrl+V",
      };
    } catch {
      return {
        ok: false,
        motivo:
          "não consegui escrever na caixa nem copiar o texto",
      };
    }
  }

  async function usar(id) {
    const item = lista.find(
      (candidato) => candidato.id === id
    );

    if (!item) return;

    fechar();

    const resultado = await colar(item.texto);

    if (!resultado.ok) {
      avisar(resultado.motivo, "ruim");
      return;
    }

    /**
     * O uso é contado só quando o texto entrou mesmo.
     *
     * A ordem da lista é "mais usado primeiro" — contar uma inserção
     * que falhou faria o topo ser ocupado pelo texto que menos
     * funciona.
     *
     * Sem `await`: quem colou já viu o resultado na tela, e a contagem
     * não pode segurar nada.
     */
    CW.enviar({ tipo: "usarResposta", id: item.id });

    const pendencias = [];

    if (item.faltando?.length > 0) {
      pendencias.push(
        `${item.faltando
          .map((token) => token.replace(/[{}]/g, ""))
          .join(", ")} não tinha valor`
      );
    }

    if (item.preencher?.length > 0) {
      pendencias.push(
        `${item.preencher.length} trecho(s) entre colchetes para escrever`
      );
    }

    if (pendencias.length > 0) {
      avisar(
        `Colado. Confira antes de enviar: ${pendencias.join(
          "; "
        )}.`,
        "atencao"
      );
      return;
    }

    avisar("Colado. Confira e envie.", "");
  }

  /* ============================================================
     O AVISO
  ============================================================ */

  let hospedeiroAviso = null;
  let relogioDoAviso = null;

  /**
   * Um aviso curto acima da caixa, que some sozinho.
   *
   * Sombra própria pelo mesmo motivo das outras duas: ele aparece por
   * cima do WhatsApp e não pode herdar nada da folha deles.
   */
  function avisar(texto, tom) {
    if (!hospedeiroAviso) {
      hospedeiroAviso = document.createElement("div");
      hospedeiroAviso.id = "cw-reputacao-atalho-aviso";

      document.documentElement.appendChild(
        hospedeiroAviso
      );

      const sombra = hospedeiroAviso.attachShadow({
        mode: "open",
      });

      const estilo = document.createElement("style");
      estilo.textContent = CW.CSS_ATALHO;
      sombra.appendChild(estilo);

      const raiz = document.createElement("div");
      raiz.className = "tema";
      raiz.dataset.tema = "auto";
      raiz.innerHTML = `<div class="aviso-atalho"></div>`;

      sombra.appendChild(raiz);
    }

    const caixaDoAviso =
      hospedeiroAviso.shadowRoot.querySelector(
        ".aviso-atalho"
      );

    caixaDoAviso.className = `aviso-atalho ${tom ?? ""}`;
    caixaDoAviso.textContent = texto;

    const alvo = hospedeiroBotao?.getBoundingClientRect();

    caixaDoAviso.style.left = `${Math.round(
      Math.max(12, alvo?.left ?? 12)
    )}px`;

    caixaDoAviso.style.bottom = `${Math.round(
      window.innerHeight - (alvo?.top ?? 80) + 8
    )}px`;

    hospedeiroAviso.style.display = "";

    clearTimeout(relogioDoAviso);

    relogioDoAviso = setTimeout(
      () => {
        if (hospedeiroAviso) {
          hospedeiroAviso.style.display = "none";
        }
      },
      /* Um aviso de pendência precisa de tempo para ser lido. */
      tom ? 6500 : 2600
    );
  }

  /* ============================================================
     LIGAÇÕES COM A PÁGINA
  ============================================================ */

  /** Clique fora fecha — inclusive dentro das sombras. */
  document.addEventListener(
    "click",
    (evento) => {
      if (!aberto) return;

      const caminho = evento.composedPath?.() ?? [];

      if (
        caminho.includes(hospedeiroJanela) ||
        caminho.includes(hospedeiroBotao)
      ) {
        return;
      }

      fechar();
    },
    true
  );

  /**
   * `Ctrl + /` com o cursor na caixa de mensagem abre a lista.
   *
   * Escolhido por não colidir com nada do WhatsApp Web e por não
   * atrapalhar quem escreve: qualquer atalho de tecla solta — uma
   * barra no começo da linha, por exemplo — sequestraria a digitação
   * de quem só queria escrever uma barra.
   */
  document.addEventListener(
    "keydown",
    (evento) => {
      if (
        !(evento.ctrlKey || evento.metaKey) ||
        evento.key !== "/"
      ) {
        return;
      }

      const escrita = caixa();

      if (!escrita) return;

      /* Aberta, o atalho fecha de onde o cursor estiver. */
      if (!aberto) {

        const escrevendo =
          document.activeElement === escrita ||
          escrita.contains(document.activeElement);

        if (!escrevendo) return;
      }

      evento.preventDefault();

      if (aberto) {
        fechar();
      } else {
        abrir();
      }
    },
    true
  );

  window.addEventListener("resize", () => {
    if (aberto) posicionar();
  });

  setInterval(() => {
    try {
      garantir();

      /* O rodapé cresce ao escrever: a janela acompanha. */
      if (aberto) posicionar();
    } catch (erro) {
      console.warn("[CW] atalho de respostas", erro);
    }
  }, INTERVALO);

  garantir();
})();
