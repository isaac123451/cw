"use client";

import { useMemo, useState } from "react";

import { Check, Lock, X } from "lucide-react";

import Modal, { textareaClass } from "@/components/shared/Modal";

import { setNpsStatus } from "@/lib/actions/nps";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { finaisDoTipo, nomeDoCliente, rotuloDeEtapa, type NpsResponseView } from "@/lib/models/nps";
import { checklist, motivoParaNaoEncerrar } from "@/lib/services/nps.service";
import { textoDaNota } from "@/lib/models/notaDoWootric";
import { useSession } from "@/lib/context/SessionContext";

import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

/**
 * Encerrar o ciclo com o status final do tipo.
 *
 * Os finais aparecem todos — os que ainda não podem ser aplicados, com o
 * motivo escrito. Um botão cinza sem explicação era o que a ficha antiga
 * fazia com o "Resolvido", e a pessoa não sabia o que faltava.
 */
export default function EncerrarNpsModal({ item, onClose }: { item: NpsResponseView; onClose: () => void }) {

  const { stages, kinds, recarregar } = useNps();
  const { notify } = useToast();
  const agora = useAgora();
  const session = useSession();
  const doWootric = item.source === "Wootric" && Boolean(item.externalId);

  const finais = useMemo(() => finaisDoTipo(stages, item.kind).filter((e) => e.name !== "[Encerrado] Sem tratativa"), [stages, item.kind]);
  const motivos = useMemo(
    () => Object.fromEntries(finais.map((e) => [e.name, agora ? motivoParaNaoEncerrar(item, e.name, kinds, agora) : null])),
    [finais, item, kinds, agora]
  );

  /* Sem escolha feita, o primeiro final que já pode ser aplicado. */
  const [escolha, setEscolha] = useState<string | null>(null);
  const final = escolha ?? finais.find((e) => !motivos[e.name])?.name ?? "";
  const [comoTerminou, setComoTerminou] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const itens = checklist(item, kinds);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await setNpsStatus(item.id, final, comoTerminou);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      await recarregar();
      const w = r.wootric;
      notify(
        w && w.estado === "pendente"
          ? { tone: "error", title: `Encerrado aqui: ${rotuloDeEtapa(final)}. O Wootric não aceitou tudo.`, detail: `${w.erro} Dá para reenviar pela ficha.` }
          : {
              tone: "success",
              title: `Ciclo encerrado: ${rotuloDeEtapa(final)}.`,
              detail: w && w.estado === "ok" ? "No Wootric: a nota com os detalhes foi enviada e a resposta, concluída." : nomeDoCliente(item),
            }
      );
      onClose();
    } catch {
      setErro("O encerramento não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      size="wide"
      title="Encerrar o ciclo"
      description={item.kind ? `Os finais que o tipo ${item.kind} aceita.` : "Classifique o tipo primeiro — é ele que diz como o ciclo pode terminar."}
      onClose={onClose}
      footer={<RodapeDeSalvar salvando={salvando} desabilitado={!final || Boolean(motivos[final])} rotulo="Encerrar" onSalvar={salvar} onCancelar={onClose} />}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]">

        <div className="space-y-4">
          <div>
            <Rotulo>Status final</Rotulo>
            {finais.length === 0 ? (
              <p className="mt-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
                Nenhuma etapa final aceita {item.kind ? `o tipo "${item.kind}"` : "um ciclo sem tipo"}. Marque o tipo em alguma etapa de encerramento, em Etapas e tipos.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {finais.map((e) => {
                  const motivo = motivos[e.name];
                  return (
                    <label
                      key={e.id}
                      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                        motivo
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50/60"
                          : final === e.name
                            ? "cursor-pointer border-violet-300 bg-violet-50/70"
                            : "cursor-pointer border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="final"
                        disabled={Boolean(motivo)}
                        checked={final === e.name}
                        onChange={() => setEscolha(e.name)}
                        className="mt-1 h-4 w-4 accent-violet-600"
                      />
                      <span className="min-w-0">
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${motivo ? "text-zinc-500" : "text-zinc-900"}`}>
                          {motivo && <Lock size={12} />}
                          {rotuloDeEtapa(e.name)}
                        </span>
                        {e.description && <span className="block text-xs text-zinc-500">{e.description}</span>}
                        {motivo && <span className="mt-0.5 block text-xs text-amber-800">{motivo}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block">
            <Rotulo>Como terminou (opcional)</Rotulo>
            <textarea
              value={comoTerminou}
              onChange={(e) => setComoTerminou(e.target.value)}
              rows={2}
              placeholder="Uma linha para quem ler o histórico depois."
              className={`mt-1.5 ${textareaClass}`}
            />
          </label>

          {doWootric && final && (
            <details className="rounded-xl bg-sky-50/60 px-3.5 py-2.5 ring-1 ring-inset ring-sky-100" open>
              <summary className="cursor-pointer text-xs font-semibold text-sky-900">
                Vai para o Wootric: esta nota, e a resposta fica concluída lá
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-zinc-700">
                {textoDaNota(
                  {
                    id: item.id,
                    status: final,
                    closedAt: agora,
                    outcome: comoTerminou.trim() || null,
                    kind: item.kind ?? null,
                    rootCause: item.rootCause ?? null,
                    churnRisk: item.churnRisk,
                    firstContactAt: item.firstContactAt ? new Date(item.firstContactAt) : null,
                    firstContactDueAt: new Date(item.firstContactDueAt),
                    postContactAt: item.postContactAt ? new Date(item.postContactAt) : null,
                    postContactBy: item.postContactBy ?? null,
                    postContactNote: item.postContactNote ?? null,
                    moodAfter: item.moodAfter ?? null,
                    resolvedAfter: item.resolvedAfter ?? null,
                    confirmedAt: item.confirmedAt ? new Date(item.confirmedAt) : null,
                    owner: item.owner ? { name: item.owner } : null,
                    attempts: item.attempts.map((a) => ({ channel: a.channel, createdAt: new Date(a.createdAt) })),
                  },
                  session?.name
                )}
              </pre>
            </details>
          )}
        </div>

        <div>
          <Rotulo>Checklist do guia</Rotulo>
          <ul className="mt-2 space-y-1.5">
            {itens.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                ) : (
                  <X size={14} className={`mt-0.5 shrink-0 ${c.obrigatorio ? "text-rose-500" : "text-zinc-300"}`} />
                )}
                <span className={c.ok ? "text-zinc-500" : c.obrigatorio ? "text-zinc-800" : "text-zinc-400"}>
                  {c.label}
                  {!c.obrigatorio && " (opcional)"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            Sem Retorno segue outra regra: as tentativas mínimas do tipo em 7 dias, ou 30 dias sem resposta. Engano pede só o tipo.
          </p>
        </div>
      </div>

      <ErroDoServidor erro={erro} />
    </Modal>
  );
}
