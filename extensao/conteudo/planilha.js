/**
 * Google Sheets — a planilha das Redes vira atendimento com um clique.
 *
 * **O pedido.** "Identificados os casos de uma planilha." A automação
 * preenche uma planilha com as menções e directs; cada linha era
 * redigitada no formulário das Redes.
 *
 * **Como lê.** A grade do Sheets é desenhada em canvas — não há texto de
 * célula no DOM para ler. A extensão pede a **mesma aba aberta** como CSV
 * ao próprio Google, com a sessão de quem está vendo a planilha (é o que
 * "Arquivo › Fazer download › CSV" entrega). Nada de outra planilha, nada
 * sem a pessoa ter aberto.
 *
 * **Só no clique, em dois tempos.** Abrir a planilha só mostra o botão.
 * "Ler para as Redes" pede a prévia — quantas linhas são novas, quantas
 * já estão no CW, quantas se repetem —, e só "Gravar" cria os atendimentos.
 * A regra (colunas, rede, perfil, chave de cada linha) mora na aplicação.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || !CW.painelDeCaptura) return;

  const PAINEL = "cw-captura-planilha";
  const LANCADOR = "cw-captura-planilha-botao";

  const idDaPlanilha = () => location.pathname.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,80})/)?.[1] ?? "";
  const gidDaAba = () => (location.hash.match(/gid=(\d+)/) ?? location.search.match(/gid=(\d+)/))?.[1] ?? "0";
  const nomeDaPlanilha = () => document.title.replace(/\s*-\s*(Google Sheets|Planilhas Google)\s*$/i, "").trim();

  async function lerCsv(id, gid) {
    /* `headers=1`: a primeira linha é o cabeçalho, sem o Google adivinhar. */
    const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&gid=${encodeURIComponent(gid)}`;
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error(r.status === 403 || r.status === 401 ? "Sem acesso a esta planilha com a sua conta do Google." : `O Google respondeu ${r.status} ao pedir a aba.`);
    const texto = await r.text();
    if (/^\s*<!doctype html|^\s*<html/i.test(texto)) throw new Error("O Google pediu login de novo. Recarregue a planilha e tente outra vez.");
    return texto;
  }

  function numeros(c) {
    const cel = (n, rotulo) => `<div><b>${Number(n) || 0}</b><span>${rotulo}</span></div>`;
    return `<div class="numeros">${cel(c.nova, "novas")}${cel(c.existente, "já no CW")}${cel(c.duplicada, "repetidas")}${cel(c["sem-rede"], "sem rede")}</div>`;
  }

  function colunas(dados) {
    const nomes = { quando: "Data", rede: "Rede", perfil: "Perfil", nome: "Nome", seguidores: "Seguidores", telefone: "Telefone", link: "Link", texto: "Relato", assunto: "Assunto" };
    const achadas = dados.colunas ?? {};
    const chips = Object.entries(nomes)
      .map(([campo, rotulo]) =>
        achadas[campo]
          ? `<span class="chip" title="Coluna “${CW.escapar(achadas[campo])}”">${rotulo}</span>`
          : `<span class="chip falta" title="Nenhuma coluna reconhecida">${rotulo}</span>`
      )
      .join("");
    return `<p class="rotulo">Colunas reconhecidas</p><div class="chips">${chips}</div>`;
  }

  async function abrirPainel() {
    const id = idDaPlanilha();
    const gid = gidDaAba();
    const painel = CW.painelDeCaptura(PAINEL);
    painel.titulo(nomeDaPlanilha() || "Planilha");
    painel.rodape([]);
    painel.corpo(`<p class="vazio">Lendo a aba aberta…</p>`);

    let csv = "";
    try {
      csv = await lerCsv(id, gid);
    } catch (erro) {
      painel.corpo(`<div class="recado erro">${CW.escapar(erro.message)}</div>`);
      painel.rodape([{ rotulo: "Tentar de novo", aoClicar: abrirPainel }]);
      return;
    }

    const corpoBase = { fonte: "planilha", planilha: { id, gid, titulo: nomeDaPlanilha() }, csv };
    const resposta = await CW.enviar({ tipo: "capturaRedes", corpo: { ...corpoBase, acao: "previa" } });
    const dados = resposta?.dados;

    if (!resposta?.ok || !dados || (dados.erro && dados.suficientes !== false)) {
      painel.corpo(`<div class="recado erro">${CW.escapar(dados?.erro ?? resposta?.erro ?? "Não deu para ler a planilha agora.")}</div>`);
      painel.rodape([{ rotulo: "Tentar de novo", aoClicar: abrirPainel }]);
      return;
    }

    if (dados.suficientes === false) {
      painel.corpo(
        `<div class="recado aviso">${CW.escapar(dados.erro)}</div>${colunas(dados)}<p class="rotulo">Cabeçalho desta aba</p><div class="chips">${(dados.cabecalho ?? [])
          .map((h) => `<span class="chip">${CW.escapar(h)}</span>`)
          .join("")}</div>`
      );
      painel.rodape([{ rotulo: "Ler de novo", aoClicar: abrirPainel }]);
      return;
    }

    const novas = (dados.linhas ?? []).filter((l) => l.estado === "nova");
    const semRede = (dados.linhas ?? []).filter((l) => l.estado === "sem-rede");

    painel.corpo(
      `${numeros(dados.contagem)}${colunas(dados)}` +
        (novas.length
          ? `<p class="rotulo">Novas${novas.length > 8 ? ` — as 8 primeiras de ${novas.length}` : ""}</p>${CW.linhasDaCaptura(novas.slice(0, 8))}`
          : `<p class="vazio">Nenhuma linha nova nesta aba: o que está aqui já foi registrado.</p>`) +
        (semRede.length
          ? `<p class="rotulo" style="margin-top:12px">Sem rede reconhecida — preencha a coluna Rede ou o link</p>${CW.linhasDaCaptura(semRede.slice(0, 3))}`
          : "")
    );

    painel.rodape([
      { rotulo: "Ler de novo", aoClicar: abrirPainel },
      {
        rotulo: novas.length ? `Gravar ${novas.length} ${novas.length === 1 ? "nova" : "novas"}` : "Nada para gravar",
        tom: "acao",
        empurra: true,
        desligado: novas.length === 0,
        aoClicar: async (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = "Gravando…";
          const r = await CW.enviar({ tipo: "capturaRedes", corpo: { ...corpoBase, acao: "gravar", apenas: novas.map((l) => l.chave) } });
          const g = r?.dados;
          if (!r?.ok || !g || g.erro) {
            painel.corpo(`<div class="recado erro">${CW.escapar(g?.erro ?? r?.erro ?? "Os atendimentos não foram gravados.")}</div>`);
            painel.rodape([{ rotulo: "Ler de novo", aoClicar: abrirPainel }]);
            return;
          }
          const criados = g.criados ?? [];
          painel.corpo(
            `<div class="recado ok">${criados.length} ${criados.length === 1 ? "atendimento criado" : "atendimentos criados"} nas Redes, em Recebido e a triar.${
              g.jaExistiam ? ` ${Number(g.jaExistiam)} já tinham sido gravados por outra pessoa.` : ""
            }</div>` +
              (criados.length
                ? `<ul>${criados
                    .slice(0, 12)
                    .map((c) => `<li><span class="meta">${CW.escapar(c.referencia)}</span> · <b>${CW.escapar(c.protocolo)}</b></li>`)
                    .join("")}</ul>`
                : "")
          );
          painel.rodape([
            { rotulo: "Ler de novo", aoClicar: abrirPainel },
            { rotulo: "Triar nas Redes", tom: "acao", empurra: true, aoClicar: () => CW.enviar({ tipo: "abrirNaPlataforma", caminho: "/redes-sociais" }) },
          ]);
        },
      },
    ]);
  }

  function montarLancador() {
    if (!idDaPlanilha() || document.getElementById(LANCADOR)) return;
    const host = document.createElement("div");
    host.id = LANCADOR;
    document.documentElement.appendChild(host);
    const raiz = host.attachShadow({ mode: "open" });
    raiz.innerHTML = `<style>
      :host { all: initial; }
      button { position: fixed; right: 16px; bottom: 16px; z-index: 2147482999; border: 1px solid #e4e4e7; background: #fff; color: #18181b;
        border-radius: 999px; padding: 6px 12px 6px 10px; font: 500 12px/1 "CW Geist", ui-sans-serif, system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 4px 14px -6px rgba(16,24,40,.25); display: flex; align-items: center; gap: 6px; }
      button:hover { border-color: #a1a1aa; }
      b { font: 600 10px/1 ui-monospace, monospace; letter-spacing: .06em; color: #71717a; }
      @media (prefers-color-scheme: dark) { button { background: #1e1f25; color: #f1f1f4; border-color: #31333c; } b { color: #8b8c96; } }
    </style><button type="button" title="Ler esta aba e registrar as linhas novas nas Redes Sociais do CW"><b>CW</b>Ler para as Redes</button>`;
    CW.registrarFonte?.();
    raiz.querySelector("button").addEventListener("click", abrirPainel);
  }

  montarLancador();
})();
