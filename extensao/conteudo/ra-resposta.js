/**
 * A conferência da resposta pública, dentro do HugMe e do Reclame Aqui.
 *
 * **O que este arquivo faz:** acha a caixa de resposta da reclamação
 * aberta e, enquanto a pessoa escreve, pergunta ao CW Reputação se o
 * texto tem dado pessoal ou se está parecido demais com uma resposta já
 * publicada. O aviso aparece **acima da caixa**, antes de publicar — que
 * é o único momento em que ele muda alguma coisa.
 *
 * **O que ele não faz:** não publica, não altera o texto e não manda
 * nada sozinho. A conferência sai só depois de a pessoa parar de digitar
 * (1,2 s), e o texto vai para a própria aplicação — as regras moram lá,
 * junto com as da ficha, para não existirem duas versões da mesma regra.
 *
 * **Por que camadas de seletor.** O HugMe e o Reclame Aqui reescrevem a
 * marcação sem avisar. A caixa é procurada por quatro caminhos, do mais
 * específico ao mais genérico, e quando nenhum casa o script simplesmente
 * não aparece — em vez de grudar num campo errado.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW) return;

  /** Onde a resposta é escrita, do mais específico ao mais genérico. */
  const CAIXAS = [
    'textarea[name*="resposta" i]',
    'textarea[placeholder*="resposta" i]',
    'textarea[aria-label*="resposta" i]',
    '[contenteditable="true"][aria-label*="resposta" i]',
    "form textarea",
    "textarea",
  ];

  /* Quase na hora (1.112): a nota acompanha quem escreve. */
  const ESPERA = 700;
  const MINIMO = 25;

  let caixaAtual = null;
  let aviso = null;
  let relogio = null;
  let ultimoTexto = "";

  /* A conferência mais recente: uma resposta mais lenta que a seguinte não pinta por cima. */
  let rodada = 0;

  /* Caixa que já ganhou os ouvintes: voltar a ela não os duplica. */
  const ligadas = new WeakSet();

  function acharCaixa() {
    for (const seletor of CAIXAS) {
      for (const el of document.querySelectorAll(seletor)) {
        /* Campo escondido ou minúsculo não é a caixa de resposta. */
        const caixa = el.getBoundingClientRect();
        if (caixa.width > 220 && caixa.height > 40) return el;
      }
    }
    return null;
  }

  function textoDaCaixa(el) {
    return (el.value ?? el.innerText ?? "").trim();
  }

  /**
   * Quem é a reclamação aberta, pelos leitores que o `check:ra` prova.
   *
   * O protocolo do CW é `RA-<COD>`, o código de 16 caracteres; o número do
   * "ID:" é outra coisa. Mandar só `RA-<número>` (até out/2026) fazia o
   * servidor quase nunca achar o caso: a nota não conferia o nome do
   * cliente, o passo e o prazo não apareciam, e reescrever uma resposta já
   * publicada acusava "100% igual" à da própria reclamação.
   */
  function identidadeDaPagina() {
    const bruto = document.body?.innerText ?? "";
    /* Só a reclamação aberta (1.110): com a lista por trás, o primeiro ID era de outra. */
    const conteudo = CW.ra?.recorteDaReclamacao ? CW.ra.recorteDaReclamacao(bruto) : bruto;
    const cod = CW.ra?.cod?.(conteudo) || CW.ra?.tipoDaPagina?.(location.href, conteudo)?.codigo || "";
    const numero = CW.ra?.id?.(conteudo) ?? "";
    return { cod, numero, protocolo: cod ? `RA-${cod}` : numero ? `RA-${numero}` : "" };
  }

  function montarAviso(el) {
    if (aviso && aviso.isConnected) return aviso;

    aviso = document.createElement("div");
    aviso.setAttribute("data-cw", "conferencia-da-resposta");
    aviso.style.cssText = [
      "margin: 8px 0",
      "padding: 10px 12px",
      "border-radius: 10px",
      "font: 500 12.5px/1.45 ui-sans-serif, system-ui, sans-serif",
      "border: 1px solid #e4e4e7",
      "background: #fafafa",
      "color: #18181b",
      "display: none",
    ].join(";");

    el.parentElement?.insertBefore(aviso, el);
    return aviso;
  }

  function pintar(caixa, tom) {
    const cores = {
      perigo: ["#fef2f2", "#fecaca", "#7f1d1d"],
      atencao: ["#fffbeb", "#fde68a", "#78350f"],
      ok: ["#f0fdf4", "#bbf7d0", "#14532d"],
      neutro: ["#fafafa", "#e4e4e7", "#3f3f46"],
    };
    const [fundo, borda, texto] = cores[tom] ?? cores.neutro;
    caixa.style.background = fundo;
    caixa.style.borderColor = borda;
    caixa.style.color = texto;
  }

  async function conferir(el) {
    const texto = textoDaCaixa(el);

    if (texto.length < MINIMO) {
      if (aviso) aviso.style.display = "none";
      return;
    }

    if (texto === ultimoTexto) return;
    ultimoTexto = texto;

    const minha = ++rodada;

    const resposta = await CW.enviar({
      tipo: "conferirResposta",
      corpo: { texto, ...identidadeDaPagina() },
    });

    /* Chegou depois de uma conferência mais nova: é do texto de antes. */
    if (minha !== rodada) return;

    if (!resposta?.ok || resposta.dados?.erro) {
      /* Falhou: o mesmo texto pode ser conferido de novo ao sair da caixa. */
      ultimoTexto = "";
      return;
    }

    const d = resposta.dados;
    const caixa = montarAviso(el);
    const partes = [];

    /* O que pede revisão; a nota e a linha do caso só informam. */
    let problemas = 0;

    /*
      A nota do analista, sempre no topo (1.112) — a mesma de 0 a 100 da tela
      Respostas. Muda enquanto a pessoa escreve.
    */
    if (typeof d.nota === "number") {
      const n = Math.round(d.nota);
      const [fundo, texto] = n >= 85 ? ["#16a34a", "#fff"] : n >= 60 ? ["#d97706", "#fff"] : ["#dc2626", "#fff"];
      partes.push(
        `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><span style="display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:30px;border-radius:8px;background:${fundo};color:${texto};font:700 17px/1 ui-sans-serif,system-ui,sans-serif">${n}</span><span><strong>Nota da resposta</strong> · de 0 a 100, pelo analista do CW${n >= 85 ? " — boa para publicar" : n >= 60 ? " — dá para melhorar" : " — revise antes de publicar"}</span></div>`
      );
    }

    if (d.caso?.passo || d.caso?.prazo) {
      partes.push(
        `<div style="opacity:.85">${CW.escapar(d.caso.protocolo)}${
          d.caso.passo ? ` · passo ${d.caso.passo.numero}: ${CW.escapar(d.caso.passo.titulo)}` : ""
        }${d.caso.prazo ? ` · ${CW.escapar(d.caso.prazo.rotulo)}` : ""}</div>`
      );
    }

    if (d.achados?.length > 0) {
      problemas += 1;
      partes.push(
        `<div><strong>Revise antes de publicar:</strong> ${CW.escapar(d.resumo)}. A resposta pública fica no ar e é indexada — dado pessoal e condição negociada ficam no canal privado.</div>`
      );
    }

    if (d.repetida) {
      problemas += 1;
      partes.push(
        `<div><strong>${d.repetida.percentual}% igual à resposta de ${CW.escapar(d.repetida.protocolo)}</strong> (${CW.escapar(
          d.repetida.titulo
        )}). A regra de ouro do documento: sem mensagem pronta — comece pelo que só este caso tem.</div>`
      );
    }

    /* O analista de respostas públicas (1.94): um ponto por linha, o erro antes. */
    const analise = Array.isArray(d.analise) ? d.analise : [];
    if (analise.length > 0) {
      problemas += 1;
      partes.push(
        `<div style="margin-top:4px"><strong>Analista:</strong><ul style="margin:2px 0 0 16px;padding:0">${analise
          .slice(0, 6)
          .map((a) => `<li>${a.tom === "perigo" ? "<strong>Erro:</strong> " : ""}${CW.escapar(a.texto)}</li>`)
          .join("")}</ul></div>`
      );
    }

    /* Contava as partes: com a linha do caso na tela, o "Pode publicar" sumia (out/2026). */
    if (problemas === 0) {
      partes.push('<div>Sem dado pessoal, sem texto repetido e segue o documento. Pode publicar.</div>');
    }

    caixa.innerHTML = partes.join("");
    caixa.style.display = "block";
    const erroDoAnalista = analise.some((a) => a.tom === "perigo");
    pintar(caixa, d.achados?.length > 0 || erroDoAnalista ? "perigo" : d.repetida || analise.length > 0 ? "atencao" : "ok");
  }

  function ligar(el) {
    if (el === caixaAtual) return;

    caixaAtual = el;
    ultimoTexto = "";

    if (ligadas.has(el)) return;
    ligadas.add(el);

    const aoDigitar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => conferir(el), ESPERA);
    };

    el.addEventListener("input", aoDigitar);
    el.addEventListener("blur", () => conferir(el));
  }

  /*
    A página troca de reclamação sem recarregar: uma varredura barata a
    cada 1,5 s acha a caixa nova. `MutationObserver` na página inteira
    dispararia milhares de vezes por minuto nesses portais.
  */
  setInterval(() => {
    const el = acharCaixa();
    if (el) ligar(el);
    else if (aviso) aviso.style.display = "none";
  }, 1500);
})();
