/**
 * Detector do Hugme e do Reclame Aqui.
 *
 * A pergunta que o painel responde aqui é outra: não "quem é este
 * cliente", e sim "**esta reclamação já existe do nosso lado?**" — quem
 * é o dono, em que etapa está, e qual prazo `sla.service.ts` calcularia
 * para ela.
 *
 * O identificador sai do endereço da página, que é a parte estável das
 * duas ferramentas. O texto da tela entra só como segunda tentativa,
 * porque marcação de portal muda sem aviso — e quando as duas falham
 * sobra a busca manual, que nunca depende de layout.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  CW.painel.montar();

  const INTERVALO = 1500;

  /**
   * Identificadores candidatos, do mais provável para o menos.
   *
   * Os protocolos da base têm 8 ou 9 dígitos (`RA-101491955`), então
   * sequências mais longas ganham. Datas e valores da tela também são
   * dígitos — o piso de seis corta a maior parte deles.
   */
  function candidatos() {

    const doEndereco = (
      location.pathname + location.search + location.hash
    ).match(/\d{6,12}/g);

    if (doEndereco?.length) {
      return [...new Set(doEndereco)].sort(
        (a, b) => b.length - a.length
      );
    }

    const titulo = document.title.match(/\d{6,12}/g);

    if (titulo?.length) return [...new Set(titulo)];

    /**
     * Último recurso: um trecho do texto visível, procurando um número
     * anunciado como protocolo ou id. O corte em 4000 caracteres existe
     * para isto não virar uma leitura da página inteira a cada ciclo.
     */
    const texto = (document.body?.innerText ?? "").slice(
      0,
      4000
    );

    const rotulado = texto.match(
      /(?:protocolo|protocol|id)\D{0,12}(\d{6,12})/i
    );

    return rotulado ? [rotulado[1]] : [];
  }

  /** Nome do consumidor, quando o portal o exibe em um cabeçalho. */
  function nomeNaTela() {

    const cabecalho = document.querySelector(
      "h1, h2, [class*='consumer'], [class*='consumidor']"
    );

    const texto = CW.texto(cabecalho, 60);

    // Dois pedaços ou mais, sem dígito: parece nome de pessoa.
    return /^[^\d]{5,60}$/.test(texto) &&
      texto.split(" ").length >= 2
      ? texto
      : "";
  }

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    const lista = candidatos();
    const nome = nomeNaTela();

    const chave = `${lista[0] ?? ""}|${nome}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    if (lista.length === 0 && !nome) {
      CW.painel.definirContexto({
        rotulo: "nenhuma reclamação aberta nesta aba",
      });
      return;
    }

    CW.painel.definirContexto({
      protocolo: lista[0] ?? "",
      nome,
      rotulo: lista[0]
        ? `protocolo ${lista[0]}`
        : nome,
    });
  }

  setInterval(verificar, INTERVALO);

  verificar();
})();
