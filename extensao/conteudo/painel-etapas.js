/**
 * Avançar e voltar etapa — parte do painel da extensão.
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
      P.filaAtual?.etapas ??
      P.ultimoDado?.etapas ??
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
  P.podeMover = function podeMover() {
    return (
      !P.ultimoDado?.usuario ||
      P.ultimoDado.usuario.papel !== "LEITURA"
    );
  };

  /**
   * Os controles de etapa de um caso.
   *
   * Dois botões para o passo vizinho **e** um seletor para qualquer
   * etapa: um caso costuma pular colunas — quem respondeu e já resolveu
   * não passa por "Em atendimento" só para chegar em "Resolvido", e
   * obrigar dois cliques para isso fazia o botão atrapalhar.
   */
  P.botoesDeEtapa = function botoesDeEtapa(caso) {

    if (!P.podeMover()) return "";

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
  };

  P.moverCaso = async function moverCaso(botao, para) {

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
      P.avisar(resposta.erro ?? r?.erro, "perigo");
      return;
    }

    if (!r.movido) {
      P.avisar(r.aviso, "atencao");
      return;
    }

    /**
     * A nota some ao voltar de "Resolvido"/"Não resolvido" — regra de
     * `moverPara`. Avisar não é enfeite: apagar avaliação em silêncio é
     * a definição de efeito colateral, e ela pesa na reputação.
     */
    P.avisar(
      `${r.protocolo}: ${r.de} → ${r.status}.${
        r.notaRemovida
          ? " A avaliação saiu junto, porque o caso voltou para antes dela."
          : ""
      }`,
      r.notaRemovida ? "atencao" : "ok"
    );

    P.recarregarVista();
  };

  /**
   * Recarrega o que está na tela, e não sempre o contato.
   *
   * O botão de atualizar chamava `consultar(true)` direto — e
   * `consultar` sai cedo quando a vista não é a de contato. O resultado
   * era o pior possível: numa aba de canal ou no detalhe, o botão de
   * atualizar não fazia **nada**, sem dizer por quê.
   */
  P.recarregarVista = function recarregarVista(naMao = false) {

    if (P.vista === "fila") return P.carregarFila();
    if (P.vista === "painel") return P.carregarPainel();
    if (P.vista === "atividades") {
      return P.carregarAtividades();
    }

    if (P.vista === "caso") {
      return P.detalhe
        ? P.abrirDetalhe(P.detalhe.protocolo)
        : P.voltarAoContato();
    }

    P.consultar(true);

    void naMao;
  };

  P.moverNps = async function moverNps(botao) {

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
      P.avisar(resposta.erro ?? r?.erro, "perigo");
      return;
    }

    if (!r.movido) {
      P.avisar(r.aviso, "atencao");
      return;
    }

    P.avisar(`NPS: ${r.de} → ${r.status}.`, "ok");

    P.recarregarVista();
  };

  /**
   * Um aviso curto no topo do corpo, que some sozinho.
   *
   * O painel não tem onde empilhar notificação, e um `alert()` dentro
   * do WhatsApp Web sequestra a página inteira.
   */
  P.avisar = function avisar(texto, tom = "ok") {

    if (!texto || !P.corpo) return;

    const antigo = P.corpo.querySelector(".recado");

    antigo?.remove();

    const caixa = document.createElement("div");

    caixa.className = `recado ${tom}`;
    caixa.textContent = texto;

    P.corpo.prepend(caixa);

    setTimeout(() => caixa.remove(), 7000);
  };

  /**
   * Alterna um grupo de botões de escolha.
   *
   * O estado vive no DOM (`aria-pressed`), e não numa variável: é a
   * mesma decisão do formulário de captura — o que vale é o que está na
   * tela. Clicar no que já está marcado desmarca, que é como se corrige
   * um clique errado sem recarregar o painel.
   */
  P.alternarEscolha = function alternarEscolha(alvo) {

    const marcado =
      alvo.getAttribute("aria-pressed") === "true";

    for (const irmao of P.corpo.querySelectorAll(
      `[data-acao="${alvo.dataset.acao}"]`
    )) {
      irmao.setAttribute("aria-pressed", "false");
    }

    alvo.setAttribute(
      "aria-pressed",
      marcado ? "false" : "true"
    );
  };

  function escolhido(grupo) {

    const alvo = P.corpo.querySelector(
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
  P.registrarNps = async function registrarNps(botao, acao) {

    const seletorErro =
      acao === "tentativa"
        ? "#nps-erro-tentativa"
        : "#nps-erro";

    const erro = P.corpo.querySelector(seletorErro);

    if (erro) erro.textContent = "";

    const registro = { id: botao.dataset.id, acao };

    if (acao === "tentativa") {

      registro.canal =
        P.corpo.querySelector("#nps-canal")?.value ??
        P.CANAIS[0];

      registro.nota = (
        P.corpo.querySelector("#nps-tentativa")?.value ?? ""
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
        P.corpo.querySelector("#nps-nota")?.value ?? ""
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
    if (resposta.dados?.nps && P.ultimoDado) {
      P.ultimoDado = {
        ...P.ultimoDado,
        nps: resposta.dados.nps,
      };

      P.render(P.ultimoDado);
    }
  };

  /**
   * Atalho para capturar a reclamação aberta.
   *
   * Fica visível **mesmo quando o painel achou alguém** — porque achar
   * um cliente por nome não quer dizer que aquela reclamação exista do
   * nosso lado. Some só quando o caso encontrado é exatamente esta
   * reclamação, onde capturar de novo não teria efeito nenhum.
   */
  P.blocoCaptura = function blocoCaptura(dados) {

    if (!P.captura?.id || !P.captura?.titulo) return "";

    const jaEstaAqui = (dados?.casos ?? []).some(
      (caso) =>
        caso.id === P.captura.id ||
        caso.protocolo === `RA-${P.captura.id}`
    );

    if (jaEstaAqui) {
      return [
        '<div class="bloco">',
        `  <p class="sub">Esta reclamação (${CW.escapar(P.captura.id)}) já está no CW Reputação.</p>`,
        '</div>',
      ].join("");
    }

    return [
      '<div class="bloco">',
      '  <button class="copiar" data-acao="capturar" style="width:100%;padding:8px">',
      `    Ler reclamação ${CW.escapar(P.captura.id)} e adicionar ao Kanban`,
      '  </button>',
      '</div>',
    ].join("");
  };
})();
