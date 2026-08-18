/**
 * Estilo do painel, como texto.
 *
 * Vai para dentro de um Shadow DOM em `painel.js`. Folha injetada na
 * página não serviria: o CSS do WhatsApp Web é agressivo e reescreveria
 * metade disto — e o contrário também vale, um seletor nosso vazando
 * quebraria a tela de quem está trabalhando.
 *
 * As cores são as da marca: roxo `#5B2A86`, violeta `#7B3FBF` e laranja
 * `#F9A11B` — a Cardápio Web é roxa **e** laranja.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || CW.CSS) return;

  CW.CSS = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    Helvetica, Arial, sans-serif;
}

* { box-sizing: border-box; }

.raiz {
  --roxo: #5B2A86;
  --violeta: #7B3FBF;
  --laranja: #F9A11B;
  --fundo: #ffffff;
  --superficie: #fafafa;
  --borda: #e4e4e7;
  --texto: #18181b;
  --fraco: #71717a;
  --perigo: #dc2626;
  --atencao: #b45309;
  --ok: #15803d;

  position: fixed;
  inset: 0 0 0 auto;
  z-index: 2147483000;
  pointer-events: none;
  color: var(--texto);
  font-size: 13px;
  line-height: 1.45;
}

@media (prefers-color-scheme: dark) {
  .raiz {
    --fundo: #17181c;
    --superficie: #1f2026;
    --borda: #303138;
    --texto: #ececf1;
    --fraco: #a1a1aa;
    --perigo: #f87171;
    --atencao: #fbbf24;
    --ok: #4ade80;
  }
}

/* ---------- botão flutuante ---------- */

.gatilho {
  position: absolute;
  right: 18px;
  bottom: 24px;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(145deg, var(--violeta), var(--roxo));
  box-shadow: 0 6px 20px rgba(91, 42, 134, .38);
  cursor: pointer;
  pointer-events: auto;
  display: grid;
  place-items: center;
  transition: transform .15s ease, box-shadow .15s ease;
}

.gatilho:hover { transform: translateY(-2px); }
.gatilho:active { transform: translateY(0); }

.gatilho svg { width: 24px; height: 24px; display: block; }

.gatilho .selo {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--perigo);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: none;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

.gatilho .selo.visivel { display: flex; }

/* ---------- gaveta ---------- */

.gaveta {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  max-width: 92vw;
  background: var(--fundo);
  border-left: 1px solid var(--borda);
  box-shadow: -14px 0 40px rgba(0, 0, 0, .16);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transform: translateX(100%);
  transition: transform .2s ease;
}

.gaveta.aberta { transform: translateX(0); }

.topo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, var(--roxo), var(--violeta));
  color: #fff;
}

.topo svg { width: 22px; height: 22px; flex: none; }

.topo .titulo {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: .2px;
}

.topo .quem {
  font-size: 11px;
  opacity: .85;
}

.topo .espaco { flex: 1; }

.icone-botao {
  border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 15px;
  line-height: 1;
}

.icone-botao:hover { background: rgba(255, 255, 255, .26); }

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
  padding: 7px 10px;
  border: 1px solid var(--borda);
  border-radius: 8px;
  background: var(--fundo);
  color: var(--texto);
  font-size: 12.5px;
  font-family: inherit;
}

.busca input:focus {
  outline: 2px solid var(--violeta);
  outline-offset: -1px;
}

.busca button {
  border: none;
  border-radius: 8px;
  padding: 0 12px;
  background: var(--roxo);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

/* ---------- corpo ---------- */

.corpo {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 22px;
}

.corpo::-webkit-scrollbar { width: 8px; }
.corpo::-webkit-scrollbar-thumb {
  background: var(--borda);
  border-radius: 8px;
}

.bloco { margin-bottom: 14px; }

.rotulo {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .7px;
  text-transform: uppercase;
  color: var(--fraco);
  margin-bottom: 6px;
}

.cartao {
  border: 1px solid var(--borda);
  border-radius: 10px;
  padding: 10px 11px;
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
  font-size: 14px;
  color: var(--texto);
}

.sub {
  font-size: 11.5px;
  color: var(--fraco);
}

.numeros {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 9px;
}

.numero {
  background: var(--fundo);
  border: 1px solid var(--borda);
  border-radius: 8px;
  padding: 6px 4px;
  text-align: center;
}

.numero b {
  display: block;
  font-size: 15px;
  line-height: 1.1;
}

.numero span {
  font-size: 9.5px;
  color: var(--fraco);
  text-transform: uppercase;
  letter-spacing: .3px;
}

/* ---------- etiquetas ---------- */

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}

.tag.neutro {
  background: rgba(113, 113, 122, .12);
  color: var(--fraco);
}
.tag.perigo {
  background: rgba(220, 38, 38, .12);
  color: var(--perigo);
}
.tag.atencao {
  background: rgba(180, 83, 9, .13);
  color: var(--atencao);
}
.tag.ok {
  background: rgba(21, 128, 61, .13);
  color: var(--ok);
}
.tag.marca {
  background: rgba(123, 63, 191, .13);
  color: var(--violeta);
}
.tag.laranja {
  background: rgba(249, 161, 27, .18);
  color: #a16207;
}

/* ---------- caso ---------- */

.caso {
  display: block;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--borda);
  border-left: 3px solid var(--violeta);
  border-radius: 9px;
  padding: 9px 10px;
  background: var(--superficie);
  cursor: pointer;
}

.caso + .caso { margin-top: 7px; }
.caso:hover { border-color: var(--violeta); }
.caso.grave { border-left-color: var(--perigo); }
.caso.fechado { border-left-color: #a1a1aa; opacity: .82; }

.caso .titulo-caso {
  font-weight: 600;
  font-size: 12.5px;
  margin: 2px 0 5px;
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
  gap: 7px;
  padding: 8px 10px;
  border-radius: 9px;
  font-size: 12px;
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
  border-radius: 9px;
  padding: 9px 10px;
  background: var(--superficie);
}

.macro + .macro { margin-top: 6px; }

.macro pre {
  margin: 6px 0 0;
  font-family: inherit;
  font-size: 11.5px;
  color: var(--fraco);
  white-space: pre-wrap;
  max-height: 66px;
  overflow: hidden;
}

.copiar {
  border: 1px solid var(--borda);
  background: var(--fundo);
  color: var(--texto);
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.copiar:hover { border-color: var(--violeta); color: var(--violeta); }

/* ---------- estados ---------- */

.aviso {
  border: 1px solid rgba(249, 161, 27, .5);
  background: rgba(249, 161, 27, .1);
  color: var(--atencao);
  border-radius: 9px;
  padding: 8px 10px;
  font-size: 11.5px;
  margin-bottom: 12px;
}

.vazio {
  text-align: center;
  padding: 34px 16px;
  color: var(--fraco);
  font-size: 12.5px;
}

.vazio b {
  display: block;
  color: var(--texto);
  font-size: 13.5px;
  margin-bottom: 5px;
}

.acao {
  margin-top: 12px;
  border: none;
  border-radius: 8px;
  background: var(--roxo);
  color: #fff;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.carregando {
  padding: 30px 0;
  text-align: center;
  color: var(--fraco);
  font-size: 12px;
}

.rodape-painel {
  padding: 9px 14px;
  border-top: 1px solid var(--borda);
  background: var(--superficie);
  font-size: 10.5px;
  color: var(--fraco);
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.rodape-painel a {
  color: var(--violeta);
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
}
`;
})();
