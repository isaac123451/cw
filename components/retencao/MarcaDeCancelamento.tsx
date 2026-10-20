"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronLeft, Loader2 } from "lucide-react";

import { lerMarcaDaReclamacao, marcarReclamacao, type MarcaDaReclamacao } from "@/lib/actions/retencao";
import { SETORES } from "@/lib/models/cancelamento";
import { useToast } from "@/lib/context/ToastContext";

export interface MarcaAtual {
  marca: MarcaDaReclamacao;
  setor?: string;
}

type Passo = "pediu" | "desfecho" | "quem";

/** O que o botão diz, na cor do desfecho. */
function rotulo(m: MarcaAtual | null) {
  if (!m) return { texto: "Cancelamento?", cor: "border border-dashed border-zinc-300 text-zinc-500 ring-0 hover:border-zinc-400 hover:text-zinc-800" };
  if (m.marca === "nao-e-cancelamento") return { texto: "Não pediu", cor: "text-zinc-500 ring-zinc-200 hover:ring-zinc-300" };
  if (m.marca === "retido") return { texto: "Retido", cor: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  if (m.marca === "cancelado") return { texto: "Cancelou", cor: "bg-rose-50 text-rose-800 ring-rose-200" };
  return { texto: `Cancelou · ${m.setor || "outro setor"}`, cor: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
}

/**
 * Cancelamento da reclamação, em três perguntas (20/10/2026): "O cliente
 * solicitou o cancelamento?" → "Foi cancelado ou retido?" → "Quem
 * cancelou?" (nosso atendimento ou outro setor). Cada resposta final grava
 * na hora e a reclamação entra na conta da Retenção — mesmo que o texto
 * dela não fale em cancelar.
 *
 * O painel é fixo na tela, preso ao botão: dentro da tabela da lista,
 * um painel absoluto seria cortado pela rolagem lateral.
 */
export default function MarcaDeCancelamento({
  protocolo,
  inicial,
  onMudou,
  className = "",
}: {
  protocolo: string;
  /** A marca já lida (a lista lê todas de uma vez); sem ela, o botão busca a sua. */
  inicial?: MarcaAtual | null;
  onMudou?: (m: MarcaAtual | null) => void;
  className?: string;
}) {
  const { notify } = useToast();
  const [buscada, setBuscada] = useState<MarcaAtual | null | undefined>(undefined);
  const [local, setLocal] = useState<{ valor: MarcaAtual | null } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState<Passo>("pediu");
  const [gravando, setGravando] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);

  /* Sem a marca vinda de fora (a ficha do caso), busca a desta reclamação. */
  useEffect(() => {
    if (inicial !== undefined) return;
    let vivo = true;
    lerMarcaDaReclamacao(protocolo).then((r) => {
      if (vivo) setBuscada(r?.marca ? { marca: r.marca, setor: r.setor } : null);
    });
    return () => {
      vivo = false;
    };
  }, [protocolo, inicial]);

  const marca = local ? local.valor : inicial !== undefined ? inicial : buscada ?? null;

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    function fora(e: MouseEvent) {
      if (!painel.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) fechar();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  async function gravar(nova: MarcaDaReclamacao | null, setor?: string) {
    setGravando(true);
    const r = await marcarReclamacao(protocolo, nova, setor);
    setGravando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
      return;
    }
    const valor = nova ? { marca: nova, setor: r.setor } : null;
    setLocal({ valor });
    onMudou?.(valor);
    setAberto(false);
    notify({
      tone: "success",
      title: `${protocolo}: ${valor ? rotulo(valor).texto.toLowerCase() : "marcação tirada"}.`,
      detail: valor && valor.marca !== "nao-e-cancelamento" ? "Já conta na Retenção." : undefined,
    });
  }

  const { texto, cor } = rotulo(marca);
  const opcao = "w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40";

  return (
    <>
      <button
        ref={botao}
        type="button"
        disabled={buscada === undefined && inicial === undefined}
        onClick={(e) => {
          e.stopPropagation();
          /* Abaixo do botão, alinhado à direita dele; perto do fim da tela, acima. */
          const r = e.currentTarget.getBoundingClientRect();
          const largura = 260;
          setPosicao({
            left: Math.max(8, Math.min(window.innerWidth - largura - 8, r.right - largura)),
            top: r.bottom + 6 + 300 > window.innerHeight ? Math.max(8, r.top - 6 - 300) : r.bottom + 6,
          });
          setPasso("pediu");
          setAberto((a) => !a);
        }}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title="O cliente solicitou o cancelamento? Marque o desfecho."
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${cor} ${className}`}
      >
        {texto}
      </button>

      {aberto && posicao && (
        <div
          ref={painel}
          role="dialog"
          aria-label="Cancelamento da reclamação"
          onClick={(e) => e.stopPropagation()}
          style={{ top: posicao.top, left: posicao.left, width: 260 }}
          className="fixed z-50 rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]"
        >
          <div className="flex items-center gap-1 px-1 pb-1.5 pt-0.5">
            {passo !== "pediu" && (
              <button
                type="button"
                onClick={() => setPasso(passo === "quem" ? "desfecho" : "pediu")}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Voltar"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <p className="text-xs font-semibold text-zinc-800">
              {passo === "pediu" ? "O cliente solicitou o cancelamento?" : passo === "desfecho" ? "Foi cancelado ou retido?" : "Quem cancelou?"}
            </p>
            {gravando && <Loader2 size={13} className="ml-auto animate-spin text-zinc-400" />}
          </div>

          {passo === "pediu" && (
            <div className="grid grid-cols-2 gap-1">
              <button type="button" disabled={gravando} onClick={() => setPasso("desfecho")} className={`${opcao} text-center ring-1 ring-inset ring-zinc-200`}>
                Sim
              </button>
              <button type="button" disabled={gravando} onClick={() => void gravar("nao-e-cancelamento")} className={`${opcao} text-center ring-1 ring-inset ring-zinc-200`}>
                Não
              </button>
            </div>
          )}

          {passo === "desfecho" && (
            <div className="grid grid-cols-2 gap-1">
              <button type="button" disabled={gravando} onClick={() => void gravar("retido")} className={`${opcao} text-center ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50`}>
                Retido
              </button>
              <button type="button" disabled={gravando} onClick={() => setPasso("quem")} className={`${opcao} text-center ring-1 ring-inset ring-rose-200 hover:bg-rose-50`}>
                Cancelado
              </button>
            </div>
          )}

          {passo === "quem" && (
            <div className="space-y-0.5">
              <button type="button" disabled={gravando} onClick={() => void gravar("cancelado")} className={`${opcao} font-medium`}>
                Nosso atendimento
                <span className="block text-[11px] font-normal text-zinc-400">conta na taxa de retenção</span>
              </button>
              <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Outro setor · não conta na taxa</p>
              {SETORES.map((setor) => (
                <button key={setor} type="button" disabled={gravando} onClick={() => void gravar("cancelado-outro-setor", setor)} className={opcao}>
                  {setor}
                </button>
              ))}
            </div>
          )}

          {marca && (
            <button
              type="button"
              disabled={gravando}
              onClick={() => void gravar(null)}
              className="mt-1.5 w-full border-t border-zinc-100 px-2.5 pt-1.5 text-left text-xs text-zinc-400 hover:text-zinc-700"
            >
              Tirar a marcação
            </button>
          )}
        </div>
      )}
    </>
  );
}
