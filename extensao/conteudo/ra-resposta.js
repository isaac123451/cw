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

  const ESPERA = 1200;
  const MINIMO = 25;

  let caixaAtual = null;
  let aviso = null;
  let relogio = null;
  let ultimoTexto = "";

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

  /** O protocolo da reclamação aberta, pelos leitores que o `check:ra` prova. */
  function protocoloDaPagina() {
    const conteudo = document.body?.innerText ?? "";
    const id = CW.ra?.id?.(conteudo) ?? "";
    return id ? `RA-${id}` : "";
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

    const resposta = await CW.enviar({
      tipo: "conferirResposta",
      corpo: { texto, protocolo: protocoloDaPagina() },
    });

    if (!resposta?.ok || resposta.dados?.erro) return;

    const d = resposta.dados;
    const caixa = montarAviso(el);
    const partes = [];

    if (d.caso?.passo || d.caso?.prazo) {
      partes.push(
        `<div style="opacity:.85">${CW.escapar(d.caso.protocolo)}${
          d.caso.passo ? ` · passo ${d.caso.passo.numero}: ${CW.escapar(d.caso.passo.titulo)}` : ""
        }${d.caso.prazo ? ` · ${CW.escapar(d.caso.prazo.rotulo)}` : ""}</div>`
      );
    }

    if (d.achados?.length > 0) {
      partes.push(
        `<div><strong>Revise antes de publicar:</strong> ${CW.escapar(d.resumo)}. A resposta pública fica no ar e é indexada — dado pessoal e condição negociada ficam no canal privado.</div>`
      );
    }

    if (d.repetida) {
      partes.push(
        `<div><strong>${d.repetida.percentual}% igual à resposta de ${CW.escapar(d.repetida.protocolo)}</strong> (${CW.escapar(
          d.repetida.titulo
        )}). A regra de ouro do documento: sem mensagem pronta — comece pelo que só este caso tem.</div>`
      );
    }

    if (partes.length === 0) {
      partes.push('<div>Sem dado pessoal e sem texto repetido. Pode publicar.</div>');
    }

    caixa.innerHTML = partes.join("");
    caixa.style.display = "block";
    pintar(caixa, d.achados?.length > 0 ? "perigo" : d.repetida ? "atencao" : "ok");
  }

  function ligar(el) {
    if (el === caixaAtual) return;

    caixaAtual = el;
    ultimoTexto = "";

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
