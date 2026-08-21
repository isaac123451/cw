import {
  gravarConfig,
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
  caso: "/api/extensao/caso",
  lembretes: "/api/extensao/lembretes",
  conversa: "/api/extensao/conversa",
  nps: "/api/extensao/nps",
  mover: "/api/extensao/mover",
  fila: "/api/extensao/fila",
  anotar: "/api/extensao/anotar",
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

/**
 * `corpo` transforma a chamada em POST.
 *
 * Três rotas escrevem: a que cria reclamação a partir do que a extensão
 * leu no portal, a que registra a tratativa de NPS, e a que pede o
 * resumo da conversa (que grava nada, mas manda texto e por isso não
 * cabe numa query string). Todas as outras seguem sendo GET.
 */
async function chamar(caminho, parametros = {}, corpo) {

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

  if (corpo !== undefined) {
    cabecalhos["Content-Type"] = "application/json";
  }

  let resposta;

  try {
    resposta = await fetch(url.toString(), {
      method: corpo === undefined ? "GET" : "POST",
      headers: cabecalhos,
      body:
        corpo === undefined
          ? undefined
          : JSON.stringify(corpo),
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

  /**
   * Resposta 200 que não é JSON.
   *
   * Acontece de verdade, e o sintoma era péssimo: um
   * `Unexpected token '<', "<!DOCTYPE "...` cru chegava à tela, sem
   * dizer o que fazer. As causas são todas de endereço — apontar para
   * um servidor que não é o CW Reputação, para um proxy com página de
   * login, ou para uma aplicação de uma versão anterior à rota que a
   * extensão está chamando. Todas se resolvem em Opções, e é isso que
   * a mensagem precisa dizer.
   */
  const tipo =
    resposta.headers.get("content-type") ?? "";

  if (!tipo.includes("json")) {

    const inicio = (await resposta.text())
      .slice(0, 120)
      .replace(/\s+/g, " ")
      .trim();

    throw new FalhaNaChamada(
      "resposta",
      `${base} respondeu uma página, não dados. Confira o endereço do CW Reputação nas Opções — e se a aplicação no ar já tem esta versão.`,
      { base, inicio }
    );
  }

  try {
    return await resposta.json();
  } catch {
    throw new FalhaNaChamada(
      "resposta",
      `${base} respondeu algo que não dá para ler. Confira o endereço nas Opções.`,
      { base }
    );
  }
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

  /**
   * Preferência gravada pelo próprio painel — tema e largura.
   *
   * Fica aqui e não no script de conteúdo porque `chrome.storage` não
   * existe do lado de lá com a mesma garantia, e porque o popup e a
   * tela de opções precisam ler o mesmo valor.
   */
  if (mensagem?.tipo === "salvar") {
    const config = await gravarConfig(
      mensagem.parcial ?? {}
    );
    return { ok: true, dados: config };
  }

  /**
   * Cria (ou atualiza) uma reclamação a partir do que a extensão leu
   * no portal. É a única escrita da extensão, e ela é explícita: só
   * acontece quando alguém clica em "Adicionar ao Kanban".
   */
  if (mensagem?.tipo === "criarCaso") {

    const dados = await chamar(
      CAMINHOS.caso,
      {},
      mensagem.caso ?? {}
    );

    // A base mudou: o retrato guardado envelheceu na hora.
    cache.clear();

    return { ok: true, dados };
  }

  /**
   * Avança ou volta um caso uma etapa do quadro.
   *
   * A extensão manda a **direção**, não a etapa: a ordem das colunas é
   * cadastro, muda na tela de configurações, e uma extensão instalada
   * há três semanas teria uma cópia velha dela. Quem resolve é o
   * servidor.
   */
  if (mensagem?.tipo === "moverCaso") {

    const dados = await chamar(CAMINHOS.mover, {}, {
      protocolo: mensagem.protocolo,
      direcao: mensagem.direcao,
      para: mensagem.para,
    });

    cache.clear();

    return { ok: true, dados };
  }

  /**
   * A fila aberta de um canal, sem depender de contato.
   *
   * Sem cache, ao contrário do contexto: esta é a lista de
   * trabalho, e uma fila de 45 segundos atrás já não descreve o que
   * está aberto agora.
   */
  /**
   * Anotação de caso ou tarefa de agenda.
   *
   * Limpa o cache porque a anotação entra na linha do tempo que o
   * painel mostra logo abaixo dela.
   */
  if (mensagem?.tipo === "anotar") {

    const dados = await chamar(
      CAMINHOS.anotar,
      {},
      mensagem.anotacao ?? {}
    );

    cache.clear();

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "fila") {

    const dados = await chamar(CAMINHOS.fila, {
      canal: mensagem.canal,
    });

    return { ok: true, dados };
  }

  /**
   * Registra a tratativa de NPS — uma tentativa de contato ou o
   * pós-contato (régua de humor e "resolveu ou não").
   *
   * Limpa o cache pelo mesmo motivo de `criarCaso`: o retrato guardado
   * ainda diz "0 tentativas" e "ainda não registrado", e é exatamente
   * isso que o painel vai redesenhar em seguida.
   */
  if (mensagem?.tipo === "registrarNps") {

    const dados = await chamar(
      CAMINHOS.nps,
      {},
      mensagem.registro ?? {}
    );

    cache.clear();

    return { ok: true, dados };
  }

  /**
   * Resumo da conversa.
   *
   * É a única mensagem que carrega texto de conversa, e ela só existe
   * porque alguém clicou em "Resumir" — o painel nunca manda isso
   * sozinho. Sem cache: um resumo de dez minutos atrás descreve outra
   * conversa.
   */
  if (mensagem?.tipo === "resumirConversa") {

    const dados = await chamar(
      CAMINHOS.conversa,
      {},
      mensagem.conversa ?? {}
    );

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
   COBRANÇA DAS ETAPAS DO FLUXO
============================================================ */

const ALARME_LEMBRETE = "cw-lembretes";

/**
 * De quanto em quanto tempo o alarme acorda.
 *
 * Cinco minutos, e não dez: o intervalo de verdade é o da etapa, e
 * acordar na metade dele garante que uma cobrança de dez minutos saia
 * aos dez, não aos vinte. Quando não há nada parado, o ciclo é uma
 * requisição e nada mais.
 */
const CICLO_LEMBRETE_MIN = 5;

/**
 * Agrupa por etapa, e não por caso.
 *
 * Oito casos parados virariam oito notificações a cada dez minutos —
 * que é o caminho mais curto para alguém desligar o aviso e perder os
 * oito. Uma por etapa diz o mesmo e continua sendo lida na terceira
 * semana.
 */
async function cobrarEtapas() {

  const config = await lerConfig();

  if (!config.lembretes) return;

  let dados;

  try {
    dados = await chamar(CAMINHOS.lembretes);
  } catch {
    // Sem sessão ou fora do ar: a cobrança não é o lugar de reclamar.
    return;
  }

  const guardado = await chrome.storage.local.get(
    "cobrancas"
  );

  const ultima = guardado.cobrancas ?? {};
  const agora = Date.now();
  const proximas = {};

  for (const etapa of dados?.etapas ?? []) {

    if (!etapa.parados) continue;

    const intervalo =
      Math.max(Number(etapa.minutos) || 10, 1) * 60000;

    const quando = ultima[etapa.nome] ?? 0;

    // Ainda não deu a hora desta etapa: mantém o relógio como está.
    if (agora - quando < intervalo) {
      proximas[etapa.nome] = quando;
      continue;
    }

    proximas[etapa.nome] = agora;

    const daEtapa = (dados.casos ?? []).filter(
      (caso) => caso.status === etapa.nome
    );

    const primeiro = daEtapa[0];

    chrome.notifications.create(
      `cw-etapa-${etapa.nome}-${agora}`,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL(
          "icones/icone-128.png"
        ),
        title: `${etapa.parados} caso(s) em "${etapa.nome}"`,
        message: primeiro
          ? `${primeiro.cliente} — ${primeiro.titulo}`.slice(
              0,
              160
            )
          : "Casos parados nesta etapa.",
        contextMessage: `Cobrando a cada ${etapa.minutos} min até sair da etapa`,
        priority: 1,
      }
    );
  }

  /**
   * Etapa que esvaziou perde o relógio.
   *
   * Sem isto, um caso que volta para a etapa três dias depois seria
   * cobrado no mesmo instante, porque o intervalo já teria "vencido"
   * há muito tempo.
   */
  await chrome.storage.local.set({ cobrancas: proximas });
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

function agendar() {

  chrome.alarms.create(ALARME, {
    delayInMinutes: 1,
    periodInMinutes: 30,
  });

  chrome.alarms.create(ALARME_LEMBRETE, {
    delayInMinutes: 1,
    periodInMinutes: CICLO_LEMBRETE_MIN,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  agendar();
  atualizarEmSilencio();
});

chrome.runtime.onStartup.addListener(agendar);

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME) atualizarEmSilencio();
  if (alarme.name === ALARME_LEMBRETE) cobrarEtapas();
});

chrome.notifications.onClicked.addListener(async (id) => {

  const config = await lerConfig();
  const base = normalizarBase(config.base);

  if (!base) return;

  // Cobrança de etapa leva ao quadro; o resto, ao painel do dia.
  chrome.tabs.create({
    url: id.startsWith("cw-etapa-")
      ? `${base}/reclame-aqui`
      : `${base}/dashboard`,
  });
});
