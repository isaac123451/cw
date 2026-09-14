"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { ArrowUpRight, BadgeCheck, CircleAlert, Download, FileCheck2, Loader2, Save, ShieldAlert, Sparkles } from "lucide-react";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TextoEditavel from "@/components/shared/TextoEditavel";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { exportarRelatorio, lerRelatorio, salvarRelatorio, type RelatorioLido } from "@/lib/actions/relatorio";
import { useToast } from "@/lib/context/ToastContext";
import { formatElapsed, ptBR, RA1000_MINIMO_DE_AVALIACOES, RA1000_TARGETS } from "@/lib/services/reputation.service";
import { descreverRegistro } from "@/lib/services/horasUteis";
import type { AbaDoRelatorio } from "@/lib/services/relatorio.service";

/** "01/09/25" — com o ano: a aba de 12 meses atravessa a virada. */
const br = (d: string) => { const [a, m, dd] = d.split("-"); return `${dd}/${m}/${a.slice(2)}`; };

/** O que falta para o selo numa aba — a mesma frase do texto do relatório. */
function falta(aba: AbaDoRelatorio) {
  if (aba.selo) return null;
  const passos = [
    aba.faltamRespostas ? `responder ${aba.faltamRespostas}` : null,
    aba.avaliacoesParaOSelo.alcancavel && aba.avaliacoesParaOSelo.necessarias
      ? `${aba.avaliacoesParaOSelo.necessarias} avaliação(ões) nota 10 resolvidas`
      : !aba.avaliacoesParaOSelo.alcancavel
        ? aba.avaliacoesParaOSelo.motivo
        : null,
    aba.faltamParaOMinimo ? `mais ${aba.faltamParaOMinimo} avaliação(ões) (mínimo de ${RA1000_MINIMO_DE_AVALIACOES})` : null,
  ].filter(Boolean);
  return passos.join(" · ");
}

/**
 * O Relatório de Reputação do ciclo, na tela.
 *
 * O documento: "ao final de cada ciclo, o agente envia à gestão o
 * Relatório de Reputação destacando os pontos de atenção da área e as
 * metas do período". A tela monta tudo com os números da base; a pessoa
 * escreve (ou pede à IA) a análise, ajusta o texto, copia para o Slack e
 * salva — o que foi enviado fica guardado, com os números daquele dia.
 */
export default function RelatorioDoCiclo() {

  const { notify } = useToast();

  const [cicloId, setCicloId] = useState<string | null>(null);
  const [lido, setLido] = useState<RelatorioLido | null>(null);
  const [lidoPara, setLidoPara] = useState<string | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  const [analise, setAnalise] = useState<{ texto: string; origem: "ia" | "regras"; aviso?: string } | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [editado, setEditado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  /* "Carregando" é derivado: o ciclo pedido ainda não é o carregado. */
  const carregando = lidoPara !== cicloId;

  useEffect(() => {
    let ativo = true;
    lerRelatorio(cicloId ?? undefined)
      .then((r) => {
        if (!ativo) return;
        if (r.ok) {
          setLido(r);
          setErro(null);
        } else {
          setErro(r.erro);
        }
        setLidoPara(cicloId);
      })
      .catch(() => {
        if (ativo) {
          setErro("Não deu para falar com o servidor.");
          setLidoPara(cicloId);
        }
      });
    return () => {
      ativo = false;
    };
  }, [cicloId]);

  function trocarCiclo(id: string | null) {
    setCicloId(id);
    setAnalise(null);
    setEditado(null);
  }

  if (!lido) {
    return (
      <div className="space-y-6">
        <PageHeading eyebrow="Inteligência" title="Relatório de Reputação" description="O relatório do ciclo para a gestão, montado com os números da base." />
        <p className="flex items-center gap-2 py-10 text-sm text-zinc-500">
          {erro ? <CircleAlert size={15} className="text-rose-600" /> : <Loader2 size={15} className="animate-spin" />}
          {erro ?? "Montando o relatório…"}
        </p>
      </div>
    );
  }

  const d = lido.dados;
  const [seis, proxima, doze] = d.ra.abas;
  const base = lido.salvo?.texto ?? lido.textoGerado;
  const gerado = analise ? `${lido.textoGerado}\n\n*Análise:*\n${analise.texto}` : base;
  const texto = editado ?? gerado;

  async function pedirAnalise() {
    setPedindo(true);
    try {
      const r = await fetch("/api/assistente/relatorio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: lido!.textoGerado, pontos: d.pontos.map((p) => p.texto) }),
      });
      const j = await r.json();
      if (!r.ok || j.erro) {
        notify({ tone: "error", title: "Não deu para escrever a análise.", detail: j.erro });
        return;
      }
      setAnalise({ texto: j.analise, origem: j.origem, aviso: j.aviso });
      setEditado(null);
    } catch {
      notify({ tone: "error", title: "Não deu para falar com o servidor." });
    } finally {
      setPedindo(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await salvarRelatorio({ ciclo: d.ciclo.id, texto });
      if (!r.ok) {
        notify({ tone: "error", title: "O relatório não foi salvo.", detail: r.erro });
        return;
      }
      const novo = await lerRelatorio(d.ciclo.id);
      if (novo.ok) {
        setLido(novo);
        setEditado(null);
        setAnalise(null);
      }
      notify({ tone: "success", title: `Relatório do ciclo ${d.ciclo.rotulo} salvo.`, detail: "O texto e os números de hoje ficam guardados para reler depois." });
    } catch {
      notify({ tone: "error", title: "Não deu para falar com o servidor." });
    } finally {
      setSalvando(false);
    }
  }

  async function baixar() {
    setBaixando(true);
    try {
      const r = await exportarRelatorio(d.ciclo.id);
      if (!r.ok) {
        notify({ tone: "error", title: "Não deu para gerar a planilha.", detail: r.erro });
        return;
      }
      const bytes = Uint8Array.from(atob(r.arquivo), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = r.nome;
      link.click();
      URL.revokeObjectURL(url);
      notify({ tone: "success", title: "Planilha do relatório gerada.", detail: r.nome });
    } catch {
      notify({ tone: "error", title: "Não deu para falar com o servidor." });
    } finally {
      setBaixando(false);
    }
  }

  const abaisTabela: { aba: AbaDoRelatorio; nome: string }[] = [
    { aba: seis, nome: "6 meses · vigente" },
    { aba: proxima, nome: "6 meses · próxima" },
    { aba: doze, nome: "12 meses · vigente" },
  ];

  const abaixo = (valor: number, meta: number) => (valor < meta ? "text-rose-700 font-semibold" : "text-zinc-800");

  return (
    <div className="space-y-6">

      <PageHeading
        eyebrow="Inteligência"
        title="Relatório de Reputação"
        description={`Ciclo ${d.ciclo.rotulo}${d.corrente ? " — parcial, até hoje" : ""}. Os indicadores, o selo RA1000 nas abas do portal, o ciclo nas quatro frentes e os pontos de atenção, para enviar à gestão.`}
      />

      {/* Os ciclos: o atual e os anteriores, com o que já foi salvo. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {lido.ciclos.map((c) => {
          const ativo = c.id === d.ciclo.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => trocarCiclo(c.corrente ? null : c.id)}
              aria-pressed={ativo}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                ativo ? "bg-violet-700 text-white ring-violet-700" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {c.salvo && <FileCheck2 size={12} className={ativo ? "text-white" : "text-emerald-600"} />}
              {c.rotulo}
              {c.corrente && <span className={ativo ? "text-violet-200" : "text-zinc-400"}>· atual</span>}
            </button>
          );
        })}
        {carregando && <Loader2 size={14} className="ml-1 animate-spin text-zinc-400" />}
      </div>

      {/* O selo, primeiro: é a meta do período. */}
      <div className="grid gap-4 md:grid-cols-3">
        {abaisTabela.map(({ aba, nome }) => (
          <div
            key={nome}
            className={`rounded-2xl border p-4 ${aba.selo ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}
          >
            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {nome}
              <span className="font-normal normal-case tracking-normal">
                {br(aba.janela.inicio)} a {br(aba.janela.fim)}
              </span>
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums text-zinc-900">{ptBR(aba.resumo.raScore)}</span>
              <span className={`flex items-center gap-1 text-sm font-semibold ${aba.selo ? "text-emerald-700" : "text-amber-800"}`}>
                {aba.selo ? <BadgeCheck size={15} /> : <ShieldAlert size={15} />}
                {aba.selo ? "RA1000" : "sem o selo"}
              </span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              {aba.selo
                ? aba.modo === "vigente" && aba.meses === 6
                  ? `${d.ra.ciclosComSelo} ciclo(s) seguido(s) com o selo.`
                  : "As cinco metas fechadas."
                : `Para o selo: ${falta(aba)}.`}
            </p>
          </div>
        ))}
      </div>

      <SurfaceCard title="Indicadores do Reclame Aqui" description={`Cada aba como o portal apura — meses fechados. Em vermelho, o que está abaixo da meta do RA1000. A próxima aba é a que vira vigente no dia 1º — é nela que o trabalho de hoje conta.`}>
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3 font-semibold">Indicador</th>
                {abaisTabela.map(({ nome }) => (
                  <th key={nome} className="py-2 pr-3 font-semibold">
                    {nome}
                  </th>
                ))}
                <th className="py-2 font-semibold">Meta RA1000</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <tr>
                <td className="py-2 pr-3 text-zinc-600">Nota de reputação</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className={`py-2 pr-3 ${abaixo(aba.resumo.raScore, 8)}`}>{ptBR(aba.resumo.raScore)}</td>
                ))}
                <td className="py-2 text-zinc-500">8</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-zinc-600">Índice de resposta</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className={`py-2 pr-3 ${abaixo(aba.resumo.responseIndex, RA1000_TARGETS.resposta)}`}>
                    {ptBR(aba.resumo.responseIndex)}%{aba.faltamRespostas ? <span className="ml-1 text-[11px] font-normal text-zinc-500">faltam {aba.faltamRespostas}</span> : null}
                  </td>
                ))}
                <td className="py-2 text-zinc-500">{RA1000_TARGETS.resposta}%</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-zinc-600">Índice de solução</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className={`py-2 pr-3 ${abaixo(aba.resumo.solutionIndex, RA1000_TARGETS.solucao)}`}>{ptBR(aba.resumo.solutionIndex)}%</td>
                ))}
                <td className="py-2 text-zinc-500">{RA1000_TARGETS.solucao}%</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-zinc-600">Nota dos consumidores</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className={`py-2 pr-3 ${abaixo(aba.resumo.consumerScore, RA1000_TARGETS.consumidor)}`}>{ptBR(aba.resumo.consumerScore, 2)}</td>
                ))}
                <td className="py-2 text-zinc-500">{RA1000_TARGETS.consumidor}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-zinc-600">Voltariam a fazer negócio</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className={`py-2 pr-3 ${abaixo(aba.resumo.wouldReturnIndex, RA1000_TARGETS["novos-negocios"])}`}>{ptBR(aba.resumo.wouldReturnIndex)}%</td>
                ))}
                <td className="py-2 text-zinc-500">{RA1000_TARGETS["novos-negocios"]}%</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-zinc-600">Avaliações</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className={`py-2 pr-3 ${abaixo(aba.resumo.evaluated, RA1000_MINIMO_DE_AVALIACOES)}`}>{aba.resumo.evaluated}</td>
                ))}
                <td className="py-2 text-zinc-500">{RA1000_MINIMO_DE_AVALIACOES}</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 text-zinc-600">1ª resposta pública</td>
                {abaisTabela.map(({ aba, nome }) => (
                  <td key={nome} className="py-2 pr-3 text-zinc-800">
                    {formatElapsed(aba.resumo.responseMinutes)}
                    {aba.tempoMedianoMin !== null && <span className="block text-[11px] text-zinc-500">mediana {formatElapsed(aba.tempoMedianoMin)}</span>}
                  </td>
                ))}
                <td className="py-2 text-zinc-500">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            frente: "reclame-aqui" as const,
            titulo: "Reclame Aqui",
            linhas: [
              `${d.ra.noCiclo.entrantes} nova(s) no ciclo`,
              `${d.ra.noCiclo.respondidas} respondida(s) · ${d.ra.noCiclo.avaliadas} avaliada(s)`,
              `${d.ra.noCiclo.resolvidas} resolvida(s) no ciclo`,
              `${d.ra.abertas.semResposta} sem resposta agora`,
            ],
            href: "/reclame-aqui",
          },
          {
            frente: "redes" as const,
            titulo: "Redes Sociais",
            linhas: [`${d.redes.entrantes} atendimento(s)`, `${d.redes.resolvidos} resolvido(s)`, `${d.redes.abertos} em aberto`],
            href: "/redes-sociais",
          },
          {
            frente: "nps" as const,
            titulo: "NPS",
            linhas: [
              `${d.nps.respostas} resposta(s)${d.nps.nps !== null ? ` · NPS ${d.nps.nps}` : ""}`,
              `${d.nps.detratores} detrator(es)${d.nps.percentualContatados !== null ? ` · ${d.nps.percentualContatados}% contatados` : ""}`,
              `${d.nps.fechadosNoCiclo} ciclo(s) fechado(s)`,
              d.nps.humorMedioDoDetrator !== null ? `humor depois do contato ${ptBR(d.nps.humorMedioDoDetrator)}/5` : null,
            ],
            href: "/nps",
          },
          {
            frente: "google" as const,
            titulo: "Google",
            linhas: [
              `${d.google.total} avaliação(ões)${d.google.notaMedia !== null ? ` · nota ${ptBR(d.google.notaMedia)}` : ""}`,
              d.google.percentualRespondidas !== null ? `${d.google.percentualRespondidas}% respondidas` : null,
              `${d.google.negativasSemResposta} negativa(s) sem resposta`,
            ],
            href: "/google",
          },
        ].map((f) => (
          <Link key={f.titulo} href={f.href} className="group rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-violet-200">
            <p className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span className="flex items-center gap-1.5">
                <IconeDaFrente frente={f.frente} size={13} /> {f.titulo}
              </span>
              <ArrowUpRight size={13} className="text-zinc-300 group-hover:text-violet-600" />
            </p>
            <ul className="mt-2 space-y-0.5 text-sm text-zinc-700">
              {f.linhas.filter(Boolean).map((l) => (
                <li key={l as string}>{l}</li>
              ))}
            </ul>
          </Link>
        ))}
      </div>

      <SurfaceCard title="Pontos de atenção" description="O que a gestão precisa saber, cada um com o lugar em que se resolve.">
        {d.pontos.length === 0 ? (
          <p className="text-sm text-emerald-700">Nenhum ponto de atenção neste ciclo.</p>
        ) : (
          <ul className="space-y-1.5">
            {d.pontos.map((p) => (
              <li key={p.texto} className="flex items-start gap-2 text-sm">
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" />
                {p.href ? (
                  <Link href={p.href} className="text-zinc-800 hover:text-violet-700 hover:underline">
                    {p.texto}
                  </Link>
                ) : (
                  <span className="text-zinc-800">{p.texto}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Para a gestão"
        description="O relatório em texto, pronto para o Slack. Peça a análise à IA (ou escreva a sua), ajuste, copie e salve — o que foi enviado fica guardado com os números de hoje."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={pedirAnalise}
              disabled={pedindo}
              className="flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
            >
              {pedindo ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {pedindo ? "Escrevendo…" : analise ? "Escrever de novo" : "Escrever a análise com a IA"}
            </button>
            <button
              type="button"
              onClick={baixar}
              disabled={baixando}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
            >
              {baixando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              .xlsx
            </button>
          </div>
        }
      >
        {analise?.origem === "regras" && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <CircleAlert size={12} /> Análise pelas regras, sem a IA{analise.aviso ? ` — ${analise.aviso}` : ""}.
          </p>
        )}

        <TextoEditavel gerado={gerado} editado={editado} onEditado={setEditado} rotulo="Copiar para o Slack" linhasMinimas={14} />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <p className="text-xs text-zinc-500">
            {lido.salvo
              ? `Salvo${lido.salvo.salvoPor ? ` por ${lido.salvo.salvoPor}` : ""} em ${descreverRegistro(lido.salvo.atualizadoEm)}. Salvar de novo atualiza.`
              : "Ainda não salvo neste ciclo."}
          </p>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !texto.trim()}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {lido.salvo ? "Salvar de novo" : "Salvar relatório"}
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}
