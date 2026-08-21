/**
 * O popup do ícone.
 *
 * Responde a pergunta que não depende de estar em nenhum site: "como
 * está a operação agora?". Reaproveita a mesma `buildNotifications()`
 * do sino da aplicação, pelo endpoint `/api/extensao/resumo`.
 *
 * Traz também uma busca — é o atalho "telefone → histórico" previsto
 * em `EXTENSAO.md` para o ManyChat, que aqui funciona em qualquer aba,
 * inclusive no meio de uma ligação.
 */

const conteudo = document.getElementById("conteudo");
const quem = document.getElementById("quem");

let base = "";

const escapar = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const enviar = (mensagem) =>
  new Promise((resolver) => {
    chrome.runtime.sendMessage(mensagem, (resposta) => {

      const falha = chrome.runtime.lastError;

      resolver(
        falha
          ? { ok: false, codigo: "extensao", erro: falha.message }
          : resposta
      );
    });
  });

function abrir(url) {
  if (url) chrome.tabs.create({ url });
}

/* ============================================================
   RESUMO
============================================================ */

async function carregar() {

  conteudo.innerHTML = `<div class="estado">Consultando…</div>`;

  const resposta = await enviar({ tipo: "resumo" });

  if (!resposta.ok) {
    falhar(resposta);
    return;
  }

  const dados = resposta.dados;

  base = dados.aplicacao ?? "";

  quem.textContent = dados.usuario
    ? `${dados.usuario.nome} · ${dados.usuario.papel.toLowerCase()}`
    : dados.demonstracao
      ? "modo demonstração"
      : "conectado";

  const rep = dados.reputacao;

  const partes = [];

  partes.push(`
    <div class="bloco">
      <p class="rotulo">Nota do Reclame Aqui</p>
      <div class="nota">
        <b>${rep.indisponivel ? "—" : escapar(rep.nota)}</b>
        <span>
          <span class="faixa">${escapar(rep.faixa)}</span><br />
          <span class="janela">${escapar(rep.inicio)} a ${escapar(
            rep.fim
          )}</span>
        </span>
        ${rep.ra1000 ? `<span class="selo-ra">RA1000</span>` : ""}
      </div>
    </div>

    <div class="bloco">
      <div class="numeros">
        <div class="numero"><b>${dados.contagens.abertos}</b><span>abertos</span></div>
        <div class="numero"><b>${dados.contagens.semResposta}</b><span>s/ resposta</span></div>
        <div class="numero"><b>${dados.contagens.replicas}</b><span>réplicas</span></div>
        <div class="numero"><b>${dados.contagens.risco}</b><span>risco</span></div>
      </div>
    </div>`);

  if (dados.alertas.length > 0) {
    partes.push(`
      <div class="bloco">
        <p class="rotulo">Alertas</p>
        ${dados.alertas
          .map(
            (item) => `
          <div class="alerta ${item.tom}" data-url="${escapar(
            item.url
          )}">
            <span class="tom"></span>
            <span>
              <span class="titulo">${escapar(item.titulo)}</span><br />
              <span class="detalhe">${escapar(item.detalhe)}</span>
            </span>
          </div>`
          )
          .join("")}
      </div>`);
  }

  partes.push(`
    <div class="bloco">
      <p class="rotulo">Buscar cliente</p>
      <div class="busca">
        <input id="termo" type="text"
               placeholder="Telefone, nome ou protocolo"
               spellcheck="false" />
        <button id="buscar" type="button">Buscar</button>
      </div>
      <div id="resultado"></div>
    </div>`);

  conteudo.innerHTML = partes.join("");

  for (const alerta of conteudo.querySelectorAll(".alerta")) {
    alerta.addEventListener("click", () =>
      abrir(alerta.dataset.url)
    );
  }

  const campo = document.getElementById("termo");

  document
    .getElementById("buscar")
    .addEventListener("click", () => buscar(campo.value));

  campo.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") buscar(campo.value);
  });

  campo.focus();
}

function falhar(resposta) {

  quem.textContent = "não conectado";

  const acoes = {
    "sem-endereco": "Configurar endereço",
    "sem-permissao": "Conceder permissão",
  };

  const rotulo = acoes[resposta.codigo];

  conteudo.innerHTML = `
    <div class="estado">
      <b>Não deu para consultar</b>
      ${escapar(resposta.erro ?? "Falha desconhecida.")}
      <br /><br />
      ${
        rotulo
          ? `<button class="acao" id="ir-opcoes" type="button">${rotulo}</button>`
          : resposta.codigo === "sessao"
            ? `<button class="acao" id="ir-login" type="button">Entrar no CW Reputação</button>`
            : `<button class="acao" id="tentar" type="button">Tentar de novo</button>`
      }
    </div>`;

  document
    .getElementById("ir-opcoes")
    ?.addEventListener("click", () =>
      chrome.runtime.openOptionsPage()
    );

  document
    .getElementById("ir-login")
    ?.addEventListener("click", () =>
      abrir(`${resposta.base ?? ""}/login`)
    );

  document
    .getElementById("tentar")
    ?.addEventListener("click", carregar);
}

/* ============================================================
   BUSCA
============================================================ */

async function buscar(termo) {

  const alvo = document.getElementById("resultado");

  const limpo = String(termo ?? "").trim();

  if (limpo === "") return;

  alvo.innerHTML = `<div class="resultado">Procurando…</div>`;

  const resposta = await enviar({
    tipo: "contexto",
    consulta: { termo: limpo },
    forcar: true,
  });

  if (!resposta.ok) {
    alvo.innerHTML = `<div class="resultado">${escapar(
      resposta.erro
    )}</div>`;
    return;
  }

  const dados = resposta.dados;

  if (!dados.cliente) {
    alvo.innerHTML = `<div class="resultado">Nada encontrado para "${escapar(
      limpo
    )}".</div>`;
    return;
  }

  const cliente = dados.cliente;

  alvo.innerHTML = `
    <div class="resultado">
      <div class="titulo-caso">${escapar(cliente.nome)}</div>
      <div class="sub">
        ${cliente.total} caso(s) · ${cliente.abertos} aberto(s) ·
        ${escapar(dados.porQue ?? "")}
      </div>
      ${dados.casos
        .slice(0, 4)
        .map(
          (caso) => `
        <div class="caso" data-url="${escapar(caso.url)}">
          <div class="titulo-caso">${escapar(caso.titulo)}</div>
          <div class="sub">${escapar(caso.protocolo)} · ${escapar(
            caso.status
          )}</div>
        </div>`
        )
        .join("")}
    </div>`;

  for (const caso of alvo.querySelectorAll(".caso")) {
    caso.addEventListener("click", () =>
      abrir(caso.dataset.url)
    );
  }
}

/* ============================================================
   LIGAÇÕES FIXAS
============================================================ */

document
  .getElementById("atualizar")
  .addEventListener("click", carregar);

document
  .getElementById("abrir-app")
  .addEventListener("click", async () => {

    if (!base) {
      const config = await enviar({ tipo: "config" });
      base = config.ok ? config.dados.base : "";
    }

    abrir(base ? `${base}/dashboard` : "");
  });

document
  .getElementById("abrir-opcoes")
  .addEventListener("click", () =>
    chrome.runtime.openOptionsPage()
  );

/**
 * Tema antes da carga.
 *
 * O popup abre e fecha em um piscar; esperar a resposta do resumo para
 * então pintar produziria um lampejo branco em quem usa tema escuro.
 * Por isso o tema vem primeiro, do storage, e o conteúdo depois.
 */
(async () => {

  const config = await enviar({ tipo: "config" });

  document.documentElement.dataset.tema =
    config.ok && config.dados?.tema
      ? config.dados.tema
      : "auto";

  carregar();
})();
