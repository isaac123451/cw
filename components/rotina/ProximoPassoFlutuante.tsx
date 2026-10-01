"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Minus, SkipForward } from "lucide-react";

import IconeDaFrente from "@/components/shared/IconeDaFrente";
import { useSession } from "@/lib/context/SessionContext";
import {
  deveLembrar,
  INTERVALO_PADRAO_DO_LEMBRETE,
  INTERVALOS_DO_LEMBRETE,
  porQueDoItem,
} from "@/lib/models/proximoPasso";

import { BotaoDeAbrir } from "@/components/rotina/ProximoPasso";
import { useMeuDia } from "@/components/rotina/useMeuDia";
import { useProximoPasso } from "@/components/rotina/useProximoPasso";

/*
  As escolhas do cartão ficam no navegador de quem usa (aberto ou
  minimizado, onde ele foi arrastado, de quanto em quanto lembrar): são
  conveniência de quem olha, não dado da operação.
*/
const EVENTO = "cw:proximo-passo";
const CHAVE_ABERTO = "cw:proximo:aberto";
const CHAVE_POSICAO = "cw:proximo:posicao";
const CHAVE_LEMBRETE = "cw:proximo:lembrete";

function ler(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
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
function useGuardado(chave: string) {
  return useSyncExternalStore(ouvir, () => ler(chave), () => null);
}

/* Onde o cartão não aparece: no Meu dia ele já está no topo; nas telas de entrada não há fila. */
const FORA = [/^\/meu-dia/, /^\/login/, /^\/cadastro/, /^\/primeiro-acesso/];

/**
 * O próximo passo em qualquer tela (1.123).
 *
 * Fase 34: "cards e pop-ups de foco — lembretes curtos e o próximo passo à
 * vista, para quem perde o foco rápido". Um cartão pequeno no canto, com o
 * primeiro da fila do Meu dia e o botão para abrir; arrastável (sem
 * desfoque, como as mini-janelas) e minimizável num botão.
 *
 * **O lembrete:** se a fila fica parada o intervalo inteiro (25 min, ou o
 * que a pessoa escolher), o cartão se abre sozinho com uma linha curta —
 * sem som, sem faixa —, e fecha de novo em 20 s se estava minimizado.
 * Quem está trabalhando não é interrompido: cada item que sai zera o
 * relógio.
 */
export default function ProximoPassoFlutuante() {
  const pathname = usePathname();
  const sessao = useSession();
  if (!sessao || FORA.some((r) => r.test(pathname))) return null;
  return <Cartao />;
}

function Cartao() {
  const dia = useMeuDia();
  const { item, resumo, pular, carregando } = useProximoPasso(dia, dia.feitasHoje);

  const aberto = useGuardado(CHAVE_ABERTO) !== "0";
  const posicaoGuardada = useGuardado(CHAVE_POSICAO);
  const intervalo = Number(useGuardado(CHAVE_LEMBRETE) ?? INTERVALO_PADRAO_DO_LEMBRETE);

  const posicao = (() => {
    try {
      const p = JSON.parse(posicaoGuardada ?? "null") as { direita: number; baixo: number } | null;
      return p && Number.isFinite(p.direita) && Number.isFinite(p.baixo) ? p : { direita: 20, baixo: 20 };
    } catch {
      return { direita: 20, baixo: 20 };
    }
  })();

  /* Arrastar: a posição acompanha o ponteiro e fica guardada ao soltar. */
  const [arrasto, setArrasto] = useState<{ direita: number; baixo: number } | null>(null);
  const inicio = useRef<{ x: number; y: number; direita: number; baixo: number } | null>(null);
  const atual = arrasto ?? posicao;

  /* O lembrete de foco. */
  const [lembrando, setLembrando] = useState(false);
  const chaveDoItem = item?.chave ?? "";
  const paradaDesde = useRef(0);
  const ultimoLembrete = useRef(0);
  useEffect(() => {
    paradaDesde.current = Date.now();
  }, [chaveDoItem]);
  useEffect(() => {
    if (!item || intervalo <= 0) return;
    const relogio = window.setInterval(() => {
      const agora = Date.now();
      if (deveLembrar({ paradaDesde: paradaDesde.current, ultimoLembrete: ultimoLembrete.current, intervaloMin: intervalo, agora })) {
        ultimoLembrete.current = agora;
        setLembrando(true);
      }
    }, 30_000);
    return () => window.clearInterval(relogio);
  }, [item, intervalo]);
  useEffect(() => {
    if (!lembrando) return;
    const t = window.setTimeout(() => setLembrando(false), 20_000);
    return () => window.clearTimeout(t);
  }, [lembrando]);

  if (carregando || !item) return null;

  const visivel = aberto || lembrando;
  const urgente = item.atrasado || item.critico;

  const segurar = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, a, select")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { x: e.clientX, y: e.clientY, direita: atual.direita, baixo: atual.baixo };
  };
  const mover = (e: React.PointerEvent<HTMLElement>) => {
    const i = inicio.current;
    if (!i) return;
    setArrasto({
      direita: Math.min(Math.max(i.direita - (e.clientX - i.x), 4), window.innerWidth - 120),
      baixo: Math.min(Math.max(i.baixo - (e.clientY - i.y), 4), window.innerHeight - 60),
    });
  };
  const soltar = () => {
    if (inicio.current && arrasto) gravar(CHAVE_POSICAO, JSON.stringify(arrasto));
    inicio.current = null;
    setArrasto(null);
  };

  if (!visivel) {
    return (
      <button
        type="button"
        onClick={() => gravar(CHAVE_ABERTO, "1")}
        style={{ right: atual.direita, bottom: atual.baixo }}
        className="fixed z-[60] flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-lg transition-colors hover:bg-zinc-50"
        title="Mostrar o próximo passo"
      >
        {urgente && <span className="h-2 w-2 rounded-full bg-amber-500" />}
        Próximo passo · <span className="tabular-nums">{resumo.total}</span>
      </button>
    );
  }

  return (
    <section
      aria-label="Próximo passo"
      style={{ right: atual.direita, bottom: atual.baixo }}
      className={`fixed z-[60] w-[300px] rounded-2xl border bg-white shadow-xl ${lembrando ? "border-violet-300 ring-2 ring-violet-200" : "border-zinc-200"}`}
    >
      <header
        onPointerDown={segurar}
        onPointerMove={mover}
        onPointerUp={soltar}
        className="flex cursor-move select-none items-center justify-between gap-2 rounded-t-2xl border-b border-zinc-100 px-3 py-2"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Próximo passo</span>
        <span className="flex items-center gap-1">
          <Link href="/meu-dia" className="rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
            Meu dia
          </Link>
          <button
            type="button"
            onClick={() => {
              setLembrando(false);
              gravar(CHAVE_ABERTO, "0");
            }}
            aria-label="Minimizar o próximo passo"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Minus size={14} />
          </button>
        </span>
      </header>

      <div className="px-3 py-2.5">
        {lembrando && (
          <p className="mb-1.5 text-xs text-violet-800">Lembrete de foco: a fila está parada há {intervalo} min.</p>
        )}
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
          {item.frente && <IconeDaFrente frente={item.frente} size={13} />}
          <span className="truncate">{item.titulo}</span>
        </p>
        <p className={`mt-0.5 text-xs ${urgente ? "text-amber-800" : "text-zinc-500"}`}>{porQueDoItem(item)}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <BotaoDeAbrir item={item} compacto />
          <button
            type="button"
            onClick={pular}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
          >
            <SkipForward size={12} /> Pular
          </button>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-2 rounded-b-2xl border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">
        <span className="tabular-nums">
          {resumo.total} na fila{resumo.atrasados > 0 && ` · ${resumo.atrasados} fora do prazo`}
        </span>
        <label className="flex items-center gap-1">
          lembrar
          <select
            value={intervalo}
            onChange={(e) => gravar(CHAVE_LEMBRETE, e.target.value)}
            aria-label="De quanto em quanto lembrar quando a fila fica parada"
            className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[11px] outline-none"
          >
            {INTERVALOS_DO_LEMBRETE.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "nunca" : `${m} min`}
              </option>
            ))}
          </select>
        </label>
      </footer>
    </section>
  );
}
