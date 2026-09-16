/**
 * Capturar a reclamação, e o público — parte do painel da extensão.
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
     CAPTURA — LER A RECLAMAÇÃO E CRIAR NO KANBAN
  ============================================================ */

  /* Os três níveis da documentação de agosto/2026 — Urgente, Alta, Normal. */
  const PRIORIDADES = ["Urgente", "Alta", "Normal"];

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
  P.abrirCaptura = function abrirCaptura() {

    if (!P.captura) return;

    const doPortal =
      !P.captura.origem ||
      P.captura.origem === "Reclame Aqui";

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

    P.corpo.innerHTML = `
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
          doPortal && (P.captura.cod || P.captura.hora)
            ? `<p class="sub" style="margin:-5px 0 11px">Lido da reclamação: ${[
                P.captura.cod &&
                  `COD <strong>${CW.escapar(P.captura.cod)}</strong>`,
                P.captura.id &&
                  `ID <strong>${CW.escapar(P.captura.id)}</strong>`,
                P.captura.hora &&
                  `publicada às <strong>${CW.escapar(P.captura.hora)}</strong>`,
              ]
                .filter(Boolean)
                .join(" · ")}.</p>`
            : ""
        }

        ${lista(
          "origem",
          "Origem",
          ORIGENS,
          P.captura.origem ?? "Reclame Aqui"
        )}

        ${campo(
          "id",
          doPortal
            ? "Id no portal"
            : "Id (deixe vazio para gerar)",
          P.captura.id
        )}
        ${campo("cliente", "Cliente", P.captura.cliente)}
        ${
          !P.captura.cliente && doPortal
            ? '<p class="sub" style="margin:-4px 0 9px">Não achei o nome do consumidor nesta página. Ele aparece acima da etiqueta “Nome social” — se não estiver lá, preencha à mão.</p>'
            : ""
        }

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${campo("telefone", "Telefone", P.captura.telefone)}
          ${campo("email", "E-mail", P.captura.email)}
        </div>

        ${campo("titulo", "Título", P.captura.titulo)}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${campo("criadoEm", "Publicada em (AAAA-MM-DD)", P.captura.criadoEm)}
          ${lista(
            "prioridade",
            "Prioridade",
            PRIORIDADES,
            P.captura.prioridade ?? "Normal"
          )}
        </div>

        ${blocoClassificacao()}

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">
          ${campo("cidade", "Cidade", P.captura.cidade)}
          ${campo("estado", "UF", uf.uf)}
        </div>
        ${
          uf.origem
            ? `<p class="sub" style="margin:-4px 0 9px">A página não mostra a UF: esta veio ${CW.escapar(uf.origem)}. Confira antes de criar.</p>`
            : ""
        }

        ${campo("texto", "Relato do consumidor", P.captura.texto, "textarea")}

        ${
          P.captura.statusPortal
            ? `<p class="sub" style="margin-bottom:11px">No portal está como <strong>${CW.escapar(P.captura.statusPortal)}</strong>.</p>`
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

    P.corpo.scrollTop = 0;
  };

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

    const cadastros = P.ultimoDado?.cadastros;

    if (!cadastros?.categorias?.length) {
      return `
        <div style="margin-bottom:9px">
          <label class="rotulo" for="cap-categoria">Categoria</label>
          <input class="campo" id="cap-categoria" data-campo="categoria" type="text"
                 style="margin-top:0" value="${CW.escapar(P.captura.categoria ?? "")}"
                 placeholder="Não classificado" />
        </div>`;
    }

    const categorias = [
      "Não classificado",
      ...cadastros.categorias,
    ];

    const atual = categorias.includes(P.captura.categoria)
      ? P.captura.categoria
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
            ${P.opcoesDeSubcategoria(atual, P.captura.subcategoria)}
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

    if (P.captura.estado) {
      return { uf: P.captura.estado, origem: "" };
    }

    const mapa =
      P.ultimoDado?.cadastros?.ufPorCidade ?? null;

    const daCidade = P.captura.cidade
      ? (mapa?.[
          String(P.captura.cidade).trim().toLowerCase()
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
      CW.ra?.ufPeloTelefone?.(P.captura.telefone) ?? "";

    if (doDdd) {
      return {
        uf: doDdd,
        origem: "do DDD do telefone do consumidor",
      };
    }

    return { uf: "", origem: "" };
  }

  P.opcoesDeSubcategoria = function opcoesDeSubcategoria(categoria, atual) {

    const todas =
      P.ultimoDado?.cadastros?.subcategorias ?? [];

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
  };

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

    if (P.captura.formularioRecolhido) {
      return [
        '<div class="bloco">',
        '  <div class="aviso">',
        '    Esta reclamação tem informações adicionais que ainda estão recolhidas na página. Clique em <strong>Exibir</strong> lá e depois em “reler a página”.',
        '  </div>',
        '  <button class="copiar" data-acao="reler" style="width:100%;padding:8px">Reler a página</button>',
        '</div>',
      ].join("");
    }

    const itens = P.captura.formulario ?? [];

    if (itens.length === 0) return "";

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Informações adicionais da reclamação</div>',
      P.captura.documento
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

    for (const campo of P.corpo.querySelectorAll(
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
  P.reler = function reler() {

    if (!P.releitor) return;

    const digitado = lerFormulario();
    const anterior = P.captura ?? {};
    const nova = P.releitor() ?? {};

    for (const [chave, valor] of Object.entries(
      digitado
    )) {

      if (chave === "url") continue;

      if (valor !== String(anterior[chave] ?? "")) {
        nova[chave] = valor;
      }
    }

    P.captura = nova;

    P.abrirCaptura();
  };

  P.criarCaso = async function criarCaso(botao) {

    const dados = lerFormulario();
    const erro = P.corpo.querySelector("#cap-erro");

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
        documento: P.captura?.documento ?? "",

        /**
         * O COD vai junto e vira o protocolo no servidor.
         *
         * É o identificador que o export do portal também traz; o número
         * do "ID:" não aparece lá. Sem mandá-lo, a reclamação capturada
         * aqui e a mesma reclamação vinda da planilha entrariam como
         * dois casos.
         */
        cod: P.captura?.cod ?? "",
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

    P.captura = null;

    P.vazio(
      r?.jaExistia
        ? "Esta reclamação já estava no Kanban"
        : "Criada no Kanban",
      r?.jaExistia
        ? [
            `${r.protocolo} está em "${r.status}"${r.responsavel ? ` com ${r.responsavel}` : ""}. Nada foi sobrescrito.`,
            /*
              O vigia cria sem nome e sem contato — o portal não os mostra
              em público. Esta página mostra, e o servidor completou o
              que estava vazio. Dizer o quê é o que faz alguém confiar.
            */
            Array.isArray(r.completou) && r.completou.length > 0
              ? `Completei ${juntarCampos(r.completou)} com o que esta página mostra.`
              : "",
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
    setTimeout(() => P.consultar(true), 900);
  };

  /** "nome, telefone e e-mail" — a lista em português. */
  function juntarCampos(campos) {
    const lista = campos.map(String);
    return lista.length <= 1
      ? lista.join("")
      : `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
  }

  CW.painel = {
    montar: P.montar,
    definirContexto: P.definirContexto,
    abrir: P.abrir,
    fechar: P.fechar,

    /**
     * Reclamação lida da página pelo detector do site.
     *
     * Guardada, não enviada: nada vai para o servidor sem alguém
     * clicar em "Criar no Kanban".
     */
    definirCaptura(dados) {
      P.captura = dados ?? null;
    },

    /**
     * O site informa **como** reler a página.
     *
     * Só o `hugme.js` fornece. É o que faz o botão "reler a página"
     * funcionar depois de alguém expandir as informações adicionais da
     * reclamação, que nascem recolhidas e não mudam o endereço.
     */
    definirReleitor(fn) {
      P.releitor = typeof fn === "function" ? fn : null;
    },

    /**
     * O site informa como entregar o texto cru da página.
     *
     * Recebe uma função, e não o texto: enquanto ninguém clicar em
     * "copiar o texto lido", nada é lido nem guardado. É a mesma regra
     * do leitor de conversa.
     */
    definirDiagnostico(fn) {
      P.diagnostico = typeof fn === "function" ? fn : null;
    },

    /**
     * O site informa **como** ler a conversa aberta.
     *
     * Recebe uma função, não o texto: enquanto ninguém clicar em
     * "Resumir", nenhuma mensagem é lida.
     */
    definirLeitorDeConversa(fn) {
      P.lerConversa = typeof fn === "function" ? fn : null;
    },

    /**
     * O que o painel sabe do contato agora.
     *
     * Existe para o atalho de respostas prontas, que fica ao lado da
     * caixa de mensagem e não tem detector próprio: quem lê a conversa
     * é o `whatsapp.js`, e quem guarda o que o servidor respondeu sobre
     * aquele contato é este painel. Duplicar a leitura ali produziria
     * duas verdades sobre quem está do outro lado.
     *
     * Só leitura, e só do que já está na memória: nada aqui consulta o
     * servidor nem lê a página de novo.
     */
    contextoAtual() {
      return {
        /* O nome do cabeçalho — apelido da agenda, quando houver. */
        nome: P.consulta?.nome ?? "",
        telefone: P.consulta?.telefone ?? "",

        /* O nome do cadastro do consumidor, quando houve casamento. */
        cliente: P.ultimoDado?.cliente?.nome ?? "",

        /**
         * O caso mais recente do contato.
         *
         * `casos` já vem ordenado pela rota, e é o que a gaveta
         * mostra no topo. É o protocolo que uma mensagem de cobrança
         * de avaliação precisa citar.
         */
        protocolo: P.ultimoDado?.casos?.[0]?.protocolo ?? "",
      };
    },

    /**
     * Autoriza o painel a abrir sozinho neste site.
     *
     * Só o `whatsapp.js` chama. É o que impede a gaveta de pular na
     * frente de quem está lendo uma reclamação no Hugme.
     */
    permitirAutoAbrir() {
      P.autoPermitido = true;
      P.refletirAuto();
    },

    /** Reanexa o painel se a página o tiver removido — ou quebrado. */
    garantir() {

      if (P.montado()) {

        /**
         * A página pode ter trocado a árvore por baixo do empurrão.
         *
         * O WhatsApp Web recria o `#app` em algumas navegações, e o
         * elemento novo nasce com a largura da viewport inteira — a
         * gaveta voltaria a cobrir a conversa sem ninguém ter mexido
         * em nada.
         */
        if (P.aberto) P.empurrarPagina(true);

        return;
      }

      P.hospedeiro?.remove();
      P.hospedeiro = null;
      P.raiz = null;

      P.montar();
    },
  };

  /* Painel de pé: uma segunda injeção não refaz nada. */
  P.pronto = true;
})();
