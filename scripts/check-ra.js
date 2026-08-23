/**
 * Prova os leitores da página do Reclame Aqui.
 *
 * `extensao/conteudo/ra-campos.js` transforma o texto da página em
 * campos. Este script roda todos eles contra o texto de uma reclamação
 * real e confere campo a campo — é o teste que a primeira versão da
 * extensão não tinha, e por isso três dos seis leitores estavam errados
 * até alguém abrir uma reclamação de verdade.
 *
 * **O texto abaixo tem a estrutura da página real e os dados trocados.**
 * Rótulos, ordem das linhas, ano de dois dígitos, o "Nome social" acima
 * do nome, o CNPJ de catorze dígitos seguidos: tudo idêntico, porque é
 * disso que os leitores dependem. Nome, CPF, e-mail, telefone e CNPJ são
 * inventados — este arquivo está no git, e a página traz consumidor de
 * verdade.
 *
 *   node scripts/check-ra.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ARQUIVO = path.join(
  __dirname,
  "..",
  "extensao",
  "conteudo",
  "ra-campos.js"
);

/**
 * Como o `innerText` entrega a página da reclamação.
 *
 * As primeiras linhas são o **cromo da própria ferramenta** — menu,
 * caminho e o título da tela. Elas estão aqui de propósito: o `<h1>`
 * desta página é "Responder reclamação", e foi ele que a primeira
 * versão mandou para a prévia como se fosse o título da reclamação.
 */
const PAGINA = [
  "Cardápio Web",
  "Plano Premium",
  "Painel inicial",
  "ATENDIMENTO",
  "Reclamações",
  "Área da Empresa",
  "Reclamações",
  "Responder reclamação",
  "Voltar",
  "Responder reclamação",
  "Seu consumidor comunicou uma insatisfação. Confira o histórico desse atendimento e utilize o espaço para dar prosseguimento à solução.",
  "Não respondida",
  "Cardápio Web: Bot do WhatsApp ineficaz e falta de retorno do suporte sobre problemas no pixel e configuração da loja.",
  "COD: uPDvBFKmssmEmxVa",
  "ID: 256949163",
  "Campo Bom",
  "20/08/26 às 11h21",
  "Telefones do consumidor informados na reclamação:",
  "51 90000-0000",
  "Marina Ferreira Lopes",
  "Nome social",
  "Nome de registro: Marina Ferreira Lopes Silva",
  "CPF: 000.000.000-00",
  "Contatos do cadastro do consumidor:",
  "E-mail: marina.lopes@exemplo.com",
  "51 90000-0000",
  "51 90000-0000",
  "Essa reclamação tem informações adicionais coletadas.",
  "Recolher",
  "Informações adicionais",
  "Qual a sua relação com a Cardápio Web?: Sou Cliente Cardápio Web (Dono de estabelecimento/ restaurante)",
  "Qual é o CPF ou CNPJ de cadastro no portal?: 12345678000199",
  "Qual é o e-mail utilizado para acessar o portal?: contato@exemplo-loja.com",
  "Qual é o nome do proprietário cadastrado no portal?: Marina Ferreira Lopes",
  "Já entrou em contato com nosso Suporte sobre seu problema/reclamação?: Sim, mas não tive resolução.",
  "Como podemos entrar em contato com você?: Ligação Telefônica",
  "A reclamação",
  "20/08/26 às 11h21",
  "Estou tentando contato com a cardápio web, o bot whatsapp é todo errado, responde mal os clientes, respostas sem nexo, estou com problemas no pixel e o suporte nao me responde e nao da retorno, no primeiro dia terminaram de configurar a minha loja e nao tinham nem colocado opcoes de pagamento e nem raio de entrega, estou decepcionado até o momento, o pior é que nem o suporte me responde!",
  "Reações",
  "0 concordam",
  "0 também passaram por isso",
  "0 acharam revoltante",
  "Imagens e documentos anexados:",
  "Arquivo_1.png",
].join("\n");

/**
 * A mesma página, com o que vem **depois** da reclamação.
 *
 * O portal não termina no anexo: embaixo há ajuda, dúvidas frequentes e
 * reclamações parecidas. Isso não estava neste arquivo, e por isso o
 * defeito passou — `ra.relato` seguia até o fim do documento e a prévia
 * de importação chegava com o FAQ colado no fim do relato.
 *
 * Os dois blocos abaixo cobrem as duas travas: o primeiro tem um título
 * que a lista de seções conhece; o segundo, um que ela **não** conhece,
 * para provar que a regra de forma ("título é curto e não termina em
 * ponto") segura sozinha quando o portal renomear a seção.
 */
const COM_RODAPE = [
  PAGINA,
  "Dúvidas frequentes",
  "Como responder uma reclamação?",
  "Você tem até 10 dias para responder.",
  "O que é o índice de solução?",
  "É a proporção de reclamações resolvidas.",
  "Reclamações parecidas",
  "Bot do WhatsApp não funciona",
  "Problema com pixel de rastreamento",
].join("\n");

/** O mesmo rodapé, com um título que a lista não conhece. */
const COM_RODAPE_DESCONHECIDO = [
  PAGINA,
  "Ficou com dúvida",
  "Fale com a nossa central pelo chat do portal.",
  "Veja o que outras empresas fizeram",
  "Responder rápido melhora sua nota.",
].join("\n");

/** A mesma página com o RA Forms ainda recolhido. */
const RECOLHIDA = PAGINA.split("\n")
  .filter(
    (linha) =>
      !/^(Recolher|Informações adicionais$|Qual |Já entrou|Como podemos)/.test(
        linha
      )
  )
  .join("\n")
  .replace(
    "Essa reclamação tem informações adicionais coletadas.",
    "Essa reclamação tem informações adicionais coletadas.\nExibir"
  );

/**
 * A mesma página com as etiquetas coladas numa linha só.
 *
 * `innerText` decide a quebra de linha pelo **layout**, não pela
 * marcação: as quatro etiquetas do cabeçalho (COD, ID, cidade, data)
 * ficam lado a lado, e o nome do consumidor tem a etiqueta "Nome social"
 * à direita. Dependendo de como o portal as renderiza, tudo isso pode
 * chegar numa linha só — e foi assim que a primeira versão perdeu a
 * cidade e o nome numa página real.
 */
const NUMA_LINHA = PAGINA.split("\n")
  .join("\n")
  .replace(
    "COD: uPDvBFKmssmEmxVa\nID: 256949163\nCampo Bom\n20/08/26 às 11h21",
    "COD: uPDvBFKmssmEmxVa ID: 256949163 Campo Bom 20/08/26 às 11h21"
  )
  .replace(
    "Marina Ferreira Lopes\nNome social",
    "Marina Ferreira Lopes Nome social"
  );

/* ============================================================
   CARGA
============================================================ */

const contexto = { window: { CWReputacao: {} } };

vm.createContext(contexto);

vm.runInContext(
  fs.readFileSync(ARQUIVO, "utf8"),
  contexto,
  { filename: ARQUIVO }
);

const ra = contexto.window.CWReputacao.ra;

if (!ra) {
  console.error("ra-campos.js não registrou CW.ra.");
  process.exit(1);
}

/* ============================================================
   CONFERÊNCIA
============================================================ */

let falhas = 0;

function conferir(campo, obtido, esperado) {

  const ok = obtido === esperado;

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(24)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(24)} ${JSON.stringify(esperado)}`
    );
  }
}

console.log("\nReclamação aberta no Reclame Aqui\n");

conferir("id", ra.id(PAGINA), "256949163");
conferir("cod", ra.cod(PAGINA), "uPDvBFKmssmEmxVa");

const data = ra.data(PAGINA);

conferir("data.iso", data.iso, "2026-08-20");
conferir("data.hora", data.hora, "11:21");

const local = ra.cidade(PAGINA);

conferir("cidade", local.cidade, "Campo Bom");
conferir("estado", local.estado, "");

conferir("telefone", ra.telefone(PAGINA), "51 90000-0000");

conferir(
  "email",
  ra.email(PAGINA),
  "marina.lopes@exemplo.com"
);

conferir("nome", ra.nome(PAGINA), "Marina Ferreira Lopes");

conferir("status", ra.status(PAGINA), "Não respondida");

conferir(
  "titulo (prefixo fora)",
  ra.titulo(
    "Cardápio Web: Bot do WhatsApp ineficaz e falta de retorno do suporte sobre problemas no pixel e configuração da loja."
  ),
  "Bot do WhatsApp ineficaz e falta de retorno do suporte sobre problemas no pixel e configuração da loja."
);

/**
 * O título vem da posição, não do `<h1>`.
 *
 * O `h1` desta página é "Responder reclamação" — o cabeçalho da tela. É
 * ele que aparecia na prévia no lugar do título da reclamação.
 */
conferir(
  "titulo na página",
  ra.tituloNaPagina(PAGINA),
  "Bot do WhatsApp ineficaz e falta de retorno do suporte sobre problemas no pixel e configuração da loja."
);

conferir(
  "não confunde com o cabeçalho da tela",
  ra.tituloNaPagina(
    ["Responder reclamação", "COD: abc123456"].join("\n")
  ),
  ""
);

conferir(
  "não confunde com o selo de situação",
  ra.tituloNaPagina(
    ["Não respondida", "ID: 256949163"].join("\n")
  ),
  ""
);

const relato = ra.relato(PAGINA);

conferir(
  "relato (início)",
  relato.slice(0, 46),
  "Estou tentando contato com a cardápio web, o b"
);

conferir(
  "relato (fim)",
  relato.slice(-30),
  "que nem o suporte me responde!"
);

/* ---- o rodapé do portal não entra no relato ---- */

/**
 * O defeito que isto guarda: a prévia de importação chegava com as
 * dúvidas frequentes do portal coladas no fim do que o consumidor
 * escreveu. Quem confere a prévia antes de criar o caso via um relato
 * que a pessoa não escreveu — e quem lesse o caso depois, também.
 */
const comRodape = ra.relato(COM_RODAPE);

conferir(
  "com FAQ na página, o relato é o mesmo",
  comRodape,
  relato
);

conferir(
  "e não sobrou nada do FAQ",
  /d[úu]vidas frequentes|índice de solução|parecidas/i.test(
    comRodape
  ),
  false
);

const comRodapeNovo = ra.relato(COM_RODAPE_DESCONHECIDO);

conferir(
  "seção com nome desconhecido também corta",
  comRodapeNovo,
  relato
);

/**
 * A trava de forma não pode comer reclamação curta.
 *
 * Uma reclamação de duas linhas, a segunda curta, continua sendo
 * reclamação — e cortá-la ali entregaria a prévia pela metade, que é o
 * defeito oposto e igualmente calado.
 */
const CURTA = [
  "A reclamação",
  "20/08/26 às 11h21",
  "Comprei e não recebi",
  "Reações",
].join("\n");

conferir(
  "reclamação curta sobrevive à trava de forma",
  ra.relato(CURTA),
  "Comprei e não recebi"
);

/* ---- o formulário do RA Forms ---- */

const formulario = ra.formulario(PAGINA);

conferir("formulário (itens)", formulario.length, 6);

conferir(
  "formulário[1].pergunta",
  formulario[1]?.pergunta,
  "Qual é o CPF ou CNPJ de cadastro no portal?"
);

conferir(
  "formulário[1].resposta",
  formulario[1]?.resposta,
  "12345678000199"
);

conferir(
  "formulário[4].resposta",
  formulario[4]?.resposta,
  "Sim, mas não tive resolução."
);

conferir(
  "recolhido? (aberta)",
  ra.formularioRecolhido(PAGINA),
  false
);

/* ---- o documento, o único campo do formulário que é gravado ---- */

/**
 * É o vínculo com o estabelecimento, e por isso é conferido aqui e não
 * só na tela: o cadastro guarda o mesmo número, a reclamação passa a
 * guardar também, e é assim que os dois se encontram. Casar por nome não
 * funcionaria — o export do portal grava o reclamante no lugar da
 * empresa.
 */
conferir(
  "documento",
  ra.documento(PAGINA),
  "12345678000199"
);

conferir(
  "máscara vira dígitos",
  ra.documento(
    "Informações adicionais\nQual é o CPF ou CNPJ de cadastro no portal?: 12.345.678/0001-99\nJá entrou em contato?: Sim"
  ),
  "12345678000199"
);

/**
 * CPF **entra**, e essa é a mudança que mais importa aqui.
 *
 * A pergunta do portal é "CPF **ou** CNPJ", e a Cardápio Web cadastra
 * restaurante das duas formas: 122 das 127 reclamações da base real
 * respondem com CPF. A versão anterior recusava onze dígitos, e com isso
 * jogava fora quase todo o vínculo que existe.
 */
conferir(
  "cpf é aceito",
  ra.documento(
    "Informações adicionais\nQual é o CPF ou CNPJ de cadastro no portal?: 123.456.789-01\nJá entrou em contato?: Sim"
  ),
  "12345678901"
);

/** Fora de onze e catorze, nada — campo pela metade não vira vínculo. */
conferir(
  "número truncado é recusado",
  ra.documento(
    "Informações adicionais\nQual é o CPF ou CNPJ de cadastro no portal?: 1234567\nJá entrou em contato?: Sim"
  ),
  ""
);

conferir(
  "sem formulário, sem documento",
  ra.documento(RECOLHIDA),
  ""
);

console.log("\nMesma página com o RA Forms recolhido\n");

conferir(
  "recolhido? (recolhida)",
  ra.formularioRecolhido(RECOLHIDA),
  true
);

conferir(
  "formulário (recolhida)",
  ra.formulario(RECOLHIDA).length,
  0
);

/**
 * A armadilha que motivou as âncoras `(?<!\d)`/`(?!\d)`: o CNPJ do
 * formulário são catorze dígitos seguidos, e um padrão de telefone casa
 * dentro dele. Ler telefone da página inteira gravaria pedaço de CNPJ
 * como contato do consumidor.
 */
console.log("\nArmadilhas medidas\n");

conferir(
  "CNPJ não vira telefone",
  ra.telefone("Qual é o CPF ou CNPJ de cadastro no portal?: 12345678000199"),
  ""
);

conferir(
  "e-mail do portal não vira o do consumidor",
  ra.email(
    [
      "Informações adicionais",
      "Qual é o e-mail utilizado para acessar o portal?: contato@exemplo-loja.com",
    ].join("\n")
  ),
  ""
);

conferir(
  "sem data com hora, cai na data solta",
  ra.data("Publicada em 05/02/2026").iso,
  "2026-02-05"
);

conferir(
  "página sem reclamação não inventa id",
  ra.id("Bem-vindo ao painel. Cobrança indevida em 2026."),
  ""
);

/**
 * A UF que a página não mostra, deduzida do DDD.
 *
 * Nenhum código de área brasileiro atravessa dois estados, então isto é
 * dedução e não chute. Cobre a cidade que a base ainda não viu — e
 * "Campo Bom" era uma delas: das 156 cidades com UF na base, nenhuma
 * era ela.
 */
conferir(
  "UF pelo DDD (51 → RS)",
  ra.ufPeloTelefone("51 90000-0000"),
  "RS"
);
conferir(
  "UF com DDI (+55 27)",
  ra.ufPeloTelefone("+55 27 90000-0000"),
  "ES"
);
conferir(
  "UF de fixo (11)",
  ra.ufPeloTelefone("(11) 3000-4000"),
  "SP"
);
conferir(
  "DDD que não existe não inventa UF",
  ra.ufPeloTelefone("(00) 90000-0000"),
  ""
);
conferir(
  "número curto demais não vira UF",
  ra.ufPeloTelefone("51999"),
  ""
);
conferir(
  "sem telefone, sem UF",
  ra.ufPeloTelefone(""),
  ""
);

/**
 * O mesmo conteúdo, com as etiquetas numa linha só.
 *
 * Não é hipótese: na Área da Empresa as quatro etiquetas do cabeçalho
 * ficam lado a lado e o "Nome social" fica à direita do nome. Ler certo
 * nos dois layouts é o que impede a prévia de chegar sem cidade e sem
 * consumidor.
 */
console.log("\nMesma página com as etiquetas numa linha só\n");

conferir("id", ra.id(NUMA_LINHA), "256949163");
conferir("cod", ra.cod(NUMA_LINHA), "uPDvBFKmssmEmxVa");
conferir("data", ra.data(NUMA_LINHA).iso, "2026-08-20");
conferir("hora", ra.data(NUMA_LINHA).hora, "11:21");
conferir(
  "cidade",
  ra.cidade(NUMA_LINHA).cidade,
  "Campo Bom"
);
conferir(
  "nome",
  ra.nome(NUMA_LINHA),
  "Marina Ferreira Lopes"
);
conferir(
  "telefone",
  ra.telefone(NUMA_LINHA),
  "51 90000-0000"
);
conferir(
  "email",
  ra.email(NUMA_LINHA),
  "marina.lopes@exemplo.com"
);

console.log(
  falhas === 0
    ? "\nTodos os campos conferem.\n"
    : `\n${falhas} campo(s) fora do esperado.\n`
);

process.exit(falhas === 0 ? 0 : 1);
