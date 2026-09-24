"use client";

import {
  documentoFormatado,
  tipoDeDocumento,
} from "@/lib/models/establishment";

import { useEffect, useMemo, useState } from "react";

import { Building2, Check } from "lucide-react";

import { Case } from "@/lib/models/case";

import SurfaceCard from "@/components/shared/SurfaceCard";
import SugestaoDoTexto from "@/components/shared/SugestaoDoTexto";

import { useSettings } from "@/lib/context/SettingsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import Combobox from "@/components/shared/Combobox";

import { sugerirAssuntoDoRelato, type SugestaoComAcerto } from "@/lib/actions/sugestoes";
import DonoDaCausa from "@/components/causas/DonoDaCausa";
import CausaSugerida from "@/components/causas/CausaSugerida";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";

interface Props {
  data: Case;
  onChange: (patch: Partial<Case>) => void;
}

export default function InvestigationTab({
  data,
  onChange,
}: Props) {

  const { categories, subcategories, teams, checklist, criarCategoria, renomearCategoria, criarSubcategoria, renomearSubcategoria } =
    useSettings();

  /*
    Criar e renomear categoria ali mesmo — o cadastro é do administrador,
    então só ele vê o "Criar" e o lápis. Renomear relê as reclamações:
    as outras com a mesma categoria mudam de nome também.
  */
  const admin = useSession()?.role === "ADMIN";
  const { recarregar } = useCases();

  async function renomearACategoria(nomeAntigo: string, nome: string) {
    const categoria = categories.find((c) => c.name === nomeAntigo);
    if (!categoria || !(await renomearCategoria(categoria.id, nome))) return false;
    if (data.category === nomeAntigo) onChange({ category: nome });
    void recarregar();
    return true;
  }

  async function renomearASubcategoria(nomeAntigo: string, nome: string) {
    const sub = subcategories.find((s) => s.category === data.category && s.name === nomeAntigo);
    if (!sub || !(await renomearSubcategoria(sub.id, nome))) return false;
    if (data.subcategory === nomeAntigo) onChange({ subcategory: nome });
    void recarregar();
    return true;
  }

  const { rootCauses } = useNps();

  const { abrirArea } = useTratativa();

  const active = useMemo(
    () => checklist.filter((item) => item.active),
    [checklist]
  );

  /**
   * Casos encerrados chegam com o checklist cumprido; os demais
   * começam vazios e o agente vai marcando.
   */
  const [done, setDone] = useState<Set<string>>(
    () =>
      new Set(
        data.resolved
          ? active.map((item) => item.id)
          : []
      )
  );

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  const required = active.filter((item) => item.required);

  const requiredDone = required.filter((item) =>
    done.has(item.id)
  ).length;

  const progress =
    active.length === 0
      ? 0
      : Math.round((done.size / active.length) * 100);

  const relatedSubcategories = subcategories.filter(
    (item) => item.category === data.category
  );

  /*
    Sugestão de assunto pelo relato (Fase 15 do roadmap 2.0). Só quando
    ainda não há assunto — quem já classificou não precisa de palpite —
    e com o texto pesado quieto por 600ms, para não bater no servidor a
    cada tecla enquanto alguém edita a descrição.
  */
  const semAssunto = !data.category || data.category === "Não classificado";
  const [sugestao, setSugestao] = useState<SugestaoComAcerto | null>(null);

  useEffect(() => {
    if (!semAssunto) return;
    const texto = `${data.title} ${data.description}`.trim();
    if (texto.length < 8) return;
    let ativo = true;
    const id = window.setTimeout(async () => {
      const r = await sugerirAssuntoDoRelato({ texto, excluirProtocol: data.protocol });
      if (ativo) setSugestao(r);
    }, 600);
    return () => {
      ativo = false;
      window.clearTimeout(id);
    };
  }, [semAssunto, data.title, data.description, data.protocol]);

  /* `semAssunto` também esconde uma sugestão de uma rodada anterior, se a categoria voltar a ser escolhida. */
  const assuntoSugerido =
    semAssunto && sugestao?.sugestao && categories.some((c) => c.name === sugestao.sugestao!.valor) ? sugestao.sugestao : null;

  return (
    <div className="space-y-5">

      <SurfaceCard
        title="Checklist de resolução"
        description="Etapas configuradas para encerrar esta reclamação com segurança operacional."
        action={
          <div className="shrink-0 rounded-xl bg-zinc-50 px-4 py-2.5 text-right">

            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Progresso
            </p>

            <p className="text-sm font-semibold text-zinc-900">
              {done.size} de {active.length} concluídos
            </p>

            <p className="text-[11px] text-zinc-500">
              {requiredDone} de {required.length} obrigatórios
            </p>

          </div>
        }
      >

        <div className="mb-5 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-700 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">

          {active.map((item) => {

            const checked = done.has(item.id);

            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  checked
                    ? "border-violet-200 bg-violet-50/40"
                    : "border-zinc-200 hover:border-violet-200 hover:bg-zinc-50"
                }`}
              >

                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    checked
                      ? "border-violet-700 bg-violet-700 text-white"
                      : "border-zinc-300"
                  }`}
                >
                  {checked && <Check size={13} />}
                </span>

                <span className="min-w-0">

                  <span className="flex flex-wrap items-center gap-2">

                    <span className="text-sm font-medium text-zinc-800">
                      {item.label}
                    </span>

                    {item.required && (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        Obrigatório
                      </span>
                    )}

                  </span>

                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    {checked
                      ? `Concluído por ${data.owner ?? "—"}`
                      : "Pendente"}
                  </span>

                </span>

              </button>
            );
          })}

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Investigação e acompanhamento operacional"
        description="Vínculos e classificação usados no diagnóstico da reclamação."
      >

        {/*
          Sem vínculo, a tela **diz** que falta.

          Antes ela mostrava o nome do consumidor aqui, porque a
          exportação do Reclame Aqui não traz o nome do restaurante e a
          carga copiou a coluna de quem reclamou. Um cadastro que se
          chama "Ana Karla da Silva" parece resolvido e não é: o
          restaurante está faltando na planilha, e essa é a única
          informação que leva alguém a agir.
        */}
        <div
          className={`rounded-xl p-4 ring-1 ring-inset ${
            data.company
              ? "bg-violet-50/50 ring-violet-100"
              : "bg-amber-50/60 ring-amber-100"
          }`}
        >

          <p
            className={`text-[11px] font-semibold uppercase tracking-wide ${
              data.company
                ? "text-violet-600"
                : "text-amber-700"
            }`}
          >
            {data.company
              ? "Estabelecimento vinculado"
              : "Sem estabelecimento vinculado"}
          </p>

          <div className="mt-2 flex items-center gap-3">

            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-inset ${
                data.company
                  ? "text-violet-600 ring-violet-100"
                  : "text-amber-600 ring-amber-100"
              }`}
            >
              <Building2 size={17} />
            </span>

            <div className="min-w-0">

              <p className="truncate text-sm font-semibold text-zinc-900">
                {data.company || "Restaurante não identificado"}
              </p>

              <p className="text-xs text-zinc-500">
                {tipoDeDocumento(data.document) || "CPF/CNPJ"}{" "}
                {documentoFormatado(data.document) || "—"}
              </p>

            </div>

          </div>

          {!data.company && (
            <p className="mt-3 text-xs leading-relaxed text-amber-800">
              {data.document
                ? "O documento desta reclamação não casa com nenhum estabelecimento cadastrado. Falta o restaurante na planilha de cadastro — o vínculo se faz sozinho assim que ele existir."
                : "A reclamação chegou sem CPF nem CNPJ, e é por documento que o vínculo acontece. Sem ele, o restaurante precisa ser escolhido à mão."}
            </p>
          )}

        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Categoria
            </label>

            <div className="mt-1.5">
              <Combobox
                value={data.category}
                onChange={(category) =>
                  onChange({ category, subcategory: "" })
                }
                placeholder="Escolher categoria…"
                options={categories.map(
                  (item) => item.name
                )}
                nomeDoItem="categoria"
                onCriar={admin ? async (nome) => ((await criarCategoria(nome)) ? nome : null) : undefined}
                onRenomear={admin ? renomearACategoria : undefined}
              />
            </div>

          </div>

          <div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Subcategoria
            </label>

            <div className="mt-1.5">
              <Combobox
                value={data.subcategory ?? ""}
                onChange={(subcategory) =>
                  onChange({ subcategory })
                }
                emptyLabel="Nenhuma selecionada"
                placeholder="Nenhuma selecionada"
                options={relatedSubcategories.map(
                  (item) => item.name
                )}
                nomeDoItem="subcategoria"
                onCriar={admin && data.category ? async (nome) => ((await criarSubcategoria(data.category, nome)) ? nome : null) : undefined}
                onRenomear={admin ? renomearASubcategoria : undefined}
              />
            </div>

          </div>

          <div>

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Time envolvido
            </label>

            <div className="mt-1.5">
              <Combobox
                value={data.department ?? ""}
                onChange={(department) =>
                  onChange({ department })
                }
                emptyLabel="Nenhum"
                placeholder="Nenhum"
                options={teams
                  .filter((item) => item.active)
                  .map((item) => item.name)}
              />
            </div>

          </div>

          {/*
            A causa raiz, da lista única das quatro frentes.

            A categoria diz do que o cliente reclamou; a causa raiz diz
            por que aconteceu — e é a mesma lista do NPS e do Google, para
            a tendência cruzar os canais.
          */}
          <div>

            <label
              className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
              title="A mesma lista do NPS e do Google — edite em NPS → Causas raiz."
            >
              Causa raiz
            </label>

            <div className="mt-1.5">
              <Combobox
                value={data.causaRaiz ?? ""}
                onChange={(causaRaiz) =>
                  onChange({ causaRaiz: causaRaiz || undefined })
                }
                emptyLabel="Não definida"
                placeholder="Não definida"
                options={[
                  ...new Set([
                    ...rootCauses
                      .filter((item) => item.active)
                      .map((item) => item.name),
                    ...(data.causaRaiz ? [data.causaRaiz] : []),
                  ]),
                ]}
              />
              <DonoDaCausa
                causa={data.causaRaiz}
                onAcionar={(area) => abrirArea(data, { area, causa: data.causaRaiz })}
              />
              <CausaSugerida
                texto={`${data.title}\n${data.description ?? ""}`}
                atual={data.causaRaiz}
                onUsar={(causaRaiz) => onChange({ causaRaiz })}
              />
            </div>

          </div>

        </div>

        {assuntoSugerido && (
          <div className="mt-4">
            <SugestaoDoTexto
              rotulo="Categoria sugerida pelo relato"
              valor={assuntoSugerido.valor}
              motivo={assuntoSugerido.motivo || undefined}
              acerto={sugestao?.acerto}
              onUsar={() => onChange({ category: assuntoSugerido.valor, subcategory: "" })}
            />
          </div>
        )}

      </SurfaceCard>

    </div>
  );
}
