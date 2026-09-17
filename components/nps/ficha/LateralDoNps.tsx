"use client";

import Link from "next/link";

import { useState } from "react";

import { Check, ExternalLink, Loader2, Send, Store, Tags, X } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import Combobox from "@/components/shared/Combobox";
import { inputClass } from "@/components/shared/Modal";

import { reenviarAoWootric, updateNpsContato } from "@/lib/actions/nps";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { linkDoPortal } from "@/lib/models/establishment";
import { isEncerrado, STATUS_SEM_TRATATIVA, tipoPorNome, type NpsResponseView } from "@/lib/models/nps";
import { checklist } from "@/lib/services/nps.service";
import { descreverRegistro } from "@/lib/services/horasUteis";

import { Rotulo } from "@/components/shared/Rodape";
import ConversasGuardadas from "@/components/conversas/ConversasGuardadas";

/**
 * A coluna da direita: quem é, como está classificado, o que falta.
 *
 * O telefone e o restaurante gravam juntos, num Salvar — na ficha
 * antiga o restaurante gravava ao escolher na lista, sem aviso, e o
 * telefone tinha um botão só dele.
 */
export default function LateralDoNps({ item, classificar }: { item: NpsResponseView; classificar: () => void }) {

  const { kinds, recarregar } = useNps();
  const { establishments } = useEstablishments();
  const { notify } = useToast();

  const [telefone, setTelefone] = useState(item.phone ?? "");
  const [estabelecimentoId, setEstabelecimentoId] = useState(item.establishmentId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const estabelecimento = establishments.find((e) => e.id === (item.establishmentId ?? ""));
  const porConta = !item.establishmentId && item.externalCompanyId ? establishments.find((e) => e.externalId === item.externalCompanyId) : undefined;
  const portal = estabelecimento ? linkDoPortal(estabelecimento) : "";

  const mudouTelefone = telefone.trim() !== (item.phone ?? "").trim();
  const mudouEstabelecimento = estabelecimentoId !== (item.establishmentId ?? "");

  const regra = tipoPorNome(kinds, item.kind);
  const itens = checklist(item, kinds);
  const encerrado = isEncerrado(item.status);

  const [reenviando, setReenviando] = useState(false);

  async function reenviar() {
    setReenviando(true);
    try {
      const r = await reenviarAoWootric(item.id);
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi ao Wootric.", detail: r.erro });
        return;
      }
      await recarregar();
      notify(
        r.wootric.estado === "ok"
          ? { tone: "success", title: "Mandado ao Wootric.", detail: "A nota com os detalhes foi enviada e a resposta, concluída." }
          : { tone: "error", title: "O Wootric ainda não aceitou tudo.", detail: r.wootric.erro }
      );
    } catch {
      notify({ tone: "error", title: "Não deu para falar com o servidor." });
    } finally {
      setReenviando(false);
    }
  }

  async function salvarContato() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await updateNpsContato({
        id: item.id,
        ...(mudouTelefone ? { phone: telefone.trim() || null } : {}),
        ...(mudouEstabelecimento ? { establishmentId: estabelecimentoId || null } : {}),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      await recarregar();
      notify({
        tone: "success",
        title: "Contato e conta salvos.",
        detail: [
          mudouTelefone ? (telefone.trim() ? `Telefone ${telefone.trim()}.` : "Telefone removido.") : null,
          mudouEstabelecimento
            ? estabelecimentoId
              ? `Vinculado a ${establishments.find((e) => e.id === estabelecimentoId)?.name ?? "o estabelecimento"}.`
              : "Sem estabelecimento."
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
    } catch {
      setErro("Não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <aside className="min-w-0 space-y-5">

      {/* As conversas do WhatsApp guardadas deste ciclo — some quando não há. */}
      <ConversasGuardadas npsId={item.id} />

      <SurfaceCard title="Cliente e conta">
        <div className="space-y-3.5">
          <div>
            <Rotulo>E-mail</Rotulo>
            <p className="mt-1 break-all text-sm text-zinc-700" title="Só leitura: é a chave que liga o NPS às outras frentes.">
              {item.email || "sem e-mail"}
            </p>
          </div>

          <label className="block">
            <Rotulo>Telefone</Rotulo>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className={`mt-1.5 ${inputClass}`} />
          </label>

          <div>
            <Rotulo>Estabelecimento</Rotulo>
            <div className="mt-1.5">
              <Combobox
                value={estabelecimentoId}
                onChange={setEstabelecimentoId}
                emptyLabel="Sem vínculo"
                placeholder="Buscar restaurante…"
                options={establishments.map((e) => ({
                  value: e.id,
                  label: e.name,
                  hint: [e.city, e.document].filter(Boolean).join(" · "),
                }))}
              />
            </div>
            {porConta && !mudouEstabelecimento && (
              <button
                type="button"
                onClick={() => setEstabelecimentoId(porConta.id)}
                className="mt-1.5 text-left text-xs font-medium text-violet-700 hover:underline"
              >
                A conta é de {porConta.name} — usar este vínculo
              </button>
            )}
          </div>

          {(mudouTelefone || mudouEstabelecimento) && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTelefone(item.phone ?? "");
                  setEstabelecimentoId(item.establishmentId ?? "");
                  setErro(null);
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Desfazer
              </button>
              <button
                type="button"
                onClick={salvarContato}
                disabled={salvando}
                className="flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Salvar
              </button>
            </div>
          )}
          {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-100">{erro}</p>}

          {estabelecimento && (
            <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
              <Link
                href={`/estabelecimentos/${estabelecimento.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                <Store size={12} /> {estabelecimento.name}
              </Link>
              {portal && (
                <a
                  href={portal}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
                >
                  <ExternalLink size={12} /> Abrir no portal
                </a>
              )}
            </div>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Classificação"
        action={
          <button
            type="button"
            onClick={classificar}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50"
          >
            <Tags size={12} /> {item.kind ? "Editar" : "Classificar"}
          </button>
        }
      >
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-500">Tipo</dt>
            <dd className="text-right font-medium text-zinc-800">{regra ? `${regra.emoji} ${regra.name}` : item.kind ?? "a classificar"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-500">Causa raiz</dt>
            <dd className="text-right font-medium text-zinc-800">{item.rootCause ?? (regra?.requiresRootCause ? <span className="text-rose-700">falta</span> : "—")}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-500">Responsável</dt>
            <dd className="text-right font-medium text-zinc-800">{item.owner ?? "ninguém"}</dd>
          </div>
        </dl>
        {regra?.action && <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-xs leading-relaxed text-zinc-600">{regra.action}</p>}
      </SurfaceCard>

      <SurfaceCard title="Checklist do guia">
        <ul className="space-y-1.5">
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
      </SurfaceCard>

      <SurfaceCard title="Origem">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Veio de</dt>
            <dd className="text-right text-zinc-800">{item.source === "Wootric" ? "Wootric (pesquisa do portal)" : "Registro manual"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Respondeu em</dt>
            <dd className="text-right tabular-nums text-zinc-800">{descreverRegistro(item.respondedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Prazo do 1º contato</dt>
            <dd className="text-right tabular-nums text-zinc-800">{descreverRegistro(item.firstContactDueAt)}</dd>
          </div>
          {item.externalCompanyId && (
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Id da conta</dt>
              <dd className="truncate text-right font-mono text-xs text-zinc-700">{item.externalCompanyId}</dd>
            </div>
          )}
          {item.source === "Wootric" && (
            <div className="border-t border-zinc-100 pt-2.5">
              <dt className="text-zinc-500">No Wootric</dt>
              <dd className="mt-1 text-[13px] leading-relaxed">
                {!encerrado ? (
                  <span className="text-zinc-600">Aberto lá também. Ao encerrar aqui, a nota com os detalhes vai para lá e a resposta é concluída.</span>
                ) : item.status === STATUS_SEM_TRATATIVA ? (
                  <span className="text-zinc-500">Promotor sem comentário — não volta ao Wootric.</span>
                ) : item.wootricNotaEm && item.wootricConcluidoEm ? (
                  <span className="text-emerald-700">
                    Nota enviada e resposta concluída em {descreverRegistro(item.wootricConcluidoEm)}.
                  </span>
                ) : (
                  <span className="block space-y-2">
                    <span className="block text-amber-800">
                      {item.wootricErro ??
                        (item.wootricConcluidoEm ? "Concluída lá; a nota ainda não foi." : "O encerramento ainda não foi mandado ao Wootric.")}
                    </span>
                    <button
                      type="button"
                      onClick={reenviar}
                      disabled={reenviando}
                      className="flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                    >
                      {reenviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {item.wootricErro ? "Reenviar ao Wootric" : "Mandar ao Wootric"}
                    </button>
                  </span>
                )}
              </dd>
            </div>
          )}
          {item.avaliacaoGoogle && (
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Avaliou no Google</dt>
              <dd className="text-right text-zinc-800">
                {"★".repeat(item.avaliacaoGoogle.estrelas)} em {descreverRegistro(item.avaliacaoGoogle.publicadaEm)}
              </dd>
            </div>
          )}
        </dl>
      </SurfaceCard>

    </aside>
  );
}
