/**
 * A extensão sempre atualizada (13/11/2026).
 *
 * "ela precisa sempre atualizar certinho". O Chrome não atualiza sozinho uma
 * extensão carregada de uma pasta ("Carregar sem compactação"): os arquivos
 * novos ficam no disco e a extensão continua rodando a versão velha até
 * alguém clicar em recarregar. Foi isso que segurou o salvamento das
 * conversas de 06 a 10/11.
 *
 * Aqui, três coisas:
 *
 * 1. **A pasta mudou → recarrega sozinha.** A cada 5 minutos (e ao pedir
 *    pela plataforma) a extensão lê o próprio `manifest.json` do disco e
 *    compara com a versão que está rodando. Diferente: \`chrome.runtime.reload()\`.
 *    Quem instalou da pasta do projeto, ou substituiu a pasta pelo zip novo,
 *    não precisa fazer mais nada.
 * 2. **Depois de recarregar, volta às abas abertas.** O WhatsApp e o Reclame
 *    Aqui abertos ficavam com o painel morto até o F5. Agora a extensão tira
 *    o painel velho e injeta o novo, sem recarregar a página.
 * 3. **A plataforma está numa versão mais nova → avisa.** Quem instalou do
 *    zip e ainda não trocou a pasta recebe uma notificação (uma por versão)
 *    que leva à página Extensão da plataforma, com o zip novo.
 */

export const ALARME_ATUALIZACAO = "cw-atualizacao";
const INTERVALO_MIN = 5;
const CHAVE_AVISADA = "cw-versao-avisada";

/** -1, 0 ou 1, número a número ("1.1.9" < "1.1.10"). */
export function compararVersoes(a, b) {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** A versão que está no disco agora (a pasta carregada no Chrome). */
export async function versaoNoDisco() {
  try {
    const r = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    const m = await r.json();
    return typeof m?.version === "string" ? m.version : null;
  } catch {
    return null;
  }
}

/**
 * Confere a pasta e, se mudou, recarrega. Devolve o que achou, para a
 * plataforma mostrar ("já está na última", "atualizando para 1.1.80").
 */
export async function conferirAtualizacao({ motivo = "relogio" } = {}) {
  const rodando = chrome.runtime.getManifest().version;
  const disco = await versaoNoDisco();
  if (disco && disco !== rodando) {
    await chrome.storage.local.set({ "cw-atualizada-de": { de: rodando, para: disco, motivo, em: Date.now() } });
    /* Um instante para a resposta chegar a quem pediu antes de a extensão sumir. */
    setTimeout(() => chrome.runtime.reload(), 400);
    return { ok: true, dados: { rodando, disco, atualizando: true } };
  }
  return { ok: true, dados: { rodando, disco, atualizando: false } };
}

/** A versão da plataforma é mais nova que a instalada? Avisa uma vez por versão. */
export async function avisarSePlataformaMaisNova(versaoDaPlataforma, enderecoDaPlataforma) {
  const rodando = chrome.runtime.getManifest().version;
  if (!versaoDaPlataforma || compararVersoes(rodando, versaoDaPlataforma) >= 0) {
    await chrome.action.setBadgeText({ text: "" }).catch(() => {});
    return false;
  }
  const disco = await versaoNoDisco();
  /* A pasta já tem a nova: o recarregar resolve sozinho, sem aviso. */
  if (disco && compararVersoes(disco, versaoDaPlataforma) >= 0) return false;
  const guardado = (await chrome.storage.local.get(CHAVE_AVISADA))[CHAVE_AVISADA];
  await chrome.action.setBadgeBackgroundColor({ color: "#B45309" }).catch(() => {});
  await chrome.action.setBadgeText({ text: "↑" }).catch(() => {});
  if (guardado === versaoDaPlataforma) return true;
  await chrome.storage.local.set({ [CHAVE_AVISADA]: versaoDaPlataforma });
  chrome.notifications.create(`cw-atualizar:${enderecoDaPlataforma ?? ""}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
    title: "Há uma versão nova da extensão",
    message: `A sua está na ${rodando}; a plataforma, na ${versaoDaPlataforma}. Clique para baixar e trocar a pasta.`,
    priority: 1,
  });
  return true;
}

/**
 * Depois de recarregar, a extensão volta às abas abertas: tira o painel
 * velho (que ficou sem extensão por trás) e injeta os scripts de novo, na
 * mesma ordem do manifesto. Sem F5 no WhatsApp.
 */
export async function voltarAsAbasAbertas() {
  const manifesto = chrome.runtime.getManifest();
  for (const entrada of manifesto.content_scripts ?? []) {
    let abas = [];
    try {
      abas = await chrome.tabs.query({ url: entrada.matches });
    } catch {
      continue;
    }
    for (const aba of abas) {
      if (!aba.id || aba.discarded) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: aba.id },
          func: () => {
            for (const el of document.querySelectorAll('[id^="cw-reputacao"], #cw-revisao-whatsapp, #cw-slack-regra')) el.remove();
          },
        });
        await chrome.scripting.executeScript({
          target: { tabId: aba.id },
          files: entrada.js ?? [],
          ...(entrada.world === "MAIN" ? { world: "MAIN" } : {}),
        });
      } catch {
        /* aba sem permissão ou fechando: a próxima abertura carrega normal */
      }
    }
  }
}

export function agendarAtualizacao() {
  chrome.alarms.create(ALARME_ATUALIZACAO, { delayInMinutes: 1, periodInMinutes: INTERVALO_MIN });
}
