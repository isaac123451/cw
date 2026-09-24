"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { Check, ExternalLink, Loader2, TriangleAlert, Undo2 } from "lucide-react";

import Modal, { GhostButton } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";
import CampoQueSalva from "@/components/shared/CampoQueSalva";
import LinksDoRa from "@/components/shared/LinksDoRa";
import ContaDaImersao from "./ContaDaImersao";

import type { Case } from "@/lib/models/case";
import { resumoDoCliente } from "@/lib/models/resumoDoCliente";

import {
  marcarPasso,
  retratoDoCliente,
  salvarLinkDaConta,
  type RetratoDoCliente,
} from "@/lib/actions/tratativa";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

const TOM_DA_FASE: Record<string, string> = {
  "Uso ativo": "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Implantação: "bg-sky-50 text-sky-700 ring-sky-100",
  "Risco de cancelamento": "bg-rose-50 text-rose-700 ring-rose-100",
  Cancelado: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  "Sem cadastro vinculado": "bg-amber-50 text-amber-700 ring-amber-100",
};

function br(dia: string) {
  return dia.split("-").reverse().join("/");
}

/**
 * O Passo 2 da documentação: a imersão antes do 1º contato.
 *
 * "Antes de enviar qualquer mensagem, investigue a fundo quem é o cliente
 * e o que ele enfrentou": a conta, a fase (implantação, uso ativo,
 * cancelamento) e a jornada de atendimento. Esta janela junta o que a
 * plataforma sabe — o estabelecimento, as outras reclamações, os
 * atendimentos em rede social e as respostas de NPS — e deixa marcar a
 * imersão como feita.
 */
export default function ImersaoModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const { aplicarDoServidor } = useEstablishments();

  const [retrato, setRetrato] = useState<RetratoDoCliente | null | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /* Muda quando a conta é vinculada ou criada aqui: o retrato é montado de novo, já com ela. */
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    retratoDoCliente(item.protocol)
      .then((r) => ativo && setRetrato(r))
      .catch(() => ativo && setRetrato(null));
    return () => {
      ativo = false;
    };
  }, [item.protocol, versao]);

  /* O link que faltava, gravado ao sair do campo — a tela acompanha o que o servidor gravou. */
  async function salvarLink(campo: "crispUrl" | "portalUrl", valor: string) {
    const id = retrato?.estabelecimento?.id;
    if (!id) return { ok: false as const, erro: "Sem conta vinculada." };
    const r = await salvarLinkDaConta({ id, campo, valor });
    if (r.ok) {
      aplicarDoServidor({ id, [campo]: valor || undefined });
      setRetrato((atual) =>
        atual?.estabelecimento
          ? { ...atual, estabelecimento: { ...atual.estabelecimento, [campo === "crispUrl" ? "crisp" : "portal"]: valor || undefined } }
          : atual
      );
    }
    return r;
  }

  const feita = Boolean(item.imersaoEm);

  async function marcar(desfazer: boolean) {

    setSalvando(true);
    setErro(null);

    try {
      const r = await marcarPasso({ protocol: item.protocol, passo: "imersao", desfazer });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo({ imersaoEm: r.em, imersaoPor: r.por });

      notify({
        tone: "success",
        title: desfazer ? "Imersão desmarcada." : `Imersão feita em ${item.protocol}.`,
        detail: desfazer ? undefined : "Próximo passo da documentação: o 1º contato humanizado, de preferência por WhatsApp ou telefone.",
      });

      onClose();
    } catch {
      setErro("Não foi gravado. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const est = retrato?.estabelecimento;
  const fase = est?.fase ?? retrato?.faseSemCadastro;

  return (
    <Modal
      open
      porque={item.source === "Reclame Aqui" ? "ra.imersao" : "redes.analise"}
      size="wide"
      title={`Quem é este cliente — ${item.protocol}`}
      description="Passo 2: conta, fase e jornada de atendimento, antes de qualquer mensagem."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Fechar</GhostButton>
          {feita ? (
            <button
              type="button"
              onClick={() => marcar(true)}
              disabled={salvando}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
            >
              <Undo2 size={15} /> Desmarcar imersão
            </button>
          ) : (
            <button
              type="button"
              onClick={() => marcar(false)}
              disabled={salvando}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Imersão feita
            </button>
          )}
        </>
      }
    >

      {retrato === undefined && (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 size={15} className="animate-spin" /> Juntando o que a plataforma sabe deste cliente…
        </p>
      )}

      {retrato === null && (
        <p className="text-sm text-zinc-500">Não deu para montar o retrato agora.</p>
      )}

      {retrato && (
        <div className="space-y-5 text-sm">

          {/* O resumo: o que ler antes da 1ª mensagem, montado do dado. */}
          <section className="rounded-xl bg-violet-50/60 px-3.5 py-3 ring-1 ring-inset ring-violet-100">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">Resumo antes do contato</h4>
              <BotaoCopiar texto={resumoDoCliente(retrato, item).join("\n")} rotulo="Copiar o resumo" />
            </div>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-violet-950/90">
              {resumoDoCliente(retrato, item).map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-zinc-900">
                {est?.nome ?? item.customer}
              </h3>
              {fase && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TOM_DA_FASE[fase] ?? "bg-zinc-100 text-zinc-600 ring-zinc-200"}`}>
                  {fase}
                </span>
              )}
              {item.source === "Reclame Aqui" && <LinksDoRa caso={item} className="ml-auto" />}
            </div>

            {est ? (
              <>
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
                  {[
                    ["Plano", est.plano],
                    ["Situação", est.situacao],
                    ["Cliente desde", est.desde ? br(est.desde) : undefined],
                    ["Receita mensal", est.mrr !== undefined ? est.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : undefined],
                    ["Responsável da conta", est.responsavel],
                    ["Cidade", est.cidade],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{k}</dt>
                        <dd className="mt-0.5 text-zinc-800">{v}</dd>
                      </div>
                    ))}
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  {est.portal && (
                    <a href={est.portal} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50">
                      <ExternalLink size={12} /> Conta no Portal
                    </a>
                  )}
                  {est.crisp && (
                    <a href={est.crisp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50">
                      <ExternalLink size={12} /> Conversas no Crisp
                    </a>
                  )}
                  <Link href={`/estabelecimentos/${est.slug}`} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
                    Ficha do estabelecimento
                  </Link>
                </div>

                {/* O link que falta se cola aqui e grava ao sair do campo — sem abrir o cadastro da conta. */}
                {(!est.crisp || !est.portal) && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {!est.crisp && (
                      <CampoQueSalva
                        id="imersao-crisp"
                        rotulo="Link do Crisp"
                        valor=""
                        placeholder="https://app.crisp.chat/…"
                        maximo={500}
                        onSalvar={(v) => salvarLink("crispUrl", v)}
                      />
                    )}
                    {!est.portal && (
                      <CampoQueSalva
                        id="imersao-portal"
                        rotulo="Link do portal"
                        valor=""
                        placeholder="https://portal.cardapioweb.com/…"
                        maximo={500}
                        onSalvar={(v) => salvarLink("portalUrl", v)}
                      />
                    )}
                  </div>
                )}

                {est.notas && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200">
                    {est.notas}
                  </p>
                )}
              </>
            ) : (
              <ContaDaImersao
                item={item}
                onVinculado={(id) => {
                  onSalvo({ establishmentId: id, establishmentManual: true });
                  notify({ tone: "success", title: `Conta vinculada a ${item.protocol}.`, detail: "O retrato foi montado de novo, com a conta." });
                  setRetrato(undefined);
                  setVersao((v) => v + 1);
                }}
              />
            )}
          </section>

          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Outras reclamações ({retrato.outrasReclamacoes.length})
            </h4>
            {retrato.outrasReclamacoes.length === 0 ? (
              <p className="mt-1.5 text-xs text-zinc-500">Primeira reclamação deste cliente na base.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {retrato.outrasReclamacoes.slice(0, 6).map((c) => (
                  <li key={c.protocolo} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-zinc-700">
                      <span className="font-mono text-zinc-400">{br(c.dia)}</span> · {c.titulo}
                    </span>
                    <span className="shrink-0 text-zinc-500">
                      {c.status}{c.nota !== undefined ? ` · nota ${c.nota}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {retrato.outrasReclamacoes.length >= 2 && (
              <p className="mt-2 text-xs text-rose-700">
                Reincidência: {retrato.outrasReclamacoes.length + 1} reclamações — é critério de Urgente na triagem.
              </p>
            )}
          </section>

          {retrato.redes.length > 0 && (
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Atendimentos em redes sociais ({retrato.redes.length})
              </h4>
              <ul className="mt-2 space-y-1.5">
                {retrato.redes.slice(0, 4).map((c) => (
                  <li key={c.protocolo} className="text-xs text-zinc-700">
                    <span className="font-mono text-zinc-400">{br(c.dia)}</span> · {c.titulo} · {c.status}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              NPS ({retrato.nps.length})
            </h4>
            {retrato.nps.length === 0 ? (
              <p className="mt-1.5 text-xs text-zinc-500">Nenhuma resposta de NPS ligada a esta conta.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {retrato.nps.slice(0, 4).map((r, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className={`shrink-0 rounded-md px-1.5 font-semibold tabular-nums ${r.nota <= 6 ? "bg-rose-50 text-rose-700" : r.nota <= 8 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {r.nota}
                    </span>
                    <span className="min-w-0 text-zinc-600">
                      <span className="font-mono text-zinc-400">{br(r.dia)}</span> · {r.comentario || "sem comentário"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Google ({retrato.google.length})
            </h4>
            {retrato.google.length === 0 ? (
              <p className="mt-1.5 text-xs text-zinc-500">Nenhuma avaliação do Google ligada a esta conta.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {retrato.google.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex gap-2 text-xs">
                    <span className={`shrink-0 rounded-md px-1.5 font-semibold tabular-nums ${a.estrelas <= 2 ? "bg-rose-50 text-rose-700" : a.estrelas === 3 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {a.estrelas}★
                    </span>
                    <a href={`/google?avaliacao=${a.id}`} className="min-w-0 text-zinc-600 hover:text-violet-700 hover:underline">
                      <span className="font-mono text-zinc-400">{br(a.dia)}</span> · {a.texto || "sem comentário"}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200">
            Falta aqui o histórico do suporte — chamados vivem em outro sistema da operação, e conversas no Crisp. Confira
            por lá antes de ligar: o documento pede para chegar ao 1º contato pronto para todas as perguntas.
          </p>

        </div>
      )}

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
