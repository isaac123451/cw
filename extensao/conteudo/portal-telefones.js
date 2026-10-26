/**
 * O telefone do NPS, buscado no portal da Cardápio Web (26/10/2026).
 *
 * "Eu queria sempre verificar o número de telefone." O Wootric não manda
 * telefone; manda o `company_id`, que é o id do estabelecimento no portal.
 * Enquanto houver uma aba do portal aberta (não precisa estar na frente),
 * este script, a cada 30 minutos:
 *
 * 1. pergunta ao CW Reputação quais estabelecimentos de NPS estão sem
 *    telefone (detratores e neutros em aberto primeiro);
 * 2. para cada um, faz as duas consultas que o próprio portal faz —
 *    estabelecimento pelo id (`admin/companies?search_text=`) e o dono
 *    (`admin/owners/<id>`) — com a sessão de quem está logado;
 * 3. manda de volta só o resultado: telefone, nome e e-mail do dono, nome
 *    da loja.
 *
 * **O token do portal não sai daqui:** é lido do `localStorage` da própria
 * página, a cada consulta, e só vai no cabeçalho para a API do portal.
 * Medido em 23/10: o cabeçalho é o token cru, sem "Bearer" (com ele, 401).
 *
 * `CW.telefonesDoPortal.lerResposta` é pura: o `check:telefones-portal` a
 * roda sem navegador.
 */
(() => {
  const CW = (window.CWReputacao = window.CWReputacao || {});
  if (CW.telefonesDoPortal) return;

  /**
   * O que vale de uma busca: o estabelecimento com o id exato (a busca é por
   * texto e pode trazer outros) e, dele, o dono.
   */
  function lerResposta(companyId, lista, dono) {
    const achado = (Array.isArray(lista) ? lista : []).find((c) => String(c?.id) === String(companyId));
    if (!achado) return { companyId: String(companyId), achou: false };
    return {
      companyId: String(companyId),
      achou: true,
      telefone: typeof dono?.user_telephone === "string" ? dono.user_telephone : undefined,
      dono: typeof dono?.user_name === "string" ? dono.user_name : achado.owner_name,
      emailDono: typeof dono?.user_email === "string" ? dono.user_email : undefined,
      loja: typeof achado.name === "string" ? achado.name.trim() : undefined,
    };
  }

  CW.telefonesDoPortal = { lerResposta };

  if (typeof location === "undefined" || location.hostname !== "portal.cardapioweb.com" || window.top !== window || !CW.enviar) return;

  const API = "https://api.cardapioweb.com/api/v2";
  const A_CADA_MS = 30 * 60_000;
  const CHAVE = "telefonesNpsUltimaVolta";
  let rodando = false;

  /** O token da sessão do portal, se ainda vale por mais 5 minutos. */
  function token() {
    const t = localStorage.getItem("access_token");
    if (!t) return null;
    try {
      const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (!p.exp || p.exp * 1000 - Date.now() < 5 * 60_000) return null;
    } catch {
      return null;
    }
    return t;
  }

  async function pegar(caminho) {
    const t = token();
    if (!t) throw Object.assign(new Error("sem sessão"), { sessao: true });
    const r = await fetch(API + caminho, { headers: { Authorization: t, Accept: "application/json" } });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error("sessão recusada"), { sessao: true });
    if (!r.ok) throw new Error(`portal respondeu ${r.status}`);
    return r.json();
  }

  async function lerUm(companyId) {
    const lista = await pegar(`/admin/companies?page=1&per_page=10&search_text=${encodeURIComponent(companyId)}`);
    const achado = (Array.isArray(lista) ? lista : []).find((c) => String(c?.id) === String(companyId));
    const dono = achado?.owner_id ? await pegar(`/admin/owners/${encodeURIComponent(achado.owner_id)}`) : null;
    return lerResposta(companyId, lista, dono);
  }

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  async function volta() {
    if (rodando || !token()) return;
    rodando = true;
    try {
      /* Várias abas do portal abertas: uma volta só, para todas. */
      const guardado = await chrome.storage.local.get(CHAVE);
      if (Date.now() - (guardado[CHAVE] ?? 0) < A_CADA_MS) return;
      await chrome.storage.local.set({ [CHAVE]: Date.now() });

      const plano = await CW.enviar({ tipo: "npsTelefones" });
      const pedidos = plano?.ok && plano.dados?.podeGravar ? plano.dados.pedidos ?? [] : [];
      const lidos = [];
      for (const companyId of pedidos) {
        try {
          lidos.push(await lerUm(companyId));
        } catch (erro) {
          if (erro?.sessao) break;
        }
        await esperar(350);
      }
      if (lidos.length) await CW.enviar({ tipo: "npsTelefonesGravar", lidos });
    } finally {
      rodando = false;
    }
  }

  /* Dá tempo de o portal renovar a sessão ao abrir; depois confere de 5 em 5 minutos se já é hora. */
  setTimeout(() => volta().catch(() => undefined), 10_000);
  setInterval(() => volta().catch(() => undefined), 5 * 60_000);
})();
