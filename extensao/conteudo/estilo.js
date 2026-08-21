/**
 * Estilo do painel, como texto.
 *
 * Vai para dentro de um Shadow DOM em `painel.js`. Folha injetada na
 * página não serviria: o CSS do WhatsApp Web é agressivo e reescreveria
 * metade disto — e o contrário também vale, um seletor nosso vazando
 * quebraria a tela de quem está trabalhando.
 *
 * **Fonte.** `all: initial` no host zera também a tipografia, e o que
 * sobrava era a fonte padrão do sistema em corpo pequeno — legível de
 * má vontade. Agora o painel usa a **Geist**, a mesma da aplicação,
 * empacotada em um único arquivo variável de 69 kB que cobre todos os
 * pesos. Quem registra a família é `nucleo.js`, porque `@font-face`
 * declarado dentro de um Shadow DOM é ignorado pelo Chrome — a regra
 * precisa existir no documento.
 *
 * **Tema.** Três estados, e não dois: `auto` segue o sistema, `claro` e
 * `escuro` mandam. Por isso as cores escuras aparecem duas vezes — uma
 * sob `prefers-color-scheme` restrita ao `auto`, outra no seletor
 * explícito. Sem essa separação, escolher "claro" num sistema escuro
 * não teria efeito nenhum.
 *
 * As cores são as da marca: roxo `#5B2A86`, violeta `#7B3FBF` e laranja
 * `#F9A11B` — a Cardápio Web é roxa **e** laranja.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || CW.CSS) return;

  /** Repetido nos dois seletores de tema escuro. */
  const ESCURO = `
  --fundo: #16171b;
  --superficie: #1e1f25;
  --elevado: #24262d;
  --borda: #31333c;
  --texto: #f1f1f4;
  --suave: #c8c9d0;
  --fraco: #9a9ba5;
  --perigo: #f87171;
  --atencao: #fbbf24;
  --ok: #4ade80;
  --violeta: #a97bea;
  --sombra: 0 14px 40px rgba(0, 0, 0, .5);
`;

  CW.CSS = `
:host {
  all: initial;
}

* {
  box-sizing: border-box;
}

.raiz {
  /* ---- marca ---- */
  --roxo: #5B2A86;
  --violeta: #7B3FBF;
  --laranja: #F9A11B;

  /* ---- claro (padrão) ---- */
  --fundo: #ffffff;
  --superficie: #fafafa;
  --elevado: #ffffff;
  --borda: #e4e4e7;
  --texto: #18181b;
  --suave: #52525b;
  --fraco: #71717a;
  --perigo: #dc2626;
  --atencao: #b45309;
  --ok: #15803d;
  --sombra: 0 14px 40px rgba(24, 24, 27, .16);

  /* ---- tipografia ---- */
  --fonte: "CW Geist", ui-sans-serif, -apple-system,
    BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;

  position: fixed;
  inset: 0 0 0 auto;
  z-index: 2147483000;
  pointer-events: none;

  font-family: var(--fonte);
  font-size: 13.5px;
  line-height: 1.5;
  font-weight: 400;
  color: var(--texto);
  font-synthesis-weight: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Sistema escuro, e o painel deixado no automático. */
@media (prefers-color-scheme: dark) {
  .raiz[data-tema="auto"] { ${ESCURO} }
}

/* Escolha explícita vence o sistema, nos dois sentidos. */
.raiz[data-tema="escuro"] { ${ESCURO} }

/* Números em largura fixa: sem isto os contadores dançam ao atualizar. */
.numero b,
.sub,
.selo {
  font-variant-numeric: tabular-nums;
}

/* ---------- botão flutuante ---------- */

.gatilho {
  position: absolute;
  right: 18px;
  bottom: 24px;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(145deg, var(--violeta), var(--roxo));
  box-shadow: 0 6px 22px rgba(91, 42, 134, .4);
  cursor: pointer;
  pointer-events: auto;
  display: grid;
  place-items: center;
  transition: transform .15s ease, box-shadow .15s ease;
}

.gatilho:hover { transform: translateY(-2px); }
.gatilho:active { transform: translateY(0); }
.gatilho:focus-visible {
  outline: 2px solid var(--violeta);
  outline-offset: 3px;
}

.gatilho svg { width: 25px; height: 25px; display: block; }

.gatilho .selo {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--perigo);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: -.02em;
  display: none;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--fundo);
}

.gatilho .selo.visivel { display: flex; }

/* ---------- gaveta ---------- */

.gaveta {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: var(--largura, 380px);
  max-width: 96vw;
  background: var(--fundo);
  border-left: 1px solid var(--borda);
  box-shadow: var(--sombra);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transform: translateX(100%);
  transition: transform .22s cubic-bezier(.32, .72, 0, 1);
}

.gaveta.aberta { transform: translateX(0); }

/**
 * Solta do canto: vira janela.
 *
 * Ancorada é o padrão porque é o que não cobre a conversa. Mas quem usa
 * dois monitores ou precisa comparar duas telas quer mover — então
 * arrastar o cabeçalho troca para posicionamento livre, com altura
 * limitada e cantos arredondados dos dois lados.
 */
.gaveta.solta {
  top: var(--y, 60px);
  left: var(--x, 40px);
  right: auto;
  bottom: auto;
  height: min(78vh, 720px);
  border: 1px solid var(--borda);
  border-radius: 14px;
  overflow: hidden;
  transform: none;
  transition: none;
}

/**
 * Solto e minimizado: some, e volta onde estava.
 *
 * Ancorada, a gaveta se esconde deslizando para fora da tela
 * (translateX de 100%). Solta, não há "fora da tela" para onde deslizar
 * — e o transform:none acima anulava justamente o que a escondia, o
 * que deixava o painel flutuante impossível de minimizar. Aqui ele sai
 * do fluxo por completo; --x e --y continuam no elemento, então
 * reabrir o traz de volta exatamente no mesmo lugar.
 */
.gaveta.solta:not(.aberta) {
  display: none;
}

.gaveta.solta .topo { cursor: grab; }
.gaveta.solta.arrastando .topo { cursor: grabbing; }
.gaveta.solta.arrastando { user-select: none; }

/* Ancorada, o cabeçalho não arrasta — não haveria para onde. */
.topo { cursor: default; }

/* Alça de redimensionar: 6px de área de clique, traço só no hover. */
.punho {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: transparent;
}

.punho:hover,
.punho.ativo {
  background: var(--violeta);
  opacity: .5;
}

.topo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  background: linear-gradient(135deg, var(--roxo), var(--violeta));
  color: #fff;
}

.topo svg { width: 23px; height: 23px; flex: none; }

.topo .titulo {
  font-weight: 600;
  font-size: 13.5px;
  letter-spacing: -.01em;
}

.topo .quem {
  font-size: 11.5px;
  opacity: .82;
}

.topo .espaco { flex: 1; }

.icone-botao {
  border: none;
  background: rgba(255, 255, 255, .15);
  color: #fff;
  width: 29px;
  height: 29px;
  border-radius: 9px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 15px;
  line-height: 1;
  font-family: var(--fonte);
  transition: background .15s ease;
}

.icone-botao:hover { background: rgba(255, 255, 255, .28); }
.icone-botao:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}

/* ---------- busca ---------- */

.busca {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--borda);
  background: var(--superficie);
}

.busca input {
  flex: 1;
  min-width: 0;
  padding: 8px 11px;
  border: 1px solid var(--borda);
  border-radius: 9px;
  background: var(--elevado);
  color: var(--texto);
  font-size: 13px;
  font-family: var(--fonte);
  line-height: 1.4;
}

.busca input::placeholder { color: var(--fraco); }

.busca input:focus {
  outline: 2px solid var(--violeta);
  outline-offset: -1px;
  border-color: transparent;
}

.busca button {
  border: none;
  border-radius: 9px;
  padding: 0 13px;
  background: var(--roxo);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -.01em;
  cursor: pointer;
  font-family: var(--fonte);
}

.busca button:hover { background: var(--violeta); }

/* ---------- corpo ---------- */

.corpo {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 13px 14px 24px;
}

.corpo::-webkit-scrollbar { width: 9px; }
.corpo::-webkit-scrollbar-track { background: transparent; }
.corpo::-webkit-scrollbar-thumb {
  background: var(--borda);
  border-radius: 9px;
  border: 2px solid var(--fundo);
}

.bloco { margin-bottom: 15px; }

.rotulo {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--fraco);
  margin-bottom: 7px;
}

.cartao {
  border: 1px solid var(--borda);
  border-radius: 11px;
  padding: 11px 12px;
  background: var(--superficie);
}

.cartao + .cartao { margin-top: 7px; }

.linha {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.nome {
  font-weight: 600;
  font-size: 14.5px;
  letter-spacing: -.015em;
  color: var(--texto);
}

.sub {
  font-size: 12px;
  color: var(--fraco);
  line-height: 1.45;
}

.numeros {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 10px;
}

.numero {
  background: var(--elevado);
  border: 1px solid var(--borda);
  border-radius: 9px;
  padding: 7px 4px;
  text-align: center;
}

.numero b {
  display: block;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -.02em;
}

.numero span {
  font-size: 9.5px;
  color: var(--fraco);
  text-transform: uppercase;
  letter-spacing: .05em;
}

/* ---------- etiquetas ---------- */

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2.5px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  white-space: nowrap;
}

.tag.neutro {
  background: color-mix(in srgb, var(--fraco) 14%, transparent);
  color: var(--suave);
}
.tag.perigo {
  background: color-mix(in srgb, var(--perigo) 14%, transparent);
  color: var(--perigo);
}
.tag.atencao {
  background: color-mix(in srgb, var(--atencao) 16%, transparent);
  color: var(--atencao);
}
.tag.ok {
  background: color-mix(in srgb, var(--ok) 15%, transparent);
  color: var(--ok);
}
.tag.marca {
  background: color-mix(in srgb, var(--violeta) 15%, transparent);
  color: var(--violeta);
}
.tag.laranja {
  background: color-mix(in srgb, var(--laranja) 20%, transparent);
  color: var(--atencao);
}

/* ---------- caso ---------- */

.caso {
  display: block;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--borda);
  border-left: 3px solid var(--violeta);
  border-radius: 10px;
  padding: 10px 11px;
  background: var(--superficie);
  cursor: pointer;
  transition: border-color .12s ease, background .12s ease;
}

.caso + .caso { margin-top: 7px; }
.caso:hover {
  border-color: var(--violeta);
  background: var(--elevado);
}
.caso.grave { border-left-color: var(--perigo); }
.caso.fechado { border-left-color: var(--fraco); opacity: .78; }

.caso .titulo-caso {
  font-weight: 500;
  font-size: 13px;
  line-height: 1.4;
  letter-spacing: -.008em;
  margin: 3px 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.caso .rodape {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

/* ---------- sugestões ---------- */

.sugestao {
  display: flex;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 10px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--suave);
  border: 1px solid var(--borda);
  background: var(--superficie);
}

.sugestao + .sugestao { margin-top: 6px; }
.sugestao .marca-tom {
  width: 3px;
  border-radius: 3px;
  flex: none;
  background: var(--fraco);
}
.sugestao.danger .marca-tom { background: var(--perigo); }
.sugestao.warning .marca-tom { background: var(--laranja); }
.sugestao.info .marca-tom { background: var(--violeta); }

/* ---------- macro ---------- */

.macro {
  border: 1px solid var(--borda);
  border-radius: 10px;
  padding: 10px 11px;
  background: var(--superficie);
}

.macro + .macro { margin-top: 6px; }

.macro pre {
  margin: 7px 0 0;
  font-family: var(--fonte);
  font-size: 12px;
  line-height: 1.5;
  color: var(--fraco);
  white-space: pre-wrap;
  max-height: 70px;
  overflow: hidden;
}

.copiar {
  border: 1px solid var(--borda);
  background: var(--elevado);
  color: var(--suave);
  border-radius: 8px;
  padding: 3.5px 10px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--fonte);
  white-space: nowrap;
}

.copiar:hover { border-color: var(--violeta); color: var(--violeta); }

.copiar:disabled,
.acao:disabled {
  opacity: .55;
  cursor: progress;
}

/* ---------- formulário ---------- */

/**
 * Campo de texto e de seleção do painel.
 *
 * Existe porque a gaveta tem 380 px: cada campo ocupa a largura toda e
 * empilha, e um campo sem estilo próprio herdaria fonte e cor do site
 * hospedeiro — no WhatsApp Web, texto branco em fundo branco.
 */
.campo {
  width: 100%;
  box-sizing: border-box;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--borda);
  border-radius: 9px;
  background: var(--elevado);
  color: var(--texto);
  font-family: var(--fonte);
  font-size: 12.5px;
  line-height: 1.45;
}

.campo:focus {
  outline: none;
  border-color: var(--violeta);
}

.campo::placeholder { color: var(--fraco); }

/* Régua de humor: cinco degraus, sempre na mesma linha. */
.humores {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}

.humor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 2px;
  border: 1px solid var(--borda);
  border-radius: 10px;
  background: var(--elevado);
  color: var(--fraco);
  font-family: var(--fonte);
  cursor: pointer;
}

.humor:hover { border-color: var(--violeta); }

.humor .emoji {
  font-size: 16px;
  line-height: 1.1;
  /* A fonte da extensão não tem emoji; sem isto vira quadrado vazio. */
  font-family: "Apple Color Emoji", "Segoe UI Emoji",
    "Noto Color Emoji", sans-serif;
}

.humor .legenda {
  font-size: 9px;
  line-height: 1.15;
  letter-spacing: -.01em;
  text-align: center;
}

.humor[aria-pressed="true"] {
  border-color: var(--violeta);
  background: color-mix(in srgb, var(--violeta) 14%, transparent);
  color: var(--violeta);
  font-weight: 600;
}

.escolhas {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.escolha {
  border: 1px solid var(--borda);
  border-radius: 8px;
  background: var(--elevado);
  color: var(--suave);
  padding: 3.5px 12px;
  font-size: 11.5px;
  font-weight: 500;
  font-family: var(--fonte);
  cursor: pointer;
}

.escolha.sim[aria-pressed="true"] {
  border-color: var(--ok);
  background: color-mix(in srgb, var(--ok) 14%, transparent);
  color: var(--ok);
}

.escolha.nao[aria-pressed="true"] {
  border-color: var(--perigo);
  background: color-mix(in srgb, var(--perigo) 14%, transparent);
  color: var(--perigo);
}

/* Mensagem de erro do formulário — vazia, não ocupa espaço. */
.sub.falha {
  color: var(--perigo);
  margin-top: 8px;
}

.sub.falha:empty { display: none; }

/* ---------- rodapé de canais ---------- */

/**
 * As três filas da operação, lado a lado.
 *
 * Fica acima do rodapé de opções, colado nele, porque é navegação e
 * não configuração — e porque no alto já existem a busca e o cabeçalho.
 */
.canais {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--borda);
  background: var(--superficie);
}

.canais button {
  border: none;
  border-right: 1px solid var(--borda);
  background: transparent;
  color: var(--fraco);
  padding: 9px 4px;
  font-size: 11.5px;
  font-weight: 500;
  font-family: var(--fonte);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.canais button:last-child { border-right: none; }

.canais button:hover { color: var(--texto); }

.canais button[aria-pressed="true"] {
  color: var(--violeta);
  font-weight: 600;
  border-bottom-color: var(--violeta);
  background: color-mix(in srgb, var(--violeta) 9%, transparent);
}

/* ---------- filtros em chip ---------- */

/**
 * A barra de filtros da fila — etapa, segmento, escopo.
 *
 * Quebra em várias linhas de propósito: numa gaveta de 380 px, cinco
 * etapas com contagem não cabem numa linha só, e rolagem horizontal
 * esconde justamente o filtro que a pessoa procura.
 */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 9px;
}

.chip {
  border: 1px solid var(--borda);
  border-radius: 999px;
  background: var(--elevado);
  color: var(--fraco);
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--fonte);
  cursor: pointer;
  white-space: nowrap;
}

.chip:hover { border-color: var(--violeta); color: var(--violeta); }

.chip[aria-pressed="true"] {
  border-color: var(--violeta);
  background: color-mix(in srgb, var(--violeta) 14%, transparent);
  color: var(--violeta);
  font-weight: 600;
}

/* ---------- avançar e voltar etapa ---------- */

.etapas {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px dashed var(--borda);
}

.passo {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--borda);
  border-radius: 8px;
  background: var(--elevado);
  color: var(--suave);
  padding: 5px 7px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--fonte);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.passo:hover {
  border-color: var(--violeta);
  color: var(--violeta);
}

.passo:disabled { opacity: .55; cursor: progress; }

/* Ponta do fluxo: informa, não convida ao clique. */
.passo.vazio {
  border-style: dashed;
  color: var(--fraco);
  cursor: default;
  text-align: center;
}

/**
 * Mover para qualquer etapa.
 *
 * Fica abaixo dos dois botões de passo, discreto: pular etapa é o caso
 * menos frequente, e um seletor do tamanho dos botões competiria com
 * eles pela atenção.
 */
.etapa-direta {
  margin-top: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--fraco);
}

.etapa-direta:hover {
  border-color: var(--violeta);
  color: var(--violeta);
}

/* ---------- recado passageiro ---------- */

.recado {
  border-radius: 9px;
  padding: 8px 11px;
  font-size: 12px;
  line-height: 1.45;
  margin-bottom: 12px;
  border: 1px solid transparent;
}

.recado.ok {
  background: color-mix(in srgb, var(--ok) 13%, transparent);
  border-color: color-mix(in srgb, var(--ok) 35%, transparent);
  color: var(--ok);
}

.recado.atencao {
  background: color-mix(in srgb, var(--laranja) 13%, transparent);
  border-color: color-mix(in srgb, var(--laranja) 40%, transparent);
  color: var(--atencao);
}

.recado.perigo {
  background: color-mix(in srgb, var(--perigo) 13%, transparent);
  border-color: color-mix(in srgb, var(--perigo) 35%, transparent);
  color: var(--perigo);
}

/* ---------- estados ---------- */

.aviso {
  border: 1px solid color-mix(in srgb, var(--laranja) 45%, transparent);
  background: color-mix(in srgb, var(--laranja) 12%, transparent);
  color: var(--atencao);
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 12px;
  line-height: 1.45;
  margin-bottom: 13px;
}

.vazio {
  text-align: center;
  padding: 36px 18px;
  color: var(--fraco);
  font-size: 12.5px;
  line-height: 1.5;
}

.vazio b {
  display: block;
  color: var(--texto);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -.01em;
  margin-bottom: 6px;
}

.acao {
  margin-top: 13px;
  border: none;
  border-radius: 9px;
  background: var(--roxo);
  color: #fff;
  padding: 9px 15px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -.01em;
  cursor: pointer;
  font-family: var(--fonte);
}

.acao:hover { background: var(--violeta); }

.carregando {
  padding: 32px 0;
  text-align: center;
  color: var(--fraco);
  font-size: 12.5px;
}

.rodape-painel {
  padding: 9px 14px;
  border-top: 1px solid var(--borda);
  background: var(--superficie);
  font-size: 11px;
  color: var(--fraco);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rodape-painel a {
  color: var(--violeta);
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
}

.rodape-painel a:hover { text-decoration: underline; }

/* Interruptor do "abrir sozinho" — some fora do WhatsApp Web. */
.rodape-painel .auto {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.rodape-painel .auto input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: var(--violeta);
  cursor: pointer;
}
`;
})();
