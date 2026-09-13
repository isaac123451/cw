"use client";

import { useEffect, useMemo, useState } from "react";

import { Combine, Loader2, TriangleAlert } from "lucide-react";

import Modal, { GhostButton } from "@/components/shared/Modal";

import {
  previaDaUnificacao,
  sugerirGrupos,
  type CategoriaContada,
} from "@/lib/models/categorias";

import { contarCategorias, unificarCategorias } from "@/lib/actions/categorias";
import { useCases } from "@/lib/context/CaseContext";
import { useSettings } from "@/lib/context/SettingsContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  onClose: () => void;
}

/**
 * Juntar categorias que dizem a mesma coisa — com prévia e confirmação.
 *
 * A tela sugere grupos pela palavra em comum ("financeiro", "sistema"),
 * com a contagem de casos de cada categoria; a pessoa escolhe o destino
 * (o nome que fica) e quais entram. Antes de gravar, a prévia diz o que
 * vai acontecer: quantos casos mudam, as subcategorias, as respostas
 * prontas e as regras de prazo. As de origem ficam desativadas.
 */
export default function UnificarCategorias({ onClose }: Props) {

  const { notify } = useToast();
  const { aplicarCategorias } = useSettings();
  const { recarregar } = useCases();

  const [contagem, setContagem] = useState<CategoriaContada[] | null>(null);
  const [grupo, setGrupo] = useState(0);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [origemIds, setOrigemIds] = useState<string[] | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    contarCategorias()
      .then((c) => ativo && setContagem(c))
      .catch(() => ativo && setContagem([]));
    return () => {
      ativo = false;
    };
  }, []);

  const grupos = useMemo(() => (contagem ? sugerirGrupos(contagem) : []), [contagem]);
  const atual = grupos[grupo];

  /* A escolha do grupo aberto; ao trocar de grupo, volta à sugestão dele. */
  const destino = atual?.membros.find((m) => m.id === (destinoId ?? atual.destinoId)) ?? atual?.membros[0];
  const escolhidas = origemIds ?? atual?.membros.filter((m) => m.id !== destino?.id).map((m) => m.id) ?? [];
  const origens = atual ? atual.membros.filter((m) => m.id !== destino?.id && escolhidas.includes(m.id)) : [];

  function abrirGrupo(i: number) {
    setGrupo(i);
    setDestinoId(null);
    setOrigemIds(null);
    setRevisando(false);
    setErro(null);
  }

  async function confirmar() {

    if (!destino || origens.length === 0) return;

    setSalvando(true);
    setErro(null);

    try {
      const r = await unificarCategorias({ destinoId: destino.id, origemIds: origens.map((o) => o.id) });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      aplicarCategorias(r.categorias, r.subcategorias);
      await recarregar();

      notify({
        tone: "success",
        title: `Unificado em "${destino.nome}".`,
        detail: `${r.casos} caso(s) movidos${r.subcategoriasMovidas + r.subcategoriasFundidas ? `, ${r.subcategoriasMovidas + r.subcategoriasFundidas} subcategoria(s)` : ""}${r.macros ? `, ${r.macros} resposta(s) pronta(s)` : ""}. ${r.desativadas.join(", ")} ficaram desativadas.`,
      });

      /* A contagem nova, para seguir com o próximo grupo. */
      setContagem(await contarCategorias());
      abrirGrupo(0);
    } catch {
      setErro("A unificação não foi gravada. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      size="wide"
      title="Unificar categorias"
      description="Categorias que dizem a mesma coisa dividem o mesmo assunto em fatias. Escolha o que junta e em qual nome."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Fechar</GhostButton>
          {revisando ? (
            <button
              type="button"
              onClick={confirmar}
              disabled={salvando}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-50"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Combine size={15} />}
              Confirmar unificação
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRevisando(true)}
              disabled={!destino || origens.length === 0}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              Revisar
            </button>
          )}
        </>
      }
    >

      {contagem === null ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 size={15} className="animate-spin" /> Contando os casos de cada categoria…
        </p>
      ) : grupos.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100">
          Nenhuma categoria ativa com nome parecido com outra. A lista está em ordem.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">

          <ul className="space-y-1">
            {grupos.map((g, i) => (
              <li key={g.chave + i}>
                <button
                  type="button"
                  onClick={() => abrirGrupo(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    i === grupo ? "bg-violet-50 font-semibold text-violet-800 ring-1 ring-inset ring-violet-200" : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <span className="truncate">“{g.chave}”</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                    {g.membros.length} · {g.casos} casos
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {atual && destino && (
            <div className="space-y-4">

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Qual nome fica, e quais entram
                </p>
                <ul className="mt-2 divide-y divide-zinc-100 rounded-xl ring-1 ring-inset ring-zinc-200">
                  {atual.membros.map((m) => {
                    const eDestino = m.id === destino.id;
                    const entra = !eDestino && escolhidas.includes(m.id);
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 text-sm">
                        <label className="flex items-center gap-2" title="O nome que fica">
                          <input
                            type="radio"
                            name="destino"
                            checked={eDestino}
                            onChange={() => {
                              setDestinoId(m.id);
                              setOrigemIds(atual.membros.filter((x) => x.id !== m.id).map((x) => x.id));
                              setRevisando(false);
                            }}
                            className="h-4 w-4 accent-violet-700"
                          />
                          <span className="text-xs text-zinc-500">fica</span>
                        </label>
                        <label className={`flex items-center gap-2 ${eDestino ? "opacity-30" : ""}`} title="Entra na unificação">
                          <input
                            type="checkbox"
                            disabled={eDestino}
                            checked={entra}
                            onChange={() => {
                              setOrigemIds(entra ? escolhidas.filter((x) => x !== m.id) : [...escolhidas, m.id]);
                              setRevisando(false);
                            }}
                            className="h-4 w-4 accent-violet-700"
                          />
                          <span className="text-xs text-zinc-500">entra</span>
                        </label>
                        <span className={`min-w-0 flex-1 truncate ${eDestino ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>
                          {m.nome}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                          {m.casos} caso(s)
                          {m.subcategorias ? ` · ${m.subcategorias} sub.` : ""}
                          {m.macros ? ` · ${m.macros} resp.` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {revisando && (
                <div className="rounded-xl bg-violet-50/60 px-4 py-3 text-sm text-violet-900 ring-1 ring-inset ring-violet-100">
                  <p className="font-semibold">O que vai acontecer</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed">
                    {previaDaUnificacao(destino, origens).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {erro && (
                <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  {erro}
                </p>
              )}

            </div>
          )}

        </div>
      )}

    </Modal>
  );
}
