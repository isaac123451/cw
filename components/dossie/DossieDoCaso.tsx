"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, CircleCheck, Download, Loader2, Sparkles, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import { abrirDossie, escreverDossieComIA, salvarPartesDoDossie, type DossieAberto } from "@/lib/actions/dossie";
import { useToast } from "@/lib/context/ToastContext";
import { aplicarPartes, conferenciaAntesDeUsar, textoParaModeracao, type PartesEscritas } from "@/lib/models/dossieEscrito";
import { renderizarDossie } from "@/lib/services/dossie.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const campo = "w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-sm outline-none focus:border-violet-400";
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * O dossiê do caso, pela plataforma (Fase 26).
 *
 * As 8 partes do documento: a identificação, as partes, a linha do tempo
 * numerada e os anexos vêm montados do banco — não se editam aqui, se
 * corrigem no registro. O sumário, a apuração, o enquadramento, a
 * conclusão e o pedido se escrevem aqui; a IA dá o primeiro rascunho. Ao
 * lado, a conferência antes de usar, e o texto pronto para a moderação.
 */
export default function DossieDoCaso({ protocolo }: { protocolo: string }) {

  const [aberto, setAberto] = useState<DossieAberto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    abrirDossie(protocolo).then((r) => {
      if (!vivo) return;
      if (!r.ok) setErro(r.erro);
      else setAberto(r);
    });
    return () => {
      vivo = false;
    };
  }, [protocolo]);

  if (erro) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">{erro}</p>;
  if (!aberto) return <p className="flex items-center gap-2 py-10 text-sm text-zinc-500"><Loader2 size={15} className="animate-spin" /> Montando o dossiê do banco…</p>;
  return <EditorDoDossie protocolo={protocolo} aberto={aberto} />;
}

/** O documento aberto, com as partes escritas editáveis. */
export function EditorDoDossie({ protocolo, aberto }: { protocolo: string; aberto: DossieAberto }) {

  const { notify } = useToast();
  const [partes, setPartes] = useState<PartesEscritas>(aberto.partes);
  const [sujo, setSujo] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const conferencia = useMemo(() => conferenciaAntesDeUsar(aberto.montado, partes), [aberto, partes]);
  const documento = useMemo(() => renderizarDossie(aplicarPartes(aberto.montado, partes)), [aberto, partes]);
  const moderacao = useMemo(() => textoParaModeracao(aberto.montado, partes), [aberto, partes]);

  const d = aberto.montado;
  const muda = (p: Partial<PartesEscritas>) => {
    setPartes((atual) => ({ ...atual, ...p }));
    setSujo(true);
  };

  async function escrever() {
    setEscrevendo(true);
    const r = await escreverDossieComIA(protocolo);
    setEscrevendo(false);
    if (!r.ok) {
      notify({ tone: "error", title: "O rascunho não saiu.", detail: r.erro });
      return;
    }
    muda(r.partes);
    notify({ tone: r.origem === "ia" ? "success" : "info", title: r.origem === "ia" ? "Rascunho da IA no lugar — leia antes de salvar." : "Rascunho das regras no lugar.", detail: r.aviso });
  }

  async function salvar() {
    setSalvando(true);
    const r = await salvarPartesDoDossie(protocolo, partes);
    setSalvando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "O dossiê não foi salvo.", detail: r.erro });
      return;
    }
    setSujo(false);
    notify({ tone: "success", title: `Dossiê salvo — versão ${r.versao}.` });
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([documento], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hojeNaOperacao()}_dossie_${d.identificacao.protocolo}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lista = (chave: "verificado" | "sustentado" | "alegado", rotulo: string, dica: string) => (
    <label className="grid gap-1 text-xs font-medium text-zinc-600">
      {rotulo}
      <textarea
        id={`dossie-${chave}`}
        rows={Math.max(3, partes[chave].length + 1)}
        value={partes[chave].join("\n")}
        onChange={(e) => muda({ [chave]: e.target.value.split("\n") } as Partial<PartesEscritas>)}
        placeholder={dica}
        className={campo}
      />
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/reclame-aqui/${encodeURIComponent(protocolo)}`} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
          <ArrowLeft size={15} /> Voltar ao caso
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-900">Dossiê — {d.identificacao.titulo}</h1>
        <button type="button" onClick={escrever} disabled={escrevendo} className="flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 px-3 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50">
          {escrevendo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Escrever sumário e apuração
        </button>
        <button type="button" onClick={salvar} disabled={salvando || !sujo || aberto.semTabela} className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-sm font-semibold text-white disabled:opacity-40">
          {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
        </button>
      </div>
      {aberto.semTabela && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">A tabela do dossiê ainda não existe no banco: dá para montar, escrever e baixar, mas salvar precisa de npm run db:push e npm run db:rls.</p>
      )}
      {aberto.salvo && <p className="text-xs text-zinc-500">Versão {aberto.salvo.versao}, salva em {dataHora(aberto.salvo.em)}{aberto.salvo.por ? ` por ${aberto.salvo.por}` : ""}.</p>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <SurfaceCard title="1. Identificação" description="Montada do banco.">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-zinc-500">Protocolo</dt><dd>{d.identificacao.protocolo} · {d.identificacao.canal}</dd></div>
              <div><dt className="text-xs text-zinc-500">Aberto em</dt><dd>{dataHora(d.identificacao.abertoEm)}</dd></div>
              <label className="grid gap-1 text-xs text-zinc-500 sm:col-span-2">Destinatário
                <input id="dossie-destinatario" value={partes.destinatario ?? d.identificacao.destinatario} onChange={(e) => muda({ destinatario: e.target.value })} className={campo} />
              </label>
              <label className="grid gap-1 text-xs text-zinc-500 sm:col-span-2">Pedido — o que se quer do destinatário, com a regra que o sustenta
                <textarea id="dossie-pedido" rows={3} value={partes.pedido ?? ""} onChange={(e) => muda({ pedido: e.target.value })} placeholder="Pedimos a moderação pelo item … do regulamento, porque …" className={campo} />
              </label>
            </dl>
          </SurfaceCard>

          <SurfaceCard title="2. Sumário executivo" description="Escrito por último: o que a evidência aguenta.">
            <textarea id="dossie-sumario" rows={5} value={partes.sumario ?? ""} onChange={(e) => muda({ sumario: e.target.value })} className={campo} />
          </SurfaceCard>

          <SurfaceCard title="3. Partes envolvidas" description="Montadas do banco.">
            <ul className="space-y-1 text-sm text-zinc-700">
              <li><span className="text-zinc-500">Consumidor:</span> {d.partes.consumidor}{d.partes.contato.length ? ` · ${d.partes.contato.join(" · ")}` : ""}</li>
              {d.partes.estabelecimento && <li><span className="text-zinc-500">Estabelecimento:</span> {d.partes.estabelecimento}{d.partes.documento ? ` · ${d.partes.documento}` : ""}</li>}
              {d.partes.setoresAcionados.length > 0 && <li><span className="text-zinc-500">Setores acionados:</span> {d.partes.setoresAcionados.join(", ")}</li>}
            </ul>
          </SurfaceCard>

          <SurfaceCard title="4. Linha do tempo" description="Numerada, montada dos registros — contatos, tentativas, áreas, conversas guardadas, respostas. Para corrigir, corrija o registro." bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-zinc-400"><tr><th className="px-4 py-2">#</th><th className="py-2">Quando</th><th className="py-2">Evento</th><th className="py-2">Canal</th><th className="py-2 pr-4">Evidência</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {d.linhaDoTempo.map((e) => (
                    <tr key={e.numero}>
                      <td className="px-4 py-1.5 tabular-nums text-zinc-400">{e.numero}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-zinc-600">{dataHora(e.quando)}</td>
                      <td className="py-1.5 pr-3 text-zinc-800">{e.evento}</td>
                      <td className="py-1.5 pr-3 text-zinc-600">{e.canal}</td>
                      <td className="py-1.5 pr-4 text-zinc-600">{e.evidencia || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>

          <SurfaceCard title="5. Evidências" description="Os anexos, com o nome de arquivo padronizado. O que está fora do sistema aparece como peça por juntar.">
            <ul className="space-y-1 text-sm">
              {d.anexos.map((a) => (
                <li key={a.numero} className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-px text-[11px] font-semibold ${a.noSistema ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>Anexo {String(a.numero).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700">{a.descricao}</span>
                  <code className="hidden truncate text-[11px] text-zinc-400 md:block">{a.nome}</code>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard title="6. Apuração" description="Uma linha por item. Verificado tem anexo; sustentado é a conclusão que os anexos apoiam; alegação sem prova é o que ninguém sustenta.">
            <div className="grid gap-3">
              {lista("verificado", "Verificado", "10/09: Reclamação publicada (Anexo 01)")}
              {lista("sustentado", "Sustentado pela evidência", "O estorno foi feito em 12/09 (Anexo 02)")}
              {lista("alegado", "Só alegado", "Diz que foi cobrado três vezes — sem extrato")}
            </div>
          </SurfaceCard>

          <SurfaceCard title="7. Enquadramento" description="A regra do regulamento, dos termos ou da política em que o caso se encaixa.">
            <textarea id="dossie-enquadramento" rows={4} value={partes.enquadramento ?? ""} onChange={(e) => muda({ enquadramento: e.target.value })} className={campo} />
          </SurfaceCard>

          <SurfaceCard title="8. Conclusão e pedido" description="O que o dossiê pede, em uma frase que se sustenta nas partes acima.">
            <textarea id="dossie-conclusao" rows={3} value={partes.conclusao ?? ""} onChange={(e) => muda({ conclusao: e.target.value })} className={campo} />
          </SurfaceCard>
        </div>

        <div className="space-y-5 xl:sticky xl:top-20">
          <SurfaceCard title="Conferência antes de usar" description="O que falta para o dossiê se sustentar.">
            {conferencia.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CircleCheck size={15} /> Nada a acertar.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-zinc-700">
                {conferencia.map((c) => (
                  <li key={c} className="flex gap-1.5"><TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" /> {c}</li>
                ))}
              </ul>
            )}
            {d.lacunas.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold text-zinc-500">Peças por juntar</p>
                <ul className="mt-1 space-y-1 text-xs text-zinc-600">{d.lacunas.map((l) => <li key={l}>• {l}</li>)}</ul>
              </>
            )}
          </SurfaceCard>

          <SurfaceCard title="Usar" description="O texto do pedido de moderação e o dossiê inteiro para anexar.">
            <textarea id="dossie-moderacao" readOnly rows={8} value={moderacao} className={`${campo} bg-zinc-50 text-xs`} />
            <div className="mt-2 flex flex-wrap gap-2">
              <BotaoCopiar texto={moderacao} rotulo="Copiar o pedido de moderação" />
              <button type="button" onClick={baixar} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
                <Download size={13} /> Baixar o dossiê (.md)
              </button>
              <BotaoCopiar texto={documento} rotulo="Copiar o dossiê" />
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
