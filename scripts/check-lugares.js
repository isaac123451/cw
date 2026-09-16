/**
 * Prova os leitores dos lugares novos da extensão (Fase 8.1).
 *
 * Portal Cardápio Web, Crisp e Google Perfil da Empresa. Cada um lê
 * página alheia, e página alheia muda — mas a parte que **decide** não
 * depende de DOM nenhum: é texto entrando e valor saindo. É essa parte
 * que este script exercita, do mesmo jeito que o `check:ra` exercita os
 * leitores do Reclame Aqui.
 *
 * Por que importa: um leitor de data que erra não deixa a tela em
 * branco — ele grava a avaliação com a data errada e ninguém percebe.
 * O painel mostra o que vai gravar antes de gravar justamente por isso,
 * e aqui está a rede embaixo.
 *
 *   node scripts/check-lugares.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");

/** Um `document` de mentira: os laços dos detectores não devem rodar. */
function janelaDeMentira() {
  const vazio = {
    querySelectorAll: () => [],
    querySelector: () => null,
    getAttribute: () => null,
    innerText: "",
  };

  return {
    window: { CWReputacao: null },
    document: { ...vazio, body: { innerText: "" }, createElement: () => ({ style: {}, append() {}, addEventListener() {} }) },
    location: { href: "https://exemplo.invalido/" },
    setInterval: () => 0,
    clearTimeout: () => {},
    setTimeout: () => 0,
    console: { warn() {}, error() {} },
    URL,
    Date,
    Number,
    Math,
    Boolean,
    String,
    Array,
    Set,
    RegExp,
  };
}

function carregar(arquivos) {
  const contexto = janelaDeMentira();
  vm.createContext(contexto);

  for (const arquivo of arquivos) {
    vm.runInContext(
      fs.readFileSync(path.join(RAIZ, "extensao", "conteudo", arquivo), "utf8"),
      contexto,
      { filename: arquivo }
    );
  }

  return contexto.window.CWReputacao;
}

let falhas = 0;

function conferir(titulo, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas += 1;
  console.log(
    ok
      ? `  ok    ${titulo}`
      : `  FALHA ${titulo}\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`
  );
}

console.log("\n  LUGARES NOVOS DA EXTENSÃO\n");

/* ============================================================
   PORTAL CARDÁPIO WEB
============================================================ */

{
  /*
    O painel precisa do `nucleo.js` (é dele que vem `INVISIVEIS`), e o
    `portal-cw.js` desiste sem `CW.painel` — então o painel entra como
    um de mentira, com só o que o detector chama.
  */
  const CW = carregar(["nucleo.js"]);
  CW.painel = { montar() {}, garantir() {}, definirContexto() {}, definirCaptura() {} };

  const contexto = { ...janelaDeMentira(), window: { CWReputacao: CW } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(RAIZ, "extensao/conteudo/portal-cw.js"), "utf8"),
    contexto,
    { filename: "portal-cw.js" }
  );

  const portal = CW.portal;

  console.log("— Portal Cardápio Web: o documento —");

  conferir(
    "CNPJ com máscara",
    portal.documentoDoTexto("Loja do Zé\nCNPJ: 12.345.678/0001-99\nPlano Premium"),
    "12345678000199"
  );

  conferir(
    "CNPJ sem máscara",
    portal.documentoDoTexto("Documento 12345678000199 — ativo"),
    "12345678000199"
  );

  conferir(
    "CPF quando não há CNPJ",
    portal.documentoDoTexto("Responsável\nCPF: 123.456.789-00"),
    "12345678900"
  );

  /*
    O caso que motivou as âncoras: um CPF casa **dentro** de um CNPJ de
    catorze dígitos seguidos. Se o CPF ganhasse, o painel perguntaria
    por um documento que não existe — e não acharia nada.
  */
  conferir(
    "CNPJ ganha do CPF que mora dentro dele",
    portal.documentoDoTexto("12345678000199"),
    "12345678000199"
  );

  conferir("tela sem documento", portal.documentoDoTexto("Painel inicial\nRelatórios"), "");

  conferir(
    "número de pedido não vira documento",
    portal.documentoDoTexto("Pedido #4821 — R$ 89,90"),
    ""
  );
}

/* ============================================================
   CRISP
============================================================ */

{
  const CW = carregar(["nucleo.js"]);
  CW.painel = {
    montar() {},
    garantir() {},
    definirContexto() {},
    definirCaptura() {},
    definirLeitorDeConversa() {},
  };

  const contexto = { ...janelaDeMentira(), window: { CWReputacao: CW } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(RAIZ, "extensao/conteudo/crisp.js"), "utf8"),
    contexto,
    { filename: "crisp.js" }
  );

  const crisp = CW.crisp;

  console.log("\n— Crisp: de quem é a mensagem —");

  conferir("atributo do operador", crisp.ladoDaMarca("operator", ""), "nos");
  conferir("atributo do visitante", crisp.ladoDaMarca("user", ""), "cliente");
  conferir("classe do operador", crisp.ladoDaMarca("", "message message--right is-operator"), "nos");
  conferir("classe do visitante", crisp.ladoDaMarca("", "message message--left"), "cliente");

  /*
    "user-agent" numa classe não faz a mensagem ser do cliente — mas
    "operator" tem de ganhar antes de chegar nesse teste, senão uma
    bolha nossa é guardada como sendo dele. Numa conversa usada como
    evidência, trocar os lados é o pior erro possível.
  */
  conferir(
    "operator ganha de user-agent na mesma classe",
    crisp.ladoDaMarca("", "message is-operator user-agent-chrome"),
    "nos"
  );

  conferir("sem pista nenhuma: cliente", crisp.ladoDaMarca("", "bolha"), "cliente");

  console.log("\n— Crisp: o carimbo em Brasília —");

  /*
    14/09/2026 13:32 UTC é 10:32 em Brasília. A conversão sai com
    `timeZone` explícito de propósito: com o relógio da máquina, a mesma
    conversa guardada de outro fuso entraria com as horas deslocadas.
  */
  conferir("ISO em UTC vira hora de Brasília", crisp.carimboDoBruto("2026-09-14T13:32:00Z"), "14/09/2026, 10:32");
  conferir("época em milissegundos", crisp.carimboDoBruto(String(Date.UTC(2026, 8, 14, 13, 32))), "14/09/2026, 10:32");
  conferir("já escrito passa direto", crisp.carimboDoBruto("14/09/2026 10:32"), "14/09/2026 10:32");
  conferir("sem carimbo", crisp.carimboDoBruto(""), "");
  conferir("texto que não é data", crisp.carimboDoBruto("enviada"), "");
}

/* ============================================================
   GOOGLE PERFIL DA EMPRESA
============================================================ */

{
  const CW = carregar(["nucleo.js"]);

  const contexto = { ...janelaDeMentira(), window: { CWReputacao: CW } };
  vm.createContext(contexto);
  vm.runInContext(
    fs.readFileSync(path.join(RAIZ, "extensao/conteudo/google-perfil.js"), "utf8"),
    contexto,
    { filename: "google-perfil.js" }
  );

  const google = CW.google;

  console.log("\n— Google: a nota —");

  conferir("'4 estrelas'", google.estrelasDoRotulo("4 estrelas"), 4);
  conferir("'Classificado como 5 de 5'", google.estrelasDoRotulo("Classificado como 5 de 5"), 5);
  conferir("'Rated 1.0 out of 5'", google.estrelasDoRotulo("Rated 1.0 out of 5"), 1);
  conferir("rótulo que não é nota", google.estrelasDoRotulo("Compartilhar"), 0);
  conferir("nota fora da faixa não passa", google.estrelasDoRotulo("9 estrelas"), 0);

  console.log("\n— Google: quem avaliou —");

  conferir("'Foto do perfil de Maria Silva'", google.nomeDoAlt("Foto do perfil de Maria Silva"), "Maria Silva");
  conferir("'Profile photo of John Doe'", google.nomeDoAlt("Profile photo of John Doe"), "John Doe");
  conferir("nome sem prefixo", google.nomeDoAlt("Ana Paula"), "Ana Paula");

  console.log("\n— Google: quando foi publicada —");

  const dia = 86400000;
  const emSP = (quando) => new Date(quando).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  conferir("data escrita ganha de tudo", google.dataDoTexto("Maria Silva\n13/09/2026\nótimo atendimento"), "2026-09-13");
  conferir("'há 2 dias'", google.dataDoTexto("Maria Silva\nhá 2 dias"), emSP(Date.now() - 2 * dia));
  conferir("'há uma semana'", google.dataDoTexto("há uma semana"), emSP(Date.now() - 7 * dia));
  conferir("'há um mês' vale 30 dias", google.dataDoTexto("há um mês"), emSP(Date.now() - 30 * dia));
  conferir("'3 anos atrás'", google.dataDoTexto("3 anos atrás"), emSP(Date.now() - 3 * 365 * dia));
  conferir("'há 5 horas' é hoje", google.dataDoTexto("há 5 horas"), emSP(Date.now()));
  conferir("sem pista nenhuma: hoje", google.dataDoTexto("Maria Silva\nótimo atendimento"), emSP(Date.now()));
}

console.log(
  falhas === 0
    ? "\n  Os três leitores decidem certo.\n"
    : `\n  ${falhas} leitura(s) erradas.\n`
);

process.exit(falhas === 0 ? 0 : 1);
