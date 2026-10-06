"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ArrowUpRight, ChevronDown, Loader2, Sparkles, TrendingDown } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerRespostaEResultado, virarRespostaPronta } from "@/lib/actions/respostaEResultado";
import { useToast } from "@/lib/context/ToastContext";
import {
  anonimizar,
  BASE_MINIMA,
  categoriasComBase,
  melhoresRespostas,
  padroesNoWhatsapp,
  padroesQueFuncionam,
  respostasQueNaoFuncionaram,
  type RespostaComResultado,
  type TracosDaResposta,
  type VezComResultado,
} from "@/lib/models/respostaEResultado";
import { pluralDe } from "@/lib/plural";

export type AbaDoResultado = "resultado" | "funciona" | "modelos" | "whatsapp";

const pct = (v: number | null) => (v === null ? "—" : `${String(v).replace(".", ",")}%`);
const um = (v: number | null) => (v === null ? "—" : String(v).replace(".", ","));
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const espera = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} ${pluralDe(Math.round(min / 1440), "dia", "dias")}`);

const ROTULO_DO_RESULTADO: Record<RespostaComResultado["resultado"], { rotulo: string; cor: string }> = {
  funcionou: { rotulo: "Funcionou", cor: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  meio: { rotulo: "Em parte", cor: "bg-amber-50 text-amber-900 ring-amber-200" },
  nao: { rotulo: "Não funcionou", cor: "bg-rose-50 text-rose-800 ring-rose-200" },
  "sem-avaliacao": { rotulo: "Sem avaliação", cor: "bg-zinc-50 text-zinc-600 ring-zinc-200" },
};

function tracosVisiveis(t: TracosDaResposta) {
  return [
    t.prazoConcreto && "prazo concreto",
    t.vago && "\"vamos verificar\" sem prazo",
    t.contatoFeito && "conta o contato",
    t.solucaoDescrita && "descreve a solução",
    t.desculpa && "pede desculpas",
    t.conviteAvaliar ? "convida a avaliar" : "sem convite a avaliar",
    t.tamanho === "longa" ? "longa" : t.tamanho === "curta" ? "curta" : null,
  ].filter(Boolean) as string[];
}

/**
 * Resposta e resultado (Fase 29, 1.109) — ver `lib/models/respostaEResultado.ts`.
 * Uma ida ao servidor; os recortes por tipo de problema são feitos aqui.
 */
export default function ResultadoDasRespostas({ aba }: { aba: AbaDoResultado }) {
  const { notify } = useToast();
  const [dados, setDados] = useState<{ respostas: RespostaComResultado[]; vezes: VezComResultado[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("");
  const [filtro, setFiltro] = useState<RespostaComResultado["resultado"] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [limite, setLimite] = useState(40);
  const [gravando, setGravando] = useState<string | null>(null);
  const [viraram, setViraram] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    lerRespostaEResultado().then((r) => {
      if (!vivo) return;
      if (r.ok) setDados({ respostas: r.respostas, vezes: r.vezes });
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const categorias = useMemo(() => (dados ? categoriasComBase(dados.respostas) : []), [dados]);
  const doRecorte = useMemo(() => (dados ? dados.respostas.filter((r) => !categoria || r.categoria === categoria) : []), [dados, categoria]);

  async function virarModelo(r: RespostaComResultado) {
    setGravando(r.id);
    const res = await virarRespostaPronta(r.id);
    setGravando(null);
    if (!res.ok) {
      notify({ tone: "error", title: "Não virou modelo.", detail: res.erro });
      return;
    }
    setViraram((s) => new Set(s).add(r.id));
    notify({
      tone: "success",
      title: res.jaExistia ? "Esta já era uma resposta pronta." : "Virou resposta pronta.",
      detail: "Está em Respostas prontas, na categoria Modelos que funcionaram — sem o nome do cliente.",
    });
  }

  if (erro) return <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>;
  if (!dados)
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400">
        <Loader2 size={15} className="animate-spin" /> Juntando cada resposta com o que veio depois…
      </p>
    );

  const seletorDeCategoria = aba !== "whatsapp" && (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      Tipo de problema
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-800 outline-none focus:border-violet-400">
        <option value="">Todos</option>
        {categorias.map((c) => (
          <option key={c.categoria} value={c.categoria}>
            {c.categoria} ({c.avaliadas} avaliadas)
          </option>
        ))}
      </select>
    </label>
  );

  /* ---------------- Resultado ---------------- */
  if (aba === "resultado") {
    const conta = (k: RespostaComResultado["resultado"]) => doRecorte.filter((r) => r.resultado === k).length;
    const lista = doRecorte.filter((r) => !filtro || r.resultado === filtro);
    return (
      <SurfaceCard title="Cada resposta, com o que veio depois" description="Avaliou? Em quantos dias? Resolveu, com que nota, voltaria a fazer negócio? A mais recente primeiro.">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ROTULO_DO_RESULTADO) as RespostaComResultado["resultado"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(filtro === k ? null : k)}
                aria-pressed={filtro === k}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${filtro === k ? "bg-violet-700 text-white ring-violet-700" : ROTULO_DO_RESULTADO[k].cor}`}
              >
                {ROTULO_DO_RESULTADO[k].rotulo} · {conta(k)}
              </button>
            ))}
          </div>
          {seletorDeCategoria}
        </div>
        <ul className="divide-y divide-zinc-100">
          {lista.slice(0, limite).map((r) => (
            <li key={r.id} className="py-2.5">
              <button type="button" onClick={() => setAberta(aberta === r.id ? null : r.id)} className="flex w-full items-center gap-3 text-left" aria-expanded={aberta === r.id}>
                <span className={`w-28 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium ring-1 ring-inset ${ROTULO_DO_RESULTADO[r.resultado].cor}`}>{ROTULO_DO_RESULTADO[r.resultado].rotulo}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-800">
                    {r.protocolo} · {r.cliente}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {r.categoria}
                    {r.diasAteResponder !== null && ` · respondida ${r.diasAteResponder === 0 ? "no mesmo dia" : `em ${r.diasAteResponder} ${pluralDe(r.diasAteResponder, "dia", "dias")}`}`}
                    {r.avaliada
                      ? ` · ${r.resolvida ? "resolvida" : "não resolvida"}, nota ${r.nota ?? "—"}${r.voltaria ? ", voltaria" : ""}${r.diasAteAvaliar !== null ? ` · avaliou ${r.diasAteAvaliar} ${pluralDe(r.diasAteAvaliar, "dia", "dias")} depois` : ""}`
                      : " · ainda sem avaliação"}
                  </span>
                </span>
                <ChevronDown size={15} className={`shrink-0 text-zinc-400 transition-transform ${aberta === r.id ? "rotate-180" : ""}`} />
              </button>
              {aberta === r.id && (
                <div className="mt-2 grid gap-3 pl-[7.75rem] lg:grid-cols-[1fr_16rem]">
                  <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-700">{r.texto}</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {tracosVisiveis(r.tracos).map((t) => (
                        <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                          {t}
                        </span>
                      ))}
                    </div>
                    <Link href={`/reclame-aqui/${r.id}`} className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
                      Abrir a reclamação <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {lista.length > limite && (
          <button type="button" onClick={() => setLimite((l) => l + 60)} className="mt-2 text-xs font-medium text-violet-700 hover:underline">
            Ver mais {Math.min(60, lista.length - limite)}
          </button>
        )}
      </SurfaceCard>
    );
  }

  /* ---------------- O que funciona ---------------- */
  if (aba === "funciona") {
    const padroes = padroesQueFuncionam(dados.respostas, categoria || undefined);
    return (
      <SurfaceCard
        title="O que funciona, em número"
        description={`Resolvido e nota de quem tem cada traço, contra quem não tem. Diferença não é causa: quem já resolveu tende a convidar para avaliar, por exemplo. "Pouca base" é menos de ${BASE_MINIMA} avaliadas num dos lados.`}
      >
        <div className="mb-3 flex justify-end">{seletorDeCategoria}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                <th className="py-2 pr-3 font-medium">Traço</th>
                <th className="px-3 py-2 font-medium">Grupos — resolvido · nota média · (avaliadas)</th>
                <th className="py-2 pl-3 text-right font-medium">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {padroes.map((p) => {
                const melhor = Math.max(...p.grupos.map((g) => g.retorno.resolvidoPct ?? -1));
                return (
                  <tr key={p.chave} className="border-b border-zinc-50 align-top last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-zinc-900">{p.rotulo}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {p.grupos.map((g) => (
                          <span key={g.rotulo} className="text-zinc-700">
                            <span className="text-zinc-500">{g.rotulo}:</span>{" "}
                            <b className={`font-semibold ${g.retorno.resolvidoPct !== null && g.retorno.resolvidoPct === melhor && p.temBase ? "text-emerald-700" : "text-zinc-900"}`}>{pct(g.retorno.resolvidoPct)}</b>
                            {" · "}
                            {um(g.retorno.notaMedia)} <span className="text-xs text-zinc-400">({g.retorno.avaliadas})</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">
                      {p.diferenca === null ? "—" : `${String(p.diferenca).replace(".", ",")} pts`}
                      {!p.temBase && <span className="block text-[11px] text-zinc-400">pouca base</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          O horário da resposta pública não entra: o portal guarda só o dia. O primeiro contato em quanto tempo entra quando houver registro suficiente — hoje são poucas reclamações com o contato registrado.
        </p>
      </SurfaceCard>
    );
  }

  /* ---------------- Modelos ---------------- */
  if (aba === "modelos") {
    const melhores = melhoresRespostas(dados.respostas, categoria || undefined, 10);
    const nao = respostasQueNaoFuncionaram(dados.respostas, categoria || undefined).slice(0, 15);
    return (
      <div className="space-y-5">
        <SurfaceCard title="As que funcionaram" description="Resolvidas com nota 8 ou mais, a maior nota primeiro. Viram resposta pronta sem o nome do cliente — e aparecem como sugestão na ficha de reclamações do mesmo tipo.">
          <div className="mb-3 flex justify-end">{seletorDeCategoria}</div>
          {melhores.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma resposta resolvida com nota 8 ou mais neste recorte.</p>
          ) : (
            <ul className="space-y-3">
              {melhores.map((r) => (
                <li key={r.id} className="rounded-xl ring-1 ring-inset ring-zinc-100">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
                    <span className="text-xs text-zinc-500">
                      <Sparkles size={12} className="mr-1 inline text-emerald-600" />
                      nota {r.nota}
                      {r.voltaria ? " · voltaria" : ""} · {r.categoria} ·{" "}
                      <Link href={`/reclame-aqui/${r.id}`} className="hover:text-violet-700">
                        {r.protocolo}
                      </Link>
                    </span>
                    <button
                      type="button"
                      onClick={() => virarModelo(r)}
                      disabled={gravando === r.id || viraram.has(r.id)}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {gravando === r.id && <Loader2 size={12} className="animate-spin" />}
                      {viraram.has(r.id) ? "Já é resposta pronta" : "Virar resposta pronta"}
                    </button>
                  </div>
                  <p className="max-h-40 overflow-y-auto whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed text-zinc-700">{anonimizar(r.texto, r.cliente)}</p>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard title="As que não funcionaram" description="Não resolvidas ou com nota 4 ou menos — com os traços que tinham, para comparar com as de cima.">
          {nao.length === 0 ? (
            <p className="text-sm text-emerald-700">Nenhuma neste recorte.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {nao.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
                  <TrendingDown size={13} className="text-rose-600" />
                  <Link href={`/reclame-aqui/${r.id}`} className="font-medium text-zinc-800 hover:text-violet-700">
                    {r.protocolo}
                  </Link>
                  <span className="text-zinc-500">
                    {r.resolvida ? "resolvida" : "não resolvida"}, nota {r.nota ?? "—"} · {r.categoria}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {tracosVisiveis(r.tracos).map((t) => (
                      <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                        {t}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    );
  }

  /* ---------------- WhatsApp ---------------- */
  const padroes = padroesNoWhatsapp(dados.vezes);
  const pioraram = dados.vezes.filter((v) => v.mudou === "piorou");
  return (
    <div className="space-y-5">
      <SurfaceCard
        title="No WhatsApp, o que veio depois"
        description={`Cada vez que falamos, nas ${dados.vezes.length} vezes das conversas guardadas pela extensão: o cliente respondeu? em quanto tempo? o humor dele melhorou ou piorou?`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                <th className="py-2 pr-3 font-medium">Traço</th>
                <th className="px-3 py-2 font-medium">Grupos — respondeu · em quanto tempo (mediana) · humor piorou · (vezes)</th>
              </tr>
            </thead>
            <tbody>
              {padroes.map((p) => (
                <tr key={p.chave} className="border-b border-zinc-50 align-top last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-zinc-900">{p.rotulo}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-zinc-700">
                      {p.grupos.map((g) => (
                        <span key={g.rotulo}>
                          <span className="text-zinc-500">{g.rotulo}:</span>{" "}
                          {g.retorno.vezes === 0 ? (
                            <span className="text-zinc-400">ainda sem dado</span>
                          ) : (
                            <>
                              <b className="font-semibold text-zinc-900">{pct(g.retorno.respondeuPct)}</b> · {g.retorno.medianaMin === null ? "—" : espera(g.retorno.medianaMin)} · {pct(g.retorno.pioraPct)}{" "}
                              <span className="text-xs text-zinc-400">({g.retorno.vezes})</span>
                            </>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Áudio conta a partir dos áudios transcritos ao guardar a conversa. O humor é o tom das duas mensagens do cliente antes e das duas depois.</p>
      </SurfaceCard>

      <SurfaceCard title="Depois destas, o humor piorou" description="Ficam marcadas para rever: o que dissemos antes de o cliente ficar pior.">
        {pioraram.length === 0 ? (
          <p className="text-sm text-emerald-700">Nenhuma vez, nas conversas guardadas.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {pioraram.slice(0, 20).map((v) => (
              <li key={`${v.conversaId}:${v.em}`} className="py-2">
                <p className="text-xs text-zinc-500">
                  <TrendingDown size={12} className="mr-1 inline text-rose-600" />
                  {v.contato} · {dataCurta(v.em)}
                  {v.respondeuEmMin !== null && ` · respondeu em ${espera(v.respondeuEmMin)}`}
                  {v.audio && " · áudio"}
                </p>
                <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[13px] text-zinc-700">{v.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
}
