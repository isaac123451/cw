/**
 * A ponte do áudio (1.82), no mundo da página do WhatsApp Web.
 *
 * O WhatsApp toca a mensagem de voz num elemento de áudio que não entra
 * na árvore da página, e o script de conteúdo (num mundo isolado) não o
 * vê. Esta ponte observa só uma coisa: quando algo começa a tocar com um
 * endereço `blob:` — o áudio que a pessoa acabou de apertar play —, avisa
 * esse endereço à extensão pela própria janela. Não toca nada, não lê
 * mensagem, não fala com a rede.
 */
(() => {
  if (window.__cwAudioPonte) return;
  window.__cwAudioPonte = true;
  const tocar = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    try {
      const endereco = this.currentSrc || this.src || "";
      if (endereco.startsWith("blob:")) window.postMessage({ __cwAudio: endereco }, location.origin);
    } catch {
      /* a ponte nunca atrapalha o player */
    }
    return tocar.apply(this, args);
  };
})();
