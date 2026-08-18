/**
 * O painel.
 *
 * Uma gaveta à direita da tela, dentro de um Shadow DOM próprio, com um
 * botão flutuante para abrir e fechar. É a mesma peça nas três
 * superfícies — WhatsApp Web, Hugme/Reclame Aqui e ManyChat. O que muda
 * de um site para outro é só **quem descobre o contato**; daqui para
 * baixo, tudo é igual.
 *
 * O painel só mostra. Não responde reclamação, não cria caso, não manda
 * mensagem. É a decisão registrada em `EXTENSAO.md`: numa base com
 * consumidor real, começar lendo tem superfície de erro muito menor.
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
  let config = { autoAbrir: false };

  /** Consulta corrente e a chave que evita repetir a mesma busca. */
  let consulta = null;
  let chaveConsulta = "";
  let ultimoDado = null;

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
        <header class="topo">
          <span style="color:#fff;display:grid;place-items:center">${MARCA}</span>
          <span>
            <span class="titulo">CW Reputação</span><br>
            <span class="quem">verificando conexão…</span>
          </span>
          <span class="espaco"></span>
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

        <footer class="rodape-painel">
          <span>Somente leitura</span>
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

      if (acao === "abrir") {
        CW.enviar({ tipo: "abrir", url: alvo.dataset.url });
      }

      if (acao === "copiar") {
        copiar(alvo, alvo.dataset.texto ?? "");
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

    vazio(
      "Nenhum contato identificado",
      "Abra uma conversa ou use a busca acima."
    );

    identificar();
  }

  async function identificar() {

    const resposta = await CW.enviar({ tipo: "config" });

    if (resposta.ok) config = resposta.dados;

    const sessao = await CW.enviar({ tipo: "sessao" });

    if (!linhaQuem) return;

    if (!sessao.ok) {
      linhaQuem.textContent = "não conectado";
      return;
    }

    const dados = sessao.dados;

    linhaQuem.textContent = dados.usuario
      ? `${dados.usuario.nome} · ${dados.usuario.papel.toLowerCase()}`
      : dados.demonstracao
        ? "modo demonstração"
        : "não conectado";
  }

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

  function fechar() {
    aberto = false;
    gaveta?.classList.remove("aberta");
  }

  function alternar() {
    if (aberto) fechar();
    else abrir();
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

    marcarSelo(null);

    if (aberto) {
      consultar(false);
      return;
    }

    if (config.autoAbrir) {
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
    };
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
          : "Abra uma conversa ou use a busca acima."
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
      vazio(
        "Nada encontrado",
        consulta?.rotulo
          ? `Sem reclamação para ${consulta.rotulo}.`
          : "Este contato não tem reclamação registrada."
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

    if (dados.nps) {
      const nps = dados.nps;

      partes.push(`
        <div class="bloco">
          <div class="rotulo">NPS</div>
          <div class="cartao">
            <div class="linha">
              <span class="nome">${nps.nota}/10</span>
              <span class="tag ${
                nps.encerrado
                  ? "neutro"
                  : nps.nota <= 6
                    ? "perigo"
                    : "atencao"
              }">${CW.escapar(nps.status)}</span>
            </div>
            <div class="sub">
              ${CW.escapar(nps.tipo ?? "sem classificação")} ·
              ${nps.tentativas} tentativa(s) ·
              prazo ${CW.data(nps.prazoPrimeiroContato)}
            </div>
          </div>
        </div>`);
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

    return `
      <div class="caso ${classe}" data-acao="abrir"
           data-url="${CW.escapar(caso.url)}">
        <div class="linha">
          <span class="sub">${CW.escapar(caso.protocolo)}</span>
          <span class="sub">${CW.data(caso.criadoEm)}</span>
        </div>
        <div class="titulo-caso">${CW.escapar(caso.titulo)}</div>
        <div class="rodape">${etiquetas.join("")}</div>
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

  CW.painel = {
    montar,
    definirContexto,
    abrir,
    fechar,

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
