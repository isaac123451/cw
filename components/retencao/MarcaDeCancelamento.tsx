"use client";

import { useEffect, useState } from "react";

import { ChevronLeft, Loader2 } from "lucide-react";

import { lerMarcaDaReclamacao, marcarReclamacao, type MarcaDaReclamacao } from "@/lib/actions/retencao";
import { SETORES } from "@/lib/models/cancelamento";
import { useToast } from "@/lib/context/ToastContext";

import { CLASSE_DO_PAINEL, usePainelPreso } from "./usePainelPreso";

export interface MarcaAtual {
  marca: MarcaDaReclamacao;
  setor?: string;
}

type Passo = "pediu" | "desfecho" | "quem" | "setor";

/** O que o botão diz, na cor do desfecho. */
export function rotuloDaMarca(m: MarcaAtual | null) {
  if (!m) return { texto: "Marcar", cor: "border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800" };
  if (m.marca === "nao-e-cancelamento") return { texto: "Não pediu", cor: "border border-zinc-200 text-zinc-500 hover:border-zinc-300" };
  if (m.marca === "retido") return { texto: "Retido", cor: "border border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (m.marca === "cancelado") return { texto: "Cancelou", cor: "border border-rose-200 bg-rose-50 text-rose-800" };
  return { texto: `Cancelou · ${m.setor || "outro setor"}`, cor: "border border-zinc-200 bg-zinc-100 text-zinc-700" };
}

const PERGUNTA: Record<Passo, string> = {
  pediu: "O cliente solicitou o cancelamento?",
  desfecho: "Foi cancelado ou retido?",
  quem: "Foi por outro setor e dentro da SLA de 24h úteis?",
  setor: "Qual setor cancelou?",
};
const ANTERIOR: Record<Passo, Passo> = { pediu: "pediu", desfecho: "pediu", quem: "desfecho", setor: "quem" };

/** As três perguntas — no painel da lista ou abertas no bloco da ficha. */
function Passos({
  passo,
  setPasso,
  gravando,
  gravar,
}: {
  passo: Passo;
  setPasso: (p: Passo) => void;
  gravando: boolean;
  gravar: (m: MarcaDaReclamacao, setor?: string) => void;
}) {
  const opcao = "rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100 disabled:opacity-40";
  return (
    <div>
      <div className="flex items-center gap-1 pb-2">
        {passo !== "pediu" && (
          <button type="button" onClick={() => setPasso(ANTERIOR[passo])} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Voltar">
            <ChevronLeft size={14} />
          </button>
        )}
        <p className="text-sm font-medium text-zinc-800">{PERGUNTA[passo]}</p>
        {gravando && <Loader2 size={13} className="ml-auto animate-spin text-zinc-400" />}
      </div>

      {passo === "pediu" && (
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={gravando} onClick={() => setPasso("desfecho")} className={opcao}>
            Sim
          </button>
          <button type="button" disabled={gravando} onClick={() => gravar("nao-e-cancelamento")} className={opcao}>
            Não
          </button>
        </div>
      )}

      {passo === "desfecho" && (
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={gravando} onClick={() => gravar("retido")} className={`${opcao} ring-emerald-200 hover:bg-emerald-50`}>
            Retido
          </button>
          <button type="button" disabled={gravando} onClick={() => setPasso("quem")} className={`${opcao} ring-rose-200 hover:bg-rose-50`}>
            Cancelado
          </button>
        </div>
      )}

      {/*
        "Foi por outro setor e dentro da SLA de 24h úteis?" (20/10): sim conta
        para o outro setor e fica fora do percentual de retenção; não é
        cancelamento nosso e entra no percentual.
      */}
      {passo === "quem" && (
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={gravando} onClick={() => setPasso("setor")} className={`${opcao} text-left`}>
            <span className="font-medium">Sim</span>
            <span className="block text-[11px] text-zinc-400">outro setor · fora da taxa</span>
          </button>
          <button type="button" disabled={gravando} onClick={() => gravar("cancelado")} className={`${opcao} text-left`}>
            <span className="font-medium">Não</span>
            <span className="block text-[11px] text-zinc-400">nosso · conta na taxa</span>
          </button>
        </div>
      )}

      {passo === "setor" && (
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            {SETORES.map((setor) => (
              <button key={setor} type="button" disabled={gravando} onClick={() => gravar("cancelado-outro-setor", setor)} className={`${opcao} text-left text-xs`}>
                {setor}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cancelamento da reclamação, em três perguntas (20/10/2026): "O cliente
 * solicitou o cancelamento?" → "Foi cancelado ou retido?" → "Quem
 * cancelou?" (nosso atendimento ou outro setor). Cada resposta final grava
 * na hora e a reclamação entra na conta da Retenção — mesmo que o texto
 * dela não fale em cancelar.
 *
 * Sempre clicável: enquanto a marca carrega (ou se a leitura falhar), o
 * botão abre do começo — "o botão é para ficar sempre disponível".
 *
 * - `modo="bloco"`: a ficha do caso — as perguntas abertas na própria
 *   lateral, e "Mudar" depois de respondido.
 * - `modo="botao"`: a coluna da lista e o "Adicionar" da Retenção — um
 *   botão com o estado, que abre as perguntas num painel.
 */
export default function MarcaDeCancelamento({
  protocolo,
  inicial,
  onMudou,
  rotuloDoBotao,
  modo = "botao",
  className = "",
}: {
  /** Protocolo, id ou link do Reclame Aqui. */
  protocolo: string;
  /** A marca já lida (a lista lê todas de uma vez); sem ela, busca a sua. */
  inicial?: MarcaAtual | null;
  onMudou?: (m: MarcaAtual | null) => void;
  /** Troca o texto do botão (o "Adicionar" da Retenção). */
  rotuloDoBotao?: string;
  modo?: "botao" | "bloco";
  className?: string;
}) {
  const { notify } = useToast();
  const [buscada, setBuscada] = useState<MarcaAtual | null>(null);
  const [local, setLocal] = useState<{ valor: MarcaAtual | null } | null>(null);
  const [passo, setPasso] = useState<Passo>("pediu");
  const [mudando, setMudando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const { aberto, alternar, fechar, botao, painel, estilo } = usePainelPreso(280, 320);

  /* Sem a marca vinda de fora (a ficha do caso), busca a desta reclamação; se falhar, segue sem marca. */
  useEffect(() => {
    if (inicial !== undefined || rotuloDoBotao) return;
    let vivo = true;
    lerMarcaDaReclamacao(protocolo)
      .then((r) => {
        if (vivo) setBuscada(r?.marca ? { marca: r.marca, setor: r.setor } : null);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [protocolo, inicial, rotuloDoBotao]);

  const marca = rotuloDoBotao ? null : local ? local.valor : inicial !== undefined ? inicial : buscada;

  async function gravar(nova: MarcaDaReclamacao | null, setor?: string) {
    if (!protocolo.trim()) {
      notify({ tone: "error", title: "Cole o protocolo ou o link da reclamação primeiro." });
      return;
    }
    setGravando(true);
    const r = await marcarReclamacao(protocolo, nova, setor).catch(() => ({ ok: false as const, erro: "O servidor não respondeu. Tente de novo." }));
    setGravando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
      return;
    }
    const valor = nova ? { marca: nova, setor: r.setor } : null;
    if (!rotuloDoBotao) setLocal({ valor });
    onMudou?.(valor);
    fechar();
    setMudando(false);
    setPasso("pediu");
    notify({
      tone: "success",
      title: `${r.protocolo} · ${r.cliente}: ${valor ? rotuloDaMarca(valor).texto.toLowerCase() : "marcação tirada"}.`,
      detail: valor && valor.marca !== "nao-e-cancelamento" ? "Já conta na Retenção." : undefined,
    });
  }

  if (modo === "bloco") {
    const { texto, cor } = rotuloDaMarca(marca);
    return (
      <section className={`rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`} aria-label="Cancelamento">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-900">Cancelamento</h3>
          {marca && !mudando && <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cor}`}>{texto}</span>}
        </div>
        <div className="mt-3">
          {marca && !mudando ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPasso("pediu");
                  setMudando(true);
                }}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
              >
                Mudar
              </button>
              <button type="button" disabled={gravando} onClick={() => void gravar(null)} className="text-xs text-zinc-400 hover:text-zinc-700">
                Tirar a marcação
              </button>
            </div>
          ) : (
            <>
              <Passos passo={passo} setPasso={setPasso} gravando={gravando} gravar={(m, s) => void gravar(m, s)} />
              {mudando && (
                <button type="button" onClick={() => setMudando(false)} className="mt-2 text-xs text-zinc-400 hover:text-zinc-700">
                  Cancelar a mudança
                </button>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  const { texto, cor } = rotuloDaMarca(marca);
  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={(e) => {
          setPasso("pediu");
          alternar(e);
        }}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="O cliente solicitou o cancelamento? Clique para marcar ou mudar."
        className={
          rotuloDoBotao
            ? `rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 ${className}`
            : `inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${cor} ${className}`
        }
      >
        {rotuloDoBotao ?? texto}
      </button>

      {aberto && (
        <div ref={painel} role="dialog" aria-label="Cancelamento da reclamação" onClick={(e) => e.stopPropagation()} style={estilo} className={`${CLASSE_DO_PAINEL} p-3`}>
          <Passos passo={passo} setPasso={setPasso} gravando={gravando} gravar={(m, s) => void gravar(m, s)} />
          {marca && (
            <button type="button" disabled={gravando} onClick={() => void gravar(null)} className="mt-2.5 w-full border-t border-zinc-100 pt-2 text-left text-xs text-zinc-400 hover:text-zinc-700">
              Tirar a marcação
            </button>
          )}
        </div>
      )}
    </>
  );
}
