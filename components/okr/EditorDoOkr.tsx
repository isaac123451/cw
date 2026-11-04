"use client";

import { useMemo, useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

import { salvarOkr } from "@/lib/actions/okr";
import { useToast } from "@/lib/context/ToastContext";
import { METRICAS, mesesDoOkr, metricaDe, nomeDoMes, problemaDoOkr, type MetricaId, type OkrView, type ResultadoChave } from "@/lib/models/okr";

const campo = "h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";
const area = "w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

/* Número digitado em português ("44,3") ou vazio. */
const lerNumero = (t: string) => {
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? null : n;
};
const escrever = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

interface KrEmEdicao {
  id: string;
  titulo: string;
  metrica: MetricaId;
  meta: string;
  linhaDeBase: string;
  linhaDeBaseNota: string;
  metasMensais: Record<string, string>;
  corte: string;
  regra: string;
}

const paraEdicao = (k: ResultadoChave): KrEmEdicao => ({
  id: k.id,
  titulo: k.titulo,
  metrica: k.metrica,
  meta: escrever(k.meta),
  linhaDeBase: escrever(k.linhaDeBase),
  linhaDeBaseNota: k.linhaDeBaseNota ?? "",
  metasMensais: Object.fromEntries(Object.entries(k.metasMensais ?? {}).map(([m, v]) => [m, escrever(v)])),
  corte: k.corte ?? "",
  regra: k.regra ?? "",
});

/**
 * Montar o OKR na própria página, no lugar do cartão — nada de janela
 * comprida por cima. Objetivo e vigência no topo; cada resultado-chave é
 * uma linha que abre: nome, métrica, meta e as metas de cada mês.
 */
export default function EditorDoOkr({ inicial, onSalvo, onCancelar }: { inicial: OkrView; onSalvo: (okr: OkrView) => void; onCancelar: () => void }) {
  const { notify } = useToast();
  const [objetivo, setObjetivo] = useState(inicial.objetivo);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [contexto, setContexto] = useState(inicial.contexto);
  const [krs, setKrs] = useState<KrEmEdicao[]>(inicial.krs.map(paraEdicao));
  const [aberto, setAberto] = useState<number>(inicial.krs.length ? -1 : 0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const meses = useMemo(() => mesesDoOkr(inicio, fim), [inicio, fim]);

  const montar = (): OkrView => ({
    id: inicial.id,
    objetivo,
    inicio,
    fim,
    contexto,
    krs: krs.map((k, i) => ({
      id: k.id || `kr${i + 1}`,
      titulo: k.titulo,
      metrica: k.metrica,
      meta: lerNumero(k.meta) ?? NaN,
      linhaDeBase: lerNumero(k.linhaDeBase),
      linhaDeBaseNota: k.linhaDeBaseNota,
      metasMensais: Object.fromEntries(
        Object.entries(k.metasMensais)
          .filter(([m, v]) => meses.includes(m) && v.trim() !== "")
          .map(([m, v]) => [m, lerNumero(v) ?? NaN])
      ),
      corte: metricaDe(k.metrica)?.frente === "NPS" && k.corte ? k.corte : null,
      regra: k.regra,
    })),
  });

  const mudarKr = (i: number, mudanca: Partial<KrEmEdicao>) => setKrs((lista) => lista.map((k, j) => (j === i ? { ...k, ...mudanca } : k)));

  async function salvar() {
    const okr = montar();
    const problema = problemaDoOkr(okr);
    if (problema) {
      setErro(problema);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarOkr(okr);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      notify({ tone: "success", title: "OKR salvo." });
      onSalvo(r.okr);
    } catch {
      setErro("Não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4 sm:p-5">
      <div className="space-y-3">
        <div>
          <Rotulo>Objetivo</Rotulo>
          <textarea className={`${area} mt-1`} rows={2} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Reverter experiências negativas e reconstruir a confiança…" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <label>
            <Rotulo>Começa em</Rotulo>
            <input type="date" className={`${campo} mt-1`} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label>
            <Rotulo>Termina em</Rotulo>
            <input type="date" className={`${campo} mt-1`} value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>
        <div>
          <Rotulo>Contexto (opcional)</Rotulo>
          <textarea className={`${area} mt-1`} rows={2} value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="Frente principal, iniciativa, o que fica fora do escopo." />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Rotulo>Resultados-chave</Rotulo>
        {krs.map((k, i) => {
          const metrica = metricaDe(k.metrica);
          const estaAberto = aberto === i;
          return (
            <div key={i} className="rounded-lg ring-1 ring-inset ring-zinc-200">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setAberto(estaAberto ? -1 : i)} className="min-w-0 flex-1 text-left" aria-expanded={estaAberto}>
                  <span className="text-sm font-medium text-zinc-900">KR{i + 1} · {k.titulo || "sem nome"}</span>
                  <span className="ml-2 text-xs text-zinc-500">{metrica?.nome} · meta {k.meta || "—"}{metrica?.unidade === "%" ? "%" : ""}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKrs((lista) => lista.filter((_, j) => j !== i));
                    setAberto(-1);
                  }}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Tirar o KR${i + 1}`}
                  title="Tirar este resultado-chave"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {estaAberto && (
                <div className="space-y-3 border-t border-zinc-100 px-3 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <Rotulo>Nome</Rotulo>
                      <input className={`${campo} mt-1`} value={k.titulo} onChange={(e) => mudarKr(i, { titulo: e.target.value })} placeholder="Confiança recuperada" />
                    </label>
                    <label>
                      <Rotulo>Métrica</Rotulo>
                      <select className={`${campo} mt-1`} value={k.metrica} onChange={(e) => mudarKr(i, { metrica: e.target.value as MetricaId })}>
                        {METRICAS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.frente} · {m.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {metrica && <p className="text-xs text-zinc-500">{metrica.leitura}</p>}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label>
                      <Rotulo>Meta final</Rotulo>
                      <input inputMode="decimal" className={`${campo} mt-1`} value={k.meta} onChange={(e) => mudarKr(i, { meta: e.target.value })} placeholder={metrica?.unidade === "nota" ? "9,0" : "60"} />
                    </label>
                    <label>
                      <Rotulo>Linha de base</Rotulo>
                      <input inputMode="decimal" className={`${campo} mt-1`} value={k.linhaDeBase} onChange={(e) => mudarKr(i, { linhaDeBase: e.target.value })} placeholder="vazio = sem base" />
                    </label>
                    <label className="col-span-2">
                      <Rotulo>Sobre a linha de base</Rotulo>
                      <input className={`${campo} mt-1`} value={k.linhaDeBaseNota} onChange={(e) => mudarKr(i, { linhaDeBaseNota: e.target.value })} placeholder="80,8% em 15/10/2026" />
                    </label>
                  </div>
                  {meses.length > 0 && (
                    <div>
                      <Rotulo>Meta de cada mês (acumulada)</Rotulo>
                      <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {meses.map((m) => (
                          <label key={m}>
                            <span className="text-[11px] capitalize text-zinc-500">{nomeDoMes(m)}</span>
                            <input inputMode="decimal" className={campo} value={k.metasMensais[m] ?? ""} onChange={(e) => mudarKr(i, { metasMensais: { ...k.metasMensais, [m]: e.target.value } })} />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {metrica?.frente === "NPS" && (
                    <label className="block sm:max-w-xs">
                      <Rotulo>Entra na população até</Rotulo>
                      <input type="date" className={`${campo} mt-1`} value={k.corte} min={inicio} max={fim} onChange={(e) => mudarKr(i, { corte: e.target.value })} />
                    </label>
                  )}
                  <label className="block">
                    <Rotulo>Regra (opcional)</Rotulo>
                    <textarea className={`${area} mt-1`} rows={2} value={k.regra} onChange={(e) => mudarKr(i, { regra: e.target.value })} placeholder="O que conta como sucesso, quem fica no denominador." />
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {krs.length < 8 && (
          <button
            type="button"
            onClick={() => {
              setKrs((lista) => [...lista, { id: "", titulo: "", metrica: "ra-voltaria", meta: "", linhaDeBase: "", linhaDeBaseNota: "", metasMensais: {}, corte: "", regra: "" }]);
              setAberto(krs.length);
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50"
          >
            <Plus size={15} /> Resultado-chave
          </button>
        )}
      </div>

      <ErroDoServidor erro={erro} />
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
        <RodapeDeSalvar salvando={salvando} onSalvar={salvar} onCancelar={onCancelar} />
      </div>
    </div>
  );
}
