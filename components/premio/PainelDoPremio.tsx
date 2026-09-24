"use client";

import { useEffect, useMemo, useState } from "react";

import { Download, Loader2, TriangleAlert } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import CampanhaDeVotacao from "@/components/premio/CampanhaDeVotacao";
import PremioNoCalendario from "@/components/premio/PremioNoCalendario";
import DepoimentosProntos from "@/components/premio/DepoimentosProntos";

import { lerPremio, registrarExportados, salvarCampanha, type CampanhaView, type PedidoView } from "@/lib/actions/premio";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { contatosDoPremio, FILTROS_PADRAO, mensagemParaContato, type FiltrosDoPremio } from "@/lib/models/premio";

const MENSAGEM_PADRAO =
  "Olá, {nome}! Aqui é da Cardápio Web. Obrigado pela avaliação no Reclame Aqui — ela faz diferença. Estamos concorrendo ao Prêmio Reclame Aqui e o seu voto conta muito: {link}";

const campo = "h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-sm outline-none focus:border-violet-400";

/**
 * O Prêmio Reclame Aqui (Fase 23): a campanha e a lista de quem pedir.
 *
 * Em cima, a campanha — o nome, o link da votação e a mensagem com
 * {nome} e {link}. Embaixo, os filtros de quem avaliou bem, a prévia de
 * quem entra e o botão que baixa a planilha e registra quem foi
 * exportado. Quem já está na campanha não volta na próxima exportação.
 */
export default function PainelDoPremio({ aoMudar }: { aoMudar?: (campanha: CampanhaView | null, pedidos: PedidoView[]) => void }) {

  const { cases } = useCases();
  const { responses } = useNps();
  const { notify } = useToast();

  const [campanhas, setCampanhas] = useState<CampanhaView[]>([]);
  const [pedidos, setPedidos] = useState<PedidoView[]>([]);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Omit<CampanhaView, "id"> & { id?: string }>({ nome: "", mensagem: MENSAGEM_PADRAO });
  const [erroDoBanco, setErroDoBanco] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosDoPremio>(FILTROS_PADRAO);

  function aplicar(r: Awaited<ReturnType<typeof lerPremio>>, id?: string) {
    if (!r.ok) {
      setErroDoBanco(r.erro);
      return;
    }
    setErroDoBanco(null);
    setCampanhas(r.campanhas);
    setPedidos(r.pedidos);
    const atual = r.campanhas.find((c) => c.id === (id ?? r.campanhas[0]?.id)) ?? null;
    setEscolhida(atual?.id ?? null);
    if (atual) setRascunho(atual);
    aoMudar?.(atual, r.pedidos);
  }

  async function carregar(id?: string) {
    aplicar(await lerPremio(id), id);
  }

  /* Uma leitura ao abrir; as outras vêm de quem grava. */
  useEffect(() => {
    let vivo = true;
    lerPremio().then((r) => vivo && aplicar(r));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jaNaCampanha = useMemo(() => new Set(pedidos.map((p) => `${p.origem}:${p.ref}`)), [pedidos]);
  const lista = useMemo(() => contatosDoPremio({ casos: cases, nps: responses, filtros, jaNaCampanha }), [cases, responses, filtros, jaNaCampanha]);
  const comTelefone = lista.filter((c) => c.telefoneInternacional).length;
  const campanha = campanhas.find((c) => c.id === escolhida) ?? null;

  async function salvar() {
    setSalvando(true);
    const r = await salvarCampanha(rascunho);
    setSalvando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "A campanha não foi salva.", detail: r.erro });
      return;
    }
    notify({ tone: "success", title: "Campanha salva." });
    await carregar(r.id);
  }

  async function exportar() {
    if (!escolhida) return;
    setExportando(true);
    const r = await registrarExportados(escolhida, lista);
    setExportando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "A planilha não saiu.", detail: r.erro });
      return;
    }
    const bytes = Uint8Array.from(atob(r.arquivo), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = r.nome;
    link.click();
    URL.revokeObjectURL(url);
    notify({ tone: "success", title: `${lista.length} contato(s) na planilha.`, detail: `${r.novos} registrado(s) na campanha como exportados — não voltam na próxima exportação.` });
    await carregar(escolhida);
  }

  const troca = <K extends keyof FiltrosDoPremio>(k: K, v: FiltrosDoPremio[K]) => setFiltros((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      {erroDoBanco && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {erroDoBanco}
        </p>
      )}

      <SurfaceCard
        title="A campanha"
        description="O prêmio deste ano: o link da votação e a mensagem do pedido. Use {nome} e {link} na mensagem — a planilha sai com cada uma preenchida."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {campanhas.length > 0 && (
            <label className="grid gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
              Campanha
              <select
                id="premio-campanha"
                value={escolhida ?? ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setEscolhida(null);
                    setRascunho({ nome: "", mensagem: MENSAGEM_PADRAO });
                  } else void carregar(e.target.value);
                }}
                className={campo}
              >
                {campanhas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
                <option value="">+ Nova campanha</option>
              </select>
            </label>
          )}
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Nome
            <input id="premio-nome" value={rascunho.nome} onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))} placeholder="Prêmio Reclame Aqui 2026" className={campo} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Categoria
            <input id="premio-categoria" value={rascunho.categoria ?? ""} onChange={(e) => setRascunho((r) => ({ ...r, categoria: e.target.value }))} placeholder="Ex.: Softwares para restaurantes" className={campo} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
            Link da votação
            <input id="premio-link" value={rascunho.linkVotacao ?? ""} onChange={(e) => setRascunho((r) => ({ ...r, linkVotacao: e.target.value }))} placeholder="https://…" className={campo} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Votação abre
            <input id="premio-inicio" type="date" value={rascunho.votacaoInicio ?? ""} onChange={(e) => setRascunho((r) => ({ ...r, votacaoInicio: e.target.value }))} className={campo} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Votação fecha
            <input id="premio-fim" type="date" value={rascunho.votacaoFim ?? ""} onChange={(e) => setRascunho((r) => ({ ...r, votacaoFim: e.target.value }))} className={campo} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Data de corte da reputação
            <input id="premio-corte" type="date" value={rascunho.dataDeCorte ?? ""} onChange={(e) => setRascunho((r) => ({ ...r, dataDeCorte: e.target.value }))} className={campo} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600">
            Nota que precisa ter na data de corte
            <input
              id="premio-meta"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={rascunho.notaMeta ?? ""}
              onChange={(e) => setRascunho((r) => ({ ...r, notaMeta: e.target.value === "" ? undefined : Number(e.target.value) }))}
              className={campo}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
            Mensagem do pedido
            <textarea id="premio-mensagem" rows={3} value={rascunho.mensagem ?? ""} onChange={(e) => setRascunho((r) => ({ ...r, mensagem: e.target.value }))} className={`${campo} h-auto py-2`} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
            Mensagem do lembrete (para quem recebeu o pedido e ainda não votou)
            <textarea
              id="premio-lembrete"
              rows={2}
              value={rascunho.lembrete ?? ""}
              onChange={(e) => setRascunho((r) => ({ ...r, lembrete: e.target.value }))}
              placeholder="Oi, {nome}! Passando para lembrar: a votação fecha em breve — {link}"
              className={`${campo} h-auto py-2`}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={salvar} disabled={salvando} className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {salvando && <Loader2 size={14} className="animate-spin" />} {rascunho.id ? "Salvar a campanha" : "Criar a campanha"}
          </button>
        </div>
      </SurfaceCard>

      {campanha && <PremioNoCalendario campanha={campanha} />}

      <SurfaceCard
        title="Quem pedir o voto"
        description="Quem já foi bem atendido. Uma pessoa por telefone, e quem já está na campanha fica de fora."
      >
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-700">
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <legend className="sr-only">Reclame Aqui</legend>
            <label className="flex items-center gap-1.5"><input id="premio-f-ra" type="checkbox" checked={filtros.frentes.includes("reclame-aqui")} onChange={(e) => troca("frentes", e.target.checked ? [...filtros.frentes, "reclame-aqui"] : filtros.frentes.filter((f) => f !== "reclame-aqui"))} className="h-4 w-4 accent-violet-600" /> Reclame Aqui</label>
            <label className="flex items-center gap-1.5"><input id="premio-f-resolvido" type="checkbox" checked={filtros.resolvido} onChange={(e) => troca("resolvido", e.target.checked)} className="h-4 w-4 accent-violet-600" /> resolvido</label>
            <label className="flex items-center gap-1.5"><input id="premio-f-voltaria" type="checkbox" checked={filtros.voltaria} onChange={(e) => troca("voltaria", e.target.checked)} className="h-4 w-4 accent-violet-600" /> voltaria</label>
            <label className="flex items-center gap-1.5">
              nota ≥
              <select id="premio-f-nota" value={filtros.notaMinima} onChange={(e) => troca("notaMinima", Number(e.target.value))} className="h-8 rounded-md border border-zinc-200 px-1.5 text-sm">
                {[0, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n === 0 ? "qualquer" : n}</option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <legend className="sr-only">NPS</legend>
            <label className="flex items-center gap-1.5"><input id="premio-f-nps" type="checkbox" checked={filtros.frentes.includes("nps")} onChange={(e) => troca("frentes", e.target.checked ? [...filtros.frentes, "nps"] : filtros.frentes.filter((f) => f !== "nps"))} className="h-4 w-4 accent-violet-600" /> NPS</label>
            <label className="flex items-center gap-1.5"><input id="premio-f-promotor" type="checkbox" checked={filtros.promotores} onChange={(e) => troca("promotores", e.target.checked)} className="h-4 w-4 accent-violet-600" /> só promotores</label>
            <label className="flex items-center gap-1.5"><input id="premio-f-google" type="checkbox" checked={filtros.googleCinco} onChange={(e) => troca("googleCinco", e.target.checked)} className="h-4 w-4 accent-violet-600" /> 5 estrelas no Google</label>
          </fieldset>
          <label className="flex items-center gap-1.5">de <input id="premio-f-de" type="date" value={filtros.de ?? ""} onChange={(e) => troca("de", e.target.value || undefined)} className="h-8 rounded-md border border-zinc-200 px-1.5 text-sm" /></label>
          <label className="flex items-center gap-1.5">até <input id="premio-f-ate" type="date" value={filtros.ate ?? ""} onChange={(e) => troca("ate", e.target.value || undefined)} className="h-8 rounded-md border border-zinc-200 px-1.5 text-sm" /></label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
          <p className="text-sm text-zinc-700">
            <strong className="font-semibold tabular-nums">{lista.length}</strong> pessoa(s) · <span className="tabular-nums">{comTelefone}</span> com telefone para o WhatsApp
            {jaNaCampanha.size > 0 && <span className="text-zinc-500"> · {jaNaCampanha.size} já na campanha, fora da lista</span>}
          </p>
          <button
            type="button"
            onClick={exportar}
            disabled={!escolhida || lista.length === 0 || exportando}
            title={!escolhida ? "Crie a campanha antes de exportar" : undefined}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-700 px-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar a planilha e registrar
          </button>
        </div>

        {lista.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Nome</th>
                  <th className="py-1.5 pr-3 font-semibold">Telefone</th>
                  <th className="py-1.5 pr-3 font-semibold">Por quê</th>
                  <th className="py-1.5 font-semibold">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lista.slice(0, 8).map((c) => (
                  <tr key={`${c.origem}:${c.ref}`}>
                    <td className="py-1.5 pr-3 text-zinc-800">{c.nome}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-zinc-600">{c.telefoneInternacional ?? <span className="text-zinc-400">sem telefone</span>}</td>
                    <td className="py-1.5 pr-3 text-zinc-600">{c.motivo}</td>
                    <td className="max-w-md truncate py-1.5 text-zinc-500">{mensagemParaContato(campanha?.mensagem ?? rascunho.mensagem ?? "", c, campanha?.linkVotacao ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 8 && <p className="mt-1 text-xs text-zinc-400">e mais {lista.length - 8} na planilha.</p>}
          </div>
        )}
      </SurfaceCard>

      {campanha && <CampanhaDeVotacao campanha={campanha} pedidos={pedidos} recarregar={() => carregar(campanha.id)} />}

      <DepoimentosProntos />
    </div>
  );
}
