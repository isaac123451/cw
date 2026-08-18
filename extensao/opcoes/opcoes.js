import {
  gravarConfig,
  lerConfig,
  normalizarBase,
  padraoDeOrigem,
} from "../comum/config.js";

/**
 * Tela de opções.
 *
 * O passo que não dá para pular é a permissão de origem: o endereço de
 * produção não pode estar no manifesto (varia por instalação), então
 * entra como permissão opcional e precisa ser concedida por você, num
 * clique. Sem ela, `chrome.cookies` não lê a sessão e o `fetch` não
 * atravessa — a extensão fica muda.
 */

const campoBase = document.getElementById("base");
const aviso = document.getElementById("aviso");

const caixas = {
  autoAbrir: document.getElementById("autoAbrir"),
  contador: document.getElementById("contador"),
  aviso: document.getElementById("aviso-diario"),
};

function mostrar(texto, tipo = "ok") {
  aviso.textContent = texto;
  aviso.className = `aviso mostrar ${tipo}`;
}

async function carregar() {

  const config = await lerConfig();

  campoBase.value = config.base ?? "";

  caixas.autoAbrir.checked = Boolean(config.autoAbrir);
  caixas.contador.checked = Boolean(config.contador);
  caixas.aviso.checked = Boolean(config.aviso);
}

for (const [chave, caixa] of Object.entries(caixas)) {
  caixa.addEventListener("change", async () => {
    await gravarConfig({ [chave]: caixa.checked });
    mostrar("Preferência salva.", "ok");
  });
}

document
  .getElementById("salvar")
  .addEventListener("click", async () => {

    const base = normalizarBase(campoBase.value);

    if (!base) {
      mostrar(
        "Endereço inválido. Use algo como https://cw-reputacao.vercel.app",
        "erro"
      );
      return;
    }

    campoBase.value = base;

    const origem = padraoDeOrigem(base);

    /**
     * `chrome.permissions.request` só funciona a partir de um clique —
     * daí ela viver aqui dentro, e não no `salvar` automático das
     * caixas de seleção.
     */
    const concedida = await chrome.permissions.request({
      origins: [origem],
    });

    if (!concedida) {
      mostrar(
        "Sem a permissão a extensão não consegue ler sua sessão nem consultar a aplicação.",
        "erro"
      );
      return;
    }

    await gravarConfig({ base });

    await testar();
  });

document
  .getElementById("testar")
  .addEventListener("click", () => testar());

async function testar() {

  mostrar("Testando…", "ok");

  const resposta = await new Promise((resolver) => {
    chrome.runtime.sendMessage(
      { tipo: "sessao" },
      (r) => {
        const falha = chrome.runtime.lastError;
        resolver(
          falha
            ? { ok: false, erro: falha.message }
            : r
        );
      }
    );
  });

  if (!resposta?.ok) {
    mostrar(
      resposta?.erro ?? "Falha desconhecida.",
      "erro"
    );
    return;
  }

  const dados = resposta.dados;

  if (dados.usuario) {
    mostrar(
      `Conectado como ${dados.usuario.nome} (${dados.usuario.papel}).`,
      "ok"
    );
    return;
  }

  if (dados.demonstracao) {
    mostrar(
      "Conectado, mas a aplicação está em modo demonstração (sem banco). Os dados são os de exemplo.",
      "ok"
    );
    return;
  }

  mostrar(
    "A aplicação respondeu, mas você não está logado nela. Abra o CW Reputação neste navegador e entre com sua conta.",
    "erro"
  );
}

carregar();
