/**
 * Os campos de uma reclamação, lidos do texto da página.
 *
 * **Por que é um arquivo separado, e por que não toca no DOM.** Cada
 * função aqui recebe uma string — o `innerText` da página — e devolve um
 * campo. Isso existe para poder ser *provado*: `npm run check:ra` roda
 * todas elas contra o texto de uma reclamação real e confere campo a
 * campo. Foi assim que três leitores errados apareceram na primeira
 * versão, e a única forma de não repetir o erro é ter onde rodar a
 * conta sem abrir o navegador.
 *
 * **Ancorar em rótulo, não em marcação.** "COD:", "ID:", "Nome de
 * registro:", "Telefones do consumidor informados na reclamação:" — são
 * palavras que a pessoa lê na tela. Classe CSS o portal troca sem
 * avisar; o rótulo, não, porque quem lê a página depende dele.
 *
 * Nada aqui adivinha: campo que não casa volta vazio, e a prévia
 * pergunta.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || CW.ra) return;

  const ra = {};

  /* ============================================================
     BASE
  ============================================================ */

  /**
   * Uma linha por bloco, espaços colapsados.
   *
   * `innerText` já entrega o texto como a tela mostra — um `\n` por
   * elemento de bloco. É essa estrutura que permite ancorar em "a linha
   * antes de 'Nome social'", que é onde o nome de exibição mora.
   */
  function linhas(texto) {
    return String(texto ?? "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((linha) => linha.replace(/[ \t ]+/g, " ").trim());
  }

  /** Trecho entre dois marcadores. Sem o segundo, vai até o fim. */
  function janela(texto, inicio, fim) {

    const de = texto.search(inicio);

    if (de < 0) return "";

    const resto = texto.slice(de);

    if (!fim) return resto;

    const ate = resto.search(fim);

    return ate > 0 ? resto.slice(0, ate) : resto;
  }

  /* ============================================================
     IDENTIFICADORES
  ============================================================ */

  /**
   * O número da reclamação — o que casa com o protocolo `RA-...`.
   *
   * Exige os dois-pontos. Sem eles, `id` casava dentro de "indevida" e o
   * primeiro número da página virava protocolo — foi o primeiro defeito
   * medido contra a página de verdade.
   */
  ra.id = (texto) => {

    const rotulado = texto.match(/\bID\s*:\s*(\d{6,12})\b/);

    if (rotulado) return rotulado[1];

    const solto = texto.match(
      /\b(?:protocolo|protocol)\b\D{0,6}(\d{6,12})/i
    );

    return solto ? solto[1] : "";
  };

  /**
   * O COD — o código alfanumérico do Reclame Aqui.
   *
   * **Não é o id.** É o mesmo hash que aparece no fim da URL pública
   * (`..._I2siU60JmI4kVeZ3/`). Lido para a prévia mostrar, porque é por
   * ele que se acha a reclamação no portal — não é gravado: não existe
   * coluna para ele, e inventar uma sem necessidade é dívida.
   */
  ra.cod = (texto) => {

    const achado = texto.match(
      /\bCOD\s*:\s*([A-Za-z0-9._-]{6,40})\b/
    );

    return achado ? achado[1] : "";
  };

  /* ============================================================
     QUANDO
  ============================================================ */

  /**
   * Data de publicação.
   *
   * **O ano vem com dois dígitos.** A página escreve "20/08/26 às
   * 11h21", e o leitor anterior exigia quatro — então não casava nada e
   * a reclamação nascia com a data de hoje, movendo a janela da nota.
   *
   * A data com hora ganha da data solta de propósito: é a do cabeçalho
   * da reclamação. A primeira data solta da página pode ser qualquer
   * coisa que o consumidor escreveu no relato.
   */
  ra.data = (texto) => {

    const comHora = texto.match(
      /(\d{2})\/(\d{2})\/(\d{2,4})\s*(?:às|as)\s*(\d{1,2})h(\d{2})/i
    );

    const achado =
      comHora ?? texto.match(/(\d{2})\/(\d{2})\/(\d{2,4})(?!\d)/);

    if (!achado) return { iso: "", hora: "" };

    const [, dia, mes, ano, hora, minuto] = achado;

    const cheio =
      ano.length === 2 ? `20${ano}` : ano;

    return {
      iso: `${cheio}-${mes}-${dia}`,
      hora: hora
        ? `${String(hora).padStart(2, "0")}:${minuto}`
        : "",
    };
  };

  /* ============================================================
     ONDE
  ============================================================ */

  const RE_CIDADE = /^[A-Za-zÀ-ÿ'.\- ]{2,40}$/;

  /**
   * Cidade e UF.
   *
   * **A página traz só a cidade** — "Campo Bom", numa etiqueta entre o
   * ID e a data, sem estado nenhum. Por isso a ordem é esta: primeiro a
   * etiqueta, depois o formato "Cidade - UF" do portal público.
   *
   * A busca por "Cidade - UF" ficou em segundo porque ela erra sozinha:
   * numa página real ela atravessou parágrafos e devolveu "Não
   * respondida Cardápio Web ... Fortaleza" como nome de cidade.
   */
  ra.cidade = (texto) => {

    /**
     * O próprio marcador sai do trecho.
     *
     * As quatro etiquetas do cabeçalho — COD, ID, cidade, data — ficam
     * lado a lado, e o `innerText` pode entregá-las **numa linha só**:
     * "ID: 256949163 Campo Bom 20/08/26". Sem tirar o "ID: <número>" da
     * frente, a única linha do trecho tem dois-pontos e era descartada.
     */
    const trecho = janela(
      texto,
      /\bID\s*:\s*\d{6,12}/,
      /\d{2}\/\d{2}\/\d{2,4}/
    ).replace(/^\s*ID\s*:\s*\d{6,12}/, "");

    for (const linha of linhas(trecho)) {

      if (
        linha === "" ||
        linha.includes(":") ||
        !RE_CIDADE.test(linha) ||
        linha.split(" ").length > 5
      ) {
        continue;
      }

      return { cidade: linha, estado: "" };
    }

    const comUf = texto.match(
      /([A-ZÀ-Ú][A-Za-zÀ-ÿ'. ]{2,38})\s+-\s+([A-Z]{2})(?:\s|$)/
    );

    return comUf
      ? { cidade: comUf[1].trim(), estado: comUf[2] }
      : { cidade: "", estado: "" };
  };

  /* ============================================================
     QUEM
  ============================================================ */

  /**
   * Telefone do consumidor.
   *
   * **Só dentro do bloco rotulado.** Procurar telefone na página
   * inteira parece mais tolerante e é o contrário: o formulário do RA
   * Forms traz o CNPJ do estabelecimento como catorze dígitos seguidos,
   * e um padrão de telefone casa dentro dele. As âncoras `(?<!\d)` e
   * `(?!\d)` fecham essa porta de vez — o número tem de começar e
   * terminar onde os dígitos começam e terminam.
   */
  const RE_TELEFONE =
    /(?<!\d)(?:\+?55[\s.-]*)?\(?(\d{2})\)?[\s.-]*(9?\d{4})[\s.-]?(\d{4})(?!\d)/;

  ra.telefone = (texto) => {

    const blocos = [
      janela(
        texto,
        /Telefones do consumidor[^\n]*/i,
        /^\s*(?:Contatos|Nome de registro|CPF|Informações adicionais|A reclamação)/im
      ),
      janela(
        texto,
        /Contatos do cadastro do consumidor/i,
        /^\s*(?:Informações adicionais|Essa reclamação|A reclamação)/im
      ),
    ];

    for (const bloco of blocos) {

      const achado = bloco.match(RE_TELEFONE);

      if (achado) return achado[0].trim();
    }

    return "";
  };

  /**
   * O estado, pelo DDD do telefone.
   *
   * A página mostra a cidade e **não mostra a UF**, então o campo
   * chegava vazio na prévia. A base cobre as 156 cidades que já
   * reclamaram; para uma cidade nova — "Campo Bom" era uma — não havia
   * de onde tirar.
   *
   * O DDD resolve e não envelhece: nenhum código de área brasileiro
   * atravessa dois estados. É derivação, não chute — e a prévia continua
   * editável, com o aviso de onde o valor veio.
   */
  const UF_POR_DDD = {
    11: "SP", 12: "SP", 13: "SP", 14: "SP", 15: "SP",
    16: "SP", 17: "SP", 18: "SP", 19: "SP",
    21: "RJ", 22: "RJ", 24: "RJ",
    27: "ES", 28: "ES",
    31: "MG", 32: "MG", 33: "MG", 34: "MG", 35: "MG",
    37: "MG", 38: "MG",
    41: "PR", 42: "PR", 43: "PR", 44: "PR", 45: "PR",
    46: "PR",
    47: "SC", 48: "SC", 49: "SC",
    51: "RS", 53: "RS", 54: "RS", 55: "RS",
    61: "DF",
    62: "GO", 64: "GO",
    63: "TO",
    65: "MT", 66: "MT",
    67: "MS",
    68: "AC",
    69: "RO",
    71: "BA", 73: "BA", 74: "BA", 75: "BA", 77: "BA",
    79: "SE",
    81: "PE", 87: "PE",
    82: "AL",
    83: "PB",
    84: "RN",
    85: "CE", 88: "CE",
    86: "PI", 89: "PI",
    91: "PA", 93: "PA", 94: "PA",
    92: "AM", 97: "AM",
    95: "RR",
    96: "AP",
    98: "MA", 99: "MA",
  };

  ra.ufPeloTelefone = (telefone) => {

    const digitos = String(telefone ?? "").replace(
      /\D/g,
      ""
    );

    // Tira o DDI, quando vier: 55 + DDD + número.
    const semDdi =
      digitos.length > 11 && digitos.startsWith("55")
        ? digitos.slice(2)
        : digitos;

    if (semDdi.length < 10) return "";

    return UF_POR_DDD[Number(semDdi.slice(0, 2))] ?? "";
  };

  const RE_EMAIL =
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

  /**
   * E-mail do consumidor.
   *
   * **Tem dois e-mails na página, e eles são de pessoas diferentes.** O
   * do cadastro do consumidor (`viniciusweberzin@gmail.com`) e o que o
   * RA Forms pergunta — "qual é o e-mail utilizado para acessar o
   * portal?" (`hamburgueriatortellini@gmail.com`), que é o do
   * estabelecimento. Uma busca solta pegaria o que viesse primeiro e
   * gravaria o contato errado no caso.
   */
  ra.email = (texto) => {

    const doCadastro = janela(
      texto,
      /Contatos do cadastro do consumidor/i,
      /^\s*(?:Informações adicionais|Essa reclamação|A reclamação)/im
    );

    const achado =
      doCadastro.match(RE_EMAIL) ??
      janela(
        texto,
        /E-?mail\s*:/i,
        /^\s*(?:Informações adicionais|Essa reclamação|A reclamação)/im
      ).match(RE_EMAIL);

    return achado ? achado[0] : "";
  };

  /**
   * Nome do consumidor.
   *
   * **O portal público não mostra; esta página, sim** — e mostra dois. O
   * nome de exibição fica na linha logo acima da etiqueta "Nome social";
   * o de registro vem rotulado. Fica com o de exibição, que é como a
   * pessoa pede para ser chamada e é o que vai aparecer no cartão do
   * Kanban.
   */
  ra.nome = (texto) => {

    const todas = linhas(texto);

    const social = todas.findIndex((linha) =>
      /^Nome social\b/i.test(linha)
    );

    if (social > 0) {

      const anterior = todas[social - 1];

      if (pareceNome(anterior)) return anterior;
    }

    /**
     * A etiqueta "Nome social" fica **ao lado** do nome, não abaixo.
     *
     * Quando o `innerText` junta os dois na mesma linha — "Vinícius
     * Weber Nome social" —, procurar a linha anterior não acha nada.
     * Este segundo caminho cobre o mesmo layout entregue de outro jeito,
     * que é a diferença entre ler o nome e ter de pedir para digitar.
     */
    for (const linha of todas) {

      const juntos = linha.match(
        /^(.{3,60}?)\s+Nome social\b/i
      );

      if (juntos && pareceNome(juntos[1].trim())) {
        return juntos[1].trim();
      }
    }

    const registro = texto.match(
      /Nome de registro\s*:\s*([^\n]{3,80})/i
    );

    if (registro && pareceNome(registro[1].trim())) {
      return registro[1].trim();
    }

    const rotulado = texto.match(
      /(?:consumidor|reclamante|cliente)\s*:\s*([^\n]{4,60})/i
    );

    return rotulado && pareceNome(rotulado[1].trim())
      ? rotulado[1].trim()
      : "";
  };

  function pareceNome(valor) {
    return (
      typeof valor === "string" &&
      valor.length >= 3 &&
      valor.length <= 80 &&
      !valor.includes(":") &&
      !/\d/.test(valor) &&
      valor.trim().split(/\s+/).length >= 2
    );
  }

  /* ============================================================
     SITUAÇÃO E TEXTO
  ============================================================ */

  /** Situação no portal — informação da prévia, não campo do caso. */
  ra.status = (texto) => {

    const achado = texto
      .slice(0, 3000)
      .match(
        /\b(Não respondida|Respondida|Resolvida|Não resolvida|Em réplica|Réplica|Avaliada|Pendente|Não avaliada)\b/i
      );

    return achado ? achado[1] : "";
  };

  /**
   * Onde o relato acaba.
   *
   * A lista cresceu por um defeito real: a página do Reclame Aqui
   * continua **depois** da reclamação, com ajuda, dúvidas frequentes e
   * reclamações parecidas — e nada disso estava aqui. O laço então
   * seguia até o fim do documento, e a prévia de importação chegava com
   * o FAQ do portal colado no fim do relato do consumidor.
   */
  const FIM_DO_RELATO =
    /^(Reações|Imagens e documentos anexados|Resposta da empresa|Réplica|Avaliação|Considerações finais|Interações|Histórico|D[úu]vidas frequentes|Perguntas frequentes|FAQ|Central de ajuda|Precisa de ajuda|Ajuda|Sobre a empresa|Sobre a Cardápio Web|Reclamações (relacionadas|parecidas|semelhantes)|Confira também|Veja também|Últimas reclamações|Outras reclamações|Empresas parecidas|Recomendadas para você|Avalie o atendimento|Compartilhar|Denunciar)/i;

  /**
   * Uma linha que parece **título de seção**, e não texto de gente.
   *
   * A lista acima é uma lista de nomes, e nome de seção muda: o portal
   * troca "Dúvidas frequentes" por "Ficou com dúvida?" e o FAQ volta
   * para dentro do relato sem ninguém perceber. Esta é a segunda trava,
   * e ela não depende de conhecer o nome: título de bloco é curto,
   * começa com maiúscula e não termina em ponto — enquanto quem está
   * reclamando escreve frases.
   *
   * Só vale depois de o relato já ter substância (ver abaixo): a
   * primeira linha de uma reclamação curta pode muito bem parecer um
   * título, e cortá-la ali deixaria a prévia vazia.
   */
  const PARECE_TITULO = (linha) =>
    linha.length <= 42 &&
    /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(linha) &&
    !/[.!?…,;:]$/.test(linha) &&
    // "51 90000-0000" e afins não são título, são dado solto.
    !/\d{4}/.test(linha);

  /**
   * Quanto o relato precisa ter para a trava acima valer.
   *
   * Abaixo disso ainda estamos lendo o começo da reclamação, e uma
   * linha curta ali é parte do que a pessoa escreveu.
   */
  const RELATO_JA_TEM_SUBSTANCIA = 180;

  /**
   * O relato do consumidor.
   *
   * Ancorado no título do bloco — "A reclamação" — e não no maior texto
   * da página: o maior bloco de uma página do Reclame Aqui é o script
   * do Google Tag Manager, e foi isso que a primeira versão capturou.
   *
   * A linha de data logo abaixo do título é descartada; ela é carimbo do
   * bloco, não parte do que a pessoa escreveu.
   */
  ra.relato = (texto) => {

    const todas = linhas(texto);

    const inicio = todas.findIndex((linha) =>
      /^A reclamação$/i.test(linha)
    );

    if (inicio < 0) return "";

    const partes = [];

    /** Quanto já se juntou, para a trava de título saber quando vale. */
    let tamanho = 0;

    for (let i = inicio + 1; i < todas.length; i += 1) {

      const linha = todas[i];

      if (FIM_DO_RELATO.test(linha)) break;

      /**
       * A segunda trava: seção nova, mesmo sem nome conhecido.
       *
       * Sem ela o laço ia até o fim do documento sempre que o portal
       * mudasse um rótulo — e a página continua depois da reclamação,
       * com ajuda e dúvidas frequentes. Era isso que chegava colado no
       * fim do relato na prévia de importação.
       */
      if (
        tamanho >= RELATO_JA_TEM_SUBSTANCIA &&
        PARECE_TITULO(linha)
      ) {
        break;
      }

      if (
        linha === "" ||
        /^\d{2}\/\d{2}\/\d{2,4}\b/.test(linha)
      ) {
        continue;
      }

      partes.push(linha);
      tamanho += linha.length;
    }

    return partes.join("\n\n").slice(0, 20000);
  };

  /**
   * Título sem o nome da empresa.
   *
   * O portal escreve "Cardápio Web: <título>"; as 334 reclamações que já
   * vieram da planilha do Hugme **não** têm esse prefixo. Manter o
   * prefixo aqui quebraria a segunda trava de duplicata do servidor, que
   * compara título com título — e a mesma reclamação entraria duas
   * vezes, com dois números diferentes.
   */
  ra.titulo = (valor) =>
    String(valor ?? "")
      .replace(/^\s*Card[áa]pio\s*Web\s*:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

  /** Cabeçalhos da própria ferramenta, que não são título de nada. */
  const CABECALHOS_DA_TELA =
    /^(Responder reclamação|Reclamações|Área da Empresa|Painel inicial|Detalhes da reclamação|Atendimento|RA Verificada|Analytics|Voltar)\b/i;

  /**
   * O título da reclamação, pela posição no texto.
   *
   * **O `<h1>` não serve nesta página.** Em "Responder reclamação" o
   * `h1` é o cabeçalho da tela — foi exatamente isso que veio parar na
   * prévia. O título de verdade é a linha logo **acima** da fileira de
   * etiquetas (COD / ID / cidade / data), abaixo do selo de situação.
   *
   * Se a linha anterior não parecer título — curta demais, um rótulo,
   * ou um cabeçalho da própria ferramenta —, devolve vazio e quem
   * chamou cai no `h1`. Vazio a prévia pergunta; errado ela grava.
   */
  ra.tituloNaPagina = (texto) => {

    const todas = linhas(texto);

    const marcador = todas.findIndex((linha) =>
      /^\s*(?:COD|ID)\s*:/i.test(linha)
    );

    if (marcador <= 0) return "";

    // Pula linhas em branco entre o título e as etiquetas.
    for (let i = marcador - 1; i >= 0 && i >= marcador - 3; i -= 1) {

      const candidato = todas[i];

      if (candidato === "") continue;

      if (
        candidato.length < 12 ||
        candidato.length > 300 ||
        CABECALHOS_DA_TELA.test(candidato) ||
        /^(Não respondida|Respondida|Resolvida|Não resolvida|Em réplica|Avaliada)\b/i.test(
          candidato
        )
      ) {
        return "";
      }

      return ra.titulo(candidato);
    }

    return "";
  };

  /* ============================================================
     RA FORMS — INFORMAÇÕES ADICIONAIS
  ============================================================ */

  const RE_PERGUNTA = /^(.{3,180}?\?)\s*:\s*(.+)$/;

  /**
   * O formulário que o Reclame Aqui coleta antes de publicar.
   *
   * É o bloco mais valioso da página e o único que **não** vira campo do
   * caso: traz o CNPJ de cadastro no portal, o e-mail de acesso e o nome
   * do proprietário — ou seja, o vínculo com o estabelecimento, que hoje
   * falta na base. Gravar isso sem decidir onde seria criar dado torto
   * em três tabelas. Então a prévia mostra, e a decisão é do Isaac.
   *
   * Aceita pergunta e resposta na mesma linha ou em linhas seguidas: o
   * portal renderiza inline, mas basta uma quebra de bloco para o
   * `innerText` separar.
   */
  ra.formulario = (texto) => {

    const todas = linhas(texto);

    const inicio = todas.findIndex((linha) =>
      /^Informações adicionais$/i.test(linha)
    );

    if (inicio < 0) return [];

    const itens = [];

    for (let i = inicio + 1; i < todas.length; i += 1) {

      const linha = todas[i];

      if (linha === "" || /^(Recolher|Exibir)/i.test(linha)) {
        continue;
      }

      const naMesmaLinha = linha.match(RE_PERGUNTA);

      if (naMesmaLinha) {
        itens.push({
          pergunta: naMesmaLinha[1].trim(),
          resposta: naMesmaLinha[2].trim(),
        });
        continue;
      }

      if (/\?\s*:?\s*$/.test(linha)) {

        const resposta = todas[i + 1] ?? "";

        if (resposta !== "") {
          itens.push({
            pergunta: linha.replace(/\s*:\s*$/, "").trim(),
            resposta: resposta.trim(),
          });
          i += 1;
          continue;
        }
      }

      // Linha que não é par pergunta/resposta encerra o bloco.
      if (itens.length > 0) break;
    }

    return itens;
  };

  /** Há formulário, mas ainda recolhido na tela. */
  ra.formularioRecolhido = (texto) =>
    /informações adicionais coletadas/i.test(texto) &&
    ra.formulario(texto).length === 0;


  /**
   * O documento do estabelecimento, tirado do RA Forms.
   *
   * É o único campo do formulário que casa com algo daqui: o cadastro de
   * estabelecimentos guarda o mesmo número, e a reclamação passa a
   * guardar também — é assim que o vínculo se faz sozinho.
   *
   * **Casar por nome não funciona.** O export do Reclame Aqui grava o
   * reclamante no lugar da empresa, então o nome da reclamação é o do
   * consumidor. O documento é o mesmo número dos dois lados.
   *
   * **CPF entra.** A pergunta do portal é literalmente "CPF ou CNPJ", e a
   * Cardápio Web cadastra restaurante das duas formas — na base real, 122
   * de 127 respondem com CPF. Aceitar só catorze dígitos jogaria fora
   * quase todo o vínculo que existe.
   *
   * Fora de onze e catorze, nada: campo pela metade ou "não informado"
   * viraria vínculo falso entre reclamações que só têm em comum o lixo.
   */
  ra.documento = (texto) => {

    const itens = ra.formulario(texto);

    for (const item of itens) {

      if (!/cpf|cnpj/i.test(item.pergunta)) continue;

      const digitos = String(item.resposta).replace(/[^0-9]/g, "");

      if (digitos.length === 11 || digitos.length === 14) {
        return digitos;
      }
    }

    return "";
  };

  ra.linhas = linhas;

  CW.ra = ra;
})();
