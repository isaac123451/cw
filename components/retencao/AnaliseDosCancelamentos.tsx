"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";

import type { ClienteEmCancelamento, ResumoDeRetencao } from "@/lib/models/cancelamento";
import { MOTIVOS_DE_CANCELAMENTO } from "@/lib/models/motivoDoCancelamento";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]}/${aaaamm.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const FRENTE: Record<string, string> = { "reclame-aqui": "Reclame Aqui", redes: "Redes", nps: "NPS", conversa: "WhatsApp" };

/* As três séries da tela inteira: quem ficou, quem saiu e quem ainda não teve desfecho. Texto nunca na cor da série. */
const COR_RETIDO = "bg-emerald-500";
const COR_CANCELADO = "bg-rose-500";
const COR_ABERTO = "bg-zinc-300";

type Fatia = "retidos" | "cancelados" | "abertos";
const DA_FATIA: Record<Fatia, (c: ClienteEmCancelamento) => boolean> = {
  retidos: (c) => c.desfecho === "retido",
  cancelados: (c) => c.desfecho === "cancelado",
  abertos: (c) => c.desfecho !== "retido" && c.desfecho !== "cancelado",
};
const NOME_DA_FATIA: Record<Fatia, string> = { retidos: "ficaram", cancelados: "cancelaram", abertos: "em aberto" };

/** O que foi clicado no gráfico: o título e quem está nele. */
interface Recorte {
  titulo: string;
  lista: ClienteEmCancelamento[];
}

interface Contagem {
  retidos: number;
  cancelados: number;
  abertos: number;
}

function contar(lista: ClienteEmCancelamento[]): Contagem & { total: number } {
  const retidos = lista.filter((c) => c.desfecho === "retido").length;
  const cancelados = lista.filter((c) => c.desfecho === "cancelado").length;
  return { total: lista.length, retidos, cancelados, abertos: lista.length - retidos - cancelados };
}

function Legenda() {
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
      {(
        [
          [COR_RETIDO, "Ficaram"],
          [COR_CANCELADO, "Cancelaram"],
          [COR_ABERTO, "Em aberto"],
        ] as const
      ).map(([cor, nome]) => (
        <span key={nome} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${cor}`} /> {nome}
        </span>
      ))}
    </span>
  );
}

/**
 * Uma barra horizontal dividida entre quem ficou, quem saiu e quem está em
 * aberto: o comprimento é o total (proporcional ao maior da lista), os
 * pedaços têm 2 px de folga entre si e só as pontas são arredondadas.
 */
function BarraDividida({ c, total, maior, nome, onFatia }: { c: Contagem; total: number; maior: number; nome: string; onFatia: (f: Fatia) => void }) {
  const pedacos = (
    [
      [c.retidos, COR_RETIDO, "retidos"],
      [c.cancelados, COR_CANCELADO, "cancelados"],
      [c.abertos, COR_ABERTO, "abertos"],
    ] as const
  ).filter(([n]) => n > 0);
  return (
    <span className="flex h-3 gap-0.5" style={{ width: `${Math.max(4, (total / maior) * 100)}%` }}>
      {pedacos.map(([n, cor, fatia], i) => (
        <button
          type="button"
          key={fatia}
          onClick={() => onFatia(fatia)}
          className={`h-full min-w-[4px] cursor-pointer transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500 ${i === 0 ? "rounded-l" : ""} ${i === pedacos.length - 1 ? "rounded-r" : ""} ${cor}`}
          style={{ flex: n }}
          title={`${nome}: ${n} ${NOME_DA_FATIA[fatia]} — clique para ver os casos`}
          aria-label={`${nome}: ver ${VER_FATIA[fatia]} (${n})`}
        />
      ))}
    </span>
  );
}

const linkDoCaso = (protocolo: string) => `/reclame-aqui/${encodeURIComponent(protocolo)}`;
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/* Aspas só no que o cliente disse; a nota nossa ("reclamação adicionada à mão…") vai sem — a mesma regra da lista da página. */
const fala = (t: string) => (/^(categoria|causa raiz|reclamação adicionada|chegou cancelado|avaliou|solução|a nossa resposta|nossa resposta|comentário do caso)/.test(t) ? t : `“${t.replace(/^…|…$/g, "")}”`);
const VER_FATIA: Record<Fatia, string> = { retidos: "quem ficou", cancelados: "quem cancelou", abertos: "quem está em aberto" };
const DESFECHO: Record<string, [string, string]> = {
  retido: ["Ficou", "bg-emerald-50 text-emerald-800"],
  cancelado: ["Cancelou", "bg-rose-50 text-rose-800"],
};

/** Os casos do pedaço clicado: quem, o desfecho, o que disse e as reclamações. */
function CasosDoRecorte({ recorte, onFechar }: { recorte: Recorte; onFechar: () => void }) {
  return (
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-900">
          {recorte.titulo}{" "}
          <span className="font-normal text-zinc-500">
            · {recorte.lista.length} {recorte.lista.length === 1 ? "cliente" : "clientes"}
          </span>
        </h3>
        <button type="button" onClick={onFechar} className="rounded p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700" aria-label="Fechar a lista">
          <X size={15} />
        </button>
      </div>
      {recorte.lista.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Ninguém neste pedaço.</p>
      ) : (
        <ul className="mt-2 max-h-80 divide-y divide-zinc-200/70 overflow-y-auto rounded-lg border border-zinc-200/80 bg-white">
          {recorte.lista.map((c) => {
            const [rotulo, cor] = DESFECHO[c.desfecho] ?? ["Em aberto", "bg-zinc-100 text-zinc-700"];
            return (
              <li key={c.chave} className="px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-zinc-900">{c.nome}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cor}`}>
                    {rotulo}
                    {c.canceladoPor === "outro-setor" ? ` · ${c.setor ?? "outro setor"}` : ""}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {c.pedido ? `pediu em ${diaCurto(c.pedido.quando)} · ${FRENTE[c.pedido.frente] ?? c.pedido.frente}` : `chegou cancelado · ${diaCurto(c.desde)}`}
                  </span>
                </p>
                {c.pedido && (
                  <p className="mt-0.5 truncate text-xs text-zinc-600" title={c.pedido.trecho}>
                    {fala(c.pedido.trecho)}
                  </p>
                )}
                {c.protocolos.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {c.protocolos.map((p) => (
                      <Link key={p} href={linkDoCaso(p)} className="font-mono text-violet-700 hover:underline">
                        {p}
                      </Link>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function mediana(v: number[]) {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/**
 * A análise dos cancelamentos (20/10/2026).
 *
 * Responde, do período escolhido: por que pedem para cancelar e em qual
 * motivo mais se perde; quais assuntos de reclamação mais terminam em
 * cancelamento ("preciso ver quais foram os casos que mais cancelaram");
 * como a retenção anda mês a mês; por onde pedem; quem cancelou; e quanto
 * tempo leva do pedido ao cancelamento.
 *
 * O mês a mês desenhava colunas de altura zero: a altura em % era medida
 * contra uma caixa sem altura. Agora cada coluna ocupa a altura toda e a
 * barra cresce de baixo.
 */
export default function AnaliseDosCancelamentos({ clientes, resumo }: { clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao }) {
  /*
    Todo gráfico abre os casos (21/10/2026): "tem que ser possível clicar
    nos gráficos na parte de cancelamento para verificar cada caso". O
    pedaço da barra abre só aquele desfecho; o nome, o grupo inteiro.
  */
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const abrir = (titulo: string, lista: ClienteEmCancelamento[], fatia?: Fatia) =>
    setRecorte({ titulo: fatia ? `${titulo} — ${NOME_DA_FATIA[fatia]}` : titulo, lista: fatia ? lista.filter(DA_FATIA[fatia]) : lista });
  const doMotivo = (id: string) => clientes.filter((c) => c.motivos.includes(id));
  const doAssunto = (nome: string) => clientes.filter((c) => c.assuntos.includes(nome));
  const doMes = (aaaamm: string) => clientes.filter((c) => c.desde.startsWith(aaaamm));
  const motivos = useMemo(
    () =>
      MOTIVOS_DE_CANCELAMENTO.map((m) => ({ id: m.id, nome: m.nome, ...contar(clientes.filter((c) => c.motivos.includes(m.id))) }))
        .filter((l) => l.total > 0)
        .sort((a, b) => b.total - a.total),
    [clientes]
  );
  const semMotivo = clientes.filter((c) => !c.motivos.length).length;
  const maiorMotivo = Math.max(1, ...motivos.map((m) => m.total));

  /* Os assuntos do portal que mais terminam em cancelamento — ordenados por quantos saíram. */
  const assuntos = useMemo(() => {
    const nomes = [...new Set(clientes.flatMap((c) => c.assuntos))];
    return nomes
      .map((nome) => ({ nome, ...contar(clientes.filter((c) => c.assuntos.includes(nome))) }))
      .filter((a) => a.cancelados > 0)
      .sort((a, b) => b.cancelados - a.cancelados || b.total - a.total)
      .slice(0, 8);
  }, [clientes]);
  const maiorAssunto = Math.max(1, ...assuntos.map((a) => a.total));

  const canais = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of clientes) if (c.pedido) t[c.pedido.frente] = (t[c.pedido.frente] ?? 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  const setores = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of clientes) if (c.canceladoPor === "outro-setor") t[c.setor ?? "Chegou cancelado"] = (t[c.setor ?? "Chegou cancelado"] ?? 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  /* Do pedido ao primeiro sinal de cancelamento, em dias corridos. */
  const diasAteCancelar = useMemo(
    () =>
      mediana(
        clientes
          .filter((c) => c.desfecho === "cancelado" && c.pedido)
          .map((c) => {
            const saiu = c.sinais.find((s) => s.tipo === "cancelado" && s.quando >= c.pedido!.quando);
            return saiu ? (Date.parse(saiu.quando) - Date.parse(c.pedido!.quando)) / 86_400_000 : null;
          })
          .filter((d): d is number => d !== null)
      ),
    [clientes]
  );

  const meses = [...resumo.porMes].slice(0, 12).reverse();
  const maiorMes = Math.max(1, ...meses.map((m) => m.clientes));

  if (!clientes.length) return null;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]" aria-label="Análise dos cancelamentos">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Análise dos cancelamentos</h2>
        <Legenda />
      </header>

      <div className="grid gap-x-10 gap-y-8 px-5 py-5 lg:grid-cols-2">
        {/* Por que pedem para cancelar — e em qual motivo mais se perde. */}
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Por que pedem para cancelar</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Lido do que o cliente escreveu; um cliente pode ter mais de um motivo. “Ficaram” conta só quem já teve desfecho.</p>
          <ul className="mt-3 space-y-3">
            {motivos.map((m) => (
              <li key={m.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <button type="button" onClick={() => abrir(m.nome, doMotivo(m.id))} className="truncate text-left text-sm text-zinc-700 hover:text-violet-700 hover:underline" title={`${m.nome} — ver os casos`}>
                    {m.nome}
                  </button>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    <span className="font-medium text-zinc-800">{m.total}</span>
                    {m.retidos + m.cancelados > 0 && ` · ficaram ${Math.round((m.retidos / (m.retidos + m.cancelados)) * 100)}%`}
                  </span>
                </div>
                <div className="mt-1">
                  <BarraDividida c={m} total={m.total} maior={maiorMotivo} nome={m.nome} onFatia={(f) => abrir(m.nome, doMotivo(m.id), f)} />
                </div>
              </li>
            ))}
          </ul>
          {semMotivo > 0 && (
            <button type="button" onClick={() => abrir("Sem motivo dito", clientes.filter((c) => !c.motivos.length))} className="mt-3 text-left text-xs text-zinc-400 hover:text-violet-700 hover:underline">
              {semMotivo} {semMotivo === 1 ? "cliente não disse o motivo" : "clientes não disseram o motivo"}.
            </button>
          )}
        </div>

        {/* Os assuntos de reclamação que mais terminaram em cancelamento. */}
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Reclamações que mais terminaram em cancelamento</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Pelo assunto da reclamação no portal, de quem mais saiu para quem menos.</p>
          {assuntos.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Nenhum cancelamento no período.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {assuntos.map((a) => (
                <li key={a.nome}>
                  <div className="flex items-baseline justify-between gap-3">
                    <button type="button" onClick={() => abrir(a.nome, doAssunto(a.nome))} className="truncate text-left text-sm text-zinc-700 hover:text-violet-700 hover:underline" title={`${a.nome} — ver os casos`}>
                      {a.nome}
                    </button>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      <span className="font-medium text-zinc-800">{a.cancelados}</span> de {a.total} cancelaram
                    </span>
                  </div>
                  <div className="mt-1">
                    <BarraDividida c={a} total={a.total} maior={maiorAssunto} nome={a.nome} onFatia={(f) => abrir(a.nome, doAssunto(a.nome), f)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mês a mês: quantos pediram, divididos entre quem ficou, quem está em aberto e quem saiu, com a taxa embaixo. */}
        {meses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-800">Mês a mês</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Pelo mês do pedido. Embaixo, a taxa de retenção do mês. Clique numa cor ou no mês para ver os casos.</p>
            <div className="mt-3 flex h-36 items-stretch gap-1.5 border-b border-zinc-200" aria-label="Retidos, em aberto e cancelamentos por mês">
              {meses.map((m) => (
                <div
                  key={m.mes}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end"
                  title={`${mes(m.mes)}: ${m.retidos} ficaram, ${m.emAberto} em aberto, ${m.cancelados} cancelaram (${m.canceladosOutroSetor} por outro setor) · retenção ${pct(m.taxaDeRetencao)}`}
                >
                  <span className="mb-0.5 text-[10px] tabular-nums text-zinc-400">{m.clientes}</span>
                  <div className="flex w-full max-w-8 flex-col gap-0.5" style={{ height: `${(m.clientes / maiorMes) * 82}%` }}>
                    {(
                      [
                        [m.cancelados, COR_CANCELADO, "cancelados"],
                        [m.emAberto, COR_ABERTO, "abertos"],
                        [m.retidos, COR_RETIDO, "retidos"],
                      ] as const
                    )
                      .filter(([n]) => n > 0)
                      .map(([n, cor, fatia], i) => (
                        <button
                          type="button"
                          key={cor}
                          onClick={() => abrir(`Pedidos de ${mes(m.mes)}`, doMes(m.mes), fatia)}
                          className={`w-full min-h-[4px] cursor-pointer transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 ${i === 0 ? "rounded-t" : ""} ${cor}`}
                          style={{ flex: n }}
                          aria-label={`${mes(m.mes)}: ver ${VER_FATIA[fatia]} (${n})`}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {meses.map((m) => (
                <div key={m.mes} className="min-w-0 flex-1 text-center">
                  <button type="button" onClick={() => abrir(`Pedidos de ${mes(m.mes)}`, doMes(m.mes))} className="block w-full truncate text-[10px] text-zinc-400 hover:text-violet-700 hover:underline">
                    {mes(m.mes)}
                  </button>
                  <span className="block text-[11px] font-medium tabular-nums text-zinc-700">{pct(m.taxaDeRetencao)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Os fatos do período, em três blocos curtos. */}
        <dl className="grid grid-cols-1 content-start gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">Por onde pediram</dt>
            <dd className="mt-1.5 space-y-1 text-sm text-zinc-800">
              {canais.map(([frente, n]) => (
                <button
                  type="button"
                  key={frente}
                  onClick={() => abrir(`Pediram pelo ${FRENTE[frente] ?? frente}`, clientes.filter((c) => c.pedido?.frente === frente))}
                  className="flex w-full justify-between gap-2 text-left tabular-nums hover:text-violet-700"
                >
                  <span>{FRENTE[frente] ?? frente}</span>
                  <span className="text-zinc-500">{n}</span>
                </button>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Quem cancelou</dt>
            <dd className="mt-1.5 space-y-1 text-sm text-zinc-800">
              <button
                type="button"
                onClick={() => abrir("Cancelaram pelo nosso atendimento", clientes.filter((c) => c.desfecho === "cancelado" && (c.canceladoPor ?? "atendimento") === "atendimento"))}
                className="flex w-full justify-between gap-2 text-left tabular-nums hover:text-violet-700"
              >
                <span>Nosso atendimento</span>
                <span className="text-zinc-500">{resumo.canceladosQueContam}</span>
              </button>
              {setores.map(([setor, n]) => (
                <button
                  type="button"
                  key={setor}
                  onClick={() => abrir(`Cancelados por ${setor}`, clientes.filter((c) => c.canceladoPor === "outro-setor" && (c.setor ?? "Chegou cancelado") === setor))}
                  className="flex w-full justify-between gap-2 text-left tabular-nums hover:text-violet-700"
                >
                  <span className="truncate">{setor}</span>
                  <span className="text-zinc-500">{n}</span>
                </button>
              ))}
              {resumo.canceladosNoPrazo > 0 && (
                <button
                  type="button"
                  onClick={() => abrir("Cancelaram no prazo do contato", clientes.filter((c) => c.desfecho === "cancelado" && c.canceladoPor === "prazo"))}
                  className="flex w-full justify-between gap-2 text-left tabular-nums hover:text-violet-700"
                >
                  <span>No prazo do contato</span>
                  <span className="text-zinc-500">{resumo.canceladosNoPrazo}</span>
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Do pedido ao cancelamento</dt>
            <dd className="mt-1.5 text-sm text-zinc-800">
              {diasAteCancelar === null ? (
                "—"
              ) : (
                <>
                  <span className="text-2xl font-semibold tabular-nums text-zinc-900">{diasAteCancelar < 1 ? "<1" : Math.round(diasAteCancelar)}</span>{" "}
                  <span className="text-zinc-500">{diasAteCancelar < 2 ? "dia" : "dias"}, na mediana</span>
                </>
              )}
            </dd>
          </div>
        </dl>
      </div>
      {recorte && <CasosDoRecorte recorte={recorte} onFechar={() => setRecorte(null)} />}
    </section>
  );
}
