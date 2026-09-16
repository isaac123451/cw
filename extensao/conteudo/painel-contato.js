/**
 * A tela do contato — parte do painel da extensão.
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

  const P = window.__cwPainel;

  if (!CW || !P || P.pronto) return;

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
  P.definirContexto = function definirContexto(novo) {

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

    if (chave === P.chaveConsulta) return;

    P.chaveConsulta = chave;
    P.consulta = novo;
    P.ultimoDado = null;

    // Contato novo de verdade: a recusa anterior não vale mais.
    P.fechadoNaMao = false;

    // E o resumo da conversa anterior não descreve esta.
    P.resumo = null;

    // Nem o "guardada" dela vale para esta.
    P.guardarConversa = null;

    marcarSelo(null);

    /**
     * Contato novo com uma aba de canal aberta.
     *
     * A aba "só deste cliente" é sobre **este** contato — trocar de
     * conversa e continuar mostrando os casos do anterior é pior do que
     * não mostrar nada. As demais vistas ficam: quem está lendo um caso
     * ou o painel do dia não pediu para ser interrompido.
     */
    if (P.vista === "fila" && P.soDoCliente) {
      if (P.aberto) P.carregarFila();
      return;
    }

    if (P.vista !== "contato") return;

    if (P.aberto) {
      P.consultar(false);
      return;
    }

    /**
     * Abrir sozinho pede três condições ao mesmo tempo: estar num site
     * onde isso faz sentido (só o WhatsApp), a preferência estar
     * ligada, e a pessoa não ter fechado o painel há pouco. Qualquer
     * uma que falte, o painel fica onde está e só acende o contador.
     */
    if (P.autoPermitido && P.config.autoAbrir && !P.fechadoNaMao) {
      P.abrir();
      return;
    }

    // Fechado: consulta assim mesmo, só para o selo do botão avisar
    // que existe algo daquele contato do lado de cá.
    consultarEmSilencio();
  };

  /**
   * O canal do site em que o painel está.
   *
   * "Reclame Aqui" no portal, "WhatsApp" no WhatsApp Web, "ManyChat" no
   * ManyChat. Cada detector informa o seu — é o que permite perguntar
   * "este cliente já passou por aqui?" em vez de só "este cliente
   * existe?".
   */
  function canalDaPagina() {
    return P.consulta?.canalDaPagina ?? P.captura?.origem ?? "";
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
  P.cadastrarNesteCanal = function cadastrarNesteCanal() {

    const daPagina = canalDaPagina();

    const cliente = P.ultimoDado?.cliente;

    P.captura = {
      ...(P.captura ?? {}),
      origem: daPagina,
      id: "",
      cliente:
        P.captura?.cliente || cliente?.nome || "",
      telefone:
        P.captura?.telefone ||
        P.consulta?.telefone ||
        "",
      email: P.captura?.email || P.consulta?.email || "",
      titulo: "",
      texto: "",
      criadoEm: "",
      categoria: "",
      subcategoria: "",
      prioridade: "Normal",
      documento: "",
      formulario: [],
      formularioRecolhido: false,
    };

    P.abrirCaptura();
  };

  P.parametros = function parametros() {
    return {
      telefone: P.consulta?.telefone ?? "",
      nome: P.consulta?.nome ?? "",
      protocolo: P.consulta?.protocolo ?? "",
      email: P.consulta?.email ?? "",

      /*
        O documento vai junto quando a tela o conhece.

        O Reclame Aqui mostra CPF ou CNPJ no RA Forms, e o leitor já o
        extraía — mas ele parava aqui e nunca chegava à busca. É o
        identificador mais forte que a base tem: 340 das 342
        reclamações carregam um, e ele é o único que sobrevive a
        alguém trocar de telefone.
      */
      documento: P.consulta?.documento ?? "",

      termo: P.consulta?.termo ?? "",
      canal: P.canal,
    };
  };

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
  P.trocarCanal = function trocarCanal(alvo) {

    const pedido = alvo.dataset.canal;

    if (pedido === "painel") {
      if (P.vista === "painel") return P.voltarAoContato();
      P.vista = "painel";
      P.canal = "todos";
      P.refletirCanal();
      P.carregarPainel();
      return;
    }

    if (pedido === "atividades") {
      if (P.vista === "atividades") {
        return P.voltarAoContato();
      }
      P.vista = "atividades";
      P.canal = "todos";
      P.refletirCanal();
      P.carregarAtividades();
      return;
    }

    if (P.vista !== "contato" && P.canal === pedido) {
      return P.voltarAoContato();
    }

    P.canal = pedido;
    P.vista = "fila";
    P.veioDaFila = true;

    // Filtro é do canal que estava aberto; trocar de aba zera.
    P.etapaFiltro = "";
    P.segmentoFiltro = "";
    P.recorteFiltro = "";

    /**
     * Com contato na tela, a aba abre **naquele cliente**.
     *
     * É o que o Isaac pediu: abrir a aba do Reclame Aqui com uma
     * conversa aberta tem de mostrar o que aquela pessoa já reclamou
     * ali, não a fila geral. O chip "toda a fila" desfaz num clique.
     */
    P.soDoCliente = P.temOndeProcurar();

    P.refletirCanal();
    P.carregarFila();
  };

  /**
   * Um contador do painel do dia abre a lista por trás do número.
   *
   * O recorte é da operação inteira, não de um canal — é a mesma conta
   * que produziu o número no painel. Por isso `canal = "todos"`: filtrar
   * por Reclame Aqui aqui faria a lista ser menor que o número clicado,
   * e um painel que se contradiz ensina a não confiar nele.
   */
  P.abrirRecorte = function abrirRecorte(recorte) {

    P.vista = "fila";
    P.canal = "todos";
    P.veioDaFila = true;
    P.soDoCliente = false;

    P.etapaFiltro = "";
    P.segmentoFiltro = "";

    P.recorteFiltro = P.NOME_DO_RECORTE[recorte]
      ? recorte
      : "";

    P.refletirCanal();
    P.carregarFila();
  };

  /**
   * Volta um passo: do caso para a lista de onde ele veio.
   *
   * Sem isto, ler um caso a partir da fila e fechar o detalhe jogava a
   * pessoa de volta no contato — perdendo o filtro e a rolagem da fila.
   */
  P.voltarDaVista = function voltarDaVista() {

    if (P.vista !== "caso") return P.voltarAoContato();

    P.detalhe = null;

    /**
     * Volta para a lista de onde o caso foi aberto.
     *
     * A aba de Atividades também abre caso, então "de onde vim" deixou
     * de ser sinônimo de fila.
     */
    if (P.vistaAnterior === "atividades") {
      P.vista = "atividades";
      P.refletirCanal();
      P.carregarAtividades();
      return;
    }

    if (P.vistaAnterior === "painel") {
      P.vista = "painel";
      P.refletirCanal();
      P.carregarPainel();
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
    if (!P.veioDaFila) return P.voltarAoContato();

    P.vista = "fila";
    P.refletirCanal();
    P.carregarFila();
  };

  P.voltarAoContato = function voltarAoContato() {

    P.vista = "contato";
    P.canal = "todos";
    P.veioDaFila = false;
    P.vistaAnterior = "contato";
    P.recorteFiltro = "";

    P.refletirCanal();

    if (P.ultimoDado) P.render(P.ultimoDado);
    else P.consultar(false);
  };

  P.refletirCanal = function refletirCanal() {

    /**
     * O voltar só existe quando há de onde voltar.
     *
     * Um botão permanente que não faz nada na tela inicial ensina a
     * pessoa a ignorá-lo — e aí ele não serve quando passa a servir.
     */
    const voltar = P.raiz?.querySelector(
      '[data-acao="voltar-da-vista"]'
    );

    if (voltar) {
      voltar.style.display =
        P.vista === "contato" ? "none" : "";
    }

    const ativo =
      P.vista === "painel"
        ? "painel"
        : P.vista === "atividades"
          ? "atividades"
          : P.canal;

    for (const botao of P.raiz.querySelectorAll(
      '[data-acao="canal"]'
    )) {
      botao.setAttribute(
        "aria-pressed",
        botao.dataset.canal === ativo &&
          P.vista !== "contato"
          ? "true"
          : "false"
      );
    }
  };

  /**
   * Um contexto pode chegar sem nada procurável — conversa em grupo,
   * aba do Hugme fora de uma reclamação. Aí o rótulo explica o motivo,
   * em vez de a consulta sair vazia e voltar erro do servidor.
   */
  P.temOndeProcurar = function temOndeProcurar() {
    return Object.values(P.parametros()).some(
      (valor) => String(valor).trim() !== ""
    );
  };

  P.consultar = async function consultar(forcar) {

    /**
     * A fila e o painel não são sobrescritos pelo detector.
     *
     * O WhatsApp troca de conversa sozinho e o Reclame Aqui redesenha a
     * página; os dois chamam `definirContexto`, que chama isto. Sem a
     * trava, a fila que a pessoa acabou de abrir sumia no meio da
     * leitura e voltava o contato.
     */
    if (P.vista !== "contato") return;

    if (!P.consulta || !P.temOndeProcurar()) {
      P.vazio(
        "Nenhum contato identificado",
        P.consulta?.rotulo
          ? `Sem contato para consultar (${P.consulta.rotulo}). Use a busca acima.`
          : "Abra uma conversa ou use a busca acima.",
        /**
         * Numa página que visivelmente tem uma reclamação, "não achei
         * nada" é defeito do leitor, não da página. O botão copia o
         * texto que o navegador realmente produziu, que é a única forma
         * de consertar sem adivinhar.
         */
        P.diagnostico
          ? '<button class="copiar" data-acao="diagnostico" style="margin-top:12px">Copiar o texto lido da página</button>'
          : undefined
      );
      marcarSelo(null);
      return;
    }

    P.corpo.innerHTML = `<div class="carregando">Consultando o CW Reputação…</div>`;

    const resposta = await CW.enviar({
      tipo: "contexto",
      consulta: P.parametros(),
      forcar: Boolean(forcar),
    });

    if (!resposta.ok) {
      P.renderFalha(resposta);
      marcarSelo(null);
      return;
    }

    P.ultimoDado = resposta.dados;
    P.render(resposta.dados);

    // Desenhou com o guardado: busca o atual sem piscar a tela.
    if (resposta.vencido) {
      P.atualizarAtras(() => P.consultar(true));
    }
  };

  /** Igual, mas sem mexer no que está na tela. */
  async function consultarEmSilencio() {

    if (!P.temOndeProcurar()) {
      marcarSelo(null);
      return;
    }

    const resposta = await CW.enviar({
      tipo: "contexto",
      consulta: P.parametros(),
    });

    if (!resposta.ok) return;

    P.ultimoDado = resposta.dados;

    marcarSelo(resposta.dados?.cliente?.abertos ?? 0);
  }

  function marcarSelo(quantidade) {

    if (!P.selo) return;

    if (!quantidade) {
      P.selo.classList.remove("visivel");
      P.selo.textContent = "";
      return;
    }

    P.selo.textContent = String(Math.min(quantidade, 99));
    P.selo.classList.add("visivel");
  }

  P.buscarManual = function buscarManual() {

    const termo = P.campoBusca.value.trim();

    if (termo === "") return;

    P.chaveConsulta = `manual:${termo}`;
    P.consulta = { termo, rotulo: `busca: ${termo}` };
    P.ultimoDado = null;

    P.consultar(true);
  };

  /* ============================================================
     DESENHO
  ============================================================ */

  P.vazio = function vazio(titulo, detalhe, botao) {
    P.corpo.innerHTML = `
      <div class="vazio">
        <b>${CW.escapar(titulo)}</b>
        ${CW.escapar(detalhe)}
        ${botao ?? ""}
      </div>`;
  };

  P.renderFalha = function renderFalha(resposta) {

    const codigo = resposta.codigo;

    const botoes = {
      "sem-endereco": `<button class="acao" data-acao="opcoes">Configurar endereço</button>`,
      "sem-permissao": `<button class="acao" data-acao="opcoes">Conceder permissão</button>`,
      sessao: `<button class="acao" data-acao="abrir" data-url="${CW.escapar(
        (resposta.base ?? "") + "/login"
      )}">Entrar no CW Reputação</button>`,
      rede: `<button class="acao" data-acao="recarregar">Tentar de novo</button>`,
      resposta: `<button class="acao" data-acao="opcoes">Conferir o endereço</button>`,

      /*
        Nada a configurar aqui: o endereço está certo e a sessão
        também. O que falta é publicar. Oferecer "Conferir o endereço"
        mandaria mexer no lugar errado.
      */
      versao: `<button class="acao" data-acao="recarregar">Tentar de novo</button>`,
    };

    P.vazio(
      "Não deu para consultar",
      resposta.erro ?? "Falha desconhecida.",
      botoes[codigo] ??
        `<button class="acao" data-acao="recarregar">Tentar de novo</button>`
    );
  };

  const TOM_CONFIANCA = {
    exata: ["ok", "confirmado"],
    provavel: ["atencao", "provável"],
    ambigua: ["perigo", "ambíguo"],
    nenhuma: ["neutro", "sem correspondência"],
  };

  P.render = function render(dados) {

    if (!dados?.cliente) {

      /**
       * Nada aqui **e** uma reclamação lida na página: é exatamente o
       * caso de alimentar o Kanban. O botão só aparece nessa
       * combinação — oferecer "criar" quando o caso já existe seria
       * convidar à duplicata.
       */
      const doPortal =
        P.captura && P.captura.id && P.captura.titulo;

      /**
       * Numa conversa basta ter com quem falar: o caso nasce do nada,
       * com o contato já preenchido. No portal exige-se o que foi lido,
       * senão o formulário abriria vazio e sem serventia.
       */
      const daConversa =
        P.captura &&
        P.captura.origem &&
        P.captura.origem !== "Reclame Aqui" &&
        (P.captura.cliente || P.captura.telefone);

      const podeCapturar = doPortal || daConversa;

      P.vazio(
        "Nada encontrado",
        doPortal
          ? `A reclamação ${P.captura.id} não está no CW Reputação.`
          : daConversa
            ? `${P.captura.cliente || P.captura.telefone} não tem caso registrado.`
            : P.consulta?.rotulo
              ? `Sem registro para ${P.consulta.rotulo}.`
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
      P.corpo.insertAdjacentHTML("beforeend", P.blocoResumo());

      /*
        E o dossiê, que aqui nasce da transcrição.

        Cliente sem reclamação cadastrada é quem mais ganha com isto:
        ler o atendimento inteiro antes de responder é o que evita que
        a conversa vire reclamação pública.
      */
      P.corpo.insertAdjacentHTML(
        "beforeend",
        P.blocoDossie("")
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
    partes.push(P.blocoResumo());

    // Depois, o atalho de capturar a reclamação que está na tela.
    partes.push(blocoOutroCanal(dados));
    partes.push(P.blocoCaptura(dados));

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
      P.canal === "nps"
        ? (dados.npsLista ?? [])
        : dados.nps
          ? [dados.nps]
          : [];

    for (const ciclo of ciclos) {
      partes.push(
        P.blocoNps(
          ciclo,
          P.podeEscrever(dados),
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
          ${dados.casos.map(P.desenharCaso).join("")}
        </div>`);
    }

    /*
      O dossiê, que faltava justamente aqui.

      Ele aparecia em três telas — contato sem caso nenhum, aba de
      Redes Sociais e caso aberto — e **não** nesta, que é a que abre
      sozinha quando a extensão identifica o contato no WhatsApp. Ou
      seja: sumia exatamente na hora mais comum de precisar dele, com o
      cliente na linha e a reclamação já reconhecida na tela.

      Vem depois da lista de reclamações porque é sobre elas: primeiro
      se vê o que existe, depois se abre a pasta. E antes das macros,
      que é o "me dá o texto" — entender vem antes de responder.

      Sem caso, vai com protocolo vazio: o servidor cruza pelo contato
      e monta a partir do NPS, dos outros canais e da transcrição.
    */
    partes.push(
      P.blocoDossie(dados.casos?.[0]?.protocolo ?? "")
    );

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

    partes.push(P.blocoAnotar(dados));

    P.corpo.innerHTML = partes.join("");
    P.corpo.scrollTop = 0;

    marcarSelo(cliente.abertos);
  };

  P.desenharCaso = function desenharCaso(caso) {

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
        ${P.botoesDeEtapa(caso)}
      </div>`;
  };

  /* ============================================================
     COPIAR
  ============================================================ */

  P.copiar = async function copiar(botao, texto) {

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
  };

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
  P.resumirConversa = async function resumirConversa(botao) {

    if (!P.lerConversa) return;

    const leitura = P.lerConversa();

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
      P.avisar(
        `Não consegui ler nenhuma mensagem${motivo ? ` — ${motivo}` : ""}. Isso é a extensão, não a conversa. Role a conversa para cima e tente de novo; se continuar, me avise com esta mensagem.`,
        "perigo"
      );
      return;
    }

    if (mensagens.length < 2) {
      P.avisar(
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
    const contexto = P.ultimoDado?.cliente
      ? [
          `Cliente: ${P.ultimoDado.cliente.nome}`,
          `${P.ultimoDado.cliente.total} caso(s), ${P.ultimoDado.cliente.abertos} aberto(s)`,
          ...(P.ultimoDado.casos ?? [])
            .slice(0, 3)
            .map((c) => `${c.protocolo} \u2014 ${c.status} \u2014 ${c.titulo}`),
        ].join("\n")
      : undefined;

    const resposta = await CW.enviar({
      tipo: "resumirConversa",
      conversa: {
        mensagens,
        contato: {
          nome: P.consulta?.nome,
          telefone: P.consulta?.telefone,
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

      P.avisar(
        /API_KEY|IA configurada/i.test(motivo)
          ? `${motivo}${onde} A chave precisa existir no ambiente que a extensão chama — se o endereço é o da Vercel, é lá que ela tem de estar.`
          : `${motivo}${onde}`,
        "perigo"
      );

      return;
    }

    P.resumo = resposta.dados;

    if (P.ultimoDado) P.render(P.ultimoDado);
    else desenharResumo();
  };

  /** O bloco do resumo e o de guardar a conversa, nas telas que podem mostrá-los. */
  P.blocoResumo = function blocoResumo() {
    return blocoSoDoResumo() + blocoGuardarConversa();
  };

  /**
   * "Guardar a conversa na plataforma."
   *
   * Três tempos, e nada vai antes do segundo clique: o botão; a pergunta,
   * que diz quantas mensagens visíveis vão e que dado bancário é omitido;
   * e o resultado do servidor — quantas entraram, quantas já estavam, e
   * o link para abrir a conversa na plataforma. Guardar de novo leva só
   * as mensagens novas, pelo id que o WhatsApp dá a cada uma.
   */
  function blocoGuardarConversa() {

    if (!P.lerConversa) return "";

    if (P.guardarConversa === "gravando") {
      return '<div class="bloco"><p class="sub">Guardando a conversa…</p></div>';
    }

    if (P.guardarConversa?.confirmar) {
      return [
        '<div class="bloco">',
        '  <div class="cartao">',
        `    <p class="sub" style="margin:0 0 8px">Guardar as <strong>${P.guardarConversa.confirmar}</strong> mensagens visíveis desta conversa na plataforma? Dados bancários e de cartão são omitidos. Se ela já foi guardada, entram só as novas.</p>`,
        '    <div class="linha" style="gap:6px;justify-content:flex-end">',
        '      <button class="passo" data-acao="guardar-conversa-nao">cancelar</button>',
        '      <button class="copiar" data-acao="guardar-conversa-sim">Guardar</button>',
        '    </div>',
        '  </div>',
        '</div>',
      ].join("");
    }

    if (P.guardarConversa?.id) {
      const r = P.guardarConversa;
      return [
        '<div class="bloco">',
        '  <div class="linha">',
        `    <span class="sub"><span class="tag ok">guardada</span> ${r.novas} ${r.novas === 1 ? "mensagem nova" : "mensagens novas"}${r.repetidas ? ` · ${r.repetidas} já estavam` : ""}${r.omitidos ? ` · ${r.omitidos} dado(s) bancário(s) omitido(s)` : ""}</span>`,
        `    <button class="passo" data-acao="abrir-url" data-url="${CW.escapar(r.url ?? "")}">abrir</button>`,
        '  </div>',
        '</div>',
      ].join("");
    }

    return [
      '<div class="bloco">',
      '  <button class="passo" data-acao="guardar-conversa" style="width:100%;padding:7px">Guardar a conversa na plataforma</button>',
      '</div>',
    ].join("");
  }

  P.confirmarGuardarConversa = async function confirmarGuardarConversa() {

    if (!P.lerConversa) return;

    const leitura = P.lerConversa();
    const mensagens = Array.isArray(leitura) ? leitura : (leitura?.mensagens ?? []);

    if (mensagens.length === 0) {
      P.avisar("Não consegui ler as mensagens desta conversa. Role a conversa para cima e tente de novo.", "atencao");
      return;
    }

    P.guardarConversa = { confirmar: mensagens.length };
    P.redesenharComResumo();
  };

  P.executarGuardarConversa = async function executarGuardarConversa() {

    const leitura = P.lerConversa?.();
    const mensagens = Array.isArray(leitura) ? leitura : (leitura?.mensagens ?? []);

    P.guardarConversa = "gravando";
    P.redesenharComResumo();

    /*
      O caso que o painel reconheceu vai como vínculo — só quando é um só:
      com dois, escolher um seria chute, e o vínculo se faz na plataforma.
    */
    const casos = P.ultimoDado?.casos ?? [];

    const resposta = await CW.enviar({
      tipo: "guardarConversa",
      corpo: {
        contato: { nome: P.consulta?.nome, telefone: P.consulta?.telefone },
        mensagens: mensagens.map((m) => ({ id: m.id, de: m.de, texto: m.texto, carimbo: m.carimbo, autor: m.autor })),
        protocolo: casos.length === 1 ? casos[0].protocolo : undefined,
      },
    });

    if (!resposta.ok || resposta.dados?.erro || !resposta.dados?.id) {
      P.guardarConversa = null;
      P.redesenharComResumo();
      P.avisar(resposta.dados?.erro ?? resposta.erro ?? "A conversa não foi guardada.", "perigo");
      return;
    }

    P.guardarConversa = resposta.dados;
    P.redesenharComResumo();
  };

  /** Redesenha a tela atual, que é onde o bloco do resumo aparece. */
  P.redesenharComResumo = function redesenharComResumo() {
    if (P.ultimoDado) P.render(P.ultimoDado);
    else desenharResumo();
  };

  function blocoSoDoResumo() {

    if (!P.lerConversa) return "";

    if (!P.resumo) {
      return [
        '<div class="bloco">',
        '  <button class="copiar" data-acao="resumir" style="width:100%;padding:8px">',
        '    Resumir e escrever a resposta (~10 s)',
        '  </button>',
        '  <p class="sub" style="margin-top:6px">',
        '    Lê as mensagens visíveis desta conversa e devolve o resumo, o humor e três respostas prontas para escolher e enviar. Só acontece quando você clica.',
        '  </p>',
        '</div>',
      ].join("");
    }

    const tom =
      P.resumo.humor <= 2
        ? "perigo"
        : P.resumo.humor === 3
          ? "neutro"
          : "ok";

    if (P.resumoRecolhido) {
      return [
        '<div class="bloco">',
        '  <div class="linha">',
        `    <span class="rotulo">Resumo · ${CW.escapar(P.resumo.assunto ?? "conversa")}</span>`,
        '    <button class="passo" data-acao="expandir-resumo">abrir</button>',
        '  </div>',
        '</div>',
      ].join("");
    }

    return [
      '<div class="bloco">',
      '  <div class="linha">',
      '    <span class="rotulo">Resumo da conversa</span>',
      '    <button class="passo" data-acao="recolher-resumo" title="Recolher e devolver o espaço do painel">recolher</button>',
      '  </div>',
      '  <div class="cartao">',
      '    <div class="linha">',
      `      <span class="nome" style="font-size:13px">${CW.escapar(P.resumo.assunto ?? "Conversa")}</span>`,
      `      <span class="tag ${tom}">${HUMOR[P.resumo.humor] ?? "\u2014"}</span>`,
      '    </div>',
      `    <p class="sub" style="margin-top:6px;color:var(--suave)">${CW.escapar(P.resumo.resumo ?? "")}</p>`,
      `    <p class="sub" style="margin-top:8px"><strong>Pendência:</strong> ${CW.escapar(P.resumo.pendencia ?? "\u2014")}</p>`,
      `    <p class="sub" style="margin-top:4px"><strong>Próximo passo:</strong> ${CW.escapar(P.resumo.proximoPasso ?? "\u2014")}</p>`,
      '    <p class="sub" style="margin-top:8px">',
      P.resumo.resolvido
        ? '      <span class="tag ok">parece resolvido</span>'
        : '      <span class="tag atencao">ainda não resolvido</span>',
      `      <span style="margin-left:6px">${P.resumo.mensagensLidas ?? 0} mensagens lidas</span>`,
      '    </p>',
      '  </div>',
      /*
        As três respostas, para escolher e enviar.

        Ficam aqui, no resumo, e não só no dossiê. É onde a pessoa está
        quando vai escrever: quem clicou em "Resumir" está com o cliente
        na linha. O dossiê é para entender um caso; o resumo é para
        responder.

        A primeira vem aberta e as outras fechadas. Abrir as três
        empurraria o resto do painel para fora da tela, e na maioria das
        conversas a primeira é a que serve.
      */
      Array.isArray(P.resumo.respostas) &&
      P.resumo.respostas.length > 0
        ? P.resumo.respostas
            .map((r, i) =>
              [
                `  <details class="macro" style="margin-top:7px" ${i === 0 ? "open" : ""}>`,
                '    <summary style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px">',
                `      <span style="font-weight:600;font-size:12.5px">${CW.escapar(r.titulo ?? `Resposta ${i + 1}`)}</span>`,
                `      <button class="copiar" data-acao="copiar" data-texto="${CW.escapar(r.texto ?? "")}">copiar</button>`,
                '    </summary>',
                r.quando
                  ? `    <p class="sub" style="margin:5px 0 0;color:var(--suave)">${CW.escapar(r.quando)}</p>`
                  : "",
                `    <pre style="max-height:none">${CW.escapar(r.texto ?? "")}</pre>`,
                '  </details>',
              ].join("")
            )
            .join("")
        : /*
            O modelo antigo devolvia um rascunho só.

            Manter o caminho de volta importa: uma extensão nova contra
            um servidor que ainda não subiu — ou um provedor que ignorou
            o campo novo — não pode ficar sem nenhuma resposta na tela.
          */
          [
            '  <div class="macro" style="margin-top:7px">',
            '    <div class="linha">',
            '      <span style="font-weight:600;font-size:12.5px">Rascunho de resposta</span>',
            `      <button class="copiar" data-acao="copiar" data-texto="${CW.escapar(P.resumo.resposta ?? "")}">copiar</button>`,
            '    </div>',
            `    <pre style="max-height:none">${CW.escapar(P.resumo.resposta ?? "")}</pre>`,
            '  </div>',
          ].join(""),

      '  <button class="copiar" data-acao="resumir" style="width:100%;margin-top:7px;padding:7px">Resumir de novo</button>',
      '</div>',
    ].join("");
  }

  function desenharResumo() {
    P.corpo.innerHTML = P.blocoResumo();
    P.corpo.scrollTop = 0;
  }
})();
