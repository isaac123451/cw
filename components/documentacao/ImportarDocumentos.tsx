"use client";

import { useEffect, useState } from "react";

import { ChevronDown, FileText, Loader2 } from "lucide-react";

import Modal from "@/components/shared/Modal";
import { ErroDoServidor, RodapeDeSalvar } from "@/components/shared/Rodape";

import { useDocs } from "@/lib/context/DocsContext";
import { useToast } from "@/lib/context/ToastContext";

import {
  importarDocumentosDoTime,
  previaDaImportacao,
  type DocumentoNaPrevia,
} from "@/lib/actions/documentos";

const SITUACAO: Record<DocumentoNaPrevia["situacao"], { rotulo: string; tom: string }> = {
  novo: { rotulo: "Novo", tom: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  igual: { rotulo: "Já importado", tom: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
  editado: { rotulo: "Editado aqui", tom: "bg-amber-50 text-amber-800 ring-amber-100" },
};

/**
 * A importação dos nove documentos do time, com prévia.
 *
 * Uma linha por documento: o que é novo já vem marcado; o que já está
 * igual não tem o que fazer; o que foi editado aqui só é trocado pelo
 * texto original se a pessoa marcar — e a linha diz que a edição se
 * perde. Nada é gravado antes do Importar, e o aviso de sucesso só vem
 * com a resposta do servidor.
 */
export default function ImportarDocumentos({
  onClose,
  onImportado,
}: {
  onClose: () => void;
  onImportado: (slug: string) => void;
}) {
  const { aplicarDoServidor } = useDocs();
  const { notify } = useToast();

  const [previa, setPrevia] = useState<DocumentoNaPrevia[] | null>(null);
  const [erroDaPrevia, setErroDaPrevia] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    previaDaImportacao()
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) return setErroDaPrevia(r.erro);
        setPrevia(r.documentos);
        setMarcados(new Set(r.documentos.filter((d) => d.situacao === "novo").map((d) => d.slug)));
      })
      .catch(() => vivo && setErroDaPrevia("Não foi possível ler o que já está importado. Tente de novo."));
    return () => {
      vivo = false;
    };
  }, []);

  const escolhidos = (previa ?? []).filter((d) => marcados.has(d.slug));
  const substituidos = escolhidos.filter((d) => d.situacao === "editado");

  function alternar(slug: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(slug)) novo.delete(slug);
      else novo.add(slug);
      return novo;
    });
  }

  async function importar() {
    if (escolhidos.length === 0) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await importarDocumentosDoTime({
        slugs: escolhidos.map((d) => d.slug),
        substituir: substituidos.map((d) => d.slug),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      aplicarDoServidor(r.documentos);
      const partes = [
        r.criados && `${r.criados} ${r.criados === 1 ? "criado" : "criados"}`,
        r.substituidos && `${r.substituidos} ${r.substituidos === 1 ? "substituído" : "substituídos"} pelo original`,
        r.mantidos && `${r.mantidos} ${r.mantidos === 1 ? "mantido" : "mantidos"} como estava`,
      ].filter(Boolean);
      notify({ tone: "success", title: "Documentos importados", detail: partes.join(" · ") });
      onImportado(r.documentos[0]?.slug ?? escolhidos[0].slug);
    } catch {
      setErro("Não foi possível falar com o servidor. Nada foi importado — tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      size="wide"
      title="Importar os documentos do time"
      description="Os nove documentos de agosto/2026 (responsável: Thais Portela). Depois de importados, eles se editam aqui mesmo."
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {escolhidos.length === 0
              ? "Nenhum documento marcado."
              : `${escolhidos.length} para importar${substituidos.length ? ` · ${substituidos.length} ${substituidos.length === 1 ? "substitui" : "substituem"} a versão editada aqui` : ""}`}
          </p>
          <div className="flex gap-2">
            <RodapeDeSalvar
              salvando={salvando}
              desabilitado={escolhidos.length === 0}
              rotulo={escolhidos.length ? `Importar ${escolhidos.length}` : "Importar"}
              onSalvar={importar}
              onCancelar={onClose}
            />
          </div>
        </div>
      }
    >
      {erroDaPrevia ? (
        <ErroDoServidor erro={erroDaPrevia} />
      ) : !previa ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" /> Conferindo o que já está aqui…
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl ring-1 ring-inset ring-zinc-200">
          {previa.map((d) => {
            const s = SITUACAO[d.situacao];
            const marcado = marcados.has(d.slug);
            const expandido = aberto === d.slug;
            return (
              <li key={d.slug} className={marcado ? "bg-violet-50/30" : "bg-white"}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={d.situacao === "igual"}
                    onChange={() => alternar(d.slug)}
                    aria-label={`Importar ${d.titulo}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-violet-700 disabled:opacity-40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900">{d.titulo}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${s.tom}`}>{s.rotulo}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-500">{d.resumo}</p>
                    {d.situacao === "editado" && (
                      <p className={`mt-1.5 text-xs leading-5 ${marcado ? "font-medium text-amber-800" : "text-zinc-500"}`}>
                        {marcado
                          ? "Marcado: o texto editado aqui volta a ser o original do documento."
                          : "Alguém editou este documento aqui. Marque só se quiser voltar ao texto original — a edição se perde."}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setAberto(expandido ? null : d.slug)}
                      aria-expanded={expandido}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900"
                    >
                      <ChevronDown size={13} className={`transition-transform ${expandido ? "rotate-180" : ""}`} />
                      {d.escopo} · {d.secoes.length} {d.secoes.length === 1 ? "seção" : "seções"}
                    </button>
                    {expandido && (
                      <ol className="mt-2 flex flex-wrap gap-1.5">
                        {d.secoes.map((secao) => (
                          <li key={secao} className="flex items-center gap-1 rounded-lg bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600 ring-1 ring-inset ring-zinc-100">
                            <FileText size={11} className="text-zinc-400" />
                            {secao}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ErroDoServidor erro={erro} />
    </Modal>
  );
}
