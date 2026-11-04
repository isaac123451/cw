/**
 * Caso rápido (04/11/2026).
 *
 * A ideia do Isaac: "estender o cw reputação pela extensão, uma forma de
 * abrir um caso de forma rápido pra atualizar". Alt+Shift+K em qualquer
 * site abre esta janela: digita o protocolo, o nome, o telefone ou o
 * CNPJ, escolhe com as setas e atualiza ali mesmo — mover de coluna,
 * anotar, deixar um lembrete para amanhã. Cada ação confirma só depois
 * que o servidor respondeu.
 */

const busca = document.getElementById("busca");
const resultados = document.getElementById("resultados");
const cartao = document.getElementById("cartao");
const dica = document.getElementById("dica");

const escapar = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const enviar = (mensagem) =>
  new Promise((resolver) => {
    chrome.runtime.sendMessage(mensagem, (resposta) => {
      const falha = chrome.runtime.lastError;
      resolver(falha ? { ok: false, erro: falha.message } : resposta);
    });
  });

const dataCurta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
};

/** O próximo dia útil (seg–sex) a partir de hoje, em Brasília. */
function amanhaUtil() {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${hoje}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/* "Não informado" é o que a carga grava quando o portal não traz o nome: não vira título. */
const SEM_NOME = /^(n[aã]o informado|consumidor)$/i;
const nomeDoCaso = (c) => [c.empresa, c.cliente].map((x) => String(x ?? "").trim()).find((x) => x && !SEM_NOME.test(x)) || "Cliente sem nome";

/* ---------- a busca ---------- */

let lista = [];
let escolhido = 0;
let pedido = 0;
let espera;

function desenharLista() {
  resultados.innerHTML = lista
    .map(
      (c, i) => `<li><button type="button" class="resultado" role="option" data-i="${i}" aria-selected="${i === escolhido}">
        <span class="linha1"><span class="proto">${escapar(c.protocolo)}</span><span class="fraco">${escapar(c.canal)}</span></span>
        <span class="fraco">${escapar(nomeDoCaso(c))} · ${escapar(c.status)}${c.encerrado ? " · encerrado" : ""}</span>
      </button></li>`
    )
    .join("");
}

async function buscar(termo) {
  const meu = ++pedido;
  if (termo.trim().length < 2) {
    lista = [];
    desenharLista();
    return;
  }
  const r = await enviar({ tipo: "casoRapido", q: termo.trim() });
  if (meu !== pedido) return;
  if (!r?.ok) {
    resultados.innerHTML = `<li class="aviso erro">${escapar(r?.erro ?? "Não deu para buscar agora.")}</li>`;
    return;
  }
  lista = r.dados?.casos ?? [];
  escolhido = 0;
  if (!lista.length) {
    resultados.innerHTML = `<li class="fraco" style="padding:8px 10px">Nenhum caso com "${escapar(termo.trim())}".</li>`;
    return;
  }
  desenharLista();
}

busca.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(() => buscar(busca.value), 220);
});

busca.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" && lista.length) {
    escolhido = Math.min(lista.length - 1, escolhido + 1);
    desenharLista();
    e.preventDefault();
  } else if (e.key === "ArrowUp" && lista.length) {
    escolhido = Math.max(0, escolhido - 1);
    desenharLista();
    e.preventDefault();
  } else if (e.key === "Enter" && lista[escolhido]) {
    abrir(lista[escolhido].protocolo);
    e.preventDefault();
  }
});

resultados.addEventListener("click", (e) => {
  const botao = e.target.closest("[data-i]");
  if (botao) abrir(lista[Number(botao.dataset.i)].protocolo);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.close();
});

/* ---------- o cartão do caso ---------- */

let atual = null;

async function abrir(protocolo) {
  cartao.innerHTML = `<div class="cartao fraco">Abrindo ${escapar(protocolo)}…</div>`;
  resultados.innerHTML = "";
  dica.hidden = true;
  const r = await enviar({ tipo: "casoRapido", protocolo });
  if (!r?.ok) {
    cartao.innerHTML = `<div class="cartao aviso erro">${escapar(r?.erro ?? "Não deu para abrir o caso.")}</div>`;
    return;
  }
  atual = r.dados;
  desenharCartao();
}

function desenharCartao(aviso) {
  const c = atual;
  const classePrazo = c.prazoSituacao === "vencido" || c.prazoSituacao === "estourado" ? "vencido" : c.prazoSituacao === "atencao" ? "atencao" : "";
  const colunas = (c.etapas ?? [])
    .map((e) => `<option value="${escapar(e)}" ${e === c.status ? "selected" : ""}>${escapar(e)}</option>`)
    .join("");
  cartao.innerHTML = `
    <div class="cartao">
      <div class="fraco">${escapar(c.protocolo)} · ${escapar(c.canal)}${c.responsavel ? ` · ${escapar(c.responsavel)}` : ""}</div>
      <h2>${escapar(nomeDoCaso(c))}</h2>
      <div class="fraco">${escapar(c.titulo)}</div>
      <div style="margin-top:8px">
        <span class="etiqueta">${escapar(c.status)}</span>
        ${c.prazo ? `<span class="etiqueta ${classePrazo}">${escapar(c.prazo)}</span>` : ""}
      </div>

      ${
        colunas
          ? `<div class="bloco"><div class="rotulo">Coluna</div>
             <div class="acoes"><select id="coluna" class="campo" style="flex:1">${colunas}</select>
             <button type="button" class="botao" id="mover">Mover</button></div></div>`
          : ""
      }

      <div class="bloco">
        <div class="rotulo">Anotar</div>
        <textarea id="texto" class="campo" placeholder="O que aconteceu, o que ficou combinado"></textarea>
        <div class="acoes">
          <button type="button" class="botao primario" id="anotar">Anotar</button>
          <button type="button" class="botao" id="lembrar" title="Cria uma atividade para o próximo dia útil com este texto">Lembrar amanhã</button>
        </div>
      </div>

      ${
        c.ultimaAnotacao
          ? `<div class="bloco"><div class="rotulo">Última anotação · ${escapar(dataCurta(c.ultimaAnotacao.em))}${c.ultimaAnotacao.por ? ` · ${escapar(c.ultimaAnotacao.por)}` : ""}</div>
             <div class="nota">${escapar(c.ultimaAnotacao.texto)}</div></div>`
          : ""
      }

      <div class="bloco acoes" style="justify-content:space-between">
        <button type="button" class="botao" id="voltar">← Outro caso</button>
        <a href="${escapar(c.link)}" target="_blank" rel="noreferrer" class="botao" style="text-decoration:none">Abrir na plataforma</a>
      </div>
      <div id="aviso" class="aviso ${aviso?.tipo ?? ""}" role="status">${escapar(aviso?.texto ?? "")}</div>
    </div>`;

  document.getElementById("voltar").onclick = () => {
    atual = null;
    cartao.innerHTML = "";
    dica.hidden = false;
    busca.focus();
    buscar(busca.value);
  };
  document.getElementById("mover")?.addEventListener("click", mover);
  document.getElementById("anotar").onclick = () => anotar(false);
  document.getElementById("lembrar").onclick = () => anotar(true);
  document.getElementById("texto").focus();
}

function avisar(texto, tipo) {
  const el = document.getElementById("aviso");
  if (!el) return;
  el.className = `aviso ${tipo}`;
  el.textContent = texto;
}

function travar(sim) {
  for (const id of ["mover", "anotar", "lembrar"]) {
    const b = document.getElementById(id);
    if (b) b.disabled = sim;
  }
}

async function mover() {
  const para = document.getElementById("coluna").value;
  if (!para || para === atual.status) {
    avisar(`Já está em "${atual.status}".`, "");
    return;
  }
  travar(true);
  const r = await enviar({ tipo: "moverCaso", protocolo: atual.protocolo, para });
  travar(false);
  if (!r?.ok || r.dados?.erro) {
    avisar(r?.dados?.erro ?? r?.erro ?? "Não foi movido.", "erro");
    return;
  }
  if (r.dados?.movido === false) {
    avisar(r.dados.aviso ?? "Nada mudou.", "");
    return;
  }
  atual.status = r.dados?.status ?? para;
  desenharCartao({ texto: `Movido para "${atual.status}".`, tipo: "ok" });
}

async function anotar(lembrete) {
  const campo = document.getElementById("texto");
  const texto = campo.value.trim();
  if (!texto) {
    avisar(lembrete ? "Escreva o que lembrar." : "Escreva a anotação.", "erro");
    campo.focus();
    return;
  }
  travar(true);
  const anotacao = lembrete
    ? { tipo: "agenda", titulo: `${atual.protocolo}: ${texto}`.slice(0, 220), quando: amanhaUtil(), protocolo: atual.protocolo }
    : { tipo: "caso", protocolo: atual.protocolo, texto };
  const r = await enviar({ tipo: "anotar", anotacao });
  travar(false);
  if (!r?.ok || r.dados?.erro) {
    avisar(r?.dados?.erro ?? r?.erro ?? "Não foi gravado.", "erro");
    return;
  }
  if (!lembrete) atual.ultimaAnotacao = { texto, em: new Date().toISOString(), por: "você" };
  desenharCartao({ texto: lembrete ? `Lembrete criado para ${amanhaUtil().split("-").reverse().slice(0, 2).join("/")}.` : "Anotado no caso.", tipo: "ok" });
}

/* O tema da extensão antes de pintar, como no popup. */
(async () => {
  const config = await enviar({ tipo: "config" });
  document.documentElement.dataset.tema = config?.ok && config.dados?.tema ? config.dados.tema : "auto";
})();
