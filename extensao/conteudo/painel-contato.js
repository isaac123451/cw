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

    /*
      O que a conversa já revelou sobre este contexto continua valendo
      quando o site manda o mesmo contexto de novo — sem isto, a consulta
      reforçada e a fraca se alternariam a cada leitura da página.
    */
    const reforco = reforcoPorContexto.get(chaveDoContexto(novo));
    if (reforco) novo = { ...novo, ...reforco };

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

    /* O número da conversa aberta sobrevive à busca manual: é ele que o "É este" lembra. */
    if (novo?.telefone) {
      P.telefoneDaConversa = novo.telefone;
      P.nomeDaConversa = novo.nome ?? "";
    }
    P.ultimoDado = null;

    // Contato novo de verdade: a recusa anterior não vale mais.
    P.fechadoNaMao = false;

    // E o resumo da conversa anterior não descreve esta.
    P.resumo = null;

    // Nem a aba escolhida para o contato anterior.
    P.abaDoContato = "agora";

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

    /* Uma linha com a ação ao lado (out/2026) — era um aviso âmbar e um botão roxo da largura da gaveta. */
    return [
      '<div class="bloco">',
      '  <div class="aviso aviso-linha">',
      `    <span>Já está em <strong>${CW.escapar(outros.join(", "))}</strong>, ainda não em <strong>${CW.escapar(daPagina)}</strong>.</span>`,
      `    <button class="link-mais" data-acao="cadastrar-canal" title="Abre a prévia do caso neste canal, com nome e telefone já preenchidos">Cadastrar aqui</button>`,
      '  </div>',
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

      /* Onde o painel está: decide a ordem dos textos prontos (out/2026). */
      site: canalDaPagina(),
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

    /*
      Clicar na aba em que já se está **recarrega** aquela tela (out/2026).

      Até a 1.134 voltava ao contato — e como não havia aba do contato,
      era o único caminho de volta, escondido num gesto que ninguém
      adivinha. Agora o contato tem aba própria.
    */
    if (pedido === "contato") return P.voltarAoContato();

    if (pedido === "painel") {
      if (P.vista === "painel") return P.carregarPainel();
      P.vista = "painel";
      P.canal = "todos";
      P.refletirCanal();
      P.carregarPainel();
      return;
    }

    if (pedido === "atividades") {
      if (P.vista === "atividades") {
        return P.carregarAtividades();
      }
      P.vista = "atividades";
      P.canal = "todos";
      P.refletirCanal();
      P.carregarAtividades();
      return;
    }

    if (P.vista === "fila" && P.canal === pedido) {
      return P.carregarFila();
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

  /** O nome da tela para onde o voltar do caso leva. */
  P.rotuloDeOnde = function rotuloDeOnde() {
    if (P.vistaAnterior === "atividades") return "Agenda";
    if (P.vistaAnterior === "painel") return "Painel";
    if (P.veioDaFila && P.vistaAnterior === "fila") {
      return { "reclame-aqui": "Reclame Aqui", nps: "NPS", social: "Redes Sociais" }[P.canal] ?? "Lista";
    }
    return "Cliente";
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

    /*
      O voltar do cabeçalho saiu em out/2026: as telas de cima têm aba
      própria, e o caso aberto mostra no alto "← de onde veio".
    */
    /*
      Qual aba fica marcada. O caso aberto mantém marcada a aba de onde
      veio — a fila do canal, o Painel ou a Agenda —, e o caso aberto a
      partir do contato mantém o Cliente.
    */
    const daVista = P.vista === "caso" ? P.vistaAnterior : P.vista;
    const ativo =
      daVista === "painel"
        ? "painel"
        : daVista === "atividades"
          ? "atividades"
          : daVista === "fila" && P.canal !== "todos"
            ? P.canal
            : daVista === "fila"
              ? ""
              : "contato";

    for (const botao of P.raiz.querySelectorAll(
      '[data-acao="canal"]'
    )) {
      botao.setAttribute(
        "aria-pressed",
        botao.dataset.canal === ativo ? "true" : "false"
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

    const chave = P.chaveConsulta;
    const resposta = await CW.enviar({
      tipo: "contexto",
      consulta: P.parametros(),
    });

    if (!resposta.ok || chave !== P.chaveConsulta) return;

    P.ultimoDado = resposta.dados;

    marcarSelo(resposta.dados?.cliente?.abertos ?? 0);

    /* Fechado também: contato conhecido, a conversa começa a se guardar. */
    ligarRelogioDeGuardar();
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

      /*
        Conhecido pelo NPS ou pela conta, mas sem reclamação: não é "nada
        encontrado". Até a 1.35 esta tela dizia isso para o cliente do NPS
        que estava ali, com ciclo aberto.
      */
      if (dados?.nps || dados?.estabelecimento) {
        P.corpo.innerHTML = blocoReconhecido(dados);
        P.corpo.insertAdjacentHTML("beforeend", P.blocoResumo());
        marcarSelo(null);
        P.pedirSinaisDaConversa();
        ligarCopiloto();
        return;
      }

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

      // Quem é? Candidatos pelo nome do contato, e o "É este" que a extensão lembra.
      P.corpo.insertAdjacentHTML("beforeend", blocoQuemE());
      P.pedirQuemE();

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

      // Antes de desistir: o cliente pode ter escrito o e-mail, o CPF ou o protocolo.
      if (P.tentarPelaConversa()) return;

      // Sem cadastro é quando mais vale saber que a mensagem é a de um RA.
      P.pedirSinaisDaConversa();
      ligarCopiloto();
      return;
    }

    const cliente = dados.cliente;

    const [tom, rotuloConfianca] =
      TOM_CONFIANCA[dados.confianca] ?? TOM_CONFIANCA.nenhuma;

    const partes = [];

    /* O que fica em cada aba; o que está em `partes` fica fixo, acima delas. */
    const abas = { agora: [], dossie: [], responder: [], historico: [], caso: [] };

    /* A aba Caso (1.127): o formulário carrega quando a aba abre. */
    const casoParaEditar = (dados.casos ?? []).find((c) => c.aberto) ?? (dados.casos ?? [])[0];
    if (casoParaEditar?.protocolo) {
      abas.caso.push(`<div class="bloco" data-bloco="editar-caso" data-protocolo="${CW.escapar(casoParaEditar.protocolo)}"><p class="sub">Carregando o caso ${CW.escapar(casoParaEditar.protocolo)}…</p></div>`);
    }

    if (dados.aviso) {
      partes.push(
        `<div class="aviso">${CW.escapar(dados.aviso)}</div>`
      );
    }

    // Antes de tudo, o que pede cuidado com esta pessoa, em uma linha cada.
    // (A lista existe mesmo vazia: os sinais da conversa chegam depois.)
    partes.push(blocoCabecalho(dados, tom, rotuloConfianca));
    partes.push(blocoVinculo(dados));
    partes.push(blocoAvisos(P.avisosDoContato(dados), true));

    // O resumo vem primeiro: responde "o que está havendo aqui".
    abas.agora.push(P.blocoResumo());

    // Depois, o atalho de capturar a reclamação que está na tela.
    abas.agora.push(blocoOutroCanal(dados));
    abas.agora.push(P.blocoCaptura(dados));

    /* ---- cliente ---- */

    abas.historico.push(`
      <div class="bloco">
        <div class="rotulo">Cliente</div>
        <div class="cartao">
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

      abas.historico.push(`
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
      abas.agora.push(
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
      abas.agora.push(`
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
      abas.historico.push(`
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
    abas.dossie.push(
      P.blocoDossie(dados.casos?.[0]?.protocolo ?? "")
    );

    /* ---- macros ---- */

    if ((dados.macros ?? []).length > 0) {
      abas.responder.push(`
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
              ${macro.canal ? `<span class="tag neutro" style="margin-top:4px">${CW.escapar(macro.canal)}</span>` : ""}
              <pre>${CW.escapar(macro.texto)}</pre>
              ${
                /* Nome, protocolo e quem atende já vêm preenchidos; o que é para escrever fica dito. */
                (macro.preencher ?? []).length
                  ? `<p class="sub" style="margin-top:6px;color:var(--atencao)">Para escrever antes de mandar: ${macro.preencher.map((t) => CW.escapar(t)).join(", ")}</p>`
                  : ""
              }
            </div>`
            )
            .join("")}
        </div>`);
    }

    abas.agora.push(blocoAcoesRapidas(dados));

    partes.push(P.blocoAbas(abas, dados));

    P.corpo.innerHTML = partes.join("");
    P.corpo.scrollTop = 0;

    marcarSelo(cliente.abertos);

    P.pedirSinaisDaConversa();
    ligarRelogioDeGuardar();
    ligarCopiloto();
  };

  /* ============================================================
     PERGUNTAR AO ASSISTENTE (Fase 16)
  ============================================================ */

  /*
    A conversa com o assistente, por contato (1.125): trocar de conversa no
    WhatsApp não mistura as perguntas de um cliente com as de outro.
  */
  P.conversasDoAssistente = P.conversasDoAssistente ?? {};

  function conversaDoContato() {
    const chave = P.chaveConsulta ?? "";
    P.conversasDoAssistente[chave] = P.conversasDoAssistente[chave] ?? [];
    return P.conversasDoAssistente[chave];
  }

  function htmlDaConversa(conversa) {
    return conversa
      .map((t) =>
        [
          `<p class="sub" style="margin:8px 0 2px;font-weight:600;color:inherit">${CW.escapar(t.pergunta)}</p>`,
          t.resposta
            ? `<p style="margin:0;white-space:pre-wrap;font-size:12.5px;line-height:1.45">${CW.escapar(t.resposta)}</p>`
            : t.erro
              ? `<p class="sub falha" style="margin:0">${CW.escapar(t.erro)}</p>`
              : `<p class="sub" style="margin:0">Pensando…</p>`,
        ].join("")
      )
      .join("");
  }

  /**
   * Perguntar ao assistente sobre o cliente aberto, ali mesmo (1.125, Fase
   * 28). Até a 1.124 era um link que abria a página do assistente numa aba
   * nova; agora a resposta vem no painel, com os casos do cliente junto.
   */
  /**
   * Perguntar, anotar e lembrar, atrás de três botões (out/2026).
   *
   * Até a 1.134 os três formulários ficavam abertos um embaixo do outro
   * no "Agora": dez campos e três botões roxos antes de chegar ao fim
   * da tela, todo atendimento. Agora é uma linha; o formulário abre no
   * clique, um de cada vez, e continua aberto se a tela redesenhar.
   */
  P.acaoRapida = P.acaoRapida ?? "";

  function blocoAcoesRapidas(dados) {
    const podeAnotar = P.podeEscrever(dados) && (dados?.casos ?? []).length > 0;
    /* Uma conversa com o assistente em andamento já abre o painel dele. */
    const aberta = P.acaoRapida || (conversaDoContato().length ? "assistente" : "");
    const botao = (qual, icone, rotulo) =>
      `<button class="acao-chip" type="button" data-acao="acao-rapida" data-qual="${qual}" aria-expanded="${aberta === qual}">${CW.icone(icone, 14)}<span>${rotulo}</span></button>`;
    return [
      '<div class="bloco acoes-rapidas">',
      '  <div class="grade-acoes tres">',
      botao("assistente", "assistente", "Perguntar"),
      podeAnotar ? botao("anotar", "anotar", "Anotar") : "",
      podeAnotar ? botao("lembrete", "lembrete", "Lembrete") : "",
      '  </div>',
      `  <div class="painel-acao" data-painel="assistente"${aberta === "assistente" ? "" : " hidden"}>${blocoPerguntar(dados)}</div>`,
      podeAnotar ? `  <div class="painel-acao" data-painel="anotar"${aberta === "anotar" ? "" : " hidden"}>${P.blocoAnotar(dados, "caso")}</div>` : "",
      podeAnotar ? `  <div class="painel-acao" data-painel="lembrete"${aberta === "lembrete" ? "" : " hidden"}>${P.blocoAnotar(dados, "lembrete")}</div>` : "",
      '</div>',
    ].join("");
  }

  P.alternarAcaoRapida = function alternarAcaoRapida(alvo) {
    const qual = alvo.dataset.qual ?? "";
    const bloco = alvo.closest(".acoes-rapidas");
    if (!bloco) return;
    P.acaoRapida = P.acaoRapida === qual ? "" : qual;
    for (const b of bloco.querySelectorAll('[data-acao="acao-rapida"]')) {
      b.setAttribute("aria-expanded", String(b.dataset.qual === P.acaoRapida));
    }
    for (const painel of bloco.querySelectorAll(".painel-acao")) {
      painel.hidden = painel.dataset.painel !== P.acaoRapida;
    }
    /* O primeiro campo do formulário que abriu já recebe o cursor. */
    bloco
      .querySelector(`.painel-acao[data-painel="${P.acaoRapida}"] textarea, .painel-acao[data-painel="${P.acaoRapida}"] input`)
      ?.focus({ preventScroll: false });
  };

  function blocoPerguntar(dados) {
    const casos = dados?.casos ?? [];
    const caso = casos.find((c) => c.aberto) ?? casos[0];
    const sobre = caso?.protocolo ? `o caso ${caso.protocolo}` : dados?.cliente?.nome || "este cliente";
    const sugestoes = caso?.protocolo
      ? ["O que fazer agora neste caso?", "O que falta para ele fechar?", "Como responder a última mensagem?"]
      : ["O que já sabemos deste cliente?", "Como abordar este cliente?"];
    return [
      `<div class="cartao" data-bloco="assistente">`,
      `  <div class="sub" style="margin-bottom:2px">Sobre ${CW.escapar(sobre)}</div>`,
      `  <div class="assistente-conversa">${htmlDaConversa(conversaDoContato())}</div>`,
      `  <div class="sugestoes-pergunta">`,
      ...sugestoes.map((s) => `    <button type="button" class="chip" data-acao="perguntar-assistente" data-pergunta="${CW.escapar(s)}">${CW.escapar(s)}</button>`),
      `  </div>`,
      `  <div class="pergunta-linha">`,
      `    <textarea class="campo" rows="1" data-acao="pergunta-assistente-campo" maxlength="500" placeholder="Ou escreva — Enter envia"></textarea>`,
      `    <button class="acao" data-acao="perguntar-assistente">Perguntar</button>`,
      `  </div>`,
      `</div>`,
    ].join("");
  }

  /** Redesenha só a conversa — o resto do painel não pisca nem perde a rolagem. */
  function redesenharConversa() {
    const alvo = P.corpo?.querySelector('[data-bloco="assistente"] .assistente-conversa');
    if (alvo) alvo.innerHTML = htmlDaConversa(conversaDoContato());
  }

  P.perguntarAoAssistente = async function (alvo) {
    const bloco = alvo.closest('[data-bloco="assistente"]');
    const campo = bloco?.querySelector('[data-acao="pergunta-assistente-campo"]');
    const pergunta = String(alvo.dataset.pergunta || campo?.value || "").trim();
    if (!pergunta) return;
    const conversa = conversaDoContato();
    if (conversa.some((t) => !t.resposta && !t.erro)) return;
    if (campo) campo.value = "";

    const turno = { pergunta, resposta: "", erro: "" };
    const historico = conversa
      .filter((t) => t.resposta)
      .flatMap((t) => [
        { role: "user", content: t.pergunta },
        { role: "assistant", content: t.resposta },
      ]);
    conversa.push(turno);
    redesenharConversa();

    const dados = P.ultimoDado ?? {};
    const resposta = await CW.enviar({
      tipo: "perguntarAoAssistente",
      pergunta,
      protocolos: (dados.casos ?? []).map((c) => c.protocolo).filter(Boolean).slice(0, 3),
      nome: dados.cliente?.nome ?? "",
      telefone: dados.cliente?.telefone ?? "",
      historico,
    });

    if (resposta?.ok && resposta.dados?.ok) turno.resposta = String(resposta.dados.resposta ?? "");
    else turno.erro = resposta?.dados?.erro || resposta?.erro || "O assistente não respondeu agora.";
    redesenharConversa();
  };

  /* ============================================================
     GUARDAR SOZINHO (Fase 18)
  ============================================================ */

  /**
   * A conversa de um contato identificado se guarda sozinha enquanto
   * está na tela — só o que é novo, e dá para pausar por conversa.
   *
   * Por quê: o botão "Guardar a conversa" dependia de lembrar de
   * clicar, e a conversa que mais importa guardar é justamente a que
   * corre enquanto a pessoa está ocupada respondendo. A rota acrescenta
   * só as mensagens que ainda não tinha, pelo id de cada uma — mandar de
   * novo não duplica.
   *
   * **Com o painel fechado também.** Até a 1.34 só guardava com o painel
   * aberto, na vista do contato, e só com caso ou NPS aberto: em uma
   * semana de uso, 2 conversas guardadas ao todo. Agora basta a conversa
   * estar aberta no WhatsApp e o contato ser conhecido (caso, NPS ou
   * estabelecimento), pela consulta silenciosa que já acende o selo do
   * botão. Quem não é conhecido continua no botão, com confirmação.
   * Nunca mais de uma gravação ao mesmo tempo.
   */
  const INTERVALO_DE_GUARDAR_MS = 20_000;
  const MAXIMO_DE_PAUSADAS = 100;
  const guardadasPorConversa = new Map();
  const totalPorConversa = new Map();
  const falhaPorConversa = new Map();
  let gravandoSozinho = false;
  let relogioDeGuardar = null;

  function telefoneDaConversa() {
    const d = String(P.consulta?.telefone ?? "").replace(/\D/g, "");
    return d.length >= 8 ? d.slice(-8) : "";
  }

  P.podeGuardarSozinho = function podeGuardarSozinho(dados = P.ultimoDado) {
    if (!P.lerConversa || !telefoneDaConversa() || !dados) return false;
    return Boolean(dados.cliente || dados.nps || dados.estabelecimento);
  };

  /* O botão da extensão diz, mesmo fechado, que esta conversa está sendo guardada. */
  function marcarGatilho() {
    const gatilho = P.raiz?.querySelector(".gatilho");
    if (!gatilho) return;
    const guardando = P.podeGuardarSozinho() && !pausada();
    gatilho.classList.toggle("guardando", guardando);
    gatilho.title = guardando ? "CW Reputação · guardando esta conversa" : "CW Reputação";
  }
  P.marcarGatilho = marcarGatilho;

  function pausada() {
    return Boolean(P.config?.guardarPausado?.[telefoneDaConversa()]);
  }

  function textoDoEstadoDeGuardar() {
    const tel = telefoneDaConversa();
    if (pausada()) {
      return `<span class="sub">Guardar sozinho está pausado nesta conversa.</span>
        <a data-acao="pausar-guardar">retomar</a>`;
    }
    const falha = falhaPorConversa.get(tel);
    const total = totalPorConversa.get(tel) ?? 0;
    const texto = falha
      ? `Não guardou agora: ${CW.escapar(falha)} Tenta de novo sozinho.`
      : total > 0
        ? `Guardando sozinho · ${total} ${total === 1 ? "mensagem nova guardada" : "mensagens novas guardadas"}`
        : "Guardando sozinho o que for novo nesta conversa";
    return `<span class="sub">${texto}</span> <a data-acao="pausar-guardar">pausar</a>`;
  }

  function desenharEstadoDeGuardar() {
    const el = P.corpo?.querySelector("[data-guardar-estado]");
    if (el) el.innerHTML = textoDoEstadoDeGuardar();
    marcarGatilho();
  }

  /** O áudio em base64, para a transcrição — só o que a pessoa já ouviu (1.82). */
  function emBase64(blob) {
    return new Promise((ok, falha) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result).split(",")[1] || "");
      leitor.onerror = falha;
      leitor.readAsDataURL(blob);
    });
  }

  async function transcreverAudios(audios) {
    const saida = [];
    for (const a of audios) {
      try {
        const blob = await fetch(a.endereco).then((r) => r.blob());
        if (!blob.size || blob.size > 3_000_000) continue;
        const r = await CW.enviar({ tipo: "transcrever", corpo: { base64: await emBase64(blob), mime: blob.type || "audio/ogg" } });
        const texto = String(r?.dados?.texto ?? "").trim();
        if (texto) {
          saida.push({ id: `${a.id}:t`, de: a.de, texto: `Transcrição do áudio${a.duracao ? ` (${a.duracao})` : ""}: ${texto}`, transcricao: true });
        }
      } catch {
        /* o áudio fica para a próxima volta */
      }
    }
    return saida;
  }

  const ultimoAvisoDeFalha = new Map();

  P.guardarSozinho = async function guardarSozinho() {

    /* Aberto ou fechado: o que manda é haver conversa na tela e contato conhecido. */
    if (gravandoSozinho || document.hidden) return;
    if (!P.podeGuardarSozinho() || pausada()) return;
    const deQuem = P.chaveConsulta;

    const tel = telefoneDaConversa();
    const leitura = P.lerConversa();
    const mensagens = (Array.isArray(leitura) ? leitura : leitura?.mensagens ?? []).filter(
      (m) => m && m.id && typeof m.texto === "string" && m.texto.trim() !== ""
    );

    const ja = guardadasPorConversa.get(tel) ?? new Set();
    const novas = mensagens.filter((m) => !ja.has(m.id));
    /* Áudio que a pessoa ouviu e ainda não foi transcrito — dois por volta, para não segurar a gravação. */
    const audiosNovos = (CW.lerAudios?.() ?? []).filter((a) => a.endereco && !ja.has(`${a.id}:t`)).slice(0, 2);
    if (novas.length === 0 && audiosNovos.length === 0) return;

    gravandoSozinho = true;
    try {
      const transcritas = await transcreverAudios(audiosNovos);
      if (novas.length === 0 && transcritas.length === 0) return;
      const dados = P.ultimoDado ?? {};
      const casos = dados.casos ?? [];
      /* O caso aberto mais recente liga a conversa à ficha dele; o NPS e a conta, às deles. */
      const abertos = casos.filter((c) => c.aberto);
      const caso = abertos.length === 1 ? abertos[0] : casos.length === 1 ? casos[0] : null;
      const resposta = await CW.enviar({
        tipo: "guardarConversa",
        corpo: {
          contato: { nome: P.consulta?.nome, telefone: P.consulta?.telefone },
          mensagens: [
            ...novas.map((m) => ({ id: m.id, de: m.de, texto: m.texto, carimbo: m.carimbo, autor: m.autor })),
            ...transcritas,
          ],
          protocolo: caso?.protocolo,
          npsId: dados.nps?.id,
          estabelecimentoId: dados.estabelecimento?.id,
        },
      });

      /* Trocou de conversa no meio da gravação: o resultado é da anterior. */
      if (deQuem !== P.chaveConsulta) return;

      if (resposta?.ok && resposta.dados?.id && !resposta.dados?.erro) {
        for (const m of novas) ja.add(m.id);
        for (const t of transcritas) ja.add(t.id);
        /* O aviso sem abrir nada (1.82): quantas entraram e onde. */
        const entraram = Number(resposta.dados.novas) || 0;
        if (entraram > 0) {
          CW.notificar?.(
            `Conversa guardada · ${entraram} ${CW.plural(entraram, "nova", "novas")}${transcritas.length ? ` · ${transcritas.length} ${CW.plural(transcritas.length, "áudio", "áudios")} ${CW.plural(transcritas.length, "transcrito", "transcritos")}` : ""}${caso?.protocolo ? ` · ${caso.protocolo}` : ""}`
          );
        }
        ultimoAvisoDeFalha.delete(tel);
        guardadasPorConversa.set(tel, ja);
        totalPorConversa.set(tel, (totalPorConversa.get(tel) ?? 0) + (resposta.dados.novas ?? 0));
        falhaPorConversa.delete(tel);
      } else {
        const erro = resposta?.dados?.erro ?? resposta?.erro ?? "sem resposta da plataforma.";
        falhaPorConversa.set(tel, erro);
        /* A falha avisa uma vez por motivo — a volta seguinte não repete o mesmo aviso. */
        if (ultimoAvisoDeFalha.get(tel) !== erro) {
          ultimoAvisoDeFalha.set(tel, erro);
          CW.notificar?.(`A conversa não foi guardada: ${erro}`, "erro");
        }
      }
    } catch {
      falhaPorConversa.set(tel, "sem resposta da plataforma.");
    } finally {
      gravandoSozinho = false;
      desenharEstadoDeGuardar();
    }
  };

  function ligarRelogioDeGuardar() {
    marcarGatilho();
    if (!P.podeGuardarSozinho()) return;
    // A primeira logo depois de desenhar; as outras no ritmo da conversa.
    setTimeout(() => P.guardarSozinho(), 1500);
    if (!relogioDeGuardar) {
      relogioDeGuardar = setInterval(() => P.guardarSozinho(), INTERVALO_DE_GUARDAR_MS);
    }
  }

  P.alternarPausaDeGuardar = function alternarPausaDeGuardar() {
    const tel = telefoneDaConversa();
    if (!tel) return;
    const mapa = { ...(P.config?.guardarPausado ?? {}) };
    if (mapa[tel]) delete mapa[tel];
    else mapa[tel] = Date.now();

    // chrome.storage.sync guarda até 8 KB por item: ficam as pausas mais recentes.
    const recentes = Object.entries(mapa)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAXIMO_DE_PAUSADAS);
    P.config = { ...(P.config ?? {}), guardarPausado: Object.fromEntries(recentes) };
    CW.enviar({ tipo: "salvar", parcial: { guardarPausado: P.config.guardarPausado } });

    desenharEstadoDeGuardar();
    if (!pausada()) P.guardarSozinho();
  };

  /* ============================================================
     AS QUATRO ABAS (Fase 17)
  ============================================================ */

  /**
   * Agora, Dossiê, Responder e Histórico.
   *
   * O painel era uma coluna só, com tudo empilhado: o resumo, a captura,
   * o cliente, o estabelecimento, o NPS, as reclamações, o dossiê, os
   * textos. Achar a resposta pronta pedia rolar a tela inteira. Agora o
   * que vale para qualquer aba (quem é, os avisos, o completar) fica em
   * cima, fixo, e o resto se divide pelo que a pessoa veio fazer.
   *
   * Trocar de aba não refaz a busca nem redesenha: só mostra e esconde.
   * A aba escolhida vale para o contato até ele mudar.
   */
  const ABAS_DO_CONTATO = [
    { id: "agora", nome: "Agora" },
    { id: "dossie", nome: "Dossiê" },
    { id: "responder", nome: "Responder" },
    { id: "historico", nome: "Histórico" },
    { id: "caso", nome: "Caso" },
  ];

  P.blocoAbas = function blocoAbas(abas, dados) {

    const ativa = ABAS_DO_CONTATO.some((a) => a.id === P.abaDoContato) ? P.abaDoContato : "agora";
    /* Aba que quem montou não trouxe (a Caso, nos caminhos sem caso) é aba vazia — nunca derruba o painel. */
    const daAba = (id) => abas[id] ?? [];
    const vazio = (id) => daAba(id).every((html) => !String(html ?? "").trim());

    const contagem = {
      historico: dados?.totalCasos ?? (dados?.casos ?? []).length,
      responder: (dados?.macros ?? []).length,
    };

    const botoes = ABAS_DO_CONTATO.map(
      (a) => `<button type="button" role="tab" data-acao="aba-contato" data-aba="${a.id}"
        aria-selected="${a.id === ativa}">${CW.escapar(a.nome)}${contagem[a.id] ? ` <span class="aba-contagem">${contagem[a.id]}</span>` : ""}</button>`
    ).join("");

    const VAZIO = {
      agora: "Nada pendente aqui agora.",
      dossie: "O dossiê aparece quando houver caso ou conversa para montar.",
      responder: "Sem textos aprovados para este caso. O resumo da conversa, na aba Agora, traz três rascunhos.",
      historico: "Nenhuma reclamação registrada.",
      caso: "Sem caso para este contato — crie pela aba Agora.",
    };

    const paineis = ABAS_DO_CONTATO.map(
      (a) => `<section class="aba-painel" role="tabpanel" data-aba="${a.id}"${a.id === ativa ? "" : " hidden"}>${
        vazio(a.id) ? `<p class="aba-vazia">${VAZIO[a.id]}</p>` : daAba(a.id).join("")
      }</section>`
    ).join("");

    return `<nav class="abas-contato" role="tablist" aria-label="O que fazer com este contato">${botoes}</nav>${paineis}`;
  };

  P.trocarAbaDoContato = function trocarAbaDoContato(alvo) {
    const aba = alvo?.dataset?.aba;
    if (!aba || !P.corpo) return;
    P.abaDoContato = aba;
    for (const b of P.corpo.querySelectorAll('[data-acao="aba-contato"]')) {
      b.setAttribute("aria-selected", String(b.dataset.aba === aba));
    }
    for (const sec of P.corpo.querySelectorAll(".aba-painel")) {
      sec.hidden = sec.dataset.aba !== aba;
    }
    if (aba === "caso") P.carregarEdicaoDoCaso();
  };

  /* ============================================================
     O CASO, SEM SAIR DA EXTENSÃO (1.127, Fase 33)
  ============================================================ */

  /*
    "Uma tela na extensão para mexer no caso e preencher o que falta sem
    ir e voltar." Responsável, categoria, prioridade, estabelecimento,
    risco e o contato que falta — gravados pelo mesmo caminho da
    plataforma (só o que mudou; recusa se outra pessoa mexeu no meio).
  */
  const edicaoDoCaso = { protocolo: "", caso: null, opcoes: null, falta: [] };

  /* As opções dos seletores, escapadas aqui dentro — nomes vêm do cadastro. */
  function opcoesDe(lista, escolhido) {
    return lista.map((n) => `<option value="${CW.escapar(n)}"${n === escolhido ? " selected" : ""}>${CW.escapar(n)}</option>`).join("");
  }

  function opcoesDeEstabelecimento(lista, escolhido) {
    return lista.map((e) => `<option value="${CW.escapar(e.id)}"${e.id === escolhido ? " selected" : ""}>${CW.escapar(e.nome)}</option>`).join("");
  }

  function htmlDaEdicao(aviso) {
    const c = edicaoDoCaso.caso;
    const o = edicaoDoCaso.opcoes;
    if (!c || !o) return `<p class="sub">Carregando…</p>`;
    const categoria = o.categorias.find((x) => x.nome === c.categoria);
    /*
      Em grade de duas colunas, e o que falta preencher marcado no próprio
      campo (out/2026) — eram nove campos empilhados, e a lista "Falta:"
      no alto obrigava a procurar cada um.
    */
    const falta = (chave) => edicaoDoCaso.falta.some((f) => String(f).toLowerCase().includes(chave));
    const campo = (rotulo, html, faltando = false) =>
      `<label class="rotulo campo-caso${faltando ? " faltando" : ""}">${CW.escapar(rotulo)}${faltando ? ' <span class="falta-ponto">falta</span>' : ""}${html}</label>`;
    return [
      `<div class="linha"><span class="rotulo" style="margin:0">Caso ${CW.escapar(c.protocolo)}</span><span class="tag neutro">${CW.escapar(c.status)}</span></div>`,
      edicaoDoCaso.falta.length
        ? `<p class="sub" style="margin:4px 0 0;color:var(--atencao)">Falta no cadastro: ${edicaoDoCaso.falta.map((f) => CW.escapar(f)).join(", ")}.</p>`
        : `<p class="sub feito" style="margin:4px 0 0">${CW.icone("ok", 13)} Cadastro completo.</p>`,
      `<div class="cartao" style="margin-top:8px">`,
      `<div class="grade-campos">`,
      campo("Responsável", `<select class="campo" data-campo-caso="responsavel"><option value="">— ninguém —</option>${opcoesDe(o.responsaveis, c.responsavel)}</select>`, falta("respons")),
      campo("Prioridade", `<select class="campo" data-campo-caso="prioridade">${opcoesDe(o.prioridades, c.prioridade)}</select>`),
      campo("Categoria", `<select class="campo" data-campo-caso="categoria">${opcoesDe(o.categorias.map((x) => x.nome), c.categoria)}</select>`, falta("categ")),
      campo("Subcategoria", `<select class="campo" data-campo-caso="subcategoria"><option value="">—</option>${opcoesDe(categoria?.subcategorias ?? [], c.subcategoria)}</select>`, falta("subcat")),
      `</div>`,
      campo("Estabelecimento", `<select class="campo" data-campo-caso="estabelecimentoId"><option value="">— sem vínculo —</option>${opcoesDeEstabelecimento(o.estabelecimentos, c.estabelecimentoId)}</select>`, falta("estabelec")),
      `<div class="grade-campos">`,
      campo("Telefone", `<input class="campo" data-campo-caso="telefone" value="${CW.escapar(c.telefone)}" placeholder="DDD e número">`, falta("telefone")),
      campo("E-mail", `<input class="campo" data-campo-caso="email" value="${CW.escapar(c.email)}">`, falta("e-mail") || falta("email")),
      `</div>`,
      campo("CPF/CNPJ", `<input class="campo" data-campo-caso="documento" value="${CW.escapar(c.documento)}" placeholder="só números">`, falta("cpf") || falta("cnpj") || falta("document")),
      `<label class="sub" style="display:flex;gap:6px;align-items:center;margin-top:9px"><input type="checkbox" data-campo-caso="risco"${c.risco ? " checked" : ""}> Risco de cancelamento</label>`,
      `<div class="linha" style="margin-top:10px;align-items:center">`,
      `  <span class="sub${aviso?.erro ? " falha" : ""}" data-aviso-caso>${aviso ? CW.escapar(aviso.texto) : "Grava só o que você mudar."}</span>`,
      `  <button class="acao" style="margin-top:0" data-acao="salvar-edicao-caso">Salvar</button>`,
      `</div>`,
      `</div>`,
    ].join("");
  }

  function desenharEdicao(aviso) {
    const bloco = P.corpo?.querySelector('[data-bloco="editar-caso"]');
    if (bloco) bloco.innerHTML = htmlDaEdicao(aviso);
  }

  P.carregarEdicaoDoCaso = async function () {
    const bloco = P.corpo?.querySelector('[data-bloco="editar-caso"]');
    const protocolo = bloco?.dataset?.protocolo;
    if (!protocolo) return;
    if (edicaoDoCaso.protocolo === protocolo && edicaoDoCaso.caso) {
      desenharEdicao();
      return;
    }
    const r = await CW.enviar({ tipo: "lerEdicaoDoCaso", protocolo });
    if (!r?.ok || !r.dados?.ok) {
      if (bloco) bloco.innerHTML = `<p class="sub falha">${CW.escapar(r?.dados?.erro || r?.erro || "Não consegui abrir o caso agora.")}</p>`;
      return;
    }
    Object.assign(edicaoDoCaso, { protocolo, caso: r.dados.caso, opcoes: r.dados.opcoes, falta: r.dados.falta ?? [] });
    desenharEdicao();
  };

  P.atualizarSubcategorias = function (seletor) {
    const o = edicaoDoCaso.opcoes;
    const sub = seletor.closest('[data-bloco="editar-caso"]')?.querySelector('[data-campo-caso="subcategoria"]');
    if (!o || !sub) return;
    const categoria = o.categorias.find((x) => x.nome === seletor.value);
    sub.innerHTML = `<option value="">—</option>${opcoesDe(categoria?.subcategorias ?? [], "")}`;
  };

  P.salvarEdicaoDoCaso = async function (botao) {
    const c = edicaoDoCaso.caso;
    const bloco = botao.closest('[data-bloco="editar-caso"]');
    if (!c || !bloco) return;
    const valor = (campo) => {
      const el = bloco.querySelector(`[data-campo-caso="${campo}"]`);
      return el?.type === "checkbox" ? el.checked : String(el?.value ?? "").trim();
    };
    const mudancas = {};
    for (const campo of ["responsavel", "prioridade", "estabelecimentoId", "risco", "telefone", "email", "documento"]) {
      if (valor(campo) !== c[campo]) mudancas[campo] = valor(campo);
    }
    if (valor("categoria") !== c.categoria || valor("subcategoria") !== c.subcategoria) {
      mudancas.categoria = valor("categoria");
      mudancas.subcategoria = valor("subcategoria");
    }
    /* Aviso só na linha de status: o que foi digitado fica onde está. */
    const avisar = (texto, erro) => {
      const linha = bloco.querySelector("[data-aviso-caso]");
      if (linha) {
        linha.textContent = texto;
        linha.classList.toggle("falha", Boolean(erro));
      }
    };
    if (Object.keys(mudancas).length === 0) {
      avisar("Nada mudou.");
      return;
    }
    botao.disabled = true;
    botao.textContent = "Salvando…";
    /* O retrato carregado vai junto: o servidor recusa se alguém mexeu nesses campos no meio. */
    const r = await CW.enviar({ tipo: "salvarEdicaoDoCaso", protocolo: c.protocolo, mudancas, antes: c });
    if (r?.ok && r.dados?.ok) {
      edicaoDoCaso.caso = r.dados.caso;
      edicaoDoCaso.falta = r.dados.falta ?? [];
      const quantos = Object.keys(mudancas).length;
      desenharEdicao({ texto: "Salvo no CW Reputação." });
      /* A confirmação depois da resposta do servidor, com o que foi gravado. */
      CW.notificar?.(`${c.protocolo} salvo · ${quantos} ${CW.plural(quantos, "campo", "campos")}`);
      return;
    }
    botao.disabled = false;
    botao.textContent = "Salvar";
    avisar(r?.dados?.erro || r?.erro || "Não consegui salvar agora.", true);
  };

  /* ============================================================
     AVISOS AO ABRIR (Fase 17)
  ============================================================ */

  /**
   * O que quem vai responder precisa saber antes da primeira frase.
   *
   * Sai só do que a consulta já trouxe — nenhuma chamada a mais ao
   * abrir a conversa. O mais grave vem primeiro, e são no máximo
   * quatro: aviso demais vira papel de parede.
   */
  const PESO_DO_TOM = { perigo: 0, atencao: 1, neutro: 2 };
  const TETO_DE_AVISOS = 5;

  P.avisosDoContato = function avisosDoContato(dados, agora = Date.now()) {

    const cliente = dados?.cliente;
    if (!cliente) return [];

    const avisos = [];
    const abertos = (dados.casos ?? []).filter((c) => c.aberto);

    for (const caso of abertos) {
      if (caso.sla?.situacao === "estourado") {
        avisos.push({ tom: "perigo", texto: `Prazo estourado em ${caso.protocolo}` });
      } else if (caso.sla?.situacao === "atencao") {
        avisos.push({ tom: "atencao", texto: `${caso.protocolo}: ${caso.sla.rotulo}` });
      }
    }

    if (cliente.risco) {
      avisos.push({ tom: "perigo", texto: "Risco de cancelamento" });
    }

    const nps = dados.nps;
    if (nps && !nps.encerrado && typeof nps.nota === "number" && nps.nota <= 6) {
      const dias = nps.respondidoEm
        ? Math.floor((agora - new Date(nps.respondidoEm).getTime()) / 86_400_000)
        : null;
      avisos.push({
        tom: "perigo",
        texto: `Detrator do NPS (nota ${nps.nota})${
          dias === null ? "" : dias <= 0 ? ", respondeu hoje" : dias === 1 ? " há 1 dia" : ` há ${dias} dias`
        }`,
      });
    }

    if (cliente.total >= 2) {
      avisos.push({
        tom: cliente.total >= 3 ? "atencao" : "neutro",
        texto: `Já reclamou ${cliente.total} vezes`,
      });
    }

    if (cliente.naoResolvidos > 0) {
      avisos.push({
        tom: "atencao",
        texto: cliente.naoResolvidos === 1
          ? "1 reclamação terminou sem solução"
          : `${cliente.naoResolvidos} reclamações terminaram sem solução`,
      });
    }

    return avisos
      .map((a, i) => ({ ...a, i }))
      .sort((a, b) => PESO_DO_TOM[a.tom] - PESO_DO_TOM[b.tom] || a.i - b.i)
      .slice(0, 4)
      .map(({ tom, texto }) => ({ tom, texto }));
  };

  function blocoAvisos(avisos, mesmoVazio = false) {
    if (avisos.length === 0 && !mesmoVazio) return "";
    return `
      <ul class="avisos-contato" aria-label="Avisos sobre este contato"${avisos.length === 0 ? " hidden" : ""}>
        ${avisos
          .map((a) => `<li class="${a.tom}">${CW.escapar(a.texto)}</li>`)
          .join("")}
      </ul>`;
  }

  /**
   * Os sinais que só a conversa dá (humor que piorou, reclamação colada)
   * vêm do servidor, uma vez por contato, depois que o painel desenhou.
   * Redesenhar o painel não chama de novo: a resposta fica guardada.
   */
  const sinaisPorContato = new Map();

  P.pedirSinaisDaConversa = async function pedirSinaisDaConversa() {

    const leitura = P.lerConversa?.();
    const mensagens = (Array.isArray(leitura) ? leitura : leitura?.mensagens ?? [])
      .filter((m) => m && typeof m.texto === "string")
      .map((m) => ({ de: m.de === "nos" ? "nos" : "cliente", texto: m.texto, carimbo: m.carimbo }));

    if (mensagens.filter((m) => m.de === "cliente").length < 2) return;

    const chave = [P.consulta?.telefone, P.consulta?.nome, P.consulta?.rotulo].join("|");

    /* O caso a completar: o aberto mais recente do contato (ou o mais recente). */
    const casos = P.ultimoDado?.cliente ? P.ultimoDado.casos ?? [] : [];
    const protocolo = (casos.find((c) => c.aberto) ?? casos[0])?.protocolo;

    if (!sinaisPorContato.has(chave)) {
      sinaisPorContato.set(chave, null);
      try {
        const resposta = await CW.enviar({
          tipo: "sinaisDaConversa",
          mensagens,
          protocolo,
          telefone: P.consulta?.telefone,
          nome: P.consulta?.nome,
          /* O que o painel já sabe: pesa no "o que fazer agora" (Fase 28). */
          historico: {
            casosAbertos: casos.filter((c) => c.aberto).length,
            reclamacoes: casos.filter((c) => (c.canal ?? "Reclame Aqui") === "Reclame Aqui").length,
          },
        });
        sinaisPorContato.set(chave, {
          avisos: resposta?.dados?.avisos ?? [],
          completar: resposta?.dados?.completar ?? null,
          humor: resposta?.dados?.humor ?? null,
          agora: resposta?.dados?.agora ?? null,
          impacto: resposta?.dados?.impacto ?? [],
        });
      } catch {
        sinaisPorContato.delete(chave);
        return;
      }
    }

    const sinais = sinaisPorContato.get(chave);
    if (!sinais) return;

    desenharTermometro(sinais.humor);
    desenharAgora(sinais.agora);
    desenharImpacto(sinais.impacto);
    desenharCompletar(sinais.completar, chave);

    const avisos = sinais.avisos;
    if (!avisos || avisos.length === 0) return;

    let lista = P.corpo?.querySelector(".avisos-contato");
    if (!lista) {
      P.corpo?.insertAdjacentHTML("afterbegin", blocoAvisos([], true));
      lista = P.corpo?.querySelector(".avisos-contato");
    }
    if (!lista || lista.dataset.sinais === chave) return;

    lista.dataset.sinais = chave;
    lista.insertAdjacentHTML(
      "beforeend",
      avisos.map((a) => `<li class="${CW.escapar(a.tom)}" data-conversa>${CW.escapar(a.texto)}</li>`).join("")
    );

    /*
      Junto com os do contato, o grave primeiro e no máximo cinco — aviso
      demais vira papel de parede. No mesmo tom, o da conversa vem antes:
      é o que ninguém sabia até abrir.
    */
    const itens = [...lista.children].map((li, i) => ({
      li,
      i,
      peso: PESO_DO_TOM[li.className] ?? 2,
      daConversa: li.hasAttribute("data-conversa") ? 0 : 1,
    }));
    itens.sort((a, b) => a.peso - b.peso || a.daConversa - b.daConversa || a.i - b.i);
    itens.forEach(({ li }, n) => (n < TETO_DE_AVISOS ? lista.appendChild(li) : li.remove()));
    lista.hidden = false;
  };

  /* ============================================================
     CABEÇALHO DO CLIENTE (Fase 17)
  ============================================================ */

  /**
   * Quem é, de qual conta, o que está aberto em cada frente e como está
   * o humor da conversa — antes de qualquer outra coisa do painel.
   *
   * O termômetro chega depois, com os sinais da conversa: até lá fica
   * escondido, em vez de mostrar um humor inventado.
   */
  function blocoCabecalho(dados, tom, rotuloConfianca) {

    const cliente = dados.cliente;
    const casos = dados.casos ?? [];
    const doRA = (c) => (c.canal ?? "Reclame Aqui") === "Reclame Aqui";
    const plural = (n, palavra) => `${n} ${palavra}${n === 1 ? "" : "s"}`;

    const raAbertos = casos.filter((c) => c.aberto && doRA(c)).length;
    const redesAbertos = casos.filter((c) => c.aberto && !doRA(c)).length;
    const nps = dados.nps;

    const frentes = [];
    if (raAbertos) frentes.push(`<span class="frente-chip">Reclame Aqui · ${plural(raAbertos, "aberto")}</span>`);
    if (redesAbertos) frentes.push(`<span class="frente-chip">Redes · ${plural(redesAbertos, "aberto")}</span>`);
    if (nps && !nps.encerrado && typeof nps.nota === "number") {
      frentes.push(
        `<span class="frente-chip${nps.nota <= 6 ? " perigo" : ""}">NPS ${nps.nota} · ciclo aberto</span>`
      );
    }
    if (frentes.length === 0) frentes.push(`<span class="frente-chip calmo">nada aberto</span>`);

    const conta = dados.estabelecimento?.nome;

    /*
      "Não informado" não é nome (out/2026). A reclamação que o vigia trouxe
      do portal chega sem o consumidor, e o cabeçalho estampava isso em
      negrito com a conversa da pessoa aberta ao lado. Com o nome do
      contato na tela, ele vai no lugar — dizendo de onde veio.
    */
    const semNome = ["", "não informado", "nao informado"].includes(String(cliente.nome ?? "").trim().toLowerCase());
    const daConversa = String(P.consulta?.nome ?? "").trim();
    const nome = semNome && daConversa && !CW.telefoneDoTexto(daConversa) ? daConversa : cliente.nome || "Sem nome";

    return `
      <div class="cabecalho-cliente">
        <div class="cab-linha">
          <span class="cab-nome" title="${CW.escapar(nome)}">${CW.escapar(nome)}</span>
          <span class="tag ${tom}">${rotuloConfianca}</span>
          <span class="termometro" hidden></span>
        </div>
        ${conta ? `<div class="cab-conta">${CW.escapar(conta)}</div>` : ""}
        ${nome !== cliente.nome && semNome && daConversa ? `<div class="cab-conta">nome do contato · a reclamação está sem o nome do consumidor</div>` : ""}
        ${P.consulta?.pelaConversa ? `<div class="cab-conta">achado pelo ${CW.escapar(P.consulta.pelaConversa)} escrito na conversa</div>` : ""}
        <div class="cab-frentes">${frentes.join("")}</div>
      </div>`;
  }

  P.blocoCabecalho = blocoCabecalho;

  /* ============================================================
     QUEM É ESTE CONTATO (1.36)
  ============================================================ */

  /**
   * O Isaac: "a identificação de contatos ainda está bem ruim". A base
   * não tem telefone de nenhum dos 239 estabelecimentos, e só 108 das
   * 1.724 respostas de NPS têm: pelo número, a extensão só achava
   * reclamação. Quando o telefone não acha, o nome do contato sugere
   * candidatos; "É este" liga o número à ficha, para sempre.
   */
  const candidatosPorContato = new Map();
  const ROTULO_DO_CANDIDATO = { nps: "NPS", caso: "Reclamação", conta: "Conta" };

  function telefoneParaLembrar() {
    const t = String(P.telefoneDaConversa ?? P.consulta?.telefone ?? "").replace(/\D/g, "");
    return t.length >= 10 ? t : "";
  }

  function blocoQuemE() {
    if (!telefoneParaLembrar()) return "";
    const nome = P.consulta?.nome ?? "";
    const lista = candidatosPorContato.get(P.chaveConsulta);
    let miolo;
    if (!nome) {
      miolo = '<p class="sub">Sem o nome do contato para procurar. Busque acima por nome, e-mail ou protocolo.</p>';
    } else if (!Array.isArray(lista)) {
      miolo = `<p class="sub">Procurando parecidos com "${CW.escapar(nome)}"…</p>`;
    } else if (lista.length === 0) {
      miolo = `<p class="sub">Ninguém parecido com "${CW.escapar(nome)}" na base. Busque acima por nome, e-mail ou protocolo.</p>`;
    } else {
      miolo = `<p class="sub">Não achei pelo telefone. Parecidos com "${CW.escapar(nome)}":</p>
        <ul class="candidatos">${lista
          .map(
            (c) => `<li>
              <span class="tag neutro">${ROTULO_DO_CANDIDATO[c.tipo] ?? ""}</span>
              <span class="candidato"><b>${CW.escapar(c.titulo)}</b><span class="sub">${CW.escapar(c.detalhe)}${c.motivo ? ` · ${CW.escapar(c.motivo)}` : ""}</span></span>
              <button type="button" class="copiar" data-acao="vincular" data-tipo="${CW.escapar(c.tipo)}" data-ref="${CW.escapar(c.ref)}">É este</button>
            </li>`
          )
          .join("")}</ul>`;
    }
    return `<div class="bloco quem-e" data-quem-e>
      <div class="rotulo">Quem é este contato?</div>
      ${miolo}
      <p class="sub falha" data-quem-e-erro></p>
      <p class="sub">Confirmado uma vez, a extensão reconhece este número para sempre — em qualquer computador.</p>
    </div>`;
  }

  /**
   * As pistas que o cliente escreveu na conversa (1.83): CPF/CNPJ, e-mail
   * e o endereço do cardápio. Lidas aqui e mandadas sozinhas — o texto
   * da conversa não sai da página por causa disso.
   */
  function pistasDaConversa() {
    const leitura = P.lerConversa?.();
    const mensagens = Array.isArray(leitura) ? leitura : leitura?.mensagens ?? [];
    const texto = mensagens.filter((m) => m?.de === "cliente").map((m) => m.texto || "").join("\n");
    const documentos = [...texto.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g)]
      .map((m) => m[0].replace(/\D/g, ""))
      .filter((d) => d.length === 11 || d.length === 14);
    const emails = [...texto.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0].toLowerCase());
    const slugs = [
      ...[...texto.matchAll(/cardapioweb\.com(?:\.br)?\/([a-z0-9][a-z0-9-]{2,60})/gi)].map((m) => m[1]),
      ...[...texto.matchAll(/\b([a-z0-9][a-z0-9-]{2,60})\.cardapioweb\.com/gi)].map((m) => m[1]),
    ].map((s) => s.toLowerCase());
    const unicos = (l) => [...new Set(l)].slice(0, 5);
    return { documentos: unicos(documentos), emails: unicos(emails), slugs: unicos(slugs) };
  }

  P.pedirQuemE = async function pedirQuemE() {
    const chave = P.chaveConsulta;
    const nome = P.consulta?.nome;
    let pistas = { documentos: [], emails: [], slugs: [] };
    try {
      pistas = pistasDaConversa();
    } catch {
      /* sem conversa legível, fica o nome */
    }
    const temPista = pistas.documentos.length || pistas.emails.length || pistas.slugs.length;
    if ((!nome && !temPista) || !telefoneParaLembrar() || candidatosPorContato.has(chave)) return;
    candidatosPorContato.set(chave, "procurando");
    const r = await CW.enviar({ tipo: "quemE", nome, pistas });
    candidatosPorContato.set(chave, r?.ok && Array.isArray(r.dados?.candidatos) ? r.dados.candidatos : []);
    if (chave !== P.chaveConsulta) return;
    const el = P.corpo?.querySelector("[data-quem-e]");
    if (el) el.outerHTML = blocoQuemE();
  };

  /** Conhecido pelo NPS ou pela conta, sem reclamação. */
  function blocoReconhecido(dados) {
    const nps = dados.nps;
    const conta = dados.estabelecimento;
    const nome = nps?.cliente || conta?.nome || P.consulta?.nome || "Contato";
    const linhas = [];
    if (nps) {
      linhas.push(`<div class="cab-frentes"><span class="frente-chip${!nps.encerrado && nps.nota <= 6 ? " perigo" : ""}">NPS ${CW.escapar(String(nps.nota))} · ${nps.encerrado ? "ciclo encerrado" : "ciclo aberto"}</span></div>`);
    }
    return `<div class="cabecalho-cliente">
        <div class="cab-linha">
          <span class="cab-nome" title="${CW.escapar(nome)}">${CW.escapar(nome)}</span>
          <span class="tag ok">reconhecido</span>
        </div>
        ${conta ? `<div class="cab-conta">${CW.escapar(conta.nome)}</div>` : ""}
        ${linhas.join("")}
      </div>
      ${blocoVinculo(dados)}
      ${
        /*
          O ciclo aberto aqui mesmo (out/2026). Quem chega pelo NPS está
          conversando sobre o NPS — e a tela dizia só "o ciclo está na aba
          NPS", com um botão para ir buscá-lo. Agora a tentativa, a régua
          de humor e a anotação estão onde a conversa está.
        */
        nps && !nps.encerrado
          ? P.blocoNps(nps, P.podeEscrever(dados), false, conta?.whatsappNps ?? null)
          : ""
      }
      <div class="bloco">
        <p class="sub">Sem reclamação registrada.${nps?.encerrado ? " O último ciclo do NPS está encerrado." : ""}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${(dados.npsLista ?? []).length > 1 || nps?.encerrado ? `<button type="button" class="copiar" data-acao="canal" data-canal="nps">${(dados.npsLista ?? []).length > 1 ? `Os ${(dados.npsLista ?? []).length} ciclos do NPS` : "Ver no NPS"}</button>` : ""}
          ${conta?.url ? `<a class="tag marca" data-acao="abrir" data-url="${CW.escapar(conta.url)}" style="cursor:pointer">abrir a conta &rarr;</a>` : ""}
        </div>
      </div>
      ${blocoAcoesRapidas(dados)}`;
  }

  /** Quem ligou este número à ficha — e o "não é este" para desfazer. Numa busca manual, o "É este" do número da conversa. */
  function blocoVinculo(dados) {
    if (dados?.vinculo) {
      const em = String(dados.vinculo.em ?? "");
      return `<div class="vinculo-contato sub">Vinculado a este número por ${CW.escapar(dados.vinculo.por ?? "")} em ${em.slice(8, 10)}/${em.slice(5, 7)} · <a data-acao="desvincular">não é este cliente</a></div>`;
    }
    const manual = String(P.chaveConsulta ?? "").startsWith("manual:");
    const tel = telefoneParaLembrar();
    if (!manual || !tel) return "";
    const aberto = (dados?.casos ?? []).find((c) => c.aberto) ?? (dados?.casos ?? [])[0];
    const alvo = aberto ? { tipo: "caso", ref: aberto.protocolo } : dados?.nps ? { tipo: "nps", ref: dados.nps.id } : dados?.estabelecimento?.id ? { tipo: "conta", ref: dados.estabelecimento.id } : null;
    if (!alvo) return "";
    return `<div class="vinculo-contato">
      <button type="button" class="copiar" data-acao="vincular" data-tipo="${alvo.tipo}" data-ref="${CW.escapar(alvo.ref)}">É o contato da conversa aberta (${CW.escapar(tel.slice(0, 2))} …${CW.escapar(tel.slice(-4))}) — lembrar</button>
      <p class="sub falha" data-quem-e-erro></p>
    </div>`;
  }

  P.vincularContato = async function vincularContato(botao) {
    const tel = telefoneParaLembrar();
    if (!tel) return;
    const rotulo = botao.textContent;
    botao.disabled = true;
    botao.textContent = "vinculando…";
    const r = await CW.enviar({
      tipo: "vincularContato",
      corpo: { telefone: tel, nome: P.nomeDaConversa || P.consulta?.nome || "", tipo: botao.dataset.tipo, ref: botao.dataset.ref },
    });
    if (!r?.ok || r.dados?.erro || !r.dados?.ok) {
      botao.disabled = false;
      botao.textContent = rotulo;
      const erro = P.corpo?.querySelector("[data-quem-e-erro]");
      if (erro) erro.textContent = r?.dados?.erro ?? r?.erro ?? "Não deu para vincular agora.";
      return;
    }
    candidatosPorContato.clear();
    /* Volta para a conversa, já reconhecida, sem o cache de antes. */
    if (String(P.chaveConsulta ?? "").startsWith("manual:") && P.telefoneDaConversa) {
      P.consulta = { telefone: P.telefoneDaConversa, nome: P.nomeDaConversa };
      P.chaveConsulta = null;
    }
    P.consultar(true);
  };

  P.desvincularContato = async function desvincularContato() {
    const tel = telefoneParaLembrar();
    if (!tel) return;
    await CW.enviar({ tipo: "vincularContato", corpo: { telefone: tel, desfazer: true } });
    candidatosPorContato.clear();
    P.consultar(true);
  };

  const ROTULO_DO_HUMOR = { 1: "muito irritado", 2: "insatisfeito", 3: "neutro", 4: "satisfeito", 5: "muito satisfeito" };

  function desenharTermometro(humor) {
    const el = P.corpo?.querySelector(".cabecalho-cliente .termometro");
    if (!el || !humor || !ROTULO_DO_HUMOR[humor.agora]) return;
    const seta = humor.tendencia === "piorando" ? " ↓" : humor.tendencia === "melhorando" ? " ↑" : "";
    el.className = `termometro h${humor.agora}`;
    el.textContent = `${ROTULO_DO_HUMOR[humor.agora]}${seta}`;
    el.title = `Humor da conversa: ${humor.agora} de 5${humor.tendencia ? `, ${humor.tendencia}` : ""} — pelas últimas mensagens do cliente`;
    el.hidden = false;
  }

  /**
   * O que fazer agora (Fase 28): escutar, assumir o erro, áudio, Meet,
   * esperar a área, escalar — logo abaixo do cabeçalho, com o porquê e
   * um roteiro curto. Fechado por padrão: o título já diz o essencial, e
   * o roteiro abre com um clique.
   */
  function desenharAgora(agora) {
    const cabecalho = P.corpo?.querySelector(".cabecalho-cliente");
    if (!cabecalho || !agora?.titulo) return;
    P.corpo.querySelector(".agora-conversa")?.remove();
    const tom = agora.acao === "escalar" ? "perigo" : agora.acao === "escutar" || agora.acao === "assumir" ? "atencao" : "neutro";
    cabecalho.insertAdjacentHTML(
      "afterend",
      `<details class="agora-conversa ${tom}" data-acao-momento="${CW.escapar(agora.acao)}">
        <summary><span class="agora-rotulo">O que fazer:</span> <b>${CW.escapar(agora.titulo)}</b></summary>
        ${agora.porque?.length ? `<p class="agora-porque">Porque ${CW.escapar(agora.porque.join(", "))}.</p>` : ""}
        <ol class="agora-roteiro">${(agora.roteiro ?? []).map((r) => `<li>${CW.escapar(r)}</li>`).join("")}</ol>
        ${agora.foraDoHorario ? `<p class="agora-porque">Fora do expediente: responda curto agora, diga quando volta e marque o retorno na agenda.</p>` : ""}
        ${agora.mensagem ? `<p class="agora-porque" style="white-space:pre-wrap;margin-top:6px">${CW.escapar(agora.mensagem)}</p><button type="button" class="copiar" data-acao="copiar-mensagem-do-momento" style="margin-top:6px">Copiar a mensagem</button>` : ""}
      </details>`
    );
  }

  P.desenharAgora = desenharAgora;

  /* ============================================================
     O COPILOTO DA TRATATIVA (1.128, Fase 33)
  ============================================================ */

  /*
    "A cada momento da conversa, o próximo passo e o texto sugeridos pela
    IA." O "o que fazer" acima é por regras; o copiloto lê a conversa de
    verdade e escreve a próxima mensagem. Pede de novo a cada mensagem nova
    do cliente — uma vez por mensagem, e só com a aba à vista, para não
    gastar a cota da IA com quem não está olhando. Quem manda a mensagem é
    sempre a pessoa.
  */
  const copiloto = { contato: "", chave: "", pedindo: false, sugestao: null, erro: "" };
  const INTERVALO_DO_COPILOTO_MS = 15_000;
  let relogioDoCopiloto = null;

  function mensagensDaTela() {
    const leitura = P.lerConversa?.();
    return (Array.isArray(leitura) ? leitura : leitura?.mensagens ?? [])
      .filter((m) => m && typeof m.texto === "string" && m.texto.trim())
      .map((m) => ({ de: m.de === "nos" ? "nos" : "cliente", texto: m.texto.slice(0, 600) }));
  }

  function htmlDoCopiloto() {
    if (copiloto.pedindo && !copiloto.sugestao) {
      return `<span class="copiloto-rotulo">Copiloto</span><p class="copiloto-porque">Lendo a conversa…</p>`;
    }
    if (copiloto.erro && !copiloto.sugestao) {
      return `<span class="copiloto-rotulo">Copiloto</span><p class="copiloto-porque">${CW.escapar(copiloto.erro)}</p><div class="copiloto-acoes"><button type="button" class="copiar" data-acao="copiloto-de-novo">Tentar de novo</button></div>`;
    }
    const s = copiloto.sugestao;
    if (!s) return "";
    return [
      `<span class="copiloto-rotulo">Copiloto · sugestão da IA${copiloto.pedindo ? " · atualizando…" : ""}</span>`,
      `<p class="copiloto-passo">${CW.escapar(s.passo)}</p>`,
      s.porque ? `<p class="copiloto-porque">${CW.escapar(s.porque)}</p>` : "",
      `<p class="copiloto-texto">${CW.escapar(s.texto)}</p>`,
      `<div class="copiloto-acoes">`,
      `  <button type="button" class="copiar" data-acao="copiar" data-texto="${CW.escapar(s.texto)}">Copiar o texto</button>`,
      `  <button type="button" class="copiar" data-acao="copiloto-de-novo">Sugerir de novo</button>`,
      `</div>`,
    ].join("");
  }

  function desenharCopiloto() {
    if (!P.corpo) return;
    const html = htmlDoCopiloto();
    let caixa = P.corpo.querySelector(".copiloto-conversa");
    if (!html) {
      caixa?.remove();
      return;
    }
    if (!caixa) {
      const depoisDe = P.corpo.querySelector(".agora-conversa") ?? P.corpo.querySelector(".cabecalho-cliente");
      if (!depoisDe) return;
      depoisDe.insertAdjacentHTML("afterend", `<div class="copiloto-conversa"></div>`);
      caixa = P.corpo.querySelector(".copiloto-conversa");
    }
    caixa.innerHTML = html;
  }

  P.pedirCopiloto = async function pedirCopiloto(forcar) {
    if (!P.corpo?.querySelector(".cabecalho-cliente")) return;
    const contato = P.chaveConsulta ?? "";
    if (copiloto.contato !== contato) Object.assign(copiloto, { contato, chave: "", sugestao: null, erro: "" });
    const mensagens = mensagensDaTela();
    if (mensagens.length === 0) return;
    const ultima = mensagens[mensagens.length - 1];
    const chave = [contato, mensagens.length, ultima.de, ultima.texto.slice(-80)].join("|");
    /* Sozinho, só quando a última mensagem é do cliente e é nova. */
    if (!forcar && (chave === copiloto.chave || ultima.de !== "cliente")) {
      desenharCopiloto();
      return;
    }
    if (copiloto.pedindo) return;
    Object.assign(copiloto, { chave, pedindo: true, erro: "" });
    desenharCopiloto();
    const dados = P.ultimoDado ?? {};
    const r = await CW.enviar({
      tipo: "copiloto",
      mensagens: mensagens.slice(-20),
      protocolos: (dados.casos ?? []).map((c) => c.protocolo).filter(Boolean).slice(0, 3),
      nome: dados.cliente?.nome ?? "",
    });
    copiloto.pedindo = false;
    /* Trocou de conversa no meio: a resposta é de outro cliente. */
    if (copiloto.contato !== (P.chaveConsulta ?? "")) return;
    if (r?.ok && r.dados?.ok) {
      copiloto.sugestao = r.dados.sugestao;
      copiloto.erro = "";
    } else {
      copiloto.erro = r?.dados?.erro || r?.erro || "O copiloto não respondeu agora.";
    }
    desenharCopiloto();
  };

  function ligarCopiloto() {
    setTimeout(() => P.pedirCopiloto(false), 1200);
    if (relogioDoCopiloto) return;
    relogioDoCopiloto = setInterval(() => {
      if (document.visibilityState === "visible") P.pedirCopiloto(false);
    }, INTERVALO_DO_COPILOTO_MS);
  }

  /* Copiar a mensagem do momento (1.103) — quem manda é a pessoa, com Enter. */
  document.addEventListener("click", (ev) => {
    const botao = ev.composedPath?.().find((el) => el?.dataset?.acao === "copiar-mensagem-do-momento");
    if (!botao) return;
    const texto = botao.previousElementSibling?.textContent ?? "";
    navigator.clipboard?.writeText(texto).then(() => {
      botao.textContent = "Copiada — cole na conversa";
    });
  }, true);

  /**
   * O impacto que a conversa mostra (Fase 28): desconto, meses sem
   * mensalidade, estorno combinados por nós. O aviso já vem com o valor
   * (pela mensalidade da conta, quando se sabe) e o caso; um clique
   * lança o custo em Impacto no Negócio. Sem mensalidade, o valor fica
   * para a pessoa digitar.
   */
  const emReais = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");

  function desenharImpacto(lista) {
    P.corpo?.querySelector(".impacto-conversa")?.remove();
    const pendentes = (lista ?? []).filter((c) => c && c.descricao);
    if (!pendentes.length) return;
    const ancora = P.corpo?.querySelector(".agora-conversa") ?? P.corpo?.querySelector(".cabecalho-cliente");
    if (!ancora) return;
    ancora.insertAdjacentHTML(
      "afterend",
      `<div class="impacto-conversa">
        <p class="impacto-titulo">Condição dada na conversa — registre o impacto</p>
        ${pendentes
          .map(
            (c, i) => `
        <div class="impacto-item" data-indice="${i}">
          <p><b>${CW.escapar(c.descricao)}</b>${c.mensalidadeCents ? ` <span class="sub">(mensalidade ${emReais(c.mensalidadeCents)})</span>` : ""}</p>
          <p class="citacao">\u201c${CW.escapar(c.trecho)}\u201d</p>
          ${
            c.jaRegistrado
              ? '<p class="sub impacto-feito">já registrado em Impacto</p>'
              : `<div class="linha">
            <label class="sub">R$ <input class="valor-impacto" inputmode="decimal" value="${c.valorCents ? (c.valorCents / 100).toFixed(2).replace(".", ",") : ""}" placeholder="valor" /></label>
            <button class="copiar" data-acao="registrar-impacto">Registrar impacto</button>
          </div>`
          }
        </div>`
          )
          .join("")}
      </div>`
    );
    P.impactoDaConversa = pendentes;
  }

  P.registrarImpacto = async function registrarImpacto(botao) {
    const item = botao.closest(".impacto-item");
    const c = P.impactoDaConversa?.[Number(item?.dataset.indice)];
    if (!item || !c) return;
    const campo = item.querySelector(".valor-impacto");
    const valorCents = Math.round(Number(String(campo?.value ?? "").replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(valorCents) || valorCents <= 0) {
      campo?.focus();
      P.avisar("Diga o valor concedido, em reais.", "atencao");
      return;
    }
    const casos = P.ultimoDado?.casos ?? [];
    const protocolo = c.protocolo ?? (casos.find((x) => x.aberto) ?? casos[0])?.protocolo;
    botao.disabled = true;
    botao.textContent = "registrando\u2026";
    const resposta = await CW.enviar({
      tipo: "registrarImpacto",
      protocolo,
      cliente: P.ultimoDado?.cliente?.nome ?? P.consulta?.nome,
      descricao: c.descricao,
      trecho: c.trecho,
      valorCents,
    });
    if (!resposta?.ok || resposta.dados?.erro) {
      botao.disabled = false;
      botao.textContent = "Registrar impacto";
      P.avisar(resposta?.dados?.erro ?? resposta?.erro ?? "Não foi registrado. Tente de novo.", "perigo");
      return;
    }
    c.jaRegistrado = true;
    item.querySelector(".linha")?.replaceWith(Object.assign(document.createElement("p"), {
      className: "sub impacto-feito",
      textContent: resposta.dados?.jaExistia ? "já estava registrado em Impacto" : `registrado em Impacto: ${emReais(valorCents)} de custo`,
    }));
  };

  /* ============================================================
     IDENTIFICA PELA CONVERSA (Fase 17)
  ============================================================ */

  function chaveDoContexto(c) {
    return JSON.stringify([c?.telefone ?? "", c?.nome ?? "", c?.protocolo ?? "", c?.email ?? "", c?.documento ?? "", c?.canalDaPagina ?? ""]);
  }

  const reforcoPorContexto = new Map();

  function digitosVerificam(d) {
    if (/^(\d)\1+$/.test(d)) return false;
    const n = d.split("").map(Number);
    if (d.length === 11) {
      const dv = (ate) => {
        let soma = 0;
        for (let i = 0; i < ate; i++) soma += n[i] * (ate + 1 - i);
        const r = (soma * 10) % 11;
        return r === 10 ? 0 : r;
      };
      return dv(9) === n[9] && dv(10) === n[10];
    }
    if (d.length === 14) {
      const dv = (tamanho) => {
        let soma = 0;
        let peso = tamanho - 7;
        for (let i = 0; i < tamanho; i++) {
          soma += n[i] * peso--;
          if (peso < 2) peso = 9;
        }
        const r = soma % 11;
        return r < 2 ? 0 : 11 - r;
      };
      return dv(12) === n[12] && dv(13) === n[13];
    }
    return false;
  }

  /**
   * E-mail, CPF/CNPJ e protocolo do Reclame Aqui escritos **pelo cliente**.
   * O e-mail do suporte e o protocolo que nós citamos não identificam
   * ninguém — por isso só as mensagens dele.
   */
  P.identificadoresDaConversa = function identificadoresDaConversa(mensagens) {
    const texto = (mensagens ?? [])
      .filter((m) => m && m.de !== "nos" && typeof m.texto === "string")
      .map((m) => m.texto)
      .join("\n");

    const achados = {};

    const email = texto.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (email) achados.email = email[0].toLowerCase();

    for (const m of texto.matchAll(/\d[\d.\/\s-]{9,20}\d/g)) {
      const d = m[0].replace(/\D/g, "");
      if ((d.length === 11 || d.length === 14) && digitosVerificam(d)) {
        achados.documento = d;
        break;
      }
    }

    /* Telefone com DDD (10 ou 11 dígitos), que não seja o próprio documento. */
    for (const m of texto.matchAll(/\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g)) {
      const d = m[0].replace(/\D/g, "");
      if ((d.length === 10 || d.length === 11) && d !== achados.documento && !digitosVerificam(d)) {
        achados.telefone = d;
        break;
      }
    }

    const protocolo = texto.match(/\bRA-[A-Za-z0-9_-]{6,30}/);
    if (protocolo) achados.protocolo = protocolo[0];

    return achados;
  };

  const NOME_DO_ACHADO = { documento: "CPF/CNPJ", email: "e-mail", protocolo: "protocolo", telefone: "telefone" };

  /**
   * Nada achado pelo que a página mostra? Tenta pelo que o cliente
   * escreveu, uma vez por contexto. Devolve `true` quando refez a busca.
   */
  P.tentarPelaConversa = function tentarPelaConversa() {
    if (!P.lerConversa || !P.consulta) return false;

    const original = chaveDoContexto(P.consulta);
    if (reforcoPorContexto.has(original)) return false;

    const leitura = P.lerConversa();
    const mensagens = Array.isArray(leitura) ? leitura : leitura?.mensagens ?? [];
    const achados = P.identificadoresDaConversa(mensagens);

    const reforco = {};
    for (const campo of ["documento", "protocolo", "email", "telefone"]) {
      if (achados[campo] && !P.consulta[campo]) reforco[campo] = achados[campo];
    }

    /* Guardado mesmo vazio: a mesma conversa não é relida a cada redesenho. */
    reforcoPorContexto.set(original, reforco);

    const campos = Object.keys(reforco);
    if (campos.length === 0) return false;

    reforco.pelaConversa = NOME_DO_ACHADO[campos[0]];
    P.definirContexto(P.consulta);
    return true;
  };

  const NOME_DO_CAMPO = { email: "e-mail", telefone: "telefone", documento: "CPF/CNPJ", nome: "o nome" };

  function valorParaMostrar(campo, valor) {
    if (campo === "documento" && valor.length === 11) return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (campo === "documento" && valor.length === 14) return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (campo === "telefone" && valor.length >= 10) return valor.replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3");
    return valor;
  }

  /**
   * "Encontrei na conversa" — e-mail, telefone ou CPF/CNPJ que o cliente
   * escreveu e o caso não tem. Nada é gravado sem o clique, e o que já
   * está no cadastro nunca é trocado.
   */
  function desenharCompletar(completar, chave) {
    if (!completar || !completar.campos?.length) return;
    if (P.corpo?.querySelector(".completar-conversa")) return;

    const lista = completar.campos
      .map((c) => `${NOME_DO_CAMPO[c.campo] ?? c.campo} <b>${CW.escapar(valorParaMostrar(c.campo, c.valor))}</b>`)
      .join(", ");

    const html = `
      <div class="completar-conversa" data-chave="${CW.escapar(chave)}">
        <p>Na conversa: ${lista}. O ${CW.escapar(completar.protocolo)} não tem.</p>
        <button type="button" class="acao" data-acao="completar-conversa">Completar o cadastro</button>
      </div>`;

    const avisos = P.corpo?.querySelector(".avisos-contato");
    if (avisos) avisos.insertAdjacentHTML("afterend", html);
    else P.corpo?.insertAdjacentHTML("afterbegin", html);
  }

  P.completarPelaConversa = async function completarPelaConversa(botao) {

    const caixa = botao.closest(".completar-conversa");
    const sinais = sinaisPorContato.get(caixa?.dataset.chave);
    const completar = sinais?.completar;
    if (!caixa || !completar) return;

    const corpo = { protocolo: completar.protocolo };
    for (const c of completar.campos) corpo[c.campo] = c.valor;

    botao.disabled = true;
    botao.textContent = "gravando\u2026";

    let resposta;
    try {
      resposta = await CW.enviar({ tipo: "completarPelaConversa", corpo });
    } catch {
      resposta = null;
    }

    const completou = resposta?.dados?.completou;

    /* Só diz que gravou quando o servidor respondeu que gravou. */
    if (Array.isArray(completou) && completou.length > 0) {
      sinais.completar = null;
      caixa.innerHTML = `<p>Gravado no ${CW.escapar(completar.protocolo)}: ${CW.escapar(completou.join(", "))}.</p>`;
      caixa.classList.add("feito");
    } else if (Array.isArray(completou)) {
      sinais.completar = null;
      caixa.innerHTML = `<p>O cadastro já estava completo — nada foi trocado.</p>`;
    } else {
      botao.disabled = false;
      botao.textContent = "Completar o cadastro";
      caixa.querySelector(".erro-completar")?.remove();
      caixa.insertAdjacentHTML(
        "beforeend",
        `<p class="erro-completar">${CW.escapar(resposta?.dados?.erro ?? "Não foi gravado. Tente de novo.")}</p>`
      );
    }
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
        ${P.linksDoCaso(caso)}
        ${P.botoesDeEtapa(caso)}
      </div>`;
  };

  /**
   * Plataforma, página pública e área da empresa — os três lugares de uma
   * reclamação. Cada link fica mais perto do clique que o cartão, e por
   * isso abre a página em vez de abrir o caso no painel.
   */
  P.linksDoCaso = function linksDoCaso(caso) {
    const links = [
      caso.url ? ["plataforma", caso.url] : null,
      caso.urlPortal ? ["página pública", caso.urlPortal] : null,
      caso.urlEmpresa ? ["área da empresa", caso.urlEmpresa] : null,
    ].filter(Boolean);
    if (links.length < 2) return "";
    return `<div class="links-caso">${links
      .map(([rotulo, url]) => `<a data-acao="abrir" data-url="${CW.escapar(url)}">${rotulo} &#8599;</a>`)
      .join("")}</div>`;
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
          `${P.ultimoDado.cliente.total} ${CW.plural(P.ultimoDado.cliente.total, "caso", "casos")}, ${P.ultimoDado.cliente.abertos} ${CW.plural(P.ultimoDado.cliente.abertos, "aberto", "abertos")}`,
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

    // Conversa de caso ou NPS aberto: guarda sozinha, e o bloco só mostra o estado.
    if (P.podeGuardarSozinho()) {
      return `<div class="bloco guardar-sozinho" data-guardar-estado>${textoDoEstadoDeGuardar()}</div>`;
    }

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
        `    <span class="sub"><span class="tag ok">guardada</span> ${r.novas} ${r.novas === 1 ? "mensagem nova" : "mensagens novas"}${r.repetidas ? ` · ${r.repetidas} já estavam` : ""}${r.omitidos ? ` · ${r.omitidos} ${CW.plural(r.omitidos, "dado", "dados")} ${CW.plural(r.omitidos, "bancário", "bancários")} ${CW.plural(r.omitidos, "omitido", "omitidos")}` : ""}</span>`,
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

  const ROTULO_DO_RISCO = { baixo: "risco baixo", medio: "risco médio", alto: "risco alto" };

  /**
   * As respostas em três tons (Fase 28): acolhedora, objetiva e técnica —
   * o mesmo recado, para o cliente que está diante de você. O texto é
   * editável ali mesmo; copiar leva o que está na caixa, e se você mudou
   * alguma coisa a edição vai para o servidor, para o próximo rascunho
   * sair do seu jeito.
   */
  function blocoTons(tons) {
    if (!Array.isArray(tons) || tons.length === 0) return "";
    return [
      '<div class="tons">',
      '  <div class="linha"><span class="rotulo">Responder em três tons</span>',
      P.resumo?.estiloAprendido ? '  <span class="sub" title="O rascunho segue as edições que você fez antes">no seu jeito</span>' : "",
      "  </div>",
      '  <div class="tons-abas" role="tablist">',
      tons.map((t, i) => `<button type="button" role="tab" data-acao="tom" data-tom="${CW.escapar(t.tom)}" aria-selected="${i === 0}" title="${CW.escapar(t.quando ?? "")}">${CW.escapar(t.rotulo ?? t.tom)}</button>`).join(""),
      "  </div>",
      tons
        .map(
          (t, i) => `
      <div class="tom" data-tom="${CW.escapar(t.tom)}" ${i === 0 ? "" : "hidden"}>
        <textarea class="texto-tom" rows="5" spellcheck="true" data-original="${CW.escapar(t.texto ?? "")}">${CW.escapar(t.texto ?? "")}</textarea>
        ${(t.conferencia ?? []).map((a) => `<p class="sub" style="margin:4px 0 0;color:${a.tom === "perigo" ? "var(--perigo)" : "var(--suave)"}">• ${CW.escapar(a.texto)}</p>`).join("")}
        <div class="linha" style="margin-top:6px">
          <span class="sub">${CW.escapar(t.quando ?? "")}</span>
          <button class="copiar" data-acao="copiar-tom">copiar</button>
        </div>
      </div>`
        )
        .join(""),
      "</div>",
    ].join("");
  }

  P.trocarTom = function trocarTom(botao) {
    const caixa = botao.closest(".tons");
    if (!caixa) return;
    for (const b of caixa.querySelectorAll('[data-acao="tom"]')) b.setAttribute("aria-selected", String(b === botao));
    for (const d of caixa.querySelectorAll(".tom")) d.hidden = d.dataset.tom !== botao.dataset.tom;
  };

  P.copiarTom = function copiarTom(botao) {
    const bloco = botao.closest(".tom");
    const area = bloco?.querySelector(".texto-tom");
    if (!area) return;
    const editada = area.value.trim();
    const original = (area.dataset.original ?? "").trim();
    P.copiar(botao, editada);
    /* Mudou alguma coisa: é o jeito de quem envia — o próximo rascunho aprende. Uma vez por texto. */
    if (editada && editada !== original && area.dataset.aprendido !== editada) {
      area.dataset.aprendido = editada;
      CW.enviar({ tipo: "aprenderResposta", tom: bloco.dataset.tom, original, editada });
    }
  };

  /**
   * A situação da conversa (Fase 28): o que o cliente quer, o que já foi
   * feito, o que prometemos e quando, o que falta e o risco. A citação é
   * o trecho da mensagem — o servidor já tirou a que não está na
   * conversa —, em letra menor, para conferir de onde o ponto saiu.
   */
  function blocoSituacao(s) {
    /* A citação igual ao próprio ponto (o que as regras escrevem) não se repete. */
    const igual = (a, b) => String(a ?? "").replace(/\u2026$/, "").trim() === String(b ?? "").replace(/\u2026$/, "").trim();
    const cita = (p) => (p?.citacao && !igual(p.citacao, p.texto) ? `<span class="citacao">\u201c${CW.escapar(p.citacao)}\u201d</span>` : "");
    const item = (p, extra = "") => `<li>${CW.escapar(p.texto)}${extra}${cita(p)}</li>`;
    const risco = s.risco ?? { nivel: "baixo", porque: "" };
    const tomDoRisco = risco.nivel === "alto" ? "perigo" : risco.nivel === "medio" ? "atencao" : "ok";
    return [
      '<dl class="situacao">',
      `  <dt>Quer</dt><dd>${CW.escapar(s.quer?.texto ?? "\u2014")}${cita(s.quer)}</dd>`,
      s.feito?.length ? `  <dt>Já feito</dt><dd><ul>${s.feito.map((p) => item(p)).join("")}</ul></dd>` : "",
      s.prometido?.length
        ? `  <dt>Prometido</dt><dd><ul>${s.prometido
            .map((p) => item(p, p.quando ? ` <span class="quando${p.vencida ? " vencida" : ""}">${p.vencida ? "venceu " : "até "}${CW.escapar(p.quando)}</span>` : ""))
            .join("")}</ul></dd>`
        : "",
      `  <dt>Falta</dt><dd>${CW.escapar(s.falta ?? "\u2014")}</dd>`,
      `  <dt>Risco</dt><dd><span class="tag ${tomDoRisco}">${ROTULO_DO_RISCO[risco.nivel] ?? risco.nivel}</span> ${CW.escapar(risco.porque ?? "")}</dd>`,
      "</dl>",
    ].join("");
  }

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
      /* A situação (Fase 28): quer, feito, prometido, falta e risco, cada um com a mensagem de onde saiu. */
      P.resumo.situacao
        ? blocoSituacao(P.resumo.situacao)
        : `    <p class="sub" style="margin-top:8px"><strong>Pendência:</strong> ${CW.escapar(P.resumo.pendencia ?? "\u2014")}</p>`,
      `    <p class="sub" style="margin-top:4px"><strong>Próximo passo:</strong> ${CW.escapar(P.resumo.proximoPasso ?? "\u2014")}</p>`,
      '    <p class="sub" style="margin-top:8px">',
      P.resumo.resolvido
        ? '      <span class="tag ok">parece resolvido</span>'
        : '      <span class="tag atencao">ainda não resolvido</span>',
      `      <span style="margin-left:6px">${P.resumo.mensagensLidas ?? 0} mensagens lidas</span>`,
      '    </p>',
      '  </div>',
      blocoTons(P.resumo.tons),
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

                /*
                  A conferência deste texto contra o documento (Fase 9.3).

                  É de cada um, e não do bloco: o "Responder agora" pode
                  estar impecável e o "Confirmar e encerrar" ter esquecido
                  o nome. Aparece antes de copiar — depois de enviado, já
                  foi.
                */
                (r.conferencia ?? []).length > 0
                  ? r.conferencia
                      .map(
                        (a) =>
                          `    <p class="sub" style="margin:4px 0 0;color:${a.tom === "perigo" ? "var(--perigo)" : "var(--suave)"}">• ${CW.escapar(a.texto)}</p>`
                      )
                      .join("")
                  : "",

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
