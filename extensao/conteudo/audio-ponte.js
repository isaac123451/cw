/**
 * A ponte do áudio (1.82; reforçada em 09/11/2026), no mundo da página do
 * WhatsApp Web.
 *
 * O WhatsApp toca a mensagem de voz num elemento de áudio que não entra na
 * árvore da página, e o script de conteúdo (num mundo isolado) não o vê.
 * Esta ponte avisa a extensão, pela própria janela, em dois momentos:
 *
 * - quando algo começa a tocar com um endereço `blob:` (o jeito de antes);
 * - quando a página cria um arquivo de áudio (`URL.createObjectURL` de um
 *   `Blob` de áudio) — que é o que o WhatsApp faz ao baixar a voz para
 *   tocar. Aqui o próprio arquivo vai junto: o script de conteúdo não
 *   precisa buscá-lo de volta.
 *
 * Em 30 dias até 09/11, nenhuma transcrição foi guardada — o caminho do
 * play sozinho tinha parado de avisar. Não toca nada, não lê mensagem, não
 * fala com a rede.
 */
(() => {
  if (window.__cwAudioPonte) return;
  window.__cwAudioPonte = true;

  const avisar = (endereco, arquivo) => {
    try {
      window.postMessage({ __cwAudio: endereco, ...(arquivo ? { __cwAudioArquivo: arquivo } : {}) }, location.origin);
    } catch {
      /* a ponte nunca atrapalha o player */
    }
  };

  const tocar = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    try {
      const endereco = this.currentSrc || this.src || "";
      if (endereco.startsWith("blob:")) avisar(endereco);
    } catch {
      /* idem */
    }
    return tocar.apply(this, args);
  };

  const criar = URL.createObjectURL;
  URL.createObjectURL = function (objeto, ...resto) {
    const endereco = criar.call(this, objeto, ...resto);
    try {
      if (objeto instanceof Blob && /^audio\//i.test(objeto.type || "") && objeto.size > 0 && objeto.size < 3_000_000) avisar(endereco, objeto);
    } catch {
      /* idem */
    }
    return endereco;
  };
})();
