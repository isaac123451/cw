"use client";

import { useEffect, useState } from "react";

import { Loader2, Save, X } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerComparacaoDoSegmento, salvarConcorrentes } from "@/lib/actions/segmento";
import { useToast } from "@/lib/context/ToastContext";
import { lugarDaCasa, ordenarSegmento, SELO_DO_PORTAL, slugDoEndereco, type LinhaDoSegmento } from "@/lib/models/segmento";
import { ptBR } from "@/lib/services/reputation.service";

const PERIODOS = [
  { tipo: "SIX_MONTHS", rotulo: "6 meses" },
  { tipo: "TWELVE_MONTHS", rotulo: "12 meses" },
  { tipo: "LAST_YEAR", rotulo: "Ano passado" },
  { tipo: "LAST_THREE_YEARS", rotulo: "3 anos" },
];

const pct = (v: number | null) => (v === null ? "—" : `${ptBR(v)}%`);

/**
 * Comparação com o segmento (Fase 30, 1.107).
 *
 * A reputação das empresas parecidas, lida pela extensão nas páginas
 * públicas do Reclame Aqui uma vez por dia, lado a lado com a da Cardápio
 * Web — o mesmo painel que o consumidor vê em cada uma. A lista de quem
 * entra se edita aqui mesmo, colando o link da página da empresa.
 */
export default function ComparacaoComSegmento() {
  const { notify } = useToast();
  const [tipo, setTipo] = useState("SIX_MONTHS");
  const [dados, setDados] = useState<{ linhas: LinhaDoSegmento[]; concorrentes: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [lista, setLista] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerComparacaoDoSegmento(tipo).then((r) => {
      if (!vivo) return;
      if (!r.ok) setErro(r.erro);
      else {
        setErro(null);
        setDados(r);
      }
    });
    return () => {
      vivo = false;
    };
  }, [tipo]);

  function abrirEdicao() {
    setLista(dados?.concorrentes ?? []);
    setNovo("");
    setEditando(true);
  }

  function adicionar() {
    const slug = slugDoEndereco(novo);
    if (!slug) {
      notify({ tone: "error", title: "Não reconheci a empresa.", detail: "Cole o link da página dela no Reclame Aqui." });
      return;
    }
    setLista((l) => (l.includes(slug) ? l : [...l, slug]));
    setNovo("");
  }

  async function salvar() {
    setSalvando(true);
    const r = await salvarConcorrentes(lista);
    setSalvando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi salvo.", detail: r.erro });
      return;
    }
    notify({ tone: "success", title: "Lista salva.", detail: "As empresas novas aparecem depois da próxima leitura da extensão, no máximo amanhã." });
    setDados((d) => (d ? { ...d, concorrentes: r.concorrentes } : d));
    setEditando(false);
  }

  const linhas = dados ? ordenarSegmento(dados.linhas) : [];
  const casa = linhas.find((l) => l.casa);
  const lugar = dados ? lugarDaCasa(dados.linhas) : null;
  const lidoEm = linhas.map((l) => l.lidoEm).sort().pop();
  const mudou = editando && lista.join(",") !== (dados?.concorrentes ?? []).join(",");

  return (
    <SurfaceCard
      title="Comparação com o segmento"
      description="A reputação de empresas parecidas no Reclame Aqui, lida das páginas públicas uma vez por dia pela extensão — o mesmo painel que o consumidor vê."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-xs">
            {PERIODOS.map((p) => (
              <button
                key={p.tipo}
                type="button"
                onClick={() => setTipo(p.tipo)}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${tipo === p.tipo ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          {!editando && dados && (
            <button type="button" onClick={abrirEdicao} className="text-xs font-medium text-zinc-600 hover:text-violet-700">
              Editar as empresas comparadas
            </button>
          )}
        </div>

        {(casa?.posicao || lugar) && (
          <p className="text-sm text-zinc-700">
            {casa?.posicao && (
              <>
                <b className="font-semibold text-zinc-900">
                  {casa.posicao.posicao}º {casa.posicao.tipo === "WORST" ? "pior" : "melhor"}
                </b>{" "}
                em {casa.posicao.segmento}, no ranking do Reclame Aqui.{" "}
              </>
            )}
            {lugar && lugar.de > 1 && (
              <span className="text-zinc-500">
                Entre as comparadas, {lugar.lugar}º de {lugar.de}.
              </span>
            )}
          </p>
        )}

        {erro && <p className="text-sm text-amber-800">{erro}</p>}

        {dados && linhas.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ainda sem leitura. A extensão lê as páginas públicas uma vez por dia, logo depois de uma volta do vigia — com o navegador aberto, os números aparecem aqui em até meia hora.
          </p>
        )}

        {linhas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="px-3 py-2 text-right font-medium">Nota</th>
                  <th className="px-3 py-2 text-right font-medium">Respondidas</th>
                  <th className="px-3 py-2 text-right font-medium">Solução</th>
                  <th className="px-3 py-2 text-right font-medium">Voltaria</th>
                  <th className="px-3 py-2 text-right font-medium">Nota do consumidor</th>
                  <th className="px-3 py-2 text-right font-medium">Reclamações</th>
                  <th className="px-3 py-2 text-right font-medium">Tempo de resposta</th>
                  <th className="py-2 pl-3 font-medium">Selo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const delta = l.nota !== null && l.notaAntes !== null ? Math.round((l.nota - l.notaAntes) * 10) / 10 : null;
                  return (
                    <tr key={l.slug} className={`border-b border-zinc-50 last:border-0 ${l.casa ? "bg-violet-50/60" : ""}`}>
                      <td className="py-2.5 pr-3">
                        <a
                          href={`https://www.reclameaqui.com.br/empresa/${l.slug}/`}
                          target="_blank"
                          rel="noreferrer"
                          className={`hover:text-violet-700 ${l.casa ? "font-semibold text-violet-900" : "font-medium text-zinc-900"}`}
                        >
                          {l.nome}
                        </a>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <span className="font-semibold text-zinc-900">{l.nota === null ? "—" : ptBR(l.nota, 1)}</span>
                        {delta !== null && delta !== 0 && (
                          <span className={`ml-1.5 text-xs ${delta > 0 ? "text-emerald-700" : "text-rose-600"}`} title="Em relação a cerca de 30 dias atrás">
                            {delta > 0 ? "+" : ""}
                            {ptBR(delta, 1)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{pct(l.resposta)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{pct(l.solucao)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{pct(l.voltaria)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{l.notaConsumidor === null ? "—" : ptBR(l.notaConsumidor, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700">{l.recebidas ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-700">{l.tempoMedio || "—"}</td>
                      <td className="py-2.5 pl-3 text-zinc-700">{SELO_DO_PORTAL[l.selo] ?? (l.selo ? l.selo : "Sem índice")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lidoEm && (
              <p className="mt-2 text-xs text-zinc-400">
                Lido em {new Date(lidoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}. A variação ao lado da nota compara com cerca de 30 dias antes.
              </p>
            )}
          </div>
        )}

        {editando && (
          <div className="space-y-3 border-t border-zinc-100 pt-4">
            <div className="flex flex-wrap gap-1.5">
              {lista.length === 0 && <span className="text-xs text-zinc-500">Nenhuma empresa: só a Cardápio Web será lida.</span>}
              {lista.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5 text-xs text-zinc-700">
                  {dados?.linhas.find((l) => l.slug === s)?.nome ?? s}
                  <button type="button" onClick={() => setLista((l) => l.filter((x) => x !== s))} className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" aria-label={`Tirar ${s}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionar();
                  }
                }}
                placeholder="Link da empresa no Reclame Aqui"
                className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-violet-400"
                aria-label="Link da empresa no Reclame Aqui"
              />
              <button type="button" onClick={adicionar} disabled={!novo.trim()} className="h-9 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
                Adicionar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={!mudou || salvando}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
              <button type="button" onClick={() => setEditando(false)} className="h-9 px-2 text-sm text-zinc-500 hover:text-zinc-800">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
