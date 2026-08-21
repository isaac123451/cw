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

    const achado = texto.match(
      /\+55[\s\-().]*\d{2}[\s\-().]*\d{4,5}[\s\-().]*\d{4}/
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

  setInterval(verificar, INTERVALO);

  verificar();
})();
