"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CalendarOff, Loader2, Shuffle, UserCheck } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { aplicarDistribuicao, lerDistribuicao, preverDistribuicao, salvarAusencia, type Distribuicao } from "@/lib/actions/distribuicao";
import { useToast } from "@/lib/context/ToastContext";
import { cargaTotal, FRENTES_DA_FILA, ROTULO_DA_FRENTE, type FrenteDaFila, type PessoaDoTime, type PlanoDeDistribuicao } from "@/lib/models/distribuicao";

const dataCurta = (aaaammdd: string) => `${aaaammdd.slice(8, 10)}/${aaaammdd.slice(5, 7)}`;
const LIMITE_DA_LISTA = 40;

/**
 * Distribuição do time (Fase 30, 1.106).
 *
 * A carga de cada pessoa por frente, quem está fora e a fila que precisa
 * de dono — a de quem está ausente, ou a dos itens sem responsável. Nada
 * muda sem a prévia: primeiro se vê para quem vai cada item, depois se
 * confirma. A conta está em `lib/models/distribuicao.ts`.
 */
export default function DistribuicaoPage() {
  const { notify } = useToast();
  const [dados, setDados] = useState<Distribuicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoAusencia, setEditandoAusencia] = useState<string | null>(null);
  const [volta, setVolta] = useState("");
  const [gravando, setGravando] = useState(false);

  const [origem, setOrigem] = useState<string | null>(null);
  const [frentes, setFrentes] = useState<FrenteDaFila[]>([]);
  const [destinos, setDestinos] = useState<string[]>([]);
  const [plano, setPlano] = useState<PlanoDeDistribuicao | null>(null);
  const [prevendo, setPrevendo] = useState(false);
  const [verTudo, setVerTudo] = useState(false);

  async function carregar() {
    const r = await lerDistribuicao();
    if (!r.ok) setErro(r.erro);
    else {
      setErro(null);
      setDados(r);
    }
  }

  useEffect(() => {
    let vivo = true;
    lerDistribuicao().then((r) => {
      if (!vivo) return;
      if (!r.ok) setErro(r.erro);
      else setDados(r);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const pessoas = dados?.pessoas ?? [];
  const vazia: Record<FrenteDaFila, number> = { "reclame-aqui": 0, redes: 0, nps: 0 };
  const cargaDaOrigem = !dados || !origem ? vazia : origem === "sem-dono" ? dados.semDono : (pessoas.find((p) => p.id === origem)?.carga ?? vazia);

  function abrirDistribuicao(de: string) {
    if (!dados) return;
    const carga = de === "sem-dono" ? dados.semDono : pessoas.find((p) => p.id === de)?.carga;
    setOrigem(de);
    setFrentes(FRENTES_DA_FILA.filter((f) => (carga?.[f] ?? 0) > 0));
    setDestinos(pessoas.filter((p) => !p.ausente && p.id !== de && FRENTES_DA_FILA.some((f) => p.podeReceber[f])).map((p) => p.id));
    setPlano(null);
    setVerTudo(false);
  }

  function alternar<T>(lista: T[], item: T) {
    return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
  }

  async function prever() {
    if (!origem) return;
    setPrevendo(true);
    const r = await preverDistribuicao({ origem, frentes, destinos });
    setPrevendo(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Sem prévia.", detail: r.erro });
      return;
    }
    setPlano(r.plano);
    setVerTudo(false);
  }

  async function confirmar() {
    if (!origem || !plano) return;
    setGravando(true);
    const r = await aplicarDistribuicao({ origem, frentes, destinos, vistos: plano.atribuicoes.map((a) => ({ id: a.id, paraId: a.paraId })) });
    setGravando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi distribuído.", detail: r.erro });
      return;
    }
    notify({
      tone: "success",
      title: `${r.gravados} ${r.gravados === 1 ? "item mudou" : "itens mudaram"} de responsável.`,
      detail: r.ignorados ? `${r.ignorados} ficaram onde estavam: mudaram depois da prévia.` : "Cada um ganhou uma anotação dizendo de quem para quem passou.",
    });
    setOrigem(null);
    setPlano(null);
    await carregar();
  }

  async function gravarAusencia(p: PessoaDoTime, ate: string | null) {
    setGravando(true);
    const r = await salvarAusencia(p.id, ate);
    setGravando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi salvo.", detail: r.erro });
      return;
    }
    notify({
      tone: "success",
      title: ate ? `${p.nome} ausente até ${dataCurta(ate)}.` : `${p.nome} de volta.`,
      detail: ate && cargaTotal(p.carga) > 0 ? "A fila aparece no topo da tela para redistribuir." : undefined,
    });
    setEditandoAusencia(null);
    await carregar();
  }

  const ausentesComFila = pessoas.filter((p) => p.ausente && cargaTotal(p.carga) > 0);
  const totalSemDono = dados ? cargaTotal(dados.semDono) : 0;
  const nomeDaOrigem = origem === "sem-dono" ? "sem responsável" : pessoas.find((p) => p.id === origem)?.nome;
  const podeRedistribuir = (de: string) => !!dados && (dados.admin || de === "sem-dono" || de === dados.eu);

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Hoje"
          title="Distribuição do time"
          description="Quanto cada pessoa carrega agora, em cada frente, quem está fora e para quem vai a fila que precisa de dono."
        />

        {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">{erro}</p>}

        {!dados && !erro && (
          <p className="flex items-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 size={15} className="animate-spin" /> Somando a carga de cada um…
          </p>
        )}

        {dados && ausentesComFila.length > 0 && !origem && (
          <div className="space-y-1.5">
            {ausentesComFila.map((p) => (
              <p key={p.id} className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                <CalendarOff size={14} className="text-amber-600" />
                <span>
                  <b className="font-semibold">{p.nome}</b> está fora até {dataCurta(p.ausenteAte!)} com {cargaTotal(p.carga)} {cargaTotal(p.carga) === 1 ? "item aberto" : "itens abertos"}.
                </span>
                {podeRedistribuir(p.id) && (
                  <button type="button" onClick={() => abrirDistribuicao(p.id)} className="font-medium text-violet-700 hover:underline">
                    Redistribuir a fila
                  </button>
                )}
              </p>
            ))}
          </div>
        )}

        {dados && (
          <SurfaceCard title="Carga de agora" description="Itens abertos com cada pessoa. No Reclame Aqui, entre parênteses, os que ainda não têm resposta pública.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Pessoa</th>
                    {FRENTES_DA_FILA.map((f) => (
                      <th key={f} className="px-3 py-2 text-right font-medium">
                        {ROTULO_DA_FRENTE[f]}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="py-2 pl-3 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-zinc-900">{p.nome}</td>
                      {FRENTES_DA_FILA.map((f) => (
                        <td key={f} className={`px-3 py-2.5 text-right tabular-nums ${p.podeReceber[f] ? "text-zinc-800" : "text-zinc-300"}`} title={p.podeReceber[f] ? undefined : "Sem acesso de agente nesta frente"}>
                          {p.carga[f]}
                          {f === "reclame-aqui" && p.semResposta > 0 && <span className="ml-1 text-xs text-rose-600">({p.semResposta})</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-900">{cargaTotal(p.carga)}</td>
                      <td className="py-2.5 pl-3">
                        {editandoAusencia === p.id ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-zinc-500">Fora até</span>
                            <input type="date" min={dados.hoje} value={volta} onChange={(e) => setVolta(e.target.value)} className="h-8 rounded-lg border border-zinc-200 px-2 text-xs outline-none focus:border-violet-400" />
                            <button type="button" disabled={!volta || gravando} onClick={() => gravarAusencia(p, volta)} className="h-8 rounded-lg bg-violet-700 px-2.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-40">
                              Salvar
                            </button>
                            <button type="button" onClick={() => setEditandoAusencia(null)} className="h-8 px-1.5 text-xs text-zinc-500 hover:text-zinc-800">
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            {p.ausente ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Fora até {dataCurta(p.ausenteAte!)}</span>
                            ) : (
                              <span className="text-zinc-500">Presente</span>
                            )}
                            {(dados.admin || p.id === dados.eu) &&
                              (p.ausente ? (
                                <button type="button" disabled={gravando} onClick={() => gravarAusencia(p, null)} className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                                  <UserCheck size={12} /> Voltou
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditandoAusencia(p.id);
                                    setVolta("");
                                  }}
                                  className="font-medium text-zinc-600 hover:text-violet-700"
                                >
                                  Marcar ausência
                                </button>
                              ))}
                            {cargaTotal(p.carga) > 0 && podeRedistribuir(p.id) && (
                              <button type="button" onClick={() => abrirDistribuicao(p.id)} className="font-medium text-zinc-600 hover:text-violet-700">
                                Passar a fila
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50/60">
                    <td className="py-2.5 pr-3 text-zinc-600">Sem responsável</td>
                    {FRENTES_DA_FILA.map((f) => (
                      <td key={f} className="px-3 py-2.5 text-right tabular-nums text-zinc-600">
                        {dados.semDono[f]}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-700">{totalSemDono}</td>
                    <td className="py-2.5 pl-3 text-xs">
                      {totalSemDono > 0 && (
                        <button type="button" onClick={() => abrirDistribuicao("sem-dono")} className="font-medium text-violet-700 hover:underline">
                          Distribuir
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        )}

        {dados && origem && (
          <SurfaceCard
            title={origem === "sem-dono" ? "Distribuir os sem responsável" : `Passar a fila de ${nomeDaOrigem}`}
            description="Cada item vai para quem tem menos na mesma frente; se alguém já atende aquele cliente, vai para essa pessoa. Os mais antigos primeiro. Nada muda antes de confirmar."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 text-xs text-zinc-500">Frentes</span>
                {FRENTES_DA_FILA.map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={cargaDaOrigem[f] === 0}
                    onClick={() => {
                      setFrentes((l) => alternar(l, f));
                      setPlano(null);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-40 ${frentes.includes(f) ? "bg-violet-50 text-violet-800 ring-violet-200" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
                  >
                    {ROTULO_DA_FRENTE[f]} · {cargaDaOrigem[f]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 text-xs text-zinc-500">Para</span>
                {pessoas
                  .filter((p) => p.id !== origem)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={p.ausente}
                      title={p.ausente ? `Fora até ${dataCurta(p.ausenteAte!)}` : undefined}
                      onClick={() => {
                        setDestinos((l) => alternar(l, p.id));
                        setPlano(null);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-40 ${destinos.includes(p.id) ? "bg-violet-50 text-violet-800 ring-violet-200" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
                    >
                      {p.nome}
                    </button>
                  ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={prever}
                  disabled={prevendo || !frentes.length || !destinos.length}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {prevendo ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
                  Ver a prévia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrigem(null);
                    setPlano(null);
                  }}
                  className="h-9 px-2 text-sm text-zinc-500 hover:text-zinc-800"
                >
                  Fechar
                </button>
              </div>

              {plano && (
                <div className="space-y-3 border-t border-zinc-100 pt-4">
                  {plano.atribuicoes.length === 0 ? (
                    <p className="text-sm text-zinc-500">Nada a distribuir com essas escolhas.</p>
                  ) : (
                    <>
                      <ul className="space-y-1 text-sm">
                        {plano.porPessoa.map((p) => (
                          <li key={p.id}>
                            <b className="font-semibold text-zinc-900">{p.nome}</b>{" "}
                            <span className="text-zinc-600">
                              recebe{" "}
                              {FRENTES_DA_FILA.filter((f) => p.recebe[f] > 0)
                                .map((f) => `${p.recebe[f]} de ${ROTULO_DA_FRENTE[f]}`)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <ul className="divide-y divide-zinc-50 rounded-xl ring-1 ring-inset ring-zinc-100">
                        {(verTudo ? plano.atribuicoes : plano.atribuicoes.slice(0, LIMITE_DA_LISTA)).map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                            <Link href={a.href} className="min-w-0 truncate text-zinc-700 hover:text-violet-700">
                              {a.rotulo}
                            </Link>
                            <span className="shrink-0 text-zinc-500">
                              → <span className="font-medium text-zinc-800">{a.paraNome}</span>
                              {a.motivo === "mesmo-cliente" && <span className="ml-1.5 text-violet-700">mesmo cliente</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {!verTudo && plano.atribuicoes.length > LIMITE_DA_LISTA && (
                        <button type="button" onClick={() => setVerTudo(true)} className="text-xs font-medium text-violet-700 hover:underline">
                          Ver os outros {plano.atribuicoes.length - LIMITE_DA_LISTA}
                        </button>
                      )}
                    </>
                  )}
                  {plano.semDestino.length > 0 && (
                    <p className="text-xs text-amber-800">
                      {plano.semDestino.length} {plano.semDestino.length === 1 ? "item fica" : "itens ficam"} onde {plano.semDestino.length === 1 ? "está" : "estão"}: ninguém escolhido tem acesso de agente nessa frente.
                    </p>
                  )}
                  {plano.atribuicoes.length > 0 && (
                    <button
                      type="button"
                      onClick={confirmar}
                      disabled={gravando}
                      className="flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"
                    >
                      {gravando && <Loader2 size={14} className="animate-spin" />}
                      Confirmar a distribuição de {plano.atribuicoes.length} {plano.atribuicoes.length === 1 ? "item" : "itens"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </SurfaceCard>
        )}
      </div>
    </MainLayout>
  );
}
