"use client";

import { useMemo, useState } from "react";

import { Save } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { Case } from "@/lib/models/case";

import { useCases } from "@/lib/context/CaseContext";
import { useSettings } from "@/lib/context/SettingsContext";
import { useWorkflow } from "@/lib/context/WorkflowContext";
import { useTeams } from "@/lib/context/TeamsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import Combobox from "@/components/shared/Combobox";

import { hojeNaOperacao } from "@/lib/services/reputation.service";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* Os três níveis da documentação — ver `CRITERIOS` em lib/models/case. */
const PRIORIDADES: Case["priority"][] = ["Urgente", "Alta", "Normal"];

/** Lista ordenada, sem repetição e sem vazios. */
function uniao(...listas: (string | undefined)[][]) {
  const set = new Set<string>();

  for (const lista of listas) {
    for (const item of lista) {
      const valor = (item ?? "").trim();
      if (valor) set.add(valor);
    }
  }

  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Cadastro manual de reclamação.
 *
 * As opções saem do que a operação já usa — cadastro de Configurar
 * fluxo **unido ao que existe na base** —, e não de listas fixas. A
 * versão anterior oferecia status inventados ("Em Atendimento",
 * "Aguardando Cliente") que não existem no fluxo real: o caso nascia
 * fora de qualquer coluna do Kanban e sumia do quadro.
 */
export default function CreateCaseModal({
  open,
  onClose,
}: Props) {

  const { cases, createCase } = useCases();
  const { categories, subcategories, criarCategoria, criarSubcategoria } = useSettings();
  const { workflow, criarEtapa } = useWorkflow();
  const { people } = useTeams();
  const { establishments, criarEstabelecimento, renomearEstabelecimento } = useEstablishments();
  const session = useSession();

  /* Criar categoria, subcategoria e etapa é do administrador; estabelecimento, de quem trata. */
  const admin = session?.role === "ADMIN";

  const etapas = useMemo(
    () =>
      workflow
        .filter((item) => item.active)
        .sort((a, b) => a.order - b.order),
    [workflow]
  );

  const opcoesCategoria = useMemo(
    () =>
      uniao(
        categories
          .filter((item) => item.active)
          .map((item) => item.name),
        cases.map((item) => item.category)
      ),
    [categories, cases]
  );

  const opcoesResponsavel = useMemo(
    () =>
      uniao(
        people.map((item) => item.name),
        cases.map((item) => item.owner)
      ),
    [people, cases]
  );

  /**
   * Protocolo próprio para o que nasce aqui.
   *
   * Os importados usam o id do HugMe (`RA-101491955`); continuar aquela
   * sequência arriscaria colidir com um id que o portal ainda vai emitir.
   */
  const protocol = useMemo(() => {

    const maior = cases.reduce((max, item) => {

      if (!item.protocol.startsWith("MAN-")) return max;

      const seq = Number(item.protocol.slice(4));

      return Number.isNaN(seq) ? max : Math.max(max, seq);

    }, 0);

    return `MAN-${String(maior + 1).padStart(4, "0")}`;

  }, [cases]);

  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  /*
    O estabelecimento vem do cadastro, com busca — e não mais de um campo
    de texto que, em branco, repetia o consumidor. Era assim que nome de
    cliente virava "estabelecimento" no filtro do quadro.
  */
  const [establishmentId, setEstablishmentId] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [priority, setPriority] =
    useState<Case["priority"]>("Normal");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState(
    session?.name ?? ""
  );
  const [createdAt, setCreatedAt] =
    useState(hojeNaOperacao());
  const [description, setDescription] = useState("");

  const subsDaCategoria = useMemo(
    () =>
      uniao(
        subcategories
          .filter(
            (item) =>
              item.active && item.category === category
          )
          .map((item) => item.name),
        cases
          .filter((item) => item.category === category)
          .map((item) => item.subcategory)
      ),
    [subcategories, cases, category]
  );

  const valido =
    title.trim() !== "" &&
    customer.trim() !== "" &&
    createdAt !== "";

  async function salvar() {
    if (!valido) return;

    /*
      Fecha só depois de o servidor aceitar (Fase 10.4). Fechar antes
      jogava fora o que foi digitado justamente quando a gravação era
      recusada — a pessoa tinha de redigitar tudo para tentar de novo.
    */
    const resultado = await createCase({
      id: crypto.randomUUID(),
      protocol,
      /* Sem estabelecimento, o nome do consumidor fica na coluna antiga — a lista já o esconde. */
      company: establishments.find((e) => e.id === establishmentId)?.name ?? customer.trim(),
      establishmentId: establishmentId || undefined,
      establishmentManual: Boolean(establishmentId),
      customer: customer.trim(),
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      source: "Reclame Aqui",
      category: category || "Outros",
      subcategory: subcategory || undefined,
      priority,
      status: status || etapas[0]?.name || "Novo",
      owner: owner || undefined,
      title: title.trim(),
      description: description.trim(),
      // Nasce sem resposta e sem avaliação: nota só existe depois que o
      // consumidor avalia no portal. Gravar 0 aqui contaria como uma
      // avaliação nota zero e derrubaria a reputação.
      publicResponse: "",
      evaluated: false,
      resolved: false,
      wouldDoBusiness: false,
      responseTime: "-",
      solutionTime: "-",
      sla: "48h",
      createdAt,
      updatedAt: createdAt,
      tags: [],
    });

    if (resultado.ok) onClose();
  }

  if (!open) return null;

  return (
    <Modal
      open
      size="wide"
      title="Nova reclamação"
      description={`Cadastro manual. Protocolo ${protocol}.`}
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
            <Save size={16} />
            Salvar reclamação
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-4">

        <Field label="Título da reclamação">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resumo do que o consumidor relatou"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Consumidor">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Quem registrou a reclamação"
              className={inputClass}
            />
          </Field>

          <Field
            label="Estabelecimento"
            hint="Busque pelo nome, cidade ou CPF/CNPJ; se não existir, crie ali mesmo."
          >
            <Combobox
              value={establishmentId}
              onChange={setEstablishmentId}
              emptyLabel="Sem estabelecimento"
              placeholder="Buscar restaurante…"
              options={establishments.map((item) => ({
                value: item.id,
                label: item.name,
                hint: [item.city, item.document].filter(Boolean).join(" · "),
              }))}
              nomeDoItem="estabelecimento"
              onCriar={async (nome) => (await criarEstabelecimento(nome))?.id ?? null}
              onRenomear={renomearEstabelecimento}
            />
          </Field>

          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Estado">
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              maxLength={2}
              placeholder="UF"
              className={inputClass}
            />
          </Field>

          <Field
            label="Categoria"
            hint="Do cadastro e das que já existem na base."
          >
            <Combobox
              value={category}
              onChange={(valor) => {
                setCategory(valor);
                setSubcategory("");
              }}
              emptyLabel="Não classificado"
              placeholder="Não classificado"
              options={opcoesCategoria}
              nomeDoItem="categoria"
              onCriar={admin ? async (nome) => ((await criarCategoria(nome)) ? nome : null) : undefined}
            />
          </Field>

          <Field label="Subcategoria">
            <Combobox
              value={subcategory}
              onChange={setSubcategory}
              disabled={!category}
              emptyLabel="Sem subcategoria"
              placeholder={category ? "Sem subcategoria" : "Escolha uma categoria primeiro"}
              options={subsDaCategoria}
              nomeDoItem="subcategoria"
              onCriar={admin && category ? async (nome) => ((await criarSubcategoria(category, nome)) ? nome : null) : undefined}
            />
          </Field>

          <Field label="Prioridade">
            <select
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value as Case["priority"]
                )
              }
              className={inputClass}
            >
              {PRIORIDADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Status"
            hint="Etapas do fluxo configurado."
          >
            <Combobox
              value={status || etapas[0]?.name || ""}
              onChange={setStatus}
              options={etapas.map((item) => item.name)}
              nomeDoItem="etapa"
              onCriar={admin ? async (nome) => ((await criarEtapa(nome)) ? nome : null) : undefined}
            />
          </Field>

          <Field label="Responsável">
            <Combobox
              value={owner}
              onChange={setOwner}
              emptyLabel="Sem responsável"
              placeholder="Sem responsável"
              options={opcoesResponsavel}
            />
          </Field>

          <Field label="Data da reclamação">
            <input
              type="date"
              value={createdAt}
              onChange={(e) =>
                setCreatedAt(e.target.value)
              }
              className={inputClass}
            />
          </Field>

        </div>

        <Field label="Relato do consumidor">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={5}
            placeholder="Cole aqui o texto da reclamação."
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
