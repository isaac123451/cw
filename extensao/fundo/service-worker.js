import {
  lerConfig,
  normalizarBase,
  padraoDeOrigem,
} from "../comum/config.js";

/**
 * O service worker é o único que fala com o CW Reputação.
 *
 * Todo o resto da extensão — painel, popup, opções — manda uma mensagem
 * para cá. A concentração existe por dois motivos concretos:
 *
 * 1. **Cookie.** A sessão (`cw_session`) é `httpOnly`: página nenhuma
 *    consegue lê-la por JavaScript. Só a API `chrome.cookies`, que
 *    existe aqui e não no script de conteúdo.
 * 2. **Origem cruzada.** Desde o Manifest V3, script de conteúdo está
 *    sujeito a CORS como qualquer página. O service worker, não: ele
 *    atravessa por causa de `host_permissions`. Buscar daqui é o que
 *    faz a chamada funcionar sem afrouxar o servidor.
 */

const CAMINHOS = {
  sessao: "/api/extensao/sessao",
  contexto: "/api/extensao/contexto",
  resumo: "/api/extensao/resumo",
};

/**
 * Guarda respostas por pouco tempo.
 *
 * O DOM do WhatsApp se reescreve o tempo todo, e o detector dispara com
 * frequência. Sem isto, trocar de conversa e voltar renderia dezenas de
 * consultas iguais em poucos segundos.
 */
const CACHE_MS = 45_000;

const cache = new Map();

function doCache(chave) {

  const item = cache.get(chave);

  if (!item) return null;

  if (Date.now() - item.em > CACHE_MS) {
    cache.delete(chave);
    return null;
  }

  return item.dados;
}

function guardar(chave, dados) {
  cache.set(chave, { em: Date.now(), dados });
}

/* ============================================================
   CHAMADA
============================================================ */

class FalhaNaChamada extends Error {
  constructor(codigo, mensagem, extra = {}) {
    super(mensagem);
    this.codigo = codigo;
    Object.assign(this, extra);
  }
}

async function chamar(caminho, parametros = {}) {

  const config = await lerConfig();

  const base = normalizarBase(config.base);

  if (!base) {
    throw new FalhaNaChamada(
      "sem-endereco",
      "Endereço do CW Reputação não configurado."
    );
  }

  const origem = padraoDeOrigem(base);

  const temPermissao = await chrome.permissions.contains({
    origins: [origem],
  });

  if (!temPermissao) {
    throw new FalhaNaChamada(
      "sem-permissao",
      `A extensão ainda não tem permissão para acessar ${base}.`,
      { base }
    );
  }

  /**
   * A sessão vai no cabeçalho, e não solta como cookie.
   *
   * O cookie é `SameSite=Lax`, e uma requisição que nasce em
   * `chrome-extension://` é de outro site aos olhos do navegador — o
   * que torna o envio automático imprevisível. Lendo e mandando
   * explicitamente, o comportamento é o mesmo em qualquer versão, e a
   * rota do servidor aceita esse cabeçalho de propósito.
   */
  let cookie = null;

  try {
    cookie = await chrome.cookies.get({
      url: base,
      name: "cw_session",
    });
  } catch {
    cookie = null;
  }

  const url = new URL(base + caminho);

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  }

  const cabecalhos = { Accept: "application/json" };

  if (cookie?.value) {
    cabecalhos["X-CW-Sessao"] = cookie.value;
  }

  let resposta;

  try {
    resposta = await fetch(url.toString(), {
      method: "GET",
      headers: cabecalhos,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (erro) {
    throw new FalhaNaChamada(
      "rede",
      `Não foi possível falar com ${base}. O endereço está certo e a aplicação está no ar?`,
      { base, detalhe: String(erro?.message ?? erro) }
    );
  }

  if (resposta.status === 401) {
    throw new FalhaNaChamada(
      "sessao",
      "Sessão expirada. Entre no CW Reputação neste navegador.",
      { base }
    );
  }

  if (!resposta.ok) {

    let detalhe = "";

    try {
      const corpo = await resposta.json();
      detalhe = corpo?.erro ?? corpo?.error ?? "";
    } catch {
      detalhe = "";
    }

    throw new FalhaNaChamada(
      "http",
      detalhe ||
        `A aplicação respondeu ${resposta.status}.`,
      { base, status: resposta.status }
    );
  }

  return resposta.json();
}

/* ============================================================
   MENSAGENS
============================================================ */

async function tratar(mensagem) {

  if (mensagem?.tipo === "config") {
    const config = await lerConfig();
    return {
      ok: true,
      dados: { ...config, base: normalizarBase(config.base) },
    };
  }

  if (mensagem?.tipo === "sessao") {
    return { ok: true, dados: await chamar(CAMINHOS.sessao) };
  }

  if (mensagem?.tipo === "contexto") {

    const consulta = mensagem.consulta ?? {};

    const chave = JSON.stringify(consulta);

    const guardado = doCache(chave);

    if (guardado && !mensagem.forcar) {
      return { ok: true, dados: guardado, doCache: true };
    }

    const dados = await chamar(
      CAMINHOS.contexto,
      consulta
    );

    guardar(chave, dados);

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "resumo") {

    const dados = await chamar(CAMINHOS.resumo);

    await aplicarContador(dados);

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "abrir") {
    await chrome.tabs.create({ url: mensagem.url });
    return { ok: true };
  }

  if (mensagem?.tipo === "opcoes") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  return {
    ok: false,
    erro: "Mensagem desconhecida.",
    codigo: "desconhecida",
  };
}

chrome.runtime.onMessage.addListener(
  (mensagem, _remetente, responder) => {

    tratar(mensagem)
      .then(responder)
      .catch((erro) =>
        responder({
          ok: false,
          codigo: erro?.codigo ?? "erro",
          erro: erro?.message ?? String(erro),
          base: erro?.base,
        })
      );

    // true mantém o canal aberto até a promessa resolver.
    return true;
  }
);

/* ============================================================
   CONTADOR NO ÍCONE
============================================================ */

/**
 * Pendências no ícone.
 *
 * Só os alertas graves entram na conta: um número que sobe com aviso
 * informativo vira ruído e some da atenção em dois dias.
 */
async function aplicarContador(resumo) {

  const config = await lerConfig();

  if (!config.contador) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const graves = (resumo?.alertas ?? []).filter(
    (item) => item.tom === "danger"
  );

  const total = graves.reduce(
    (soma, item) => soma + (item.quantidade ?? 1),
    0
  );

  await chrome.action.setBadgeBackgroundColor({
    color: "#DC2626",
  });

  await chrome.action.setBadgeText({
    text: total > 0 ? String(Math.min(total, 99)) : "",
  });

  await chrome.action.setTitle({
    title:
      graves.length > 0
        ? `CW Reputação — ${graves[0].titulo}`
        : "CW Reputação",
  });

  await avisar(resumo, graves, config);
}

/**
 * Aviso de área de trabalho, no máximo um por dia.
 *
 * É a versão possível do "resumo diário" da Peça B enquanto o cron não
 * existe — e é honestamente menos do que ela: só dispara com o
 * navegador aberto.
 */
async function avisar(resumo, graves, config) {

  if (!config.aviso || graves.length === 0) return;

  const agora = new Date();

  if (agora.getHours() < 8) return;

  const hoje = agora.toISOString().slice(0, 10);

  const { ultimoAviso } = await chrome.storage.local.get(
    "ultimoAviso"
  );

  if (ultimoAviso === hoje) return;

  await chrome.storage.local.set({ ultimoAviso: hoje });

  const resto =
    graves.length > 1
      ? `\n+ ${graves.length - 1} outro(s) alerta(s).`
      : "";

  chrome.notifications.create(`cw-${hoje}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
    title: `CW Reputação — nota ${
      resumo?.reputacao?.indisponivel
        ? "indisponível"
        : resumo?.reputacao?.nota
    }`,
    message: `${graves[0].titulo}\n${graves[0].detalhe}${resto}`,
    priority: 1,
  });
}

/* ============================================================
   ROTINA
============================================================ */

const ALARME = "cw-resumo";

async function atualizarEmSilencio() {
  try {
    const dados = await chamar(CAMINHOS.resumo);
    await aplicarContador(dados);
  } catch {
    /**
     * Falhar em silêncio é intencional: sem sessão, sem endereço ou
     * fora da VPN, a rotina de fundo não tem o que fazer, e transformar
     * isso em erro visível encheria a tela de aviso inútil. O popup
     * mostra a falha de verdade quando você abre.
     */
    await chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARME, {
    delayInMinutes: 1,
    periodInMinutes: 30,
  });
  atualizarEmSilencio();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARME, {
    delayInMinutes: 1,
    periodInMinutes: 30,
  });
});

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME) atualizarEmSilencio();
});

chrome.notifications.onClicked.addListener(async () => {
  const config = await lerConfig();
  const base = normalizarBase(config.base);
  if (base) chrome.tabs.create({ url: `${base}/dashboard` });
});
