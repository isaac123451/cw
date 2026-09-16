/**
 * NPS, anotações e a fila do canal — parte do painel da extensão.
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

  P.CANAIS = ["Telefone", "WhatsApp", "E-mail"];

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
      P.filaAtual?.etapasNps ?? P.ultimoDado?.etapasNps;

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

  /**
   * Anotar no ciclo, do lado de dentro da conversa.
   *
   * O caso do Reclame Aqui já tinha isto; o ciclo de NPS, não — só
   * dava para registrar tentativa de contato, que é outra coisa. Quem
   * descobria algo sobre o cliente no meio do atendimento não tinha
   * onde escrever sem trocar de aba, e registro que exige trocar de
   * aba é registro que não acontece.
   *
   * Fica recolhido: nem toda conversa vira anotação, e um campo de
   * texto sempre aberto empurraria o resto do cartão para baixo.
   */
  function campoDeAnotacaoDoNps(nps) {

    if (nps.encerrado) return "";

    const id = CW.escapar(nps.id);

    return `
    <details style="margin-top:8px">
      <summary style="cursor:pointer;font-size:12px;font-weight:600;padding:5px 0">Anotar neste ciclo</summary>
      <textarea class="campo" id="nps-nota-${id}" rows="2" style="margin-top:6px" placeholder="O que você descobriu sobre este cliente"></textarea>
      <div class="linha" style="margin-top:7px;align-items:center">
        <span class="sub">Entra na ficha do NPS, com seu nome e a data.</span>
        <button class="acao" style="margin-top:0" data-acao="anotar-nps" data-id="${id}">Anotar</button>
      </div>
    </details>`;
  }

  /**
   * "Este WhatsApp é o do NPS."
   *
   * O Isaac: "no do nps ser possível selecionar que é do nps".
   *
   * A extensão sempre soube ler o número da conversa aberta e usá-lo
   * para **procurar** ciclos. O caminho de volta não existia: achado o
   * ciclo, não havia como dizer "e este número é o dele". O resultado
   * está medido — 868 respostas sem telefone nenhum, enquanto quem
   * atendia estava com a conversa aberta, com o número na tela.
   *
   * Não adivinha. O mesmo número pode ser do consumidor que reclamou no
   * Reclame Aqui ou do dono que respondeu a pesquisa, e nada no número
   * diz qual — são pessoas diferentes, com problemas diferentes. Quem
   * está na conversa sabe; o painel pergunta.
   *
   * **Só aparece com conversa aberta.** Sem número na tela não há o que
   * gravar, e um botão que não tem o que fazer é pior do que nenhum.
   */
  function esteWhatsappEDoNps(nps) {

    const numero = numeroDaConversa();

    if (!numero || nps.encerrado) return "";

    /*
      Sem comparar com o número que já está gravado, de propósito.

      O servidor manda `temContato` e **não** o telefone do ciclo: a
      resposta fica em cache na extensão, e contato solto ali não tem
      uso e vira dado exposto sem motivo. Então o botão aparece mesmo
      quando já existe contato — e o texto abaixo dele avisa que
      substitui, em vez de trocar em silêncio.
    */

    return [
      '    <div class="etapas" style="border-top-style:solid">',
      `      <button class="passo" data-acao="wpp-frente" data-frente="nps" data-id="${CW.escapar(nps.id)}" data-numero="${CW.escapar(numero)}" style="flex:1">Este WhatsApp é do NPS</button>`,
      '    </div>',
      `    <p class="sub" style="margin-top:5px">Grava ${CW.escapar(numero)} como contato deste ciclo${nps.temContato ? " — substitui o que já está lá" : ""}.</p>`,
    ].join("");
  }

  /**
   * "Este WhatsApp é o do Reclame Aqui."
   *
   * A outra metade do pedido. Mesma mecânica, outro destino: o telefone
   * do caso, que é o do consumidor que abriu a reclamação.
   */
  P.esteWhatsappEDoCaso = function esteWhatsappEDoCaso(protocolo, telefoneAtual) {

    const numero = numeroDaConversa();

    if (!numero) return "";

    if (
      String(telefoneAtual ?? "").replace(/\D/g, "") ===
      numero
    ) {
      return "";
    }

    return [
      '  <div class="etapas" style="border-top-style:solid">',
      `    <button class="passo" data-acao="wpp-frente" data-frente="reclame-aqui" data-protocolo="${CW.escapar(protocolo)}" data-numero="${CW.escapar(numero)}" style="flex:1">Este WhatsApp é do Reclame Aqui</button>`,
      '  </div>',
      `  <p class="sub" style="margin-top:5px">Grava ${CW.escapar(numero)} como telefone desta reclamação${telefoneAtual ? " — substitui o que está lá" : ""}.</p>`,
    ].join("");
  };

  /**
   * O número da conversa aberta, só dígitos.
   *
   * Vem da captura do `whatsapp.js`, que é quem lê a página. O piso de
   * dez dígitos existe porque a leitura às vezes pega um fragmento — e
   * um telefone de três dígitos gravado num cadastro é pior do que
   * campo vazio: ele parece preenchido.
   */
  function numeroDaConversa() {

    const bruto =
      P.captura?.telefone ?? P.consulta?.telefone ?? "";

    const so = String(bruto).replace(/\D/g, "");

    return so.length >= 10 && so.length <= 15 ? so : "";
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
  P.podeEscrever = function podeEscrever(dados) {
    return (
      Boolean(dados?.usuario) &&
      dados.usuario.papel !== "LEITURA"
    );
  };

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
  P.blocoNps = function blocoNps(
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
      escrever ? esteWhatsappEDoNps(nps) : "",
      escrever ? campoDeAnotacaoDoNps(nps) : "",
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
        ...P.CANAIS.map(
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
  };

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
  P.blocoAnotar = function blocoAnotar(dados) {

    if (!P.podeEscrever(dados)) return "";

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
  };

  P.anotarCaso = async function anotarCaso(botao) {

    const erro = P.corpo.querySelector("#anota-erro");

    const texto = (
      P.corpo.querySelector("#anota-texto")?.value ?? ""
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
          P.corpo.querySelector("#anota-caso")?.value,
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

    P.avisar(
      `Anotação gravada em ${resposta.dados.protocolo}.`,
      "ok"
    );

    const campo = P.corpo.querySelector("#anota-texto");

    if (campo) campo.value = "";
  };

  P.anotarTarefa = async function anotarTarefa(botao) {

    const erro = P.corpo.querySelector("#tarefa-erro");

    const titulo = (
      P.corpo.querySelector("#anota-tarefa")?.value ?? ""
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
          P.corpo.querySelector("#anota-quando")?.value,
        hora: P.corpo.querySelector("#anota-hora")?.value,
        tipoDeTarefa:
          P.corpo.querySelector("#anota-tipo")?.value,
        protocolo:
          P.corpo.querySelector("#anota-caso")?.value,
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

    P.avisar(
      `Marcado na agenda para ${CW.data(resposta.dados.quando)}${
        resposta.dados.hora
          ? ` às ${resposta.dados.hora}`
          : ""
      }.`,
      "ok"
    );

    const campo = P.corpo.querySelector("#anota-tarefa");

    if (campo) campo.value = "";
  };

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
  P.NOME_DO_RECORTE = {
    "sem-resposta": "Sem resposta",
    replicas: "Réplicas",
    risco: "Risco de churn",
  };

  P.carregarFila = async function carregarFila() {

    P.corpo.innerHTML = `<div class="carregando">Carregando ${CW.escapar(
      NOME_DO_CANAL[P.canal] ?? P.canal
    )}…</div>`;

    /**
     * Duas fontes para a mesma aba, e a diferença é a pergunta.
     *
     * "Só deste cliente" é `contexto`, que casa telefone, nome e
     * e-mail. A fila é `fila`, que ordena por urgência e não conhece
     * contato nenhum. Tentar servir as duas com uma rota só faria uma
     * delas trabalhar contra a própria definição.
     */
    const resposta = P.soDoCliente
      ? await CW.enviar({
          tipo: "contexto",
          consulta: { ...P.parametros(), canal: P.canal },
          forcar: true,
        })
      : await CW.enviar({
          tipo: "fila",
          canal: P.canal,
          etapa: P.etapaFiltro,
          segmento: P.segmentoFiltro,
          recorte: P.recorteFiltro,
        });

    if (!resposta.ok) {
      P.renderFalha(resposta);
      return;
    }

    if (resposta.dados?.erro) {
      P.vazio("Não deu para carregar", resposta.dados.erro);
      return;
    }

    if (P.soDoCliente) {
      P.ultimoDado = resposta.dados;
      P.filaAtual = { etapas: resposta.dados.etapas };
      desenharFilaDoCliente(resposta.dados);
      return;
    }

    P.filaAtual = resposta.dados;

    desenharFila(resposta.dados);
  };

  /** O chip que alterna entre o cliente da tela e a fila inteira. */
  function chipsDeEscopo() {

    if (!P.temOndeProcurar()) return "";

    return [
      '<div class="chips">',
      `  <button class="chip" data-acao="escopo" data-valor="cliente" aria-pressed="${P.soDoCliente}">Só deste cliente</button>`,
      `  <button class="chip" data-acao="escopo" data-valor="fila" aria-pressed="${!P.soDoCliente}">Toda a fila</button>`,
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

    if (P.canal === "nps") {
      return desenharNpsDoCliente(dados);
    }

    P.corpo.innerHTML = [
      '<div class="bloco">',
      `  <div class="rotulo">${CW.escapar(NOME_DO_CANAL[P.canal] ?? P.canal)}${nome ? ` · ${CW.escapar(nome)}` : ""}</div>`,
      chipsDeEscopo(),
      casos.length === 0
        ? `  <p class="sub" style="margin-top:9px">Este cliente não tem caso em ${CW.escapar(NOME_DO_CANAL[P.canal] ?? P.canal)}.</p>`
        : casos.map(P.desenharCaso).join(""),
      '</div>',

      /*
        Resumo e dossiê valem para Redes Sociais como valem para o RA.

        O dossiê se apoia no primeiro caso quando há um, e no contato
        quando não há — o servidor cruza os dois lados e traz o NPS e os
        outros canais deste mesmo cliente junto.
      */
      P.blocoOutrasFrentes(dados.outrasFrentes),
      P.lerConversa ? P.blocoResumo() : "",
      P.blocoDossie(casos[0]?.protocolo ?? ""),
    ].join("");

    P.corpo.scrollTop = 0;
  }

  /** Os ciclos de NPS daquele cliente, com o contato editável. */
  function desenharNpsDoCliente(dados) {

    const ciclos = dados.npsLista ?? [];

    P.corpo.innerHTML = [
      '<div class="bloco">',
      `  <div class="rotulo">NPS${dados.cliente?.nome ? ` · ${CW.escapar(dados.cliente.nome)}` : ""}</div>`,
      chipsDeEscopo(),
      '</div>',
      ciclos.length === 0
        ? '<div class="bloco"><p class="sub">Nenhum ciclo de NPS para este contato. O WhatsApp da pesquisa é outro número — se souber que é a mesma pessoa, abra o ciclo pela fila e grave o telefone ali.</p></div>'
        : ciclos
            .map((ciclo) =>
              P.blocoNps(
                ciclo,
                P.podeEscrever(dados),
                true,
                dados.estabelecimento?.whatsappNps ?? null
              )
            )
            .join(""),

      /*
        Resumo e dossiê também aqui.

        O Isaac pediu: "essa possibilidade de resumos, dossiê, outras
        funcionalidades, precisam estar também no NPS e Redes sociais".
        Nada disso é exclusivo do Reclame Aqui — o cliente que detratou
        no NPS é o mesmo que pode abrir reclamação amanhã, e é agora que
        ler o histórico dele ainda muda o desfecho.

        O dossiê vai sem protocolo: o servidor cruza pelo contato e traz
        os ciclos de NPS junto com os casos dos outros canais.
      */
      P.blocoOutrasFrentes(dados.outrasFrentes),
      P.lerConversa ? P.blocoResumo() : "",
      P.blocoDossie(""),
    ].join("");

    P.corpo.scrollTop = 0;
  }

  /** Última fila carregada — as etapas dela rotulam os botões. */
  P.filaAtual = null;

  function desenharFila(dados) {

    const itens = dados.itens ?? [];

    /** O recorte, quando há, é quem dá nome à lista. */
    const titulo =
      P.NOME_DO_RECORTE[dados.recorte] ??
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
        P.vazio(
          `Nada em ${titulo}`,
          "A fila deste canal está limpa."
        );
        return;
      }

      P.corpo.innerHTML = [
        '<div class="bloco">',
        `  <div class="rotulo">${CW.escapar(titulo)} · nada em aberto</div>`,
        chipsDeEscopo(),
        filtros,
        '  <p class="sub" style="margin-top:9px">Nenhum caso neste recorte. Escolha outro acima.</p>',
        '</div>',
      ].join("");

      P.corpo.scrollTop = 0;
      return;
    }

    P.corpo.innerHTML = [
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
                P.blocoNps(item, P.podeMover(), true)
            : P.desenharDaFila
        )
        .join(""),
    ].join("");

    P.corpo.scrollTop = 0;
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
        `  <button class="chip" data-acao="segmento" data-valor="" aria-pressed="${!P.segmentoFiltro}">Todos ${dados.totalGeral ?? 0}</button>`,
        ...["Detrator", "Passivo", "Promotor"].map(
          (nome) =>
            `  <button class="chip" data-acao="segmento" data-valor="${nome}" aria-pressed="${P.segmentoFiltro === nome}">${nome}es ${contagem[nome] ?? 0}</button>`
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
            `  <button class="chip" data-acao="etapa" data-valor="" aria-pressed="${!P.etapaFiltro}">Todas ${dados.totalGeral ?? 0}</button>`,
            ...etapas.map(
              (nome) =>
                `  <button class="chip" data-acao="etapa" data-valor="${CW.escapar(nome)}" aria-pressed="${P.etapaFiltro === nome}">${CW.escapar(nome)} ${contagem[nome]}</button>`
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
      `  <button class="chip" data-acao="recorte" data-valor="" aria-pressed="${!P.recorteFiltro}">Em aberto ${dados.totalDoCanal ?? 0}</button>`,
      ...Object.entries(P.NOME_DO_RECORTE).map(
        ([id, rotulo]) =>
          `  <button class="chip" data-acao="recorte" data-valor="${id}" aria-pressed="${P.recorteFiltro === id}">${CW.escapar(rotulo)} ${porRecorte[id] ?? 0}</button>`
      ),
      '</div>',
      chipsDeEtapa,
    ].join("");
  }
})();
