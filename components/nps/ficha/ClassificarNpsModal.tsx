"use client";

import { useState } from "react";

import Modal, { inputClass } from "@/components/shared/Modal";
import SugestaoDoTexto from "@/components/shared/SugestaoDoTexto";
import DonoDaCausa from "@/components/causas/DonoDaCausa";

import { classificarNps } from "@/lib/actions/nps";
import { useNps } from "@/lib/context/NpsContext";
import { useProjects } from "@/lib/context/ProjectsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useSugestaoNps } from "@/lib/hooks/useSugestaoNps";
import { segmentOf, tipoPorNome, type NpsResponseView } from "@/lib/models/nps";

import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

/**
 * Classificar o ciclo: o tipo do guia, a causa raiz e quem assume.
 *
 * Os tipos aparecem como cartões com o "o que fazer" de cada um — é a
 * escolha que decide o resto da trilha (prazo, confirmação, finais), e
 * a pessoa precisa ver a consequência antes de escolher.
 */
export default function ClassificarNpsModal({ item, onClose }: { item: NpsResponseView; onClose: () => void }) {

  const { kinds, rootCauses, recarregar } = useNps();
  const { recarregar: recarregarProjetos } = useProjects();
  const { notify } = useToast();

  const [tipo, setTipo] = useState(item.kind ?? "");
  const [causa, setCausa] = useState(item.rootCause ?? "");
  const [assumir, setAssumir] = useState(!item.owner);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const regra = tipoPorNome(kinds, tipo);
  const ativos = kinds.filter((k) => k.active || k.name === item.kind).sort((a, b) => a.order - b.order);
  const causas = rootCauses.filter((c) => c.active || c.name === item.rootCause).sort((a, b) => a.order - b.order);
  const faltaCausa = Boolean(regra?.requiresRootCause) && !causa;
  const mudou = tipo !== (item.kind ?? "") || causa !== (item.rootCause ?? "") || assumir;

  /* Sugestão pelo comentário: só enquanto o campo ainda não foi escolhido. */
  const sugestao = useSugestaoNps(item.comment, item.score);
  const tipoSugerido = !tipo && sugestao.tipo && ativos.some((k) => k.name === sugestao.tipo!.valor) ? sugestao.tipo : null;
  const causaSugerida = !causa && sugestao.causa && causas.some((c) => c.name === sugestao.causa!.valor) ? sugestao.causa : null;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await classificarNps({ id: item.id, tipo, causa: causa || null, assumir });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      await recarregar();
      if (r.revisao) await recarregarProjetos();
      notify({
        tone: "success",
        title: `Classificado como ${tipo}.`,
        detail: [
          causa ? `Causa raiz: ${causa}.` : null,
          r.responsavel ? `Com ${r.responsavel}.` : null,
          r.revisao ? "Revisão de processo aberta em Projetos e Melhorias." : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      onClose();
    } catch {
      setErro("A classificação não foi gravada. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="nps.tipos"
      size="wide"
      title="Classificar o feedback"
      description={`${segmentOf(item.score).label}, nota ${item.score}. O tipo decide o prazo, o que o guia pede e como o ciclo pode terminar.`}
      onClose={onClose}
      footer={<RodapeDeSalvar salvando={salvando} desabilitado={!tipo || faltaCausa || !mudou} onSalvar={salvar} onCancelar={onClose} />}
    >
      <div className="space-y-5">

        {item.comment && (
          <blockquote className="rounded-xl bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-700 ring-1 ring-inset ring-zinc-200">
            &ldquo;{item.comment}&rdquo;
          </blockquote>
        )}

        {tipoSugerido && (
          <SugestaoDoTexto
            rotulo="Tipo sugerido pelo comentário"
            valor={tipoSugerido.valor}
            motivo={tipoSugerido.motivo || undefined}
            onUsar={() => setTipo(tipoSugerido.valor)}
          />
        )}

        <div>
          <Rotulo>Tipo</Rotulo>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ativos.map((k) => {
              const ativo = tipo === k.name;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setTipo(k.name)}
                  aria-pressed={ativo}
                  aria-label={`${k.name}: ${k.action}`}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    ativo ? "border-violet-300 bg-violet-50 ring-1 ring-inset ring-violet-200" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <span className={`text-sm ${ativo ? "font-semibold text-violet-900" : "font-medium text-zinc-800"}`}>
                    {k.emoji} {k.name}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-zinc-500">{k.action}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <Rotulo>Causa raiz{regra?.requiresRootCause ? " (obrigatória para este tipo)" : " (opcional)"}</Rotulo>
            <select value={causa} onChange={(e) => setCausa(e.target.value)} className={`mt-1.5 ${inputClass}`}>
              <option value="">Sem causa</option>
              {causas.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <DonoDaCausa causa={causa} />
            <span className="mt-1 block text-xs text-zinc-400">A mesma lista nas quatro frentes — é ela que mostra a tendência no Analytics.</span>
            {causaSugerida && (
              <div className="mt-2">
                <SugestaoDoTexto
                  rotulo="Causa sugerida pelo comentário"
                  valor={causaSugerida.valor}
                  motivo={causaSugerida.motivo || undefined}
                  onUsar={() => setCausa(causaSugerida.valor)}
                />
              </div>
            )}
          </label>

          <div>
            <Rotulo>Responsável</Rotulo>
            <p className="mt-1.5 flex h-11 items-center rounded-xl bg-zinc-50 px-3.5 text-sm text-zinc-600">{item.owner ?? "Ninguém ainda"}</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={assumir} onChange={(e) => setAssumir(e.target.checked)} className="h-4 w-4 accent-violet-600" />
              {item.owner ? "Assumir no lugar" : "Assumir este ciclo"}
            </label>
          </div>
        </div>

        {regra?.name === "Erro Processual" && (
          <p className="rounded-xl bg-violet-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-violet-900 ring-1 ring-inset ring-violet-100">
            O guia pede que todo Erro Processual vire revisão de processo: ao salvar, o item é aberto em Projetos e Melhorias.
          </p>
        )}
      </div>

      <ErroDoServidor erro={erro} />
    </Modal>
  );
}
