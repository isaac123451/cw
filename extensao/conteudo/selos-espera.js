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

  /**
   * A conversa espera a nossa resposta? (1.110)
   *
   * "A espera está indo para conversas em que a última mensagem foi
   * minha." Em setembro o WhatsApp trocou a marcação das mensagens, e o
   * ícone de "enviado/lido" deixou de ser achado — sem ele, toda conversa
   * parecia do cliente. A decisão agora pesa, em ordem:
   *
   * 1. **"Não lidas"**: o selo de mensagens não lidas só existe quando o
   *    cliente falou por último — espera, com certeza.
   * 2. **Nossa**: marca de enviado/lido, prévia "Você…", ou a conversa
   *    aberta mostrou que a última foi nossa depois da hora da lista.
   * 3. **Calibragem**: se nenhuma linha da lista tem marca nossa, a
   *    leitura dos ícones está quebrada nesta versão do WhatsApp — sem o
   *    selo de não lidas, não dá para saber, e aí não se marca.
   */
  function esperaDaLinha(l) {
    if (l.grupo || l.minutos === null || l.minutos === undefined) return null;
    if (l.naoLida) return seloDaEspera(Math.max(l.minutos, 5));
    if (l.nossa || previaNossa(l.previa) || encerrou(l.previa)) return null;
    /* A conversa aberta mostrou a nossa resposta depois da hora que a lista mostra. */
    if (l.respondidaHaMin !== null && l.respondidaHaMin !== undefined && l.respondidaHaMin <= l.minutos + 1) return null;
    if (!l.calibrado) return null;
    return seloDaEspera(l.minutos);
  }

  CW.selosEspera = { minutosDesde, seloDaEspera, previaNossa, encerrou, esperaDaLinha };

  /* ------------------------------------------------------------------ */
  /* A parte da página                                                    */
  /* ------------------------------------------------------------------ */

  if (typeof location === "undefined" || (location.hostname !== "web.whatsapp.com" && CW.bancada !== true)) return;
  if (typeof document === "undefined") return;

  const NOSSO = '[data-icon*="check"], [data-icon="status-time"], [data-icon="msg-time"], [data-icon*="status-dbl"]';
  /* Os rótulos de acessibilidade do status da nossa mensagem, e o selo de não lidas. */
  const STATUS_NOSSO = /^\s*(lida|entregue|enviada|pendente|read|delivered|sent|pending)\s*$/i;
  const NAO_LIDA = '[aria-label*="não lida" i], [aria-label*="nao lida" i], [aria-label*="unread" i]';
  const GRUPO = '[data-icon="default-group"], [data-icon="default-community"]';

  /** A linha tem a marca de mensagem nossa: ícone, título do ícone ou rótulo de status. */
  function temMarcaNossa(linha) {
    if (linha.querySelector(NOSSO)) return true;
    for (const t of linha.querySelectorAll("svg title")) if (/check|status-time|msg-time/i.test(t.textContent || "")) return true;
    for (const el of linha.querySelectorAll("[aria-label]")) if (STATUS_NOSSO.test(el.getAttribute("aria-label") || "")) return true;
    return false;
  }

  /*
    A conversa aberta diz de quem foi a última mensagem — quando dá para
    ter certeza. Guardado por nome: se a última foi nossa, a linha da lista
    com a mesma hora (ou mais antiga) não espera nada.
  */
  const respondidaEm = new Map();

  function olharConversaAberta() {
    const main = document.querySelector("#main");
    /* Era o `header span[title]` — que hoje é o subtítulo ("clique para mostrar os dados do contato"), igual para toda conversa. */
    const nome = CW.nomeNoCabecalho?.() || "";
    if (!main || !nome) return;
    const todas = main.querySelectorAll("[data-id]");
    const ultima = todas[todas.length - 1];
    if (!ultima) return;
    const id = ultima.getAttribute("data-id") || "";
    const nossa =
      id.startsWith("true_") ||
      Boolean(ultima.querySelector('.message-out, [data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="msg-dblcheck-ack"], [data-icon="msg-time"]'));
    const deles = id.startsWith("false_") || Boolean(ultima.querySelector('.message-in, [data-icon="tail-in"]'));
    if (nossa) respondidaEm.set(nome, Date.now());
    else if (deles) respondidaEm.delete(nome);
  }
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
    if (!lista) return [];
    const todas = [...lista.querySelectorAll('[role="listitem"], [role="row"]')];
    /* Linha dentro de linha (listitem com row dentro) é a mesma conversa: fica a de fora. */
    return todas.filter((l) => !todas.some((outra) => outra !== l && outra.contains(l)));
  }

  function horaDaLinha(linha) {
    for (const el of linha.querySelectorAll("span, div")) {
      if (el.children.length === 0 && HORA.test((el.textContent || "").trim())) return el;
    }
    return null;
  }

  /** O nome é o primeiro texto com `title` da linha; a prévia, a primeira linha depois do nome e da hora. */
  /**
   * O nome da linha: o `span[title]` que parece nome, ou o primeiro texto
   * `dir="auto"` sem filhos (o nome vem antes da prévia). Sem o segundo,
   * a linha sem `title` ficava sem selo e sem etiqueta.
   */
  function nomeDaLinha(linha) {
    const parece = CW.pareceNomeDeContato ?? ((t) => Boolean(String(t ?? "").trim()));
    const comTitulo = [...linha.querySelectorAll("span[title]")].find((el) => parece(el.getAttribute("title")));
    if (comTitulo) return comTitulo;
    return [...linha.querySelectorAll('span[dir="auto"]')].find((el) => !el.querySelector("span") && parece(el.textContent) && !HORA.test((el.textContent || "").trim())) || null;
  }

  const textoDoNome = (el) => (el?.getAttribute("title") || el?.textContent || "").trim();

  function previaDaLinha(linha, nome) {
    /* Os selos e etiquetas da própria extensão não são prévia. */
    const nossos = new Set([...linha.querySelectorAll(".cw-espera, .cw-etiqueta")].map((e) => (e.textContent || "").trim()));
    const partes = (linha.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
    return partes.find((l) => l !== nome && !nossos.has(l) && !HORA.test(l) && !/^\d+$/.test(l)) || "";
  }

  /* Quem espera agora, para o Meu dia (1.108): chave, nome ou número, minutos e etiquetas. */
  let esperando = [];

  function marcarEspera() {
    const agora = new Date();
    const vistos = [];
    olharConversaAberta();
    const todas = linhas();
    const lidas = todas.map((linha) => {
      const hora = horaDaLinha(linha);
      const nome = textoDoNome(nomeDaLinha(linha));
      const quando = respondidaEm.get(nome);
      return {
        linha,
        hora,
        nome,
        grupo: Boolean(linha.querySelector(GRUPO)),
        minutos: hora ? minutosDesde(hora.textContent, agora) : null,
        nossa: temMarcaNossa(linha),
        naoLida: Boolean(linha.querySelector(NAO_LIDA)),
        previa: previaDaLinha(linha, nome),
        respondidaHaMin: quando ? Math.round((agora.getTime() - quando) / 60000) : null,
      };
    });
    /* Com várias conversas na tela e nenhuma marca nossa, a leitura dos ícones não serve nesta versão. */
    const calibrado = todas.length < 4 || lidas.some((l) => l.nossa);
    for (const l of lidas) {
      const { linha, hora, nome } = l;
      const antigo = linha.querySelector(".cw-espera");
      const espera = esperaDaLinha({ ...l, calibrado });
      const minutos = Math.max(l.minutos ?? 0, 5);
      if (espera && nome) {
        const chave = chaveDaLinha(nome);
        vistos.push({ chave, nome: TELEFONE.test(nome) ? "" : nome, telefone: TELEFONE.test(nome) ? nome : "", minutos, etiquetas: cache.get(chave)?.lista ?? [] });
      }
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
    esperando = vistos;
  }

  /*
    O retrato vai quando muda (quem entrou, quem saiu, a espera mudando de
    faixa) ou a cada 4 minutos — o CW descarta retrato com mais de 15, e é
    assim que o Meu dia sabe que o WhatsApp foi fechado. Só a lista que
    aparece na tela: conversa rolada para baixo não conta.
  */
  let ultimoEnvio = { em: 0, assinatura: "" };
  const faixa = (m) => (m < 60 ? Math.floor(m / 15) : 4 + Math.floor(m / 60));

  async function enviarEspera() {
    if (!chrome?.runtime?.id || !CW.enviar) return;
    const assinatura = esperando.map((e) => `${e.chave}:${faixa(e.minutos)}:${e.etiquetas.length}`).sort().join("|");
    const agora = Date.now();
    if (assinatura === ultimoEnvio.assinatura && agora - ultimoEnvio.em < 4 * 60_000) return;
    ultimoEnvio = { em: agora, assinatura };
    try {
      await CW.enviar({ tipo: "esperaWhatsapp", conversas: esperando.slice(0, 100) });
    } catch {
      ultimoEnvio.em = 0;
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
      const nome = textoDoNome(nomeDaLinha(linha));
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
      const nome = textoDoNome(alvo);
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
  setInterval(() => void enviarEspera(), 60000);
  setTimeout(() => void enviarEspera(), 8000);
  setTimeout(() => void perguntarEtiquetas().then(marcarEtiquetas), 2500);
})();
