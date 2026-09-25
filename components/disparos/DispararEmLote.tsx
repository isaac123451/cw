"use client";

import { useEffect, useState } from "react";

import { Loader2, Send, Square } from "lucide-react";

import { criarLoteDeDisparo, lerLotesDeDisparo, pararLoteDeDisparo } from "@/lib/actions/disparos";
import { useToast } from "@/lib/context/ToastContext";
import type { LoteView, OrigemDoDisparo } from "@/lib/models/disparos";

export interface CandidatoAoDisparo {
  chave: string;
  nome: string;
  telefone: string;
  mensagem: string;
  ref: string;
  /** "avaliou 10, resolvido", "2º lembrete" — por que está na lista. */
  motivo?: string;
}

const ROTULO_DA_SITUACAO: Record<string, string> = { ativo: "no WhatsApp", pausado: "pausada", concluido: "concluída", parado: "parada" };

/**
 * Montar um disparo em lote (1.78) — a lista escolhida por você.
 *
 * Abre em linha, não em janela: a lista com as caixas (os primeiros vêm
 * marcados), a mensagem do primeiro para conferir e "Criar a lista". A
 * lista vai para o WhatsApp Web, onde a extensão abre uma conversa por
 * vez, em lotes de 10 com ~40 s entre uma e outra; quem aperta Enter é
 * você. Embaixo, as listas recentes, com o que já saiu e o botão de parar.
 */
export default function DispararEmLote({
  nome,
  origem,
  campanhaId,
  candidatos,
  marcadosDeInicio = 10,
}: {
  nome: string;
  origem: OrigemDoDisparo;
  campanhaId?: string;
  candidatos: CandidatoAoDisparo[];
  marcadosDeInicio?: number;
}) {
  const { notify } = useToast();
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);
  const [lotes, setLotes] = useState<LoteView[]>([]);

  async function recarregar() {
    const r = await lerLotesDeDisparo();
    if (r.ok) setLotes(r.lotes.filter((l) => l.origem === origem).slice(0, 3));
  }

  useEffect(() => {
    let vivo = true;
    lerLotesDeDisparo().then((r) => vivo && r.ok && setLotes(r.lotes.filter((l) => l.origem === origem).slice(0, 3)));
    return () => {
      vivo = false;
    };
  }, [origem]);

  function abrir() {
    setMarcados(new Set(candidatos.slice(0, marcadosDeInicio).map((c) => c.chave)));
    setAberto(true);
  }

  async function criar() {
    const itens = candidatos.filter((c) => marcados.has(c.chave)).map(({ nome: n, telefone, mensagem, ref }) => ({ nome: n, telefone, mensagem, ref }));
    setCriando(true);
    const r = await criarLoteDeDisparo({ nome, origem, campanhaId, itens });
    setCriando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "A lista não foi criada.", detail: r.erro });
      return;
    }
    setAberto(false);
    notify({ tone: "success", title: `Lista com ${r.itens} contato(s) criada.`, detail: "Abra o WhatsApp Web: o painel CW mostra a fila. Quem aperta Enter é você." });
    await recarregar();
  }

  async function parar(id: string) {
    const r = await pararLoteDeDisparo(id);
    if (!r.ok) notify({ tone: "error", title: "A lista não parou.", detail: r.erro });
    await recarregar();
  }

  const ativos = lotes.filter((l) => l.situacao === "ativo" || l.situacao === "pausado");

  return (
    <div className="rounded-xl bg-zinc-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-zinc-700">
          <strong className="font-semibold">Disparo em lote pelo WhatsApp</strong>
          <span className="text-zinc-500"> · lotes de 10, uma conversa a cada ~40 s, com pausa e parada. Você aperta Enter; cada envio fica registrado.</span>
        </p>
        {!aberto && (
          <button
            type="button"
            onClick={abrir}
            disabled={candidatos.length === 0}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Send size={13} /> Montar a lista ({candidatos.length})
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            <span className="tabular-nums">{marcados.size} marcado(s)</span>
            <button type="button" onClick={() => setMarcados(new Set(candidatos.map((c) => c.chave)))} className="font-medium text-violet-700 hover:underline">
              todos
            </button>
            <button type="button" onClick={() => setMarcados(new Set())} className="font-medium text-violet-700 hover:underline">
              nenhum
            </button>
          </div>
          <ul className="mt-2 max-h-64 divide-y divide-zinc-200/70 overflow-y-auto rounded-lg bg-white ring-1 ring-zinc-200">
            {candidatos.map((c) => (
              <li key={c.chave}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={marcados.has(c.chave)}
                    onChange={(e) =>
                      setMarcados((m) => {
                        const n = new Set(m);
                        if (e.target.checked) n.add(c.chave);
                        else n.delete(c.chave);
                        return n;
                      })
                    }
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-zinc-800">{c.nome}</span>
                    {c.motivo && <span className="text-xs text-zinc-500"> · {c.motivo}</span>}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-400">{c.telefone}</span>
                </label>
              </li>
            ))}
          </ul>
          {candidatos[0] && (
            <p className="mt-2 line-clamp-3 rounded-lg bg-white px-3 py-2 text-xs text-zinc-600 ring-1 ring-zinc-200" title={candidatos[0].mensagem}>
              <span className="font-semibold text-zinc-800">Mensagem, no primeiro: </span>
              {candidatos[0].mensagem}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="h-8 rounded-lg px-3 text-xs font-medium text-zinc-600 hover:bg-white">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void criar()}
              disabled={criando || marcados.size === 0}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {criando && <Loader2 size={13} className="animate-spin" />} Criar a lista ({marcados.size})
            </button>
          </div>
        </div>
      )}

      {lotes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-zinc-600">
          {lotes.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium text-zinc-800">{l.nome}</span>
              <span className="tabular-nums">
                {l.enviados} enviado(s) de {l.total}
                {l.pulados ? ` · ${l.pulados} pulado(s)` : ""}
              </span>
              <span className="text-zinc-400">· {ROTULO_DA_SITUACAO[l.situacao] ?? l.situacao}</span>
              {(l.situacao === "ativo" || l.situacao === "pausado") && (
                <button type="button" onClick={() => void parar(l.id)} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-rose-700 hover:bg-rose-50">
                  <Square size={10} /> parar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ativos.length > 1 && <p className="mt-1 text-[11px] text-amber-700">Há mais de uma lista aberta: o WhatsApp trabalha a mais recente.</p>}
    </div>
  );
}
