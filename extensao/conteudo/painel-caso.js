/**
 * A tela do caso — parte do painel da extensão.
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
  P.abrirDetalhe = async function abrirDetalhe(protocolo, emSilencio = false) {

    /**
     * De onde viemos, para o voltar saber para onde volta.
     *
     * Sem isto, abrir um caso a partir da aba de Atividades e fechar o
     * detalhe jogava a pessoa no contato — perdendo a lista e o
     * recorte que ela tinha escolhido.
     */
    if (P.vista !== "caso") P.vistaAnterior = P.vista;

    P.vista = "caso";

    P.refletirCanal();

    if (!emSilencio) {
      P.corpo.innerHTML = `<div class="carregando">Abrindo ${CW.escapar(protocolo)}…</div>`;
    }

    const resposta = await CW.enviar({
      tipo: "detalhe",
      protocolo,
      forcar: emSilencio,
    });

    if (!resposta.ok) {
      P.renderFalha(resposta);
      return;
    }

    if (resposta.dados?.erro) {
      P.vazio("Não deu para abrir", resposta.dados.erro);
      return;
    }

    P.detalhe = resposta.dados;

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

    desenharDetalhe(P.detalhe);

    /**
     * Desenhou com dado velho: atualiza atrás.
     *
     * É o que faz a gaveta abrir instantânea sem mostrar informação
     * desatualizada por muito tempo — a tela aparece com o que já se
     * tinha e se corrige sozinha um instante depois.
     */
    if (resposta.vencido) {
      P.atualizarAtras(() => P.abrirDetalhe(protocolo, true));
    }
  };

  /**
   * Refaz a consulta em segundo plano, sem piscar a tela.
   *
   * `requestIdleCallback` porque isto nunca é urgente: o usuário já
   * está lendo o resultado. Onde ele não existe, um `setTimeout` curto
   * dá o mesmo efeito.
   */
  P.atualizarAtras = function atualizarAtras(fn) {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => fn(), { timeout: 3000 });
    } else {
      setTimeout(fn, 300);
    }
  };

  /**
   * Os passos do documento, ao lado da conversa (Fase 8.2).
   *
   * O que o caso já tem não aparece: com o 1º contato registrado, o
   * botão dele sai e fica o que vem depois. Os textos — pedido de
   * avaliação com o lembrete certo da cadência, acionamento no formato
   * do #incidentes, atualização e a oferta que a criticidade permite —
   * vêm prontos do servidor, dos mesmos modelos das telas: um texto
   * montado aqui divergiria do que a aplicação escreve amanhã.
   *
   * Registrar grava pelo mesmo caminho da ficha, então o relógio do
   * caso e a trilha mudam junto.
   */
  function blocoPassosDoDocumento(d) {

    if (!d || !d.protocolo || !P.podeEscrever(P.ultimoDado)) return "";

    const c = d.contatos ?? {};
    const textos = d.textos ?? {};

    const passo = (tipo, rotulo, dica) =>
      '  <button class="passo" data-acao="tratativa" data-tipo="' +
      tipo +
      '" data-protocolo="' +
      CW.escapar(d.protocolo) +
      '" title="' +
      CW.escapar(dica) +
      '" style="width:100%;margin-top:6px">' +
      rotulo +
      '</button>';

    const texto = (rotulo, valor) =>
      valor
        ? '  <button class="copiar" data-acao="copiar" data-texto="' + CW.escapar(valor) + '" style="width:100%;margin-top:6px">' + rotulo + '</button>'
        : "";

    return [
      '<div class="bloco">',
      '  <div class="linha">',
      '    <span class="rotulo">Passos do documento</span>',
      d.trilha ? '    <span class="tag neutro">agora: ' + CW.escapar(d.trilha.titulo) + '</span>' : "",
      '  </div>',
      d.trilha && d.trilha.detalhe ? '  <p class="sub" style="margin:4px 0 2px">' + CW.escapar(d.trilha.detalhe) + '</p>' : "",

      c.primeiroContatoEm
        ? '  <p class="sub" style="margin:6px 0 0">1º contato registrado.' + (c.tentativasSemResposta ? ' ' + c.tentativasSemResposta + ' tentativa(s) sem resposta.' : "") + '</p>'
        : passo("contato", "Fiz o 1º contato", "Registra o contato agora, pelo mesmo caminho da ficha"),

      passo("tentativa", "Tentei contato", "Fica aguardando retorno; sem retorno só 2 horas depois, pela ficha do caso"),
      passo("atualizacao", "Mandei uma atualização", "O documento pede não deixar o cliente no vácuo"),
      texto("Copiar a mensagem de atualização", textos.atualizacao),

      c.validadoEm
        ? '  <p class="sub" style="margin:6px 0 0">Cliente já confirmou a solução.</p>'
        : passo("validacao", "Cliente confirmou a solução", "O Passo 6: tudo voltou a funcionar"),

      passo("pedido-avaliacao", "Pedi a avaliação", "O Passo 8, na cadência da documentação"),
      texto("Copiar o pedido de avaliação", textos.pedidoAvaliacao),
      texto("Copiar o acionamento para o #incidentes", textos.acionamento),

      (c.tentativasSemResposta ?? 0) >= 5 ? texto("Copiar a mensagem pública transparente", textos.publicaTransparente) : "",

      d.oferta
        ? '  <p class="sub" style="margin:8px 0 0">Oferta que a criticidade permite: <strong>' + CW.escapar(d.oferta.titulo) + '</strong>. Quem registra é a aplicação.</p>'
        : "",
      texto("Copiar a proposta de oferta", textos.oferta),

      '</div>',
    ]
      .filter(Boolean)
      .join("");
  }

  /** Registra o passo e recarrega o detalhe com o que o servidor devolveu. */
  P.registrarTratativa = async function registrarTratativa(botao) {

    const protocolo = botao.dataset.protocolo;
    const tipo = botao.dataset.tipo;
    if (!protocolo || !tipo) return;

    const rotulo = botao.textContent;
    botao.disabled = true;
    botao.textContent = "registrando\u2026";

    const resposta = await CW.enviar({
      tipo: "tratativa",
      corpo: { protocolo, tipo, canal: canalDoContato() },
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      P.avisar(resposta.dados?.erro ?? resposta.erro ?? "Não deu para registrar.", "perigo");
      return;
    }

    P.avisar(resposta.dados.rotulo + " registrado em " + protocolo + ".", "ok");
    P.abrirDetalhe(protocolo, true);
  };

  /** Por onde o contato aconteceu, pela página em que o painel está. */
  function canalDoContato() {
    const host = location.hostname;
    if (host.includes("crisp")) return "Crisp";
    if (host.includes("reclameaqui") || host.includes("hugme")) return "Portal RA";
    if (host.includes("manychat")) return "Instagram";
    return "WhatsApp";
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
      P.botoesDeEtapa({
        protocolo: d.protocolo,
        status: d.status,
      }),

      /*
        "Este WhatsApp é o do Reclame Aqui."

        Fica no cartão do caso e não num bloco à parte: a pergunta que
        ele responde é sobre **este** caso, e separada dele viraria uma
        escolha sem sujeito.
      */
      P.podeEscrever(P.ultimoDado)
        ? P.esteWhatsappEDoCaso(d.protocolo, d.telefone)
        : "",

      '  </div>',
      '</div>',
    ];

    partes.push(blocoPassosDoDocumento(d));

    /* ---- resumo do caso ---- */

    /*
      Vem antes da triagem de propósito.

      A ordem na tela é a ordem da cabeça de quem atende: primeiro "o
      que é isto", depois "o que eu faço". Uma sugestão de resposta
      acima do resumo faria a pessoa decidir antes de entender.
    */
    partes.push(P.blocoDossie(d.protocolo));

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
      P.podeMover()
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
      /* A página pública e a área da empresa, lado a lado: uma é o que o mercado lê, a outra é onde se responde. */
      d.urlPortal || d.urlEmpresa
        ? [
            '  <div style="display:flex;gap:6px;margin-top:7px">',
            d.urlPortal
              ? `    <button class="copiar" data-acao="abrir" data-url="${CW.escapar(d.urlPortal)}" style="flex:1;padding:8px">Página pública</button>`
              : "",
            d.urlEmpresa
              ? `    <button class="copiar" data-acao="abrir" data-url="${CW.escapar(d.urlEmpresa)}" style="flex:1;padding:8px">Área da empresa</button>`
              : "",
            "  </div>",
          ].join("")
        : "",
      '</div>'
    );

    P.corpo.innerHTML = partes.filter(Boolean).join("");
    P.corpo.scrollTop = 0;
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
   * A transcrição do Crisp, **importada do arquivo** que o Crisp gera.
   *
   * Era um campo de colar. Colar quebra na prática: a transcrição do
   * Crisp vem com dezenas de milhares de caracteres, e o WhatsApp — que
   * é onde este painel vive — captura teclas globalmente. Um Ctrl+V de
   * 40 mil caracteres num textarea dentro do WhatsApp é lento e às
   * vezes some pela metade. O arquivo entra inteiro, de uma vez, e o
   * nome dele ainda serve de conferência do que foi carregado.
   *
   * Fica em memória e some quando o painel fecha: transcrição de
   * atendimento não é para ficar guardada em extensão.
   */
  P.transcricaoImportada = null;

  /**
   * O dossiê e o resumo ficam recolhidos?
   *
   * O Isaac pediu: "preciso que tenha um botão para recolher o dossiê,
   * resumo". O motivo é de espaço — o painel tem 350 px de largura
   * dentro do WhatsApp, e o dossiê montado empurra a fila de casos, as
   * anotações e os botões de mover para muito abaixo da dobra. Depois
   * de ler, quem atende quer o painel de volta.
   *
   * Recolhido guarda o conteúdo, não o joga fora: reabrir não gasta
   * outra chamada ao modelo.
   */
  P.dossieRecolhido = false;
  P.resumoRecolhido = false;

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
  /**
   * "Este contato também tem caso em outra frente."
   *
   * A aba recorta os casos, e o recorte é certo — quem abriu o Reclame
   * Aqui quer ver reclamações. O silêncio sobre o resto é que não era:
   * um cliente com atendimento aberto no Instagram e nada no portal
   * fazia o painel dizer "não tem caso em Reclame Aqui", e quem lê
   * conclui que não há nada. Há — noutro lugar.
   *
   * O Isaac: "é importante sinalizar que o caso está nas redes sociais
   * e verificar por lá".
   *
   * Não lista os casos: a lista é a aba do lado, e repeti-la aqui
   * misturaria as frentes de novo. Diz que existem, quantos, e leva.
   */
  P.blocoOutrasFrentes = function blocoOutrasFrentes(frentes) {

    if (!Array.isArray(frentes) || frentes.length === 0) {
      return "";
    }

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Este contato em outras frentes</div>',

      ...frentes.map((f) =>
        [
          '  <div class="cartao" style="margin-top:6px">',
          '    <div class="linha">',
          `      <span class="sub" style="color:var(--texto);font-weight:600">${CW.escapar(f.nome)}</span>`,
          f.abertos > 0
            ? `      <span class="tag atencao">${f.abertos} em aberto</span>`
            : '      <span class="tag neutro">sem nada em aberto</span>',
          '    </div>',
          `    <p class="sub" style="margin-top:3px;color:var(--suave)">${f.total} caso(s) deste contato. Esta aba não os mostra — a fila é outra.</p>`,
          '    <div class="etapas">',
          `      <button class="passo" data-acao="canal" data-canal="${CW.escapar(f.canal)}">ver em ${CW.escapar(f.nome)}</button>`,
          '    </div>',
          '  </div>',
        ].join("")
      ),

      '</div>',
    ].join("");
  };

  /*
    A aba Dossiê abre o dossiê na plataforma (Fase 26).

    O Isaac: "dossiê deve ser feito pela plataforma e precisa levar a
    estrutura que já te enviei" e "quero que você retire [da] extensão".
    O documento de 8 partes — linha do tempo numerada, evidências,
    apuração, pedido — é trabalho de tela grande, com revisão. Aqui fica o
    botão que abre na plataforma, já no caso certo, e o resumo rápido,
    que é leitura.
  */
  P.blocoDossie = function blocoDossie(protocolo) {

    const pronto =
      resumoDoCaso &&
      (resumoDoCaso.protocolo ?? "") === (protocolo ?? "");

    return [
      '<div class="bloco">',
      '  <div class="rotulo">Dossiê</div>',

      protocolo
        ? `  <button class="acao" data-acao="abrir-na-plataforma" data-caminho="/reclame-aqui/${CW.escapar(encodeURIComponent(protocolo))}/dossie" style="width:100%;margin-top:0">Abrir o dossiê na plataforma</button>
  <p class="sub" style="margin-top:6px">As 8 partes, montadas dos registros deste caso, com a conferência antes de pedir moderação. Abre na plataforma, já neste caso.</p>`
        : '  <p class="sub" style="margin-top:0">O dossiê é feito na plataforma, a partir da reclamação — este contato não tem reclamação cadastrada.</p>',

      pronto
        ? blocoResumoDoCaso(resumoDoCaso)
        : protocolo
          ? '  <div class="etapas" style="margin-top:8px"><button class="passo" data-acao="resumir-caso" data-rapido="1" data-protocolo="' +
            CW.escapar(protocolo) +
            '" style="flex:1">Resumo rápido do caso (~2 s)</button></div>'
          : "",

      '</div>',
    ].join("");
  };


  /**
   * A capa do dossiê e as peças, agrupadas por tipo.
   *
   * **A definição que o Isaac mandou.** Dossiê é "conjunto organizado
   * de documentos ou informações sobre um assunto específico", que
   * "reúne papéis, relatórios, registros ou arquivos digitais focados
   * em um único tema". As três palavras que mandam ali são *conjunto*,
   * *organizado* e *documentos* — e a versão anterior entregava uma
   * lista corrida, em ordem de data, sem dizer o que a pasta continha.
   *
   * Uma lista corrida é um monte de papel; um dossiê tem capa. A capa
   * responde antes de abrir: **quantos documentos**, **de quando até
   * quando** e **de onde vieram**. É o que permite dizer "isto aqui
   * cobre agosto inteiro e não tem nada do financeiro" sem ler nada.
   *
   * **Agrupado por tipo, cronológico dentro do grupo.** Uma pasta de
   * verdade tem separadores: as anotações juntas, as movimentações
   * juntas. Misturadas por data, para achar "todas as anotações" é
   * preciso varrer tudo — que é o trabalho que a organização existe
   * para poupar. A ordem do tempo continua valendo dentro de cada
   * grupo, que é onde ela responde alguma coisa.
   *
   * **Cada peça é numerada.** Um dossiê serve para ser citado: "veja a
   * peça 4" é uma frase que alguém escreve num grupo de trabalho, e
   * sem número não existe.
   */
  function capaEPecas(pecas) {

    /*
      A janela que a pasta cobre.

      Peça sem data não estraga o cálculo — é filtrada antes. E se
      nenhuma tiver data, a capa simplesmente não fala de período, em
      vez de inventar um.
    */
    const datas = pecas
      .map((p) => p.quando)
      .filter(Boolean)
      .sort();

    const origens = [
      ...new Set(
        pecas.map((p) => p.origem).filter(Boolean)
      ),
    ];

    /* Ordem estável dos separadores: a que veio do servidor. */
    const grupos = [];

    for (const peca of pecas) {

      const tipo = peca.tipo ?? "Documento";

      let grupo = grupos.find((g) => g.tipo === tipo);

      if (!grupo) {
        grupo = { tipo, itens: [] };
        grupos.push(grupo);
      }

      grupo.itens.push(peca);
    }

    let numero = 0;

    const periodo =
      datas.length === 0
        ? ""
        : datas.length === 1 ||
            CW.data(datas[0]) ===
              CW.data(datas[datas.length - 1])
          ? `de ${CW.data(datas[0])}`
          : `de ${CW.data(datas[0])} a ${CW.data(datas[datas.length - 1])}`;

    return [
      '  <div class="cartao" style="margin-top:9px">',

      '    <div class="linha">',
      '      <span class="rotulo">As peças deste dossiê</span>',
      `      <span class="tag neutro">${pecas.length} documento(s)</span>`,
      '    </div>',

      /*
        A capa em uma frase.

        Sem ela a pessoa precisa abrir e contar para saber o que tem na
        pasta — e quem não abre fica sem saber que existe.
      */
      `    <p class="sub" style="margin-top:5px;color:var(--suave)">${[
        periodo,
        origens.length > 0
          ? `de ${origens.map(CW.escapar).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")}</p>`,

      /* Um resumo do que tem, por tipo, antes de abrir. */
      '    <div class="etapas" style="margin-top:7px">',
      /*
        Só a primeira letra desce.

        `toLowerCase()` inteiro virava "1 resposta de nps" e "1
        transcrição do crisp" — siglas e nomes próprios não são
        minúsculos, e o rótulo passava a parecer erro de digitação.
      */
      ...grupos.map(
        (g) =>
          `      <span class="tag neutro">${g.itens.length} ${CW.escapar(
            g.tipo.charAt(0).toLowerCase() +
              g.tipo.slice(1)
          )}</span>`
      ),
      '    </div>',

      `
    <details style="margin-top:8px">
      <summary style="cursor:pointer;font-size:12.5px;font-weight:600;padding:6px 0">Abrir a pasta</summary>
      <div style="margin-top:5px">${grupos
        .map(
          (g) => `
        <div style="margin-bottom:9px">
          <div class="rotulo" style="margin-bottom:4px">${CW.escapar(g.tipo)} (${g.itens.length})</div>
          ${g.itens
            .map((peca) => {

              numero += 1;

              return `
          <div class="cartao" style="margin-bottom:5px">
            <div class="linha">
              <span class="sub" style="color:var(--texto);font-weight:600">Peça ${numero}</span>
              <span class="sub" style="color:var(--suave)">${
                peca.quando
                  ? CW.data(peca.quando)
                  : "sem data"
              }${peca.autor ? ` · ${CW.escapar(peca.autor)}` : ""}</span>
            </div>
            <p class="sub" style="margin-top:4px;color:var(--texto);white-space:pre-wrap">${CW.escapar(peca.trecho ?? "")}</p>
          </div>`;
            })
            .join("")}
        </div>`
        )
        .join("")}</div>
    </details>`,

      '  </div>',
    ].join("");
  }

  function blocoResumoDoCaso(r) {

    /*
      Recolhido, sobra o cabeçalho e o botão de reabrir.

      Some o conteúdo, não o dossiê: `resumoDoCaso` continua em
      memória, e reabrir é instantâneo.
    */
    if (P.dossieRecolhido) {
      return [
        '  <div class="cartao">',
        '    <div class="linha">',
        '      <span class="sub" style="color:var(--texto);font-weight:600">Dossiê montado</span>',
        '      <button class="passo" data-acao="expandir-dossie">abrir</button>',
        '    </div>',
        `    <p class="sub" style="margin-top:4px;color:var(--suave)">${CW.escapar((r.geral ?? "").slice(0, 90))}${(r.geral ?? "").length > 90 ? "…" : ""}</p>`,
        '  </div>',
      ].join("");
    }

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
      '    <div class="linha" style="margin-bottom:5px">',
      '      <span class="rotulo">Onde estou</span>',
      '      <button class="passo" data-acao="recolher-dossie" title="Recolher o dossiê e devolver o espaço do painel">recolher</button>',
      '    </div>',
      paragrafo(r.geral),
      '  </div>',

      r.comTranscricao
        ? `  <div class="sub" style="margin-top:6px;color:var(--suave)">Transcrição lida: ${CW.escapar(r.arquivoDaTranscricao || "arquivo do Crisp")} (${r.tamanhoDaTranscricao} caracteres).</div>`
        : "",

      r.semCaso
        ? '  <div class="sub" style="margin-top:6px;color:var(--suave)">Sem reclamação cadastrada — o dossiê saiu do atendimento.</div>'
        : "",

      /*
        O que o cruzamento por contato encontrou nos outros canais.

        Precisa aparecer: um dossiê que leu dois ciclos de NPS e um que
        não achou nenhum têm a mesma cara na tela, e quem lê não saberia
        se o cliente nunca respondeu NPS ou se o cruzamento falhou.
      */
      r.npsLidos || r.casosLidos
        ? `  <div class="sub" style="margin-top:6px;color:var(--suave)">Leu também ${[
            r.npsLidos
              ? `${r.npsLidos} ciclo(s) de NPS`
              : "",
            r.casosLidos
              ? `${r.casosLidos} caso(s) de outros canais`
              : "",
          ]
            .filter(Boolean)
            .join(" e ")} deste mesmo cliente.</div>`
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

      /* ---- as peças: o conjunto organizado ---- */

      /*
        Um dossiê é uma pasta, não só um parecer.

        O Isaac mandou a definição de dicionário: "conjunto organizado
        de documentos ou informações", que "reúne papéis, relatórios,
        registros ou arquivos digitais". O que existia era só a leitura
        — bem escrita, e ainda assim uma versão da história, sem os
        documentos atrás dela. Quem lê uma narrativa não confere nada:
        não sabe quantas anotações existem, de que data, quem escreveu,
        nem se ficou alguma de fora.

        Estas peças são fato, montadas do banco, e não passam pelo
        modelo. Recolhidas porque são muitas e a leitura vem primeiro.
      */
      Array.isArray(r.pecas) && r.pecas.length > 0
        ? capaEPecas(r.pecas)
        : "",

      /*
        O dossiê completo e o "Salvar dossiê" saíram daqui (Fase 26): o
        dossiê é feito na plataforma, com as 8 partes, a conferência e o
        pedido de moderação. O painel fica com o resumo, que é leitura.
      */

      r.rapido
        ? '  <p class="sub" style="margin-top:6px;color:var(--suave)">Resumo rápido: modelo menor, responde na hora e resume com menos cuidado.</p>'
        : "",
    ]
      .filter(Boolean)
      .join("");
  }

  /**
   * Manda o dossiê para a ficha do caso.
   *
   * O texto vem do estado, e não da tela: o cartão mostra o dossiê
   * dentro de um `<details>` que pode estar fechado, e ler do DOM
   * traria vazio na metade das vezes.
   */
  P.guardarDossie = async function guardarDossie(botao) {

    if (!resumoDoCaso?.dossie) return;

    const rotulo = botao.textContent;

    botao.disabled = true;
    botao.textContent = "salvando…";

    /*
      Vai a leitura **e** as peças.

      Salvar só a narrativa devolveria à ficha o mesmo que o dicionário
      diz que um dossiê não é: um parecer sem a pasta. Quem abrir o caso
      amanhã precisa poder conferir de onde saiu cada afirmação.

      A transcrição do Crisp continua de fora — é o que o Isaac pediu
      explicitamente, e a peça dela guarda só o nome do arquivo e o
      tamanho, não o conteúdo.
    */
    const lista = resumoDoCaso.pecas ?? [];

    /*
      Numeradas, e com a capa, como na tela.

      O texto salvo é lido meses depois, por gente que não estava na
      conversa. "Veja a peça 4" só funciona se as peças tiverem número
      no que ficou guardado — e a capa é o que permite dizer, sem ler
      tudo, o que aquela pasta cobre e o que ela não cobre.
    */
    const datas = lista
      .map((p) => p.quando)
      .filter(Boolean)
      .sort();

    const capa = [
      `${lista.length} documento(s)`,
      datas.length > 0
        ? `de ${CW.data(datas[0])} a ${CW.data(datas[datas.length - 1])}`
        : "",
      [
        ...new Set(
          lista.map((p) => p.origem).filter(Boolean)
        ),
      ].join(", "),
    ]
      .filter(Boolean)
      .join(" · ");

    const pecas = lista
      .map(
        (p, i) =>
          `[${i + 1}] ${p.tipo}${p.origem ? ` (${p.origem})` : ""}${
            p.quando ? ` · ${CW.data(p.quando)}` : ""
          }${p.autor ? ` · ${p.autor}` : ""}\n${p.trecho ?? ""}`
      )
      .join("\n\n");

    const texto = pecas
      ? `${resumoDoCaso.dossie}\n\n\n=== AS PEÇAS DESTE DOSSIÊ ===\n${capa}\n\n${pecas}`
      : resumoDoCaso.dossie;

    const resposta = await CW.enviar({
      tipo: "salvarDossie",
      protocolo: botao.dataset.protocolo,
      dossie: texto,
    });

    botao.disabled = false;

    if (!resposta.ok || resposta.dados?.erro) {
      botao.textContent = rotulo;
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Não deu para guardar agora.",
        "perigo"
      );
      return;
    }

    botao.textContent = "dossiê salvo";

    P.avisar(
      "Dossiê salvo — aparece na ficha do caso na aplicação.",
      "ok"
    );
  };

  P.resumirCaso = async function resumirCaso(botao) {

    const rapido = botao.dataset.rapido === "1";
    const rotulo = botao.textContent;

    botao.disabled = true;

    /* O rótulo de espera diz quanto vai demorar — ver a triagem. */
    botao.textContent = rapido
      ? "Lendo…"
      : "Montando… (~15 s)";

    const resposta = await CW.enviar({
      tipo: "resumoCaso",
      protocolo: botao.dataset.protocolo,
      transcricao: P.transcricaoImportada?.texto ?? "",
      arquivoDaTranscricao:
        P.transcricaoImportada?.nome ?? "",
      nome: P.consulta?.nome ?? "",
      telefone: P.consulta?.telefone ?? "",
      rapido,
    });

    botao.disabled = false;
    botao.textContent = rotulo;

    if (!resposta.ok || resposta.dados?.erro) {
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao resumir o caso.",
        "perigo"
      );
      return;
    }

    resumoDoCaso = resposta.dados;

    /* Montar um dossiê é querer lê-lo: recolhido, o clique não faria nada. */
    P.dossieRecolhido = false;

    if (P.detalhe) desenharDetalhe(P.detalhe);
  };

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
        A conferência do rascunho contra o documento (Fase 9.3).

        Quem gerou o texto foi o modelo; quem diz se ele segue as regras
        é o servidor, com a mesma função que confere o texto digitado à
        mão. Aparece **antes** de copiar, que é o único momento em que
        muda alguma coisa — depois de colado no portal, já foi.
      */
      (t.conferencia ?? []).length > 0
        ? [
            '  <div class="cartao" style="margin-top:7px">',
            `    <div class="rotulo">${CW.escapar(t.resumoDaConferencia ?? "O documento pede ajustes")}</div>`,
            ...t.conferencia.map(
              (a) =>
                `    <div class="sub" style="color:${a.tom === "perigo" ? "var(--perigo)" : "var(--suave)"}">• ${CW.escapar(a.texto)}</div>`
            ),
            '  </div>',
          ].join("")
        : '  <p class="sub" style="margin-top:6px">Conferido contra o documento: nome, acolhimento, dado pessoal e repetição — sem apontamentos.</p>',

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

  P.triarCaso = async function triarCaso(botao) {

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
      P.avisar(
        resposta.dados?.erro ??
          resposta.erro ??
          "Falha ao triar.",
        "perigo"
      );
      return;
    }

    triagem = resposta.dados;

    if (P.detalhe) desenharDetalhe(P.detalhe);
  };

  P.anotarNoDetalhe = async function anotarNoDetalhe(botao) {

    const erro = P.corpo.querySelector("#detalhe-erro");

    const texto = (
      P.corpo.querySelector("#detalhe-nota")?.value ?? ""
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
    P.abrirDetalhe(botao.dataset.protocolo);
  };

  /**
   * Um caso na fila.
   *
   * Traz o cliente no lugar da etiqueta de canal: na fila de um canal
   * só, dizer o canal em cada linha é ruído — quem é a pessoa, não.
   */
  P.desenharDaFila = function desenharDaFila(caso) {

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
        ${P.botoesDeEtapa(caso)}
      </div>`;
  };
})();
