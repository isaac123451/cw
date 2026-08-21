/**
 * Detector do Hugme e do Reclame Aqui.
 *
 * A pergunta que o painel responde aqui é outra: não "quem é este
 * cliente", e sim "**esta reclamação já existe do nosso lado?**" — quem
 * é o dono, em que etapa está, e qual prazo `sla.service.ts` calcularia
 * para ela.
 *
 * **A identificação acontece dentro da reclamação aberta**, não no
 * endereço. A página traz tudo rotulado — COD, ID, cidade, data,
 * telefone, nome do consumidor, e-mail e o formulário do RA Forms — e é
 * disso que os leitores vivem. Cada leitor é uma função pura em
 * `ra-campos.js`, provada por `npm run check:ra` contra o texto de uma
 * reclamação real; aqui ficam só o DOM e o laço.
 *
 * Quando um leitor falha, o campo vem vazio e a prévia pergunta — nunca
 * um chute. E a busca manual continua ali, que é a única coisa que não
 * depende de layout nenhum.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel || !CW.ra) return;

  CW.painel.montar();

  const INTERVALO = 1500;

  /**
   * O texto da página, inteiro.
   *
   * Sem fatiar em 4.000 caracteres como antes: o relato e o RA Forms
   * ficam depois disso numa reclamação longa, e o corte silencioso era
   * o motivo de os campos do fim virem vazios. `innerText` custa um
   * cálculo de layout, e por isso é lido **uma vez** por leitura, não
   * uma vez por campo.
   */
  function texto() {
    return document.body?.innerText ?? "";
  }

  /**
   * Título: o `h1` da página, com o `document.title` de reserva.
   *
   * `CW.ra.titulo` tira o "Cardápio Web: " da frente — o prefixo é do
   * portal, e as reclamações que vieram da planilha do Hugme não o têm.
   */
  function tituloNaTela(conteudo) {

    /**
     * A posição no texto vem **antes** do `h1`.
     *
     * Em "Responder reclamação" o `h1` é o cabeçalho da tela, e era ele
     * que estava indo para a prévia como título da reclamação. O título
     * de verdade é a linha acima da fileira de etiquetas.
     */
    const daPagina = CW.ra.tituloNaPagina(conteudo);

    if (daPagina) return daPagina;

    const h1 = CW.texto(document.querySelector("h1"), 260);

    if (h1 && h1.length > 8) return CW.ra.titulo(h1);

    return CW.ra.titulo(
      document.title.replace(
        /\s*[|\-–]\s*(Reclame Aqui|Reclame AQUI|Hugme).*$/i,
        ""
      )
    );
  }

  /**
   * Texto que é código, e não relato.
   *
   * O Reclame Aqui injeta o Google Tag Manager em `<div>` soltos, e o
   * conteúdo deles é **maior** que a reclamação — a busca pelo maior
   * bloco de texto voltava com JavaScript. Este teste é o que separa os
   * dois sem depender de classe CSS.
   */
  function pareceCodigo(valor) {
    return /google_tag_manager|function\s*\(|=>|var\s+[A-Za-z_$]+\s*=|\}\)\(/.test(
      valor.slice(0, 200)
    );
  }

  /**
   * O relato, quando a âncora "A reclamação" não existe.
   *
   * Reserva para o Hugme e para o dia em que o bloco mudar de nome: o
   * `<p>` dentro do `<article>`, que é semântico o bastante para
   * sobreviver a uma troca de classes.
   */
  function relatoPeloDom() {

    const doArtigo = [
      ...document.querySelectorAll(
        "article p, article [data-testid]"
      ),
    ]
      .map((elemento) => (elemento.innerText ?? "").trim())
      .filter(
        (valor) =>
          valor.length >= 100 &&
          valor.length <= 20000 &&
          !pareceCodigo(valor)
      )
      .sort((a, b) => b.length - a.length)[0];

    return doArtigo ?? "";
  }

  /**
   * Lê a reclamação aberta.
   *
   * Tudo junto, numa passada só pelo texto da página. O resultado fica
   * **guardado no painel** e só vira requisição depois de alguém
   * conferir a prévia — ler não é gravar.
   */
  function lerReclamacao(bruto) {

    const conteudo = bruto ?? texto();

    const id = CW.ra.id(conteudo);

    const quando = CW.ra.data(conteudo);
    const local = CW.ra.cidade(conteudo);
    const telefone = CW.ra.telefone(conteudo);

    const relato =
      CW.ra.relato(conteudo) || relatoPeloDom();

    return {
      id,
      cod: CW.ra.cod(conteudo),

      cliente: CW.ra.nome(conteudo),
      telefone,
      email: CW.ra.email(conteudo),

      titulo: tituloNaTela(conteudo),
      texto: relato,

      criadoEm: quando.iso,
      hora: quando.hora,

      cidade: local.cidade,

      /**
       * A UF sai daqui **como a página a mostra** — quase sempre vazia.
       *
       * Deduzir fica com a prévia, e não com o leitor, porque lá o
       * valor vem com a etiqueta de onde veio: da base ou do DDD. Um
       * campo preenchido sem dizer a origem ninguém confere.
       */
      estado: local.estado,

      /**
       * Categoria não é lida da página de propósito: o portal não
       * classifica a reclamação, e o que parecia rótulo de categoria
       * ("Está com problema com Cardápio Web?") era pergunta de
       * formulário. Quem tem a lista certa é a própria ferramenta — a
       * prévia oferece as categorias cadastradas.
       */
      categoria: "",
      subcategoria: "",

      prioridade: "Alta",
      statusPortal: CW.ra.status(conteudo),

      /**
       * O RA Forms vai junto para a prévia **mostrar**, e só. Traz o
       * CNPJ de cadastro no portal, o e-mail de acesso e o nome do
       * proprietário — o vínculo com o estabelecimento, que hoje falta
       * na base. Onde isso deve ser gravado é decisão que ainda não foi
       * tomada, e gravar antes de decidir cria dado torto em três
       * tabelas.
       */
      formulario: CW.ra.formulario(conteudo),
      formularioRecolhido:
        CW.ra.formularioRecolhido(conteudo),

      origem: "Reclame Aqui",
      url: location.href,
    };
  }

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    /**
     * A chave é o endereço **mais o número da reclamação**.
     *
     * Só o endereço não serve, e isso custou um defeito: a Área da
     * Empresa do Reclame Aqui é um SPA — o endereço não muda entre a
     * lista e a reclamação aberta, e o conteúdo chega **depois** do
     * primeiro ciclo do detector. Com a chave presa ao endereço, o
     * painel lia a página ainda vazia, guardava "nenhuma reclamação
     * aberta nesta aba" e nunca mais tentava.
     *
     * O id também não pode entrar sozinho no lugar do texto lido, que
     * foi a primeira tentativa: nome e relato o portal reescreve
     * enquanto renderiza, e a chave mudava a cada ciclo — o painel
     * tratava isso como reclamação nova e a gaveta pulava na frente de
     * quem estava lendo. O número é estável assim que existe.
     *
     * Custo: um `innerText` por ciclo. Os leitores só rodam quando o
     * número muda, que é o trabalho caro.
     */
    const conteudo = texto();

    const chave = `${location.href}#${CW.ra.id(conteudo)}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    const lida = lerReclamacao(conteudo);

    if (!lida.id && !lida.cliente) {
      CW.painel.definirCaptura(null);
      CW.painel.definirContexto({
        canalDaPagina: "Reclame Aqui",
        rotulo: "nenhuma reclamação aberta nesta aba",
      });
      return;
    }

    CW.painel.definirCaptura(lida);

    CW.painel.definirContexto({
      canalDaPagina: "Reclame Aqui",
      protocolo: lida.id,
      nome: lida.cliente,
      telefone: lida.telefone,
      email: lida.email,
      rotulo: lida.id
        ? `protocolo ${lida.id}`
        : lida.cliente,
    });
  }

  /**
   * Como reler sob demanda.
   *
   * O RA Forms nasce recolhido, e expandir não muda o endereço. Sem
   * isto, quem clicasse em "Exibir" depois de o painel ler continuaria
   * vendo "há informações adicionais não exibidas" para sempre.
   */
  CW.painel.definirReleitor(lerReclamacao);

  /**
   * E como entregar o texto cru, quando o leitor não achar nada.
   *
   * O portal decide a quebra de linha pelo layout: as mesmas etiquetas
   * podem chegar em uma linha ou em quatro, e um leitor certo para um
   * caso erra o outro. Copiar o texto que o navegador produziu é o que
   * transforma "não achou" em correção — em vez de mais um palpite.
   */
  CW.painel.definirDiagnostico(texto);

  setInterval(verificar, INTERVALO);

  verificar();
})();
