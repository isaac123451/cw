"use client";

import { useCallback, useEffect, useState } from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import LinhasCarregando from "@/components/shared/LinhasCarregando";
import { ConfirmDelete } from "@/components/shared/Modal";

import CartaoDoKr from "@/components/okr/CartaoDoKr";
import EditorDoOkr from "@/components/okr/EditorDoOkr";

import { excluirOkr, lerOkrs, type OkrNaTela } from "@/lib/actions/okr";
import { useToast } from "@/lib/context/ToastContext";
import { OKR_4T_2026, type OkrView } from "@/lib/models/okr";

const dataCurta = (d: string) => d.split("-").reverse().join("/");

const NOVO: OkrView = { id: "", objetivo: "", inicio: "", fim: "", contexto: "", krs: [] };

/**
 * OKR (04/11/2026) — "uma página com possibilidade de montar o okr com x
 * métrica". O objetivo, os resultados-chave e, em cada um, o número de
 * hoje contra a meta do mês, calculado pela plataforma. Quem monta é o
 * administrador; todos veem.
 */
export default function OkrPage() {
  const { notify } = useToast();
  const [dados, setDados] = useState<{ okrs: OkrNaTela[]; previa: OkrNaTela | null; podeEditar: boolean; semTabela: boolean; hoje: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** O id do OKR em edição; "" é um novo. */
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<OkrView>(NOVO);
  const [excluindo, setExcluindo] = useState<OkrView | null>(null);

  const carregar = useCallback(async () => {
    const r = await lerOkrs();
    if (r.ok) {
      setDados(r);
      setErro(null);
    } else setErro(r.erro);
  }, []);

  useEffect(() => {
    let vivo = true;
    lerOkrs().then((r) => {
      if (!vivo) return;
      if (r.ok) setDados(r);
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const novo = (base: OkrView) => {
    setRascunho(base);
    setEditando("");
  };

  async function confirmarExclusao() {
    if (!excluindo) return;
    const r = await excluirOkr(excluindo.id);
    setExcluindo(null);
    if (!r.ok) {
      notify({ tone: "error", title: r.erro });
      return;
    }
    notify({ tone: "success", title: "OKR excluído." });
    await carregar();
  }

  const salvo = async () => {
    setEditando(null);
    await carregar();
  };

  const temO4T = dados?.okrs.some((o) => o.okr.inicio === OKR_4T_2026.inicio && o.okr.fim === OKR_4T_2026.fim);

  return (
    <MainLayout>
      <PageHeading eyebrow="Inteligência" title="OKR" description="O objetivo do time e como cada resultado-chave está hoje, calculado pela plataforma.">
        {dados?.podeEditar && editando === null && (
          <div className="flex flex-wrap gap-2">
            {!temO4T && (
              <button type="button" onClick={() => novo({ id: "", ...OKR_4T_2026 })} className="rounded-xl bg-violet-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-800">
                {dados.previa ? "Salvar o OKR do 4º tri" : "Usar o OKR do 4º tri"}
              </button>
            )}
            <button type="button" onClick={() => novo(NOVO)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50">
              <Plus size={15} /> Montar um OKR
            </button>
          </div>
        )}
      </PageHeading>

      {dados?.semTabela && (
        <p className="mb-4 text-sm text-amber-800">
          O banco ainda não tem onde guardar o OKR e a pesquisa de confiança. Rode <code className="rounded bg-amber-50 px-1">npm run db:push</code> uma vez e atualize a página.
        </p>
      )}

      {erro && <p className="text-sm text-rose-700">{erro}</p>}
      {!dados && !erro && <LinhasCarregando linhas={4} />}

      {editando === "" && (
        <div className="mb-6">
          <EditorDoOkr inicial={rascunho} onSalvo={salvo} onCancelar={() => setEditando(null)} />
        </div>
      )}

      {dados && dados.okrs.length === 0 && !dados.previa && editando === null && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-800">Nenhum OKR montado ainda.</p>
          <p className="mt-1 text-sm text-zinc-500">
            {dados.podeEditar ? "Comece pelo OKR do 4º trimestre: objetivo, os dois KRs e as metas de cada mês já vêm preenchidos." : "Quem é administrador monta o OKR aqui."}
          </p>
        </div>
      )}

      <div className="space-y-8">
        {(dados ? (dados.okrs.length ? dados.okrs : dados.previa && editando === null ? [dados.previa] : []) : []).map(({ okr, krs, pendentes }) => {
          if (!dados) return null;
          const previa = !okr.id;
          const emVigencia = okr.inicio <= dados.hoje && dados.hoje <= okr.fim;
          if (!previa && editando === okr.id) {
            return <EditorDoOkr key={okr.id} inicial={okr} onSalvo={salvo} onCancelar={() => setEditando(null)} />;
          }
          return (
            <section key={okr.id || "previa"}>
              {previa && (
                <p className="mb-3 text-sm text-zinc-600">
                  Prévia do OKR do 4º trimestre, já com os números de hoje.{" "}
                  {dados.podeEditar ? "Salve para fixar e poder ajustar as metas." : "Quem é administrador salva o OKR."}
                </p>
              )}
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Objetivo · {dataCurta(okr.inicio)} a {dataCurta(okr.fim)}
                    {!emVigencia && (okr.fim < dados.hoje ? " · encerrado" : " · ainda não começou")}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug text-zinc-900">{okr.objetivo}</h2>
                  {okr.contexto && <p className="mt-1 text-sm leading-relaxed text-zinc-600">{okr.contexto}</p>}
                </div>
                {dados.podeEditar && editando === null && !previa && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditando(okr.id)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800" aria-label="Editar o OKR" title="Editar">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => setExcluindo(okr)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Excluir o OKR" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {krs.map((calc, i) => (
                  <CartaoDoKr key={calc.kr.id || i} calc={calc} indice={i} pendentes={pendentes} mesAtual={dados.hoje > okr.fim ? okr.fim.slice(0, 7) : dados.hoje.slice(0, 7)} />
                ))}
              </div>
              {okr.atualizadoPor && <p className="mt-2 text-[11px] text-zinc-400">Montado por {okr.atualizadoPor}.</p>}
            </section>
          );
        })}
      </div>

      <ConfirmDelete open={Boolean(excluindo)} label={excluindo ? `o OKR "${excluindo.objetivo.slice(0, 60)}"` : ""} onCancel={() => setExcluindo(null)} onConfirm={confirmarExclusao} />
    </MainLayout>
  );
}
