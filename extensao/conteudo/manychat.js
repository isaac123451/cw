/**
 * Detector do ManyChat.
 *
 * A versão mais enxuta das três, e de propósito: não existe integração
 * com o ManyChat hoje, então não há como casar automaticamente uma
 * conversa de lá com um caso daqui. O que sobra é o que `EXTENSAO.md`
 * já previa — **atalho de busca**: se um telefone aparecer na tela, o
 * painel o oferece; se não aparecer, o campo de busca resolve.
 *
 * Não tenta adivinhar por nome de perfil: apelido de rede social casa
 * com quase nada, e casar errado é pior do que não casar.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  CW.painel.montar();

  const INTERVALO = 2000;

  function telefoneNaTela() {

    /** Link `tel:` é o sinal mais confiável — foi marcado como telefone. */
    const link = document.querySelector('a[href^="tel:"]');

    if (link) {
      const digitos = CW.digitos(
        link.getAttribute("href")
      );

      if (digitos.length >= 10) return digitos;
    }

    const texto = (document.body?.innerText ?? "").slice(
      0,
      3000
    );

    /*
      A mesma família de traços do WhatsApp.

      O padrão era `[\s\-().]` — só o hífen ASCII. O ManyChat exibe o
      telefone com a tipografia do navegador, e um travessão curto ou um
      hífen não separável no meio fazia o número inteiro passar
      despercebido. É o mesmo defeito que o Isaac viu no WhatsApp, no
      outro leitor.
    */
    const SEP = "[\\s\\-().\\u00A0\\u2010-\\u2015\\u2212]*";

    const achado = texto
      .replace(CW.INVISIVEIS, "")
      .match(
        new RegExp(
          `\\+55${SEP}\\d{2}${SEP}\\d{4,5}${SEP}\\d{4}`
        )
      );

    return achado ? CW.digitos(achado[0]) : "";
  }

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    const telefone = telefoneNaTela();

    if (telefone === ultimaChave) return;

    ultimaChave = telefone;

    if (!telefone) {
      CW.painel.definirCaptura(null);
      CW.painel.definirContexto({
        canalDaPagina: "ManyChat",
        rotulo: "nenhum telefone visível nesta tela",
      });
      return;
    }

    /**
     * O contato já vira rascunho de caso.
     *
     * Guardado, não enviado: é o que permite ao painel oferecer
     * "cadastrar neste canal" no mesmo instante em que descobre que
     * aquele telefone só tem caso no Reclame Aqui — sem pedir para
     * redigitar o que já está na tela.
     */
    CW.painel.definirCaptura({
      id: "",
      cliente: "",
      telefone,
      titulo: "",
      texto: "",
      criadoEm: "",
      categoria: "",
      prioridade: "Alta",
      origem: "ManyChat",
      url: location.href,
    });

    CW.painel.definirContexto({
      canalDaPagina: "ManyChat",
      telefone,
      rotulo: telefone,
    });
  }

  /**
   * O laço nunca deixa a página quebrar a ferramenta.
   *
   * Detector lê DOM alheio, e DOM alheio muda. Uma exceção aqui, sem a
   * proteção, derrubava a primeira execução e com ela o próprio
   * `setInterval` — o painel ficava montado e mudo, sem nada no
   * console da nossa origem.
   */
  function verificarComRede() {
    try {
      verificar();
    } catch (erro) {
      console.warn("[CW] detector falhou nesta volta", erro);
    }
  }

  setInterval(verificarComRede, INTERVALO);

  verificarComRede();
})();
