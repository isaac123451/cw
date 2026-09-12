"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useCases } from "@/lib/context/CaseContext";
import { useTeams } from "@/lib/context/TeamsContext";
import { useSettings } from "@/lib/context/SettingsContext";
import { SlaRuleDraft } from "@/lib/context/SlaContext";

import {
  ANY_CATEGORY,
  CANAIS_DO_PRAZO,
  canalDoCaso,
  SlaRule,
} from "@/lib/models/sla";
import { PRIORIDADES } from "@/lib/models/case";
import { descreverPrazo } from "@/lib/services/horasUteis";

interface Props {
  open: boolean;
  editing?: SlaRule;
  onClose: () => void;
  onSave: (data: SlaRuleDraft | SlaRule) => void;
}

export default function SlaRuleForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const { cases } = useCases();
  const { teams } = useTeams();
  const { categories } = useSettings();

  /**
   * Os campos nascem preenchidos, e o formulário remonta a cada
   * abertura.
   *
   * Era um `useEffect` que copiava `editing` para o estado quando o
   * modal abria. Funcionava, mas ao custo de uma renderização a mais
   * por abertura — e de uma janela em que o formulário já estava na
   * tela com os campos do registro anterior. Quem abre passa `key`, e
   * é ela que garante instância nova.
   */
  const [category, setCategory] = useState(
    editing?.category ?? ANY_CATEGORY
  );
  const [priority, setPriority] = useState<string>(
    editing?.priority ?? ""
  );
  const [canal, setCanal] = useState<string>(
    editing?.canal ?? ""
  );
  const [seguidoresMin, setSeguidoresMin] = useState(
    editing?.seguidoresMin ? String(editing.seguidoresMin) : ""
  );
  const [responseHours, setResponseHours] = useState(
    editing ? String(editing.responseHours) : "48"
  );
  const [solutionHours, setSolutionHours] = useState(
    editing ? String(editing.solutionHours) : "120"
  );
  const [team, setTeam] = useState(
    editing?.team ?? ""
  );
  const [note, setNote] = useState(
    editing?.note ?? ""
  );
  const [active, setActive] = useState(
    editing?.active ?? true
  );

  /**
   * As categorias vêm de Configurar fluxo — é lá que se cria, edita e
   * exclui. Antes esta lista era montada a partir dos dados importados,
   * o que criava uma segunda taxonomia paralela à configuração.
   */
  const categorias = useMemo(
    () =>
      categories
        .filter((item) => item.active)
        .map((item) => ({
          name: item.name,
          casos: cases.filter(
            (caso) => caso.category === item.name
          ).length,
        })),
    [categories, cases]
  );

  const resposta = Number(responseHours);
  const solucao = Number(solutionHours);
  const alcanceMin = seguidoresMin.trim() === "" ? 0 : Number(seguidoresMin);

  /*
    Solução zero é permitida: é "a documentação não fixa prazo de
    solução", como nas Redes Sociais. Primeiro contato zero não é.
  */
  const horasValidas =
    Number.isFinite(resposta) &&
    resposta > 0 &&
    Number.isFinite(solucao) &&
    solucao >= 0;

  // Não faz sentido exigir a solução antes do 1º contato.
  const ordemValida =
    !horasValidas || solucao === 0 || solucao >= resposta;

  const alcanceValido = Number.isFinite(alcanceMin) && alcanceMin >= 0;

  const valido = horasValidas && ordemValida && alcanceValido;

  /** Quantos casos da base esta regra passaria a governar. */
  const alcance = useMemo(
    () =>
      cases.filter(
        (item) =>
          (category === ANY_CATEGORY ||
            item.category === category) &&
          (priority === "" ||
            item.priority === priority) &&
          (canal === "" || canalDoCaso(item.source) === canal) &&
          (!alcanceMin || (item.followers ?? 0) >= alcanceMin)
      ).length,
    [cases, category, priority, canal, alcanceMin]
  );

  function salvar() {

    if (!valido) return;

    const base: SlaRuleDraft = {
      category,
      priority: priority
        ? (priority as SlaRule["priority"])
        : undefined,
      canal: canal ? (canal as SlaRule["canal"]) : undefined,
      seguidoresMin: alcanceMin > 0 ? alcanceMin : undefined,
      responseHours: resposta,
      solutionHours: solucao,
      team: team.trim() || undefined,
      note: note.trim() || undefined,
      active,
    };

    onSave(
      editing ? { ...base, id: editing.id } : base
    );
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={
        editing ? "Editar regra de SLA" : "Nova regra de SLA"
      }
      description="O prazo do 1º contato com o cliente e o da solução, em tempo útil — contados só dentro do expediente."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>
            Cancelar
          </GhostButton>

          <PrimaryButton
            onClick={salvar}
            disabled={!valido}
          >
            <Save size={15} />
            {editing ? "Salvar" : "Criar regra"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Categoria"
            hint="Vem de Configurar fluxo — é lá que se cria e edita."
          >

            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
              className={inputClass}
            >
              <option value={ANY_CATEGORY}>
                Todas as categorias
              </option>

              {categorias.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} ({item.casos})
                </option>
              ))}

              {/* Categoria de uma regra antiga que saiu da configuração. */}
              {category !== ANY_CATEGORY &&
                !categorias.some(
                  (item) => item.name === category
                ) && (
                  <option value={category}>
                    {category} (fora da configuração)
                  </option>
                )}
            </select>

            <Link
              href="/reclame-aqui/configuracoes"
              className="mt-1.5 inline-block text-xs font-medium text-violet-700 hover:underline"
            >
              Gerenciar categorias
            </Link>

          </Field>

          <Field
            label="Prioridade"
            hint="Deixe em branco para valer em qualquer prioridade."
          >
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value)
              }
              className={inputClass}
            >
              <option value="">
                Qualquer prioridade
              </option>

              {PRIORIDADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Frente"
            hint="Reclame Aqui e Redes Sociais têm prazos diferentes na documentação."
          >
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className={inputClass}
            >
              <option value="">Todas as frentes</option>
              {CANAIS_DO_PRAZO.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Só a partir de (seguidores)"
            hint={
              alcanceValido
                ? "Vazio vale para qualquer perfil. A documentação usa 10.000 nas Redes Sociais."
                : "Informe um número inteiro."
            }
          >
            <input
              value={seguidoresMin}
              onChange={(e) => setSeguidoresMin(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Ex.: 10000"
              className={inputClass}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="1º contato (horas úteis)"
            hint={
              horasValidas
                ? `Equivale a ${descreverPrazo(resposta)}. Múltiplos de 24 contam em dias úteis.`
                : "Informe um número maior que zero."
            }
          >
            <input
              value={responseHours}
              onChange={(e) =>
                setResponseHours(e.target.value)
              }
              inputMode="numeric"
              className={inputClass}
            />
          </Field>

          <Field
            label="Solução (horas úteis)"
            hint={
              !ordemValida
                ? "A solução não pode vencer antes do 1º contato."
                : horasValidas
                ? solucao === 0
                  ? "Zero: sem prazo de solução — o relógio para no 1º contato."
                  : `Equivale a ${descreverPrazo(solucao)}.`
                : "Informe zero ou mais."
            }
          >
            <input
              value={solutionHours}
              onChange={(e) =>
                setSolutionHours(e.target.value)
              }
              inputMode="numeric"
              className={`${inputClass} ${
                ordemValida
                  ? ""
                  : "border-rose-300 focus:border-rose-400"
              }`}
            />
          </Field>

        </div>

        <Field
          label="Time responsável"
          hint="Quem responde por este tipo de caso."
        >
          <input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            list="times-sla"
            placeholder="Ex.: Financeiro"
            className={inputClass}
          />

          <datalist id="times-sla">
            {teams.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
        </Field>

        <Field label="Observação">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Por que este tipo de caso tem esse prazo"
            className={textareaClass}
          />
        </Field>

        <div className="rounded-xl bg-violet-50/60 px-4 py-3 ring-1 ring-inset ring-violet-100">

          <p className="text-sm text-violet-900">
            Esta regra alcança{" "}
            <strong className="font-semibold">
              {alcance} reclamação(ões)
            </strong>{" "}
            da base atual.
          </p>

          <p className="mt-1 text-xs leading-relaxed text-violet-700">
            Regras mais específicas continuam tendo
            preferência sobre esta.
          </p>

        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3.5">

          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-violet-700"
          />

          <span>

            <span className="block text-sm font-medium text-zinc-800">
              Regra ativa
            </span>

            <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
              Regras inativas param de valer sem serem
              apagadas.
            </span>

          </span>

        </label>

      </div>

    </Modal>
  );
}
