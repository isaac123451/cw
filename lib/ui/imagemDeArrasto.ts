/**
 * O cartão "no ar" enquanto é arrastado (1.88).
 *
 * "Quero que quando eu segurar para mudar a etapa seja possível ver ele
 * sendo arrastado." O cartão do quadro é um link, e o navegador arrasta
 * link como link: a imagem que segue o mouse era o endereço, não o
 * cartão. Aqui a imagem passa a ser uma cópia do próprio cartão, um
 * pouco inclinada e com sombra, presa ao ponto em que o mouse o pegou.
 *
 * A cópia vive fora da tela só o tempo de o navegador fotografá-la.
 */
export function imagemDeArrasto(evento: React.DragEvent<HTMLElement>) {
  const origem = evento.currentTarget;
  if (!evento.dataTransfer?.setDragImage || !origem) return;

  const caixa = origem.getBoundingClientRect();
  const copia = origem.cloneNode(true) as HTMLElement;

  copia.style.position = "fixed";
  copia.style.top = "-10000px";
  copia.style.left = "-10000px";
  copia.style.width = `${caixa.width}px`;
  copia.style.transform = "rotate(2deg)";
  copia.style.boxShadow = "0 18px 40px -12px rgba(40, 10, 70, 0.45)";
  copia.style.opacity = "1";
  copia.style.pointerEvents = "none";
  copia.style.zIndex = "2147483647";

  document.body.appendChild(copia);
  evento.dataTransfer.setDragImage(copia, evento.clientX - caixa.left, evento.clientY - caixa.top);
  setTimeout(() => copia.remove(), 0);
}
