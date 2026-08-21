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
   TENDÊNCIA
============================================================ */

const LARGURA = 300;
const ALTURA = 54;
const MARGEM = 4;

/**
 * A nota mês a mês, em SVG pequeno.
 *
 * **Por que a escala tem piso.** A nota do Reclame Aqui varia pouco —
 * doze meses entre 8,3 e 8,6 é o normal. Ajustar o eixo exatamente ao
 * mínimo e ao máximo transformaria 0,3 de variação numa montanha, e
 * quem olhasse de relance leria uma queda que não existe. O piso de
 * meio ponto mantém a proporção honesta, e os dois extremos aparecem
 * escritos embaixo para não restar dúvida do alcance.
 *
 * A linha tracejada é o 8,0 — a nota mínima do selo RA1000 —, desenhada
 * só quando cai dentro da faixa visível.
 */
function tendencia(serie) {

  if (serie.length < 2) return "";

  const notas = serie.map((p) => p.nota);

  const menor = Math.min(...notas);
  const maior = Math.max(...notas);

  const meio = (menor + maior) / 2;
  const alcance = Math.max(maior - menor, 0.5);

  const base = meio - alcance / 2;
  const topo = meio + alcance / 2;

  const x = (i) =>
    MARGEM +
    (i * (LARGURA - MARGEM * 2)) / (serie.length - 1);

  const y = (v) =>
    ALTURA -
    MARGEM -
    ((v - base) / (topo - base)) * (ALTURA - MARGEM * 2);

  const pontos = serie
    .map((p, i) => `${x(i).toFixed(1)},${y(p.nota).toFixed(1)}`)
    .join(" ");

  const area = `${MARGEM},${ALTURA - MARGEM} ${pontos} ${(
    LARGURA - MARGEM
  ).toFixed(1)},${ALTURA - MARGEM}`;

  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];

  const variacao = ultimo.nota - anterior.nota;

  const tom =
    variacao > 0.049
      ? "sobe"
      : variacao < -0.049
        ? "desce"
        : "igual";

  const sinal =
    tom === "sobe" ? "▲" : tom === "desce" ? "▼" : "•";

  const meta =
    8 > base && 8 < topo
      ? `<line x1="${MARGEM}" y1="${y(8).toFixed(1)}" x2="${LARGURA - MARGEM}" y2="${y(8).toFixed(1)}" stroke="var(--fraco)" stroke-width="1" stroke-dasharray="3 3" opacity=".5" />`
      : "";

  return `
    <div class="bloco">
      <p class="rotulo">Nota mês a mês</p>
      <div class="grafico">

        <div class="topo">
          <span>
            <span class="valor">${ultimo.nota.toFixed(1).replace(".", ",")}</span>
            <span class="mes">em ${escapar(ultimo.rotulo)} · ${ultimo.recebidas} reclamação(ões)</span>
          </span>
          <span class="delta ${tom}">
            ${sinal} ${Math.abs(variacao).toFixed(1).replace(".", ",")}
          </span>
        </div>

        <svg viewBox="0 0 ${LARGURA} ${ALTURA}"
             preserveAspectRatio="none" aria-hidden="true">
          <polygon points="${area}" fill="var(--violeta)" opacity=".12" />
          ${meta}
          <polyline points="${pontos}" fill="none"
                    stroke="var(--violeta)" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="${x(serie.length - 1).toFixed(1)}"
                  cy="${y(ultimo.nota).toFixed(1)}" r="3"
                  fill="var(--violeta)" />
        </svg>

        <div class="eixo">
          <span>${escapar(serie[0].rotulo)}</span>
          <span>${menor.toFixed(1).replace(".", ",")} – ${maior
            .toFixed(1)
            .replace(".", ",")}</span>
          <span>${escapar(ultimo.rotulo)}</span>
        </div>

      </div>
    </div>`;
}

/* ============================================================
   NPS
============================================================ */

/**
 * O NPS dos últimos 30 dias.
 *
 * A barra mostra a composição, e não só a nota: −100 a 100 é um número
 * difícil de sentir, e "12 detratores em 190" diz na hora se a queda
 * veio de muita gente insatisfeita ou de pouca gente respondendo.
 *
 * Os números vêm prontos do servidor, de `summarize` — a mesma função
 * da tela do `/nps`. Refazer a conta aqui seria a segunda conta em
 * paralelo, que é como duas telas passam a discordar.
 */
function blocoNps(nps) {

  if (!nps || nps.total === 0) return "";

  const fatia = (n) => (n / nps.total) * 100;

  return `
    <div class="bloco">
      <p class="rotulo">NPS · últimos 30 dias</p>
      <div class="nps" data-url="${escapar(base)}/nps">

        <div class="linha">
          <span class="valor">${nps.nota}</span>
          <span class="sub">
            média ${String(nps.media).replace(".", ",")} ·
            ${nps.total} resposta(s)
          </span>
          <span class="lado">
            ${nps.abertos} em aberto<br />
            ${
              nps.estourados > 0
                ? `<b style="color:var(--perigo)">${nps.estourados} fora do prazo</b>`
                : "nenhum fora do prazo"
            }
          </span>
        </div>

        <div class="barra">
          <span class="det" style="width:${fatia(nps.detratores)}%"></span>
          <span class="pas" style="width:${fatia(nps.passivos)}%"></span>
          <span class="pro" style="width:${fatia(nps.promotores)}%"></span>
        </div>

        <div class="legenda">
          <span>${nps.detratores} detrator(es)</span>
          <span>${nps.passivos} passivo(s)</span>
          <span>${nps.promotores} promotor(es)</span>
        </div>

      </div>
    </div>`;
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

  partes.push(tendencia(dados.tendencia ?? []));
  partes.push(blocoNps(dados.nps));

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

  // O bloco de NPS abre a tela da tratativa, que é onde se encerra.
  conteudo
    .querySelector(".nps")
    ?.addEventListener("click", function () {
      abrir(this.dataset.url);
    });

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
