"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import { Check, ChevronLeft, Loader2, TriangleAlert } from "lucide-react";

import Combobox from "@/components/shared/Combobox";
import DonoDaCausa from "@/components/causas/DonoDaCausa";
import CausaSugerida from "@/components/causas/CausaSugerida";

import type { Case } from "@/lib/models/case";
import { AREAS_INTERNAS } from "@/lib/models/mensagens";
import {
  SAIDAS_DA_TRIAGEM,
  SOCIAL_DAS_REDES,
  TENTATIVAS_DAS_REDES,
  faltaNaTriagem,
  gravidadeSugerida,
  sinaisDeCrise,
  type TriagemDasRedes as Triagem,
} from "@/lib/models/redes";
import { prioridadeNormalizada } from "@/lib/models/case";

import { triarAtendimento } from "@/lib/actions/redes";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSettings } from "@/lib/context/SettingsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useRascunhoNaJanela } from "@/lib/context/rascunhosDasJanelas";

import { isSocial } from "@/lib/services/case.service";
import { cn } from "@/lib/utils";

interface Props {
  data: Case;
  /** O relato, que não vem na carga do quadro. */
  relato: string;
  aoSalvar: (patch: Partial<Case>) => void;
  /** Some quando a triagem já existia e a pessoa desistiu de refazer. */
  onCancelar?: () => void;
}

const PERGUNTAS = ["Quem é", "Rede", "O que aconteceu", "Gravidade", "Saída"] as const;

const GRAVIDADES: { id: Triagem["prioridade"]; texto: string }[] = [
  { id: "Urgente", texto: "Órgão do consumidor, ação judicial, imprensa ou falha em massa. Liderança agora; nada público sem alinhar." },
  { id: "Alta", texto: "Perfil de grande alcance ou cliente em risco. 1º contato em até 1 hora." },
  { id: "Normal", texto: "O restante. 1º contato em até 4 horas úteis." },
];

/**
 * A triagem das Redes, uma pergunta por vez.
 *
 * Cinco passos curtos no lugar do formulário de treze campos: quem é, a
 * rede, o que aconteceu, a gravidade (com a sugestão dos dados e o
 * motivo) e a saída. A saída pode fechar o atendimento na hora —
 * resolvido na conversa, sem contato, sem identificação ou encaminhado —
 * pedindo só o que aquele final exige. Grava tudo de uma vez, e só diz
 * "salvo" com a resposta do banco.
 */
export default function TriagemDasRedes({ data, relato, aoSalvar, onCancelar }: Props) {

  const { cases, setCases } = useCases();
  const { categories } = useSettings();
  const { rootCauses } = useNps();
  const { notify } = useToast();

  const sinais = useMemo(() => sinaisDeCrise({ ...data, description: relato || data.description }, cases), [data, relato, cases]);
  const sugestao = gravidadeSugerida(sinais, data.followers);

  const inicial: Triagem = {
    customer: data.customer && !/^n[ãa]o identificad/i.test(data.customer) ? data.customer : "",
    socialHandle: data.socialHandle ?? "",
    followers: data.followers ?? null,
    naoIdentificado: false,
    source: SOCIAL_DAS_REDES.includes(data.source) ? data.source : "Instagram",
    category: data.category && !/^n[ãa]o classificad/i.test(data.category) ? data.category : "",
    relato,
    prioridade: data.triadaEm ? prioridadeNormalizada(data.priority) : sugestao.nivel,
    saida: "segue",
    solucao: "",
    causaRaiz: data.causaRaiz ?? "",
    clienteConfirmou: false,
    area: "",
    chamado: "",
  };

  const [t, setT] = useState<Triagem>(inicial);
  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mexeu = JSON.stringify(t) !== JSON.stringify(inicial);
  useRascunhoNaJanela(mexeu);

  const mudar = <K extends keyof Triagem>(campo: K, valor: Triagem[K]) => {
    setT((atual) => ({ ...atual, [campo]: valor }));
    setErro(null);
  };

  /* Os assuntos mais usados nas Redes primeiro — o resto no seletor. */
  const assuntos = useMemo(() => {
    const ativos = categories.filter((c) => c.active).map((c) => c.name);
    const conta = new Map<string, number>();
    for (const c of cases) if (isSocial(c)) conta.set(c.category, (conta.get(c.category) ?? 0) + 1);
    const frequentes = ativos
      .filter((n) => (conta.get(n) ?? 0) > 0 && !/^n[ãa]o classificad/i.test(n))
      .sort((a, b) => (conta.get(b) ?? 0) - (conta.get(a) ?? 0))
      .slice(0, 8);
    return { frequentes, todos: ativos };
  }, [categories, cases]);

  const falta = faltaNaTriagem(t, { validadoEm: data.validadoEm, tentativasSemResposta: data.tentativasSemResposta });

  /* O que cada pergunta precisa para seguir — a saída é conferida no fim. */
  const faltaNoPasso = [
    !t.naoIdentificado && t.customer.trim().length < 2 ? "Diga o nome do cliente, ou marque que ele ainda não se identificou." : null,
    null,
    !t.category.trim() ? "Escolha o assunto." : null,
    null,
    falta.length ? `Falta ${falta.join("; ")}.` : null,
  ];

  const podeSeguir = !faltaNoPasso[passo];
  const ultimo = passo === PERGUNTAS.length - 1;

  async function salvar() {
    if (falta.length || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await triarAtendimento({ ...t, protocol: data.protocol });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setCases((prev) => prev.map((c) => (c.protocol === data.protocol ? { ...c, ...r.patch } : c)));
      aoSalvar(r.patch);
      const saida = SAIDAS_DA_TRIAGEM.find((s) => s.id === t.saida)!;
      notify({
        tone: "success",
        title: t.saida === "segue" ? "Triagem salva." : `Triagem salva e encerrado: ${saida.nome.toLowerCase()}.`,
        detail:
          t.saida === "segue"
            ? `${t.prioridade} · ${t.category}. Próximo passo: o 1º contato.`
            : t.saida === "Resolvido"
              ? "Conta como resolvido nos indicadores."
              : "Não conta como resolvido. Se o cliente voltar, reabra — o registro é o mesmo.",
      });
    } catch {
      setErro("A triagem não foi gravada. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function seguir() {
    if (!podeSeguir) return;
    if (ultimo) salvar();
    else setPasso((p) => p + 1);
  }

  /* Enter segue — fora do texto longo, onde Enter é quebra de linha. */
  function tecla(e: KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey || (e.target as HTMLElement).tagName === "TEXTAREA") return;
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    e.preventDefault();
    seguir();
  }

  const campo = "h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400";
  const texto = "w-full resize-y rounded-lg border border-zinc-200 bg-white p-2.5 text-sm leading-relaxed outline-none placeholder:text-zinc-400 focus:border-zinc-400";

  return (
    <div onKeyDown={tecla} className="rounded-xl border border-zinc-200 bg-white">

      {/* As cinco perguntas: as já respondidas voltam com um clique. */}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-zinc-100 px-4 py-2.5">
        {PERGUNTAS.map((p, i) => (
          <li key={p} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-3 bg-zinc-200" aria-hidden />}
            <button
              type="button"
              onClick={() => i < passo && setPasso(i)}
              disabled={i > passo}
              aria-current={i === passo ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs",
                i === passo ? "font-semibold text-zinc-900" : i < passo ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800" : "text-zinc-400"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] tabular-nums",
                  i < passo ? "bg-emerald-500 text-white" : i === passo ? "bg-zinc-900 text-white" : "border border-zinc-300"
                )}
              >
                {i < passo ? <Check size={10} strokeWidth={3} /> : i + 1}
              </span>
              {p}
            </button>
          </li>
        ))}
      </ol>

      <div className="px-4 py-4">

        {passo === 0 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-zinc-900">Quem é o cliente?</legend>
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px]">
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Nome</span>
                <input autoFocus value={t.customer} disabled={t.naoIdentificado} onChange={(e) => mudar("customer", e.target.value)} placeholder="Como se apresentou" className={cn(campo, "mt-1 disabled:bg-zinc-50 disabled:text-zinc-400")} />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Perfil</span>
                <input value={t.socialHandle} onChange={(e) => mudar("socialHandle", e.target.value)} placeholder="@perfil" className={cn(campo, "mt-1")} />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Seguidores</span>
                <input
                  inputMode="numeric"
                  value={t.followers ?? ""}
                  onChange={(e) => {
                    const n = e.target.value.replace(/\D/g, "");
                    mudar("followers", n ? Number(n) : null);
                  }}
                  placeholder="—"
                  className={cn(campo, "mt-1 tabular-nums")}
                />
              </label>
            </div>
            <label className="flex w-fit items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" checked={t.naoIdentificado} onChange={(e) => mudar("naoIdentificado", e.target.checked)} className="h-3.5 w-3.5 accent-zinc-900" />
              Ainda não se identificou pelo canal privado
            </label>
          </fieldset>
        )}

        {passo === 1 && (
          <fieldset>
            <legend className="text-sm font-semibold text-zinc-900">Em qual rede?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {SOCIAL_DAS_REDES.map((r) => (
                <Opcao key={r} ativo={t.source === r} onClick={() => mudar("source", r)}>
                  {r}
                </Opcao>
              ))}
            </div>
          </fieldset>
        )}

        {passo === 2 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-zinc-900">O que aconteceu?</legend>
            <div className="flex flex-wrap gap-2">
              {assuntos.frequentes.map((a) => (
                <Opcao key={a} ativo={t.category === a} onClick={() => mudar("category", a)}>
                  {a}
                </Opcao>
              ))}
              <div className="w-56">
                <Combobox
                  value={assuntos.frequentes.includes(t.category) ? "" : t.category}
                  onChange={(v) => mudar("category", v)}
                  options={assuntos.todos}
                  placeholder={assuntos.frequentes.length ? "Outro assunto…" : "Escolha o assunto"}
                  emptyLabel="—"
                />
              </div>
            </div>
            <label className="block">
              <span className="text-[11px] font-medium text-zinc-500">Relato</span>
              <textarea value={t.relato} onChange={(e) => mudar("relato", e.target.value)} rows={4} placeholder="O que o cliente escreveu, e onde." className={cn(texto, "mt-1")} />
            </label>
          </fieldset>
        )}

        {passo === 3 && (
          <fieldset>
            <legend className="text-sm font-semibold text-zinc-900">Qual a gravidade?</legend>
            <p className="mt-1 text-xs text-zinc-500">
              Sugerida: <strong className="font-medium text-zinc-700">{sugestao.nivel}</strong> — {sugestao.motivo}.
            </p>
            <div role="radiogroup" aria-label="Gravidade" className="mt-3 grid gap-2">
              {GRAVIDADES.map((g) => (
                <Linha key={g.id} ativo={t.prioridade === g.id} onClick={() => mudar("prioridade", g.id)} titulo={g.id} texto={g.texto} marca={g.id === sugestao.nivel ? "sugerida" : undefined} />
              ))}
            </div>
          </fieldset>
        )}

        {passo === 4 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-zinc-900">Como fica?</legend>
            <div role="radiogroup" aria-label="Saída" className="grid gap-2">
              {SAIDAS_DA_TRIAGEM.map((s) => (
                <Linha
                  key={s.id}
                  ativo={t.saida === s.id}
                  onClick={() => mudar("saida", s.id)}
                  titulo={s.nome}
                  texto={s.id === "Sem contato" ? `${s.texto} Hoje: ${data.tentativasSemResposta ?? 0} de ${TENTATIVAS_DAS_REDES}.` : s.texto}
                />
              ))}
            </div>

            {t.saida === "Resolvido" && (
              <div className="grid gap-2.5 rounded-lg bg-zinc-50 p-3">
                {!data.validadoEm && (
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input type="checkbox" checked={t.clienteConfirmou} onChange={(e) => mudar("clienteConfirmou", e.target.checked)} className="h-3.5 w-3.5 accent-zinc-900" />
                    O cliente confirmou que foi resolvido <span className="text-zinc-400">(registra a validação, por {t.source})</span>
                  </label>
                )}
                <label className="block">
                  <span className="text-[11px] font-medium text-zinc-500">Solução aplicada</span>
                  <textarea value={t.solucao} onChange={(e) => mudar("solucao", e.target.value)} rows={2} placeholder="O que resolveu — para quem abrir o caso de novo." className={cn(texto, "mt-1")} />
                </label>
                <div>
                  <span className="text-[11px] font-medium text-zinc-500">Causa raiz</span>
                  <div className="mt-1">
                    <Combobox
                      value={t.causaRaiz}
                      onChange={(v) => mudar("causaRaiz", v)}
                      emptyLabel="Não definida"
                      placeholder="Não definida"
                      options={[...new Set([...rootCauses.filter((c) => c.active).map((c) => c.name), ...(t.causaRaiz ? [t.causaRaiz] : [])])]}
                    />
                    <DonoDaCausa causa={t.causaRaiz} />
                    <CausaSugerida texto={`${data.title}\n${relato || data.description || ""}`} atual={t.causaRaiz} onUsar={(c) => mudar("causaRaiz", c)} />
                  </div>
                </div>
              </div>
            )}

            {t.saida === "Encaminhado" && (
              <div className="grid gap-2.5 rounded-lg bg-zinc-50 p-3">
                <div className="flex flex-wrap gap-2">
                  {AREAS_INTERNAS.map((a) => (
                    <Opcao key={a.nome} ativo={t.area === a.nome} onClick={() => mudar("area", a.nome)}>
                      {a.nome}
                    </Opcao>
                  ))}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="block">
                    <span className="text-[11px] font-medium text-zinc-500">Nº do chamado</span>
                    <input value={t.chamado} onChange={(e) => mudar("chamado", e.target.value)} placeholder="opcional" className={cn(campo, "mt-1")} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-zinc-500">Nota</span>
                    <input value={t.solucao} onChange={(e) => mudar("solucao", e.target.value)} placeholder="O que ficou combinado com a área" className={cn(campo, "mt-1")} />
                  </label>
                </div>
              </div>
            )}

            {t.saida === "Sem identificação" && (
              <label className="block">
                <span className="text-[11px] font-medium text-zinc-500">Nota (opcional)</span>
                <input value={t.solucao} onChange={(e) => mudar("solucao", e.target.value)} placeholder="Onde foi a menção e o que foi pedido" className={cn(campo, "mt-1")} />
              </label>
            )}
          </fieldset>
        )}

        {erro && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-100">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {erro}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-2.5">
        {passo > 0 ? (
          <button type="button" onClick={() => setPasso((p) => p - 1)} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
            <ChevronLeft size={14} /> Voltar
          </button>
        ) : (
          onCancelar && (
            <button type="button" onClick={onCancelar} className="flex h-8 items-center rounded-lg px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
              Cancelar
            </button>
          )
        )}
        <p className="min-w-0 flex-1 text-right text-[11px] text-zinc-500">{faltaNoPasso[passo]}</p>
        <button
          type="button"
          onClick={seguir}
          disabled={!podeSeguir || salvando}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {salvando && <Loader2 size={13} className="animate-spin" />}
          {ultimo ? (t.saida === "segue" ? "Salvar triagem" : `Salvar e encerrar`) : "Continuar"}
        </button>
      </div>
    </div>
  );
}

function Opcao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "h-8 rounded-lg border px-3 text-xs font-medium transition-colors",
        ativo ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
      )}
    >
      {children}
    </button>
  );
}

function Linha({ ativo, onClick, titulo, texto, marca }: { ativo: boolean; onClick: () => void; titulo: string; texto: string; marca?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
        ativo ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
      )}
    >
      <span className={cn("mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border", ativo ? "border-zinc-900 text-zinc-900" : "border-zinc-300")}>
        {ativo && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-900">
          {titulo}
          {marca && <span className="rounded bg-zinc-100 px-1.5 text-[10px] font-medium text-zinc-500">{marca}</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{texto}</span>
      </span>
    </button>
  );
}
