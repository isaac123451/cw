/**
 * Selos na lista de conversas do WhatsApp Web.
 *
 * **Espera (1.81, ajustada na 1.84).** "Identifique a espera somente de
 * quem eu não respondi." A linha ganha o selo quando o cliente falou por
 * último e ninguém respondeu: sem o ícone de envio (tiques ou relógio,
 * que só existem no que nós mandamos) e sem prévia começando por "Você"
 * (a reação, a mensagem apagada, o "Você: foto"). E a conversa que o
 * cliente fechou com "ok", "obrigado", "👍" não é espera — é fim.
 *
 * **Etiquetas (1.84).** "Redes sociais", "Detrator · NPS" e afins: ao
 * lado do nome, o que o CW sabe daquele contato. A extensão manda à
 * aplicação só o nome que a lista mostra e, do contato não salvo, o
 * número — nunca mensagem — e guarda a resposta por 5 minutos.
 *
 * **O que lê:** o ícone de envio, a hora, a prévia (só para o "Você" e o
 * "obrigado", aqui mesmo) e o nome da linha. A prévia não sai da página.
 */
(() => {
  const CW = (window.CWReputacao = window.CWReputacao || {});

  /* ------------------------------------------------------------------ */
  /* A parte pura                                                         */
  /* ------------------------------------------------------------------ */

  const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  /**
   * Há quantos minutos, pela hora que a lista mostra: "14:32" (hoje),
   * "Ontem", o dia da semana ou "23/09/2026". Hora de hoje é exata; o
   * resto é "pelo menos" — o selo diz "desde ontem", "há 3 dias".
   */
  function minutosDesde(texto, agora = new Date()) {
    const t = String(texto ?? "").trim().toLowerCase();
    let m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const quando = new Date(agora);
      quando.setHours(Number(m[1]), Number(m[2]), 0, 0);
      const diff = Math.round((agora - quando) / 60000);
      return diff >= 0 ? diff : diff + 1440;
    }
    if (t === "ontem" || t === "yesterday") return 1440;
    const dia = DIAS.indexOf(t);
    if (dia >= 0) return ((agora.getDay() - dia + 7) % 7 || 7) * 1440;
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const ano = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
      const quando = new Date(ano, Number(m[2]) - 1, Number(m[1]));
      return Math.max(1440, Math.round((agora - quando) / 60000));
    }
    return null;
  }

  /** O selo: rótulo e nível pela espera; `null` abaixo de 5 minutos. */
  function seloDaEspera(minutos) {
    if (minutos === null || minutos === undefined || minutos < 5) return null;
    const rotulo =
      minutos < 60 ? `espera ${minutos} min` : minutos < 1440 ? `espera ${Math.floor(minutos / 60)} h${minutos % 60 >= 30 ? " e meia" : ""}` : minutos < 2880 ? "espera desde ontem" : `espera há ${Math.floor(minutos / 1440)} dias`;
    const nivel = minutos < 30 ? "leve" : minutos < 120 ? "atencao" : "atrasado";
    return { rotulo, nivel };
  }

  /** A prévia é nossa? "Você: foto", "Você reagiu…", "Você apagou…". */
  function previaNossa(previa) {
    /* Sem \b: para o JavaScript, "ê" não é letra, e "Vocês" passaria. */
    return /^voc[eê](?![a-zà-ÿ])/i.test(String(previa ?? "").trim());
  }

  /** O cliente encerrou: "ok", "obrigado", "valeu", um 👍 — não é espera. */
  const ENCERRA = /^(ok+|okay|blz|beleza|obrigad[oa]s?|muito obrigad[oa]|obg|valeu|vlw|tmj|show|perfeito|certo|combinado|de nada|disponha|👍+|🙏+|❤️+|😊+)[\s!.,:)👍🙏❤️😊]*$/i;
  function encerrou(previa) {
    return ENCERRA.test(String(previa ?? "").trim());
  }

  CW.selosEspera = { minutosDesde, seloDaEspera, previaNossa, encerrou };

  /* ------------------------------------------------------------------ */
  /* A parte da página                                                    */
  /* ------------------------------------------------------------------ */

  if (typeof location === "undefined" || (location.hostname !== "web.whatsapp.com" && CW.bancada !== true)) return;
  if (typeof document === "undefined") return;

  const NOSSO = '[data-icon*="check"], [data-icon="status-time"], [data-icon="msg-time"]';
  const GRUPO = '[data-icon="default-group"], [data-icon="default-community"]';
  const HORA = /^(\d{1,2}:\d{2}|ontem|yesterday|domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|\d{1,2}\/\d{1,2}\/\d{2,4})$/i;
  const TELEFONE = /^\+?\d[\d\s().-]{8,}$/;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .cw-espera, .cw-etiqueta { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; font: 600 10.5px/1.5 system-ui, sans-serif; white-space: nowrap; vertical-align: middle; }
    .cw-espera.leve { background: #ede9fe; color: #5b21b6; }
    .cw-espera.atencao { background: #fef3c7; color: #92400e; }
    .cw-espera.atrasado { background: #ffe4e6; color: #9f1239; }
    .cw-etiquetas { display: inline-flex; gap: 4px; margin-left: 4px; vertical-align: middle; }
    .cw-etiqueta { margin-left: 0; font-weight: 600; }
    .cw-etiqueta.perigo { background: #ffe4e6; color: #9f1239; }
    .cw-etiqueta.atencao { background: #ffedd5; color: #9a3412; }
    .cw-etiqueta.ok { background: #dcfce7; color: #166534; }
    .cw-etiqueta.neutro { background: #f4f4f5; color: #52525b; }
  `;
  document.head?.appendChild(estilo);

  function linhas() {
    const lista = document.querySelector("#pane-side") || document.querySelector("[data-testid='chat-list']");
    return lista ? [...lista.querySelectorAll('[role="listitem"], [role="row"]')] : [];
  }

  function horaDaLinha(linha) {
    for (const el of linha.querySelectorAll("span, div")) {
      if (el.children.length === 0 && HORA.test((el.textContent || "").trim())) return el;
    }
    return null;
  }

  /** O nome é o primeiro texto com `title` da linha; a prévia, a primeira linha depois do nome e da hora. */
  function nomeDaLinha(linha) {
    return linha.querySelector("span[title]") || null;
  }

  function previaDaLinha(linha, nome) {
    /* Os selos e etiquetas da própria extensão não são prévia. */
    const nossos = new Set([...linha.querySelectorAll(".cw-espera, .cw-etiqueta")].map((e) => (e.textContent || "").trim()));
    const partes = (linha.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
    return partes.find((l) => l !== nome && !nossos.has(l) && !HORA.test(l) && !/^\d+$/.test(l)) || "";
  }

  function marcarEspera() {
    const agora = new Date();
    for (const linha of linhas()) {
      const antigo = linha.querySelector(".cw-espera");
      const hora = horaDaLinha(linha);
      const nome = nomeDaLinha(linha)?.getAttribute("title") || "";
      const previa = previaDaLinha(linha, nome);
      const espera =
        !linha.querySelector(GRUPO) && hora && !linha.querySelector(NOSSO) && !previaNossa(previa) && !encerrou(previa)
          ? seloDaEspera(minutosDesde(hora.textContent, agora))
          : null;
      if (!espera) {
        antigo?.remove();
        continue;
      }
      const selo = antigo || document.createElement("span");
      selo.className = `cw-espera ${espera.nivel}`;
      selo.textContent = espera.rotulo;
      selo.title = "O cliente falou por último e ainda espera a nossa resposta (CW Reputação)";
      if (!antigo) hora.after(selo);
    }
  }

  /* ---- as etiquetas ---- */
  const cache = new Map();
  const VIDA_MS = 5 * 60 * 1000;
  let perguntando = false;

  function chaveDaLinha(nome) {
    return TELEFONE.test(nome) ? `tel:${nome.replace(/\D/g, "")}` : `nome:${nome.trim().toLowerCase()}`;
  }

  async function perguntarEtiquetas() {
    if (perguntando || !chrome?.runtime?.id || !CW.enviar) return;
    const agora = Date.now();
    const faltam = [];
    for (const linha of linhas()) {
      const nome = nomeDaLinha(linha)?.getAttribute("title") || "";
      if (!nome || linha.querySelector(GRUPO)) continue;
      const chave = chaveDaLinha(nome);
      const guardado = cache.get(chave);
      if (guardado && agora - guardado.em < VIDA_MS) continue;
      if (!faltam.some((f) => f.chave === chave)) faltam.push({ chave, nome: TELEFONE.test(nome) ? "" : nome, telefone: TELEFONE.test(nome) ? nome : "" });
    }
    if (!faltam.length) return;
    perguntando = true;
    try {
      const r = await CW.enviar({ tipo: "etiquetasLista", contatos: faltam.slice(0, 60) });
      const etiquetas = r?.dados?.etiquetas ?? {};
      for (const f of faltam.slice(0, 60)) cache.set(f.chave, { em: agora, lista: etiquetas[f.chave] ?? [] });
    } finally {
      perguntando = false;
    }
  }

  function marcarEtiquetas() {
    for (const linha of linhas()) {
      const alvo = nomeDaLinha(linha);
      const nome = alvo?.getAttribute("title") || "";
      const antigo = linha.querySelector(".cw-etiquetas");
      const lista = nome ? cache.get(chaveDaLinha(nome))?.lista ?? [] : [];
      if (!lista.length) {
        antigo?.remove();
        continue;
      }
      const assinatura = lista.map((e) => `${e.tom}:${e.rotulo}`).join("|");
      if (antigo?.dataset.assinatura === assinatura) continue;
      const caixa = antigo || document.createElement("span");
      caixa.className = "cw-etiquetas";
      caixa.dataset.assinatura = assinatura;
      caixa.replaceChildren(
        ...lista.map((e) => {
          const pilula = document.createElement("span");
          pilula.className = `cw-etiqueta ${["perigo", "atencao", "ok", "neutro"].includes(e.tom) ? e.tom : "neutro"}`;
          pilula.textContent = String(e.rotulo ?? "");
          pilula.title = "O que o CW Reputação sabe deste contato";
          return pilula;
        })
      );
      if (!antigo) alvo.after(caixa);
    }
  }

  setInterval(() => {
    marcarEspera();
    marcarEtiquetas();
  }, 3000);
  setInterval(() => void perguntarEtiquetas().then(marcarEtiquetas), 10000);
  setTimeout(() => void perguntarEtiquetas().then(marcarEtiquetas), 2500);
})();
