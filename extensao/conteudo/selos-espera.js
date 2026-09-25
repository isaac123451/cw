/**
 * Selos de quem espera resposta, na lista de conversas do WhatsApp Web
 * (Fase 33, 1.81).
 *
 * "Nas conversas, o cliente que está esperando a nossa resposta ganha
 * selo, com o tempo de espera."
 *
 * **O que lê:** de cada linha da lista, só duas coisas — se a última
 * mensagem tem o ícone de envio (os tiques ou o relógio, que só existem
 * no que nós mandamos) e a hora dela. Sem tique, quem falou por último
 * foi o cliente: ele espera. **O que não lê:** o texto das mensagens.
 * Nada sai desta página; o selo é desenhado aqui e some quando a gente
 * responde.
 *
 * Grupos ficam de fora (a última fala é de qualquer um), e espera de
 * menos de 5 minutos também — é conversa acontecendo, não fila.
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

  CW.selosEspera = { minutosDesde, seloDaEspera };

  /* ------------------------------------------------------------------ */
  /* A parte da página                                                    */
  /* ------------------------------------------------------------------ */

  if (typeof location === "undefined" || (location.hostname !== "web.whatsapp.com" && CW.bancada !== true)) return;
  if (typeof document === "undefined") return;

  const NOSSO = '[data-icon*="check"], [data-icon="status-time"], [data-icon="msg-time"]';
  const GRUPO = '[data-icon="default-group"], [data-icon="default-community"]';
  const HORA = /^(\d{1,2}:\d{2}|ontem|yesterday|domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado|\d{1,2}\/\d{1,2}\/\d{2,4})$/i;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .cw-espera { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; font: 600 10.5px/1.5 system-ui, sans-serif; white-space: nowrap; vertical-align: middle; }
    .cw-espera.leve { background: #ede9fe; color: #5b21b6; }
    .cw-espera.atencao { background: #fef3c7; color: #92400e; }
    .cw-espera.atrasado { background: #ffe4e6; color: #9f1239; }
  `;
  document.head?.appendChild(estilo);

  function linhas() {
    const lista = document.querySelector("#pane-side") || document.querySelector("[data-testid='chat-list']");
    if (!lista) return [];
    const achadas = lista.querySelectorAll('[role="listitem"], [role="row"]');
    return [...achadas];
  }

  function horaDaLinha(linha) {
    /* A hora é um texto curto sozinho num elemento — o primeiro que casa. */
    for (const el of linha.querySelectorAll("span, div")) {
      if (el.children.length === 0 && HORA.test((el.textContent || "").trim())) return el;
    }
    return null;
  }

  function marcar() {
    const agora = new Date();
    for (const linha of linhas()) {
      const antigo = linha.querySelector(".cw-espera");
      const hora = horaDaLinha(linha);
      const espera = !linha.querySelector(GRUPO) && hora && !linha.querySelector(NOSSO) ? seloDaEspera(minutosDesde(hora.textContent, agora)) : null;
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

  setInterval(marcar, 3000);
})();
