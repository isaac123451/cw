/**
 * O dia: painel, atividades, fila e agenda — parte do painel da extensão.
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
     PAINEL DO DIA
  ============================================================ */

  P.carregarPainel = async function carregarPainel() {

    P.corpo.innerHTML = `<div class="carregando">Carregando o painel…</div>`;

    const resposta = await CW.enviar({ tipo: "resumo" });

    if (!resposta.ok) {
      P.renderFalha(resposta);
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
    if (P.podeMover()) {
      partes.push(blocoNovaAtividade());
    }

    /* ---- resumo da conversa, quando o site oferece ---- */

    if (P.lerConversa) {
      partes.push(P.blocoResumo());
    }

    P.corpo.innerHTML = partes.filter(Boolean).join("");
    P.corpo.scrollTop = 0;
  };

  /** A anotação do dia — tarefa de agenda sem caso ligado. */
  P.anotarODia = async function anotarODia(botao) {

    const erro = P.corpo.querySelector("#dia-erro");

    const titulo = (
      P.corpo.querySelector("#dia-tarefa")?.value ?? ""
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
        quando: P.corpo.querySelector("#dia-quando")?.value,
        hora: P.corpo.querySelector("#dia-hora")?.value,
        tipoDeTarefa:
          P.corpo.querySelector("#dia-tipo")?.value,
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
      `Marcado para ${CW.data(resposta.dados.quando)}${
        resposta.dados.hora
          ? ` às ${resposta.dados.hora}`
          : ""
      }.`,
      "ok"
    );

    P.recarregarVista();
  };

  /* ============================================================
     ATIVIDADES
  ============================================================ */

  const NOME_DO_ESCOPO = {
    "": "Vencendo",
    proximos: "Próximas",
    concluidas: "Concluídas",
    reclamacoes: "RA em aberto",
  };

  /**
   * A fila do Reclame Aqui e a leitura dela, guardadas entre trocas de
   * recorte.
   *
   * Voltar de "Concluídas" para "RA em aberto" não deve gastar outra
   * chamada ao modelo — o resumo custa caro e a fila não mudou em três
   * segundos. Some quando o painel fecha.
   */
  P.pendencias = null;
  P.resumoDasPendencias = null;

  /**
   * As contagens da agenda, guardadas para os chips da outra tela.
   *
   * A fila do RA desenha a mesma linha de recortes, e ela não pede a
   * agenda — se os números não viessem daqui, "Vencendo 0 · Próximas 0"
   * apareceria em cima de uma agenda cheia, e o zero seria lido como
   * "não tem nada", não como "não perguntei".
   */
  let contagensDaAgenda = {};

  /**
   * Os quatro recortes, num lugar só.
   *
   * Duas telas os desenham — a agenda e a fila do RA — e uma lista de
   * botões copiada em dois lugares é uma lista que fica diferente na
   * primeira vez que alguém mexe num deles.
   */
  function chipsDeAtividade(contagens, abertos) {
    return [
      '  <div class="chips">',
      ...[
        ["", "Vencendo", contagens.pendentes ?? 0],
        ["proximos", "Próximas", contagens.proximos ?? 0],
        [
          "concluidas",
          "Concluídas",
          contagens.concluidas ?? 0,
        ],
        [
          "reclamacoes",
          "RA em aberto",
          abertos ?? "",
        ],
      ].map(
        ([id, rotulo, quantidade]) =>
          `    <button class="chip" data-acao="escopo-atividade" data-valor="${id}" aria-pressed="${P.escopoAtividades === id}">${rotulo} ${quantidade}</button>`
      ),
      '  </div>',
    ].join("");
  }

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
  P.carregarAtividades = async function carregarAtividades() {

    /*
      "RA em aberto" não é um recorte da agenda: é outra fonte.

      A agenda lista o que alguém marcou; esta lista, o que está aberto
      no portal quer alguém tenha marcado ou não. São as duas metades
      do mesmo dia de trabalho, e por isso moram na mesma aba — mas a
      rota é outra.
    */
    if (P.escopoAtividades === "reclamacoes") {
      await carregarReclamacoesAbertas();
      return;
    }

    P.corpo.innerHTML = `<div class="carregando">Carregando as atividades…</div>`;

    const resposta = await CW.enviar({
      tipo: "agenda",
      escopo: P.escopoAtividades,
    });

    if (!resposta.ok) {
      P.renderFalha(resposta);
      return;
    }

    const dados = resposta.dados ?? {};
    const itens = dados.itens ?? [];
    const contagens = dados.contagens ?? {};

    // Guardadas para os chips da fila do RA — ver contagensDaAgenda.
    contagensDaAgenda = contagens;

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

      chipsDeAtividade(
        contagens,
        P.pendencias?.contagens?.abertos ?? ""
      ),

      contagens.atrasadas > 0 && P.escopoAtividades !== ""
        ? `  <p class="sub" style="margin-top:8px;color:var(--perigo)"><strong>${contagens.atrasadas} atrasada(s)</strong> esperando em "Vencendo".</p>`
        : "",

      '</div>',
    ];

    if (ordenados.length === 0) {

      partes.push(
        '<div class="bloco">',
        `  <p class="sub">${
          P.escopoAtividades === "concluidas"
            ? "Nada concluído nos últimos sete dias."
            : P.escopoAtividades === "proximos"
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

    if (P.podeMover()) {
      partes.push(blocoNovaAtividade());
    }

    partes.push(
      `<button class="acao" data-acao="abrir" data-url="${CW.escapar(dados.url ?? "")}" style="width:100%">Abrir a agenda na aplicação</button>`
    );

    P.corpo.innerHTML = partes.filter(Boolean).join("");
    P.corpo.scrollTop = 0;
  };

  /* ============================================================
     A FILA DO RECLAME AQUI
  ============================================================ */

  /**
   * O que está aberto no portal, e o que falta em cada um.
   *
   * A agenda mostra o que alguém marcou. Esta lista mostra o que está
   * aberto quer alguém tenha marcado ou não — que é a metade do
   * trabalho que some quando ninguém lembra de criar a tarefa.
   *
   * O checkpoint de cada caso ("sem resposta pública", "fora do prazo",
   * "sem responsável") vem calculado do servidor, não escrito por
   * modelo: numa lista de pendências, um item inventado manda alguém
   * trabalhar no caso errado. A IA entra depois e por cima, e só para
   * dizer por onde começar e do que cada caso trata.
   */
  async function carregarReclamacoesAbertas() {

    if (!P.pendencias) {

      P.corpo.innerHTML = `<div class="carregando">Lendo a fila do Reclame Aqui\u2026</div>`;

      const resposta = await CW.enviar({
        tipo: "pendencias",
        resumir: false,
      });

      if (!resposta.ok) {
        P.renderFalha(resposta);
        return;
      }

      if (resposta.dados?.erro) {
        P.avisar(resposta.dados.erro, "perigo");
        return;
      }

      P.pendencias = resposta.dados ?? {};
    }

    desenharReclamacoesAbertas();
  }

  function desenharReclamacoesAbertas() {

    const c = P.pendencias?.contagens ?? {};
    const casos = P.pendencias?.casos ?? [];

    const partes = [
      '<div class="bloco">',
      '  <div class="rotulo">Atividades \u00b7 RA em aberto</div>',

      chipsDeAtividade(contagensDaAgenda, c.abertos ?? 0),

      /*
        Os números da fila inteira, e não só do que coube na tela.

        Sem esta linha, "25 casos" seria lido como o total — e quem
        olha decide o dia por ela.
      */
      `  <p class="sub" style="margin-top:8px">${c.abertos ?? 0} em aberto${(c.abertos ?? 0) > (c.mostrados ?? 0) ? ` \u00b7 mostrando os ${c.mostrados} mais urgentes` : ""}.</p>`,

      '  <div class="chips" style="margin-top:6px">',
      c.semResposta
        ? `    <span class="chip" aria-pressed="false" style="cursor:default">${c.semResposta} sem resposta</span>`
        : "",
      /*
        "Fora do prazo" só é dito quando há prazo.

        Zero atrasados e zero prazos cadastrados dão o mesmo número e
        significam o contrário: no primeiro caso a operação está em
        dia, no segundo ninguém está medindo. Enquanto não houver
        regra de SLA, a tela diz isso em vez de mostrar um zero que
        tranquiliza à toa.
      */
      c.semRegraDeSla && c.semRegraDeSla >= (c.mostrados ?? 0)
        ? `    <span class="chip" aria-pressed="false" style="cursor:default;color:var(--atencao)" title="Nenhuma regra de SLA cadastrada em Processos e SLA. Sem prazo definido, nenhum caso pode ser apontado como atrasado.">sem prazo definido</span>`
        : c.foraDoPrazo
          ? `    <span class="chip" aria-pressed="false" style="cursor:default;color:var(--perigo)">${c.foraDoPrazo} fora do prazo</span>`
          : "",
      c.semResponsavel
        ? `    <span class="chip" aria-pressed="false" style="cursor:default">${c.semResponsavel} sem responsável</span>`
        : "",
      c.comRascunho
        ? `    <span class="chip" aria-pressed="false" style="cursor:default">${c.comRascunho} com rascunho pronto</span>`
        : "",
      c.risco
        ? `    <span class="chip" aria-pressed="false" style="cursor:default;color:var(--perigo)">${c.risco} em risco</span>`
        : "",
      c.naoResolvidos
        ? `    <span class="chip" aria-pressed="false" style="cursor:default" title="Fora da fila: já foram respondidos e avaliados. Mas cada um puxa o índice de solução para baixo, e recuperação ainda é possível.">${c.naoResolvidos} avaliados como não resolvido</span>`
        : "",
      '  </div>',
      '</div>',
    ];

    /* ---- a leitura, quando alguém pediu ---- */

    if (P.resumoDasPendencias) {

      const r = P.resumoDasPendencias;

      partes.push(
        '<div class="bloco">',
        '  <div class="rotulo">Por onde começar</div>',
        '  <div class="cartao">',
        `    <p class="sub" style="color:var(--texto)">${CW.escapar(r.porOndeComecar ?? "")}</p>`,
        r.atencao
          ? `    <p class="sub" style="margin-top:8px"><strong>Atenção:</strong> ${CW.escapar(r.atencao)}</p>`
          : "",
        P.pendencias?.comConversa
          ? '    <p class="sub" style="margin-top:8px;color:var(--suave)">Leu também a conversa aberta no WhatsApp.</p>'
          : '    <p class="sub" style="margin-top:8px;color:var(--suave)">Nenhuma conversa aberta no WhatsApp — a ordem saiu só da fila.</p>',
        '  </div>',
        '  <button class="copiar" data-acao="resumir-pendencias" style="width:100%;margin-top:7px;padding:7px">Ler de novo</button>',
        '</div>'
      );

    } else if (casos.length > 0) {

      partes.push(
        '<div class="bloco">',
        '  <button class="copiar" data-acao="resumir-pendencias" style="width:100%;padding:8px">Ler o WhatsApp e organizar a fila (~20 s)</button>',
        '  <p class="sub" style="margin-top:6px">Lê as mensagens da conversa aberta, junta com a fila abaixo e diz por onde começar e do que cada caso trata. Só acontece quando você clica.</p>',
        '</div>'
      );
    }

    /* ---- a fila ---- */

    if (casos.length === 0) {
      partes.push(
        '<div class="bloco">',
        '  <p class="sub">Nada em aberto no Reclame Aqui.</p>',
        '</div>'
      );
    } else {
      partes.push(
        ...casos.map((caso) => cartaoDePendencia(caso))
      );
    }

    P.corpo.innerHTML = partes.filter(Boolean).join("");
    P.corpo.scrollTop = 0;
  }

  /** Um caso da fila, com o checkpoint do que não foi feito. */
  function cartaoDePendencia(caso) {

    const linha = (P.resumoDasPendencias?.linhas ?? []).find(
      (l) => l.protocolo === caso.protocolo
    );

    const tom =
      caso.sla?.situacao === "estourado"
        ? "perigo"
        : caso.sla?.situacao === "atencao"
          ? "atencao"
          : "neutro";

    return `
      <div class="cartao" style="margin-bottom:7px">
        <div class="linha">
          <span class="sub" style="color:var(--texto);font-weight:600">${CW.escapar(caso.cliente ?? "")}</span>
          <span class="tag ${tom}">${CW.escapar(caso.sla?.rotulo ?? "")}</span>
        </div>

        <div class="sub" style="margin-top:3px">${CW.escapar(caso.protocolo ?? "")} \u00b7 ${CW.escapar(caso.categoria ?? "")}${caso.responsavel ? ` \u00b7 ${CW.escapar(caso.responsavel)}` : ""}</div>

        <p class="sub" style="margin-top:5px;color:var(--suave)">${CW.escapar(linha?.resumo || caso.titulo || "")}</p>

        ${
          caso.falta?.length
            ? `<ul style="margin:7px 0 0;padding-left:16px">${caso.falta
                .map(
                  (f) =>
                    `<li class="sub" style="color:var(--suave);margin-top:2px">${CW.escapar(f)}</li>`
                )
                .join("")}</ul>`
            : '<p class="sub" style="margin-top:7px;color:var(--suave)">Nada apontado — só falta o consumidor avaliar.</p>'
        }

        <div class="etapas">
          <button class="passo" data-acao="ver" data-protocolo="${CW.escapar(caso.protocolo ?? "")}">abrir o caso</button>
        </div>
      </div>`;
  }

  /**
   * A leitura da fila pelo modelo, com a conversa aberta junto.
   *
   * A conversa entra porque muda a ordem: quem acabou de escrever
   * cobrando vem antes de quem sumiu há um mês, por pior que esteja o
   * prazo do segundo. Quando não há conversa aberta, a fila é lida
   * sozinha — que continua útil, só não é a lista daquele atendimento.
   */
  P.resumirPendencias = async function resumirPendencias(botao) {

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "lendo\u2026";

    /*
      As mensagens só são lidas aqui, no clique — como no resumo da
      conversa. Enquanto ninguém pedir, nada é lido.
    */
    let conversa = "";

    if (P.lerConversa) {

      const leitura = P.lerConversa();

      const mensagens = Array.isArray(leitura)
        ? leitura
        : (leitura?.mensagens ?? []);

      /*
        O rótulo sai de `de`, que o leitor tira do `data-id` do
        WhatsApp: `true_` é o que saiu daqui, `false_` o que veio do
        cliente. Sem a direção, o modelo lê promessa nossa como
        cobrança do cliente — e a fila sai na ordem errada.
      */
      conversa = mensagens
        .map(
          (m) =>
            `${m.hora ? `[${m.hora}] ` : ""}${m.de === "nos" ? "Nós" : "Cliente"}: ${m.texto ?? ""}`
        )
        .join("\n");
    }

    const resposta = await CW.enviar({
      tipo: "pendencias",
      resumir: true,
      conversa,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Não deu para ler a fila agora.",
        "perigo"
      );
      return;
    }

    P.pendencias = resposta.dados ?? P.pendencias;
    P.resumoDasPendencias = resposta.dados?.resumo ?? null;

    if (!P.resumoDasPendencias) {
      P.avisar(
        resposta.dados?.erroDoResumo ??
          "A fila veio, mas o modelo não devolveu a leitura.",
        "atencao"
      );
    }

    desenharReclamacoesAbertas();
  };

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

  P.concluirTarefa = async function concluirTarefa(botao) {

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
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao concluir.",
        "perigo"
      );
      return;
    }

    P.avisar("Tarefa concluída.", "ok");

    // A tarefa saiu da lista da vista em que estamos, seja qual for.
    P.recarregarVista();
  };

  /**
   * Desfaz a baixa.
   *
   * A rota sempre soube desfazer (`concluida: false`) — é o que torna o
   * clique em "concluir" seguro. Faltava o botão, e ele só faz sentido
   * numa lista que mostra o que já foi concluído, que é a aba de
   * Atividades.
   */
  P.reabrirTarefa = async function reabrirTarefa(botao) {

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
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao reabrir.",
        "perigo"
      );
      return;
    }

    P.avisar("Tarefa reaberta.", "ok");

    P.recarregarVista();
  };

  /**
   * Grava o telefone que a pesquisa não trouxe.
   *
   * O Wootric só manda o número quando o cliente o cadastrou no portal,
   * e em boa parte das respostas ele vem vazio. Sem número, o ciclo não
   * casa com conversa nenhuma do WhatsApp e some do painel justamente
   * quando alguém está falando com a pessoa.
   */
  /**
   * Grava o número da conversa na frente que a pessoa escolheu.
   *
   * Um clique, sem digitar: o número já está na tela, lido da conversa
   * aberta. O que faltava era dizer de quem ele é — e é isso que os
   * dois botões perguntam.
   */
  P.gravarWhatsappDaFrente = async function gravarWhatsappDaFrente(botao) {

    const frente = botao.dataset.frente;
    const numero = botao.dataset.numero;

    if (!numero) {
      P.avisar(
        "Não consegui ler o número desta conversa.",
        "atencao"
      );
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "gravando...";

    const resposta = await CW.enviar({
      tipo: "whatsappDaFrente",
      numero,
      frente,
      protocolo: botao.dataset.protocolo,
      npsId: botao.dataset.id,

      /*
        No NPS, guarda também no cadastro do estabelecimento.

        É o campo que faz o botão "WhatsApp do NPS" aparecer nos
        **próximos** ciclos daquela conta, e não só neste. O servidor
        ignora quando o ciclo não tem estabelecimento vinculado.
      */
      tambemNoEstabelecimento: frente === "nps",
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Não deu para gravar o número.",
        "perigo"
      );
      return;
    }

    const d = resposta.dados ?? {};

    P.avisar(
      `Número gravado ${
        d.frente === "nps"
          ? "no ciclo de NPS"
          : `na reclamação ${d.onde ?? ""}`
      }${d.substituiu ? " (substituiu o anterior)" : ""}${
        d.noEstabelecimento
          ? " e no cadastro do estabelecimento"
          : ""
      }.`,
      "ok"
    );

    /*
      Era `recarregar()`, que não existe em lugar nenhum — o painel
      estourava um `ReferenceError` logo depois de avisar "Número
      gravado", e a tela ficava com o número antigo até alguém trocar de
      aba. Achado na divisão do painel em sete arquivos (Fase 8.5), pela
      conferência que passou a exigir que todo nome tenha dono.
    */
    P.recarregarVista();
  };

  /**
   * Anota num ciclo de NPS, sem sair da conversa.
   *
   * O Isaac pediu paridade com o Reclame Aqui: "preciso que seja
   * possível adicionar notas assim nos casos de nps, também seja
   * possível via extensão".
   *
   * **Não é tentativa de contato.** A tentativa tem canal e significa
   * "liguei" — é a contagem dela que decide se o ciclo encerra por
   * "sem retorno". Escrever uma observação ali inflaria esse número.
   */
  P.anotarNoNps = async function anotarNoNps(botao) {

    const id = botao.dataset.id;

    const campo = P.corpo.querySelector(
      `#nps-nota-${CSS.escape(id)}`
    );

    const texto = (campo?.value ?? "").trim();

    if (!texto) {
      P.avisar("Escreva a anotação antes.", "atencao");
      return;
    }

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "...";

    const resposta = await CW.enviar({
      tipo: "anotar",
      anotacao: { tipo: "nps", npsId: id, texto },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao anotar.",
        "perigo"
      );
      return;
    }

    if (campo) campo.value = "";

    P.avisar("Anotação gravada no ciclo.", "ok");
  };

  P.gravarContatoDoNps = async function gravarContatoDoNps(botao) {

    const id = botao.dataset.id;

    const campo = P.corpo.querySelector(
      `#nps-contato-${CSS.escape(id)}`
    );

    const valor = (campo?.value ?? "").trim();

    if (!valor) {
      P.avisar(
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
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao gravar o contato.",
        "perigo"
      );
      return;
    }

    P.avisar(
      "Contato gravado — agora este ciclo casa com a conversa.",
      "ok"
    );

    P.recarregarVista();
  };
})();
