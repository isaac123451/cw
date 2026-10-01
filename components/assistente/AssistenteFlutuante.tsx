"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Bot, Eraser, Loader2, Maximize2, Send, X } from "lucide-react";

import { itemDeConfiguracoes, menuItems } from "@/core/navigation/menu";
import { useCases } from "@/lib/context/CaseContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useConversaDoAssistente } from "@/lib/hooks/useConversaDoAssistente";
import { contextoDaTela } from "@/lib/models/contextoDaTela";

/* Onde o botão não aparece: na própria página do assistente e nas telas de entrada. */
const FORA = [/^\/assistente/, /^\/login/, /^\/cadastro/, /^\/primeiro-acesso/];

const CHAVE_POSICAO = "cw:assistente:posicao";
const EVENTO = "cw:assistente";

function lerPosicao() {
  try {
    return window.localStorage.getItem(CHAVE_POSICAO);
  } catch {
    return null;
  }
}
function gravarPosicao(valor: { direita: number; baixo: number }) {
  try {
    window.localStorage.setItem(CHAVE_POSICAO, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: vale só nesta tela */
  }
  window.dispatchEvent(new Event(EVENTO));
}
function ouvir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}
const nada = () => () => {};

/**
 * O assistente em qualquer tela (1.125, Fase 28: "na plataforma, um botão
 * flutuante e arrastável que abre o assistente com o contexto da tela").
 *
 * Um botão redondo no canto — arrastável, sem desfoque, ao lado do cartão
 * do próximo passo — que abre a conversa ali mesmo, sem sair da tela. A
 * conversa é a da página do assistente (`useConversaDoAssistente`: o mesmo
 * retrato, os mesmos prazos), com o **contexto da tela** junto: a
 * mini-janela na frente, a ficha aberta pelo endereço, ou o nome da tela —
 * e as sugestões mudam com ele ("o que fazer agora neste caso?").
 */
export default function AssistenteFlutuante() {
  const pathname = usePathname();
  const sessao = useSession();
  const montado = useSyncExternalStore(nada, () => true, () => false);
  if (!montado || !sessao || FORA.some((r) => r.test(pathname))) return null;
  return <Painel caminho={pathname} />;
}

function Painel({ caminho }: { caminho: string }) {
  const { cases } = useCases();
  const { responses } = useNps();
  const { janelas } = useJanelas();
  const { turns, setTurns, busy, perguntar, aiEnabled } = useConversaDoAssistente();

  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const nomeDaTela = [...menuItems, itemDeConfiguracoes].find((i) => caminho === i.href || caminho.startsWith(`${i.href}/`))?.title;
  const contexto = useMemo(
    () => contextoDaTela({ caminho, nomeDaTela, casos: cases, nps: responses, janelas }),
    [caminho, nomeDaTela, cases, responses, janelas]
  );

  /* Posição: ao lado do cartão do próximo passo; arrastar guarda no navegador. */
  const guardada = useSyncExternalStore(ouvir, lerPosicao, () => null);
  const padrao = window.innerWidth < 760 ? { direita: 20, baixo: 84 } : { direita: 336, baixo: 20 };
  const posicao = (() => {
    try {
      const p = JSON.parse(guardada ?? "null") as { direita: number; baixo: number } | null;
      return p && Number.isFinite(p.direita) && Number.isFinite(p.baixo) ? p : padrao;
    } catch {
      return padrao;
    }
  })();
  const [arrasto, setArrasto] = useState<{ direita: number; baixo: number } | null>(null);
  const inicio = useRef<{ x: number; y: number; direita: number; baixo: number; moveu: boolean } | null>(null);
  const atual = arrasto ?? posicao;
  /* O clique que termina um arrasto não abre o painel. */
  const acabouDeArrastar = useRef(false);

  useEffect(() => {
    if (!aberto) return;
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [turns, aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  const segurar = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a, input, textarea, [data-sem-arrasto]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { x: e.clientX, y: e.clientY, direita: atual.direita, baixo: atual.baixo, moveu: false };
  };
  const mover = (e: React.PointerEvent<HTMLElement>) => {
    const i = inicio.current;
    if (!i) return;
    const dx = e.clientX - i.x;
    const dy = e.clientY - i.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) i.moveu = true;
    if (!i.moveu) return;
    setArrasto({
      direita: Math.min(Math.max(i.direita - dx, 4), window.innerWidth - 60),
      baixo: Math.min(Math.max(i.baixo - dy, 4), window.innerHeight - 60),
    });
  };
  const soltar = () => {
    const i = inicio.current;
    inicio.current = null;
    if (i?.moveu && arrasto) {
      gravarPosicao(arrasto);
      acabouDeArrastar.current = true;
    }
    setArrasto(null);
  };
  /* Abrir é o clique de sempre — mouse, Enter, Espaço ou leitor de tela. */
  const clicar = () => {
    if (acabouDeArrastar.current) {
      acabouDeArrastar.current = false;
      return;
    }
    setAberto((a) => !a);
  };

  const enviar = (pergunta: string) => {
    if (!pergunta.trim() || busy) return;
    setTexto("");
    void perguntar(pergunta, contexto.texto);
  };

  /* O painel abre por cima do botão, sem sair da tela. */
  const larguraDoPainel = Math.min(380, window.innerWidth - 16);
  const direitaDoPainel = Math.min(Math.max(atual.direita, 8), window.innerWidth - larguraDoPainel - 8);
  const baixoDoPainel = Math.min(atual.baixo + 56, window.innerHeight - 200);

  return (
    <>
      <button
        type="button"
        onPointerDown={segurar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onClick={clicar}
        aria-label={aberto ? "Fechar o assistente" : "Perguntar ao assistente sobre esta tela"}
        aria-expanded={aberto}
        title="Assistente — arraste para mudar de lugar"
        style={{ right: atual.direita, bottom: atual.baixo }}
        className={`fixed z-[61] flex h-11 w-11 cursor-pointer touch-none items-center justify-center rounded-full shadow-lg ring-1 transition-colors ${
          aberto ? "bg-violet-800 text-white ring-violet-900" : "bg-white text-violet-700 ring-zinc-200 hover:bg-violet-50"
        }`}
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Bot size={19} />}
      </button>

      {aberto && (
        <section
          aria-label="Assistente"
          style={{ right: direitaDoPainel, bottom: baixoDoPainel, width: larguraDoPainel }}
          className="fixed z-[61] flex max-h-[min(560px,calc(100vh-120px))] flex-col rounded-2xl border border-zinc-200 bg-white shadow-xl"
        >
          <header className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                <Bot size={15} className="text-violet-700" /> Assistente
              </p>
              <p className="truncate text-[11px] text-zinc-500" title={contexto.rotulo}>
                Sobre: {contexto.rotulo}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-0.5">
              {turns.length > 0 && (
                <button type="button" onClick={() => setTurns([])} aria-label="Limpar a conversa" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                  <Eraser size={14} />
                </button>
              )}
              <Link href="/assistente" aria-label="Abrir o assistente em tela cheia" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <Maximize2 size={14} />
              </Link>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar o assistente" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <X size={14} />
              </button>
            </span>
          </header>

          <div className="min-h-[120px] flex-1 space-y-3 overflow-y-auto px-3.5 py-3 text-sm">
            {aiEnabled === false && (
              <p className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-500">Sem IA configurada: respostas prontas sobre nota, fila, prazos e retenção.</p>
            )}
            {turns.length === 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-500">Pergunte algo sobre esta tela, ou comece por uma destas:</p>
                {contexto.sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => enviar(s)}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-violet-50 hover:text-violet-800 hover:ring-violet-200 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              turns.map((t) => (
                <div key={t.id} className="space-y-1.5">
                  <p className="ml-6 rounded-xl rounded-br-sm bg-violet-50 px-3 py-1.5 text-[13px] text-violet-900">{t.question}</p>
                  {t.answer ? (
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800">{t.answer}</p>
                  ) : t.local ? (
                    <div className="space-y-1 text-[13px] leading-relaxed text-zinc-800">
                      {t.local.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  ) : t.streaming ? (
                    <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Loader2 size={12} className="animate-spin" /> Pensando…
                    </p>
                  ) : null}
                  {t.error && !t.local && <p className="text-xs text-rose-700">{t.error}</p>}
                </div>
              ))
            )}
            <div ref={fimRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
            className="flex items-end gap-2 border-t border-zinc-100 p-2.5"
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(texto);
                }
              }}
              rows={1}
              placeholder="Pergunte sobre esta tela…"
              aria-label="Pergunta ao assistente"
              className="max-h-28 min-h-[38px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            <button
              type="submit"
              disabled={busy || !texto.trim()}
              aria-label="Enviar a pergunta"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-violet-800 text-white transition-colors hover:bg-violet-900 disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
