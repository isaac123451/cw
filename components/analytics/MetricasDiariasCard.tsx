"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import { Loader2, Save, TableProperties } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useToast } from "@/lib/context/ToastContext";

import {
  lerMetricas,
  salvarMetricaManual,
  type LinhaDeMetrica,
} from "@/lib/actions/metricas";

/**
 * O histórico diário da reputação — a planilha, dentro do sistema.
 *
 * **Por que uma tabela por dia e não um gráfico.** A nota do Reclame
 * Aqui é sempre calculada sobre a janela vigente de seis meses: ela
 * responde "como estamos agora", não "como estávamos em 12 de agosto".
 * Perguntar hoje qual era a nota naquele dia dá a resposta errada,
 * porque a janela andou. Só serve o número anotado no dia — e é isso
 * que a rotina agendada grava.
 *
 * **As colunas cinzas são do portal.** Visualizações, selo, desativadas
 * e resolvidas por ciclo não existem na base: só o Reclame Aqui sabe.
 * Ficam editáveis e começam vazias, porque **vazio quer dizer "ninguém
 * preencheu"** — e um zero inventado no histórico vira gráfico com um
 * buraco que parece queda.
 */

/** Campo numérico editável, que aceita ficar vazio. */
function CampoManual({
  valor,
  onChange,
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={valor ?? ""}
      onChange={(e) =>
        onChange(
          e.target.value === ""
            ? null
            : Number(e.target.value)
        )
      }
      placeholder="—"
      className="h-7 w-16 rounded-lg border border-zinc-200 bg-white px-1.5 text-center text-xs tabular-nums outline-none transition-colors focus:border-violet-400"
    />
  );
}

const mesAtual = () =>
  new Date().toISOString().slice(0, 7);

export default function MetricasDiariasCard() {

  const { notify } = useToast();

  const [mes, setMes] = useState(mesAtual);
  const [linhas, setLinhas] = useState<LinhaDeMetrica[]>(
    []
  );
  const [salvando, startSalvar] = useTransition();

  /**
   * "Carregando" e´ derivado, nao um estado a mais.
   *
   * Chamar `setCarregando(true)` no corpo do efeito dispara uma
   * renderizacao em cascata — o compilador do React reprova, e com
   * razao. Guardar **qual mes ja carregou** responde a mesma pergunta
   * sem estado extra: se o mes pedido nao e´ o carregado, esta
   * carregando.
   */
  const [mesCarregado, setMesCarregado] = useState<
    string | null
  >(null);

  const carregando = mesCarregado !== mes;

  /** As edições ainda não salvas, por dia. */
  const [edicoes, setEdicoes] = useState<
    Record<string, Partial<LinhaDeMetrica>>
  >({});

  useEffect(() => {

    let ativo = true;

    const ultimoDia = new Date(
      Number(mes.slice(0, 4)),
      Number(mes.slice(5, 7)),
      0
    ).getDate();

    lerMetricas(
      `${mes}-01`,
      `${mes}-${String(ultimoDia).padStart(2, "0")}`
    )
      .then((r) => {
        if (!ativo) return;
        setLinhas(r);
        setEdicoes({});
        setMesCarregado(mes);
      })
      .catch(() => {
        /* Falha nao pode travar em "carregando" para sempre. */
        if (ativo) setMesCarregado(mes);
      });

    return () => {
      ativo = false;
    };
  }, [mes]);

  const sujo = Object.keys(edicoes).length > 0;

  function editar(
    dia: string,
    campo: keyof LinhaDeMetrica,
    valor: number | null
  ) {
    setEdicoes((atual) => ({
      ...atual,
      [dia]: { ...atual[dia], [campo]: valor },
    }));
  }

  function valorDe(
    linha: LinhaDeMetrica,
    campo:
      | "visualizacoes"
      | "ciclosComSelo"
      | "desativadas"
      | "resolvidasCiclo"
  ) {
    const edicao = edicoes[linha.dia];

    return edicao && campo in edicao
      ? ((edicao[campo] ?? null) as number | null)
      : linha[campo];
  }

  function salvar() {

    startSalvar(async () => {

      const dias = Object.keys(edicoes);

      for (const dia of dias) {

        const base = linhas.find((l) => l.dia === dia);

        if (!base) continue;

        const r = await salvarMetricaManual({
          dia,
          visualizacoes: valorDe(base, "visualizacoes"),
          ciclosComSelo: valorDe(base, "ciclosComSelo"),
          desativadas: valorDe(base, "desativadas"),
          resolvidasCiclo: valorDe(
            base,
            "resolvidasCiclo"
          ),
        });

        if (r.erro) {
          notify({
            tone: "error",
            title: `Não salvei o dia ${dia}.`,
            detail: r.erro,
          });
          return;
        }
      }

      const ultimoDia = new Date(
        Number(mes.slice(0, 4)),
        Number(mes.slice(5, 7)),
        0
      ).getDate();

      setLinhas(
        await lerMetricas(
          `${mes}-01`,
          `${mes}-${String(ultimoDia).padStart(2, "0")}`
        )
      );

      setEdicoes({});

      notify({
        tone: "success",
        title: `${dias.length} dia(s) salvos.`,
        detail:
          "Os números do portal ficam gravados; os da base continuam sendo recalculados pela rotina.",
      });
    });
  }

  const cabecalho = [
    "Dia",
    "Entrantes",
    "Nota",
    "Respondidas",
    "Não resp.",
    "Consumidor",
    "Voltariam",
    "Resolvidas",
    "Tempo (h)",
    "Churn",
    "Retidos",
    "Visualizações",
    "Selo",
    "Desativadas",
    "Resolv./ciclo",
  ];

  return (
    <SurfaceCard
      title="Métricas diárias"
      description="Um retrato por dia, gravado no dia. A nota do Reclame Aqui muda de significado com o tempo: só o número anotado naquele dia responde como estávamos naquele dia."
      action={
        <div className="flex shrink-0 items-center gap-2">

          <input
            type="month"
            value={mes}
            onChange={(e) =>
              setMes(e.target.value || mesAtual())
            }
            className="h-9 rounded-xl border border-zinc-200 px-2.5 text-sm outline-none transition-colors focus:border-violet-400"
          />

          {sujo && (
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-800 px-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:opacity-70"
            >
              {salvando ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Save size={14} />
              )}
              Salvar
            </button>
          )}
        </div>
      }
    >

      {carregando ? (
        <p className="flex items-center gap-2 py-8 text-sm text-zinc-400">
          <Loader2 size={15} className="animate-spin" />
          Carregando…
        </p>
      ) : linhas.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-100">
          <TableProperties
            size={16}
            className="mt-0.5 shrink-0 text-zinc-400"
          />
          <span>
            Nenhum dia medido neste mês. A rotina agendada grava o dia
            corrente; para preencher o passado, rode{" "}
            <code className="rounded bg-zinc-100 px-1">
              npm run metricas:preencher
            </code>
            .
          </span>
        </div>
      ) : (
        <>
          {/*
            A tabela rola sozinha, e o cabeçalho fica.

            São quinze colunas por até trinta e um dias; sem o rolo
            próprio, a página inteira ganharia barra horizontal e o
            menu sairia da tela em qualquer monitor menor.
          */}
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-xs tabular-nums">

              <thead>
                <tr>
                  {cabecalho.map((c, i) => (
                    <th
                      key={c}
                      className={`sticky top-0 whitespace-nowrap border-b border-zinc-200 bg-white px-2 py-2 text-left font-semibold ${
                        i >= 11
                          ? "text-zinc-400"
                          : "text-zinc-600"
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.dia}
                    className="hover:bg-zinc-50/60"
                  >
                    <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1.5 font-medium text-zinc-700">
                      {l.dia.slice(8)}/{l.dia.slice(5, 7)}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.entrantes}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5 font-semibold text-violet-700">
                      {l.notaReputacao.toFixed(1)}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.respondidas}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.naoRespondidas}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.notaConsumidor.toFixed(2)}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.voltariam.toFixed(1)}%
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.resolvidasPct.toFixed(1)}%
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.tempoMedioHoras.toFixed(1)}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.churn}
                    </td>
                    <td className="border-b border-zinc-100 px-2 py-1.5">
                      {l.retidos}
                    </td>

                    {(
                      [
                        "visualizacoes",
                        "ciclosComSelo",
                        "desativadas",
                        "resolvidasCiclo",
                      ] as const
                    ).map((campo) => (
                      <td
                        key={campo}
                        className="border-b border-zinc-100 bg-zinc-50/50 px-2 py-1"
                      >
                        <CampoManual
                          valor={valorDe(l, campo)}
                          onChange={(v) =>
                            editar(l.dia, campo, v)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            As quatro últimas colunas só o Reclame Aqui sabe — o sistema
            não tem como calculá-las. Em branco significa{" "}
            <strong className="font-semibold">
              ninguém preencheu
            </strong>
            , e não zero: um zero inventado no histórico vira um gráfico
            com um buraco que parece queda.
          </p>
        </>
      )}
    </SurfaceCard>
  );
}
