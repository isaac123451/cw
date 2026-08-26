"use client";

import { useMemo, useState } from "react";

import { MOODS } from "@/lib/models/nps";

import { Save, Search } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useClients } from "@/lib/context/ClientsContext";

import { ImpactRecord, ImpactType } from "@/lib/models/impact";
import {
  ImpactDraft,
  useImpact,
} from "@/lib/context/ImpactContext";
import { slugify } from "@/lib/services/slug";

// Os tipos vêm do cadastro (Impacto → Tipos de impacto), não daqui.

interface Props {
  open: boolean;
  editing?: ImpactRecord;
  /** Pré-vincula a um caso, quando aberto de dentro da reclamação. */
  presetCaseId?: string;
  /** Pré-vincula a um estabelecimento, quando aberto da conta. */
  presetEstablishmentId?: string;
  onClose: () => void;
  onSave: (data: ImpactDraft | ImpactRecord) => void;
}

export default function ImpactForm({
  open,
  editing,
  presetCaseId,
  presetEstablishmentId,
  onClose,
  onSave,
}: Props) {

  const { cases } = useCases();
  const session = useSession();
  const { establishments } = useEstablishments();
  const { clients } = useClients();
  const { types } = useImpact();

  /** Só os ativos entram na escolha; os inativos seguem no histórico. */
  const tipos = types.filter((item) => item.active);

  /**
   * Os campos nascem preenchidos, e o formulário remonta a cada
   * abertura.
   *
   * Era um `useEffect` que copiava `editing` (ou o preset) para o
   * estado quando o modal abria. Funcionava, mas ao custo de uma
   * renderização a mais por abertura — e de uma janela em que o
   * formulário já estava na tela com os campos do lançamento anterior.
   * Quem abre passa `key`, e é ela que garante instância nova.
   */
  /**
   * O caso e o estabelecimento de onde o modal foi aberto.
   *
   * Abrir o lançamento a partir de uma reclamação ou de um
   * estabelecimento já preenche o que aquela tela sabe — é a diferença
   * entre registrar o impacto ali mesmo e ir procurar o caso de novo.
   */
  const preset = presetCaseId
    ? cases.find((item) => item.id === presetCaseId)
    : undefined;

  const estab = presetEstablishmentId
    ? establishments.find(
        (item) => item.id === presetEstablishmentId
      )
    : undefined;

  const [type, setType] = useState<ImpactType>(
    editing?.type ?? "Cancelamento evitado"
  );
  const [company, setCompany] = useState(
    editing?.company ??
      preset?.company ??
      estab?.name ??
      ""
  );
  const [description, setDescription] = useState(
    editing?.description ?? ""
  );
  const [amount, setAmount] = useState(
    editing ? String(Math.abs(editing.amount)) : ""
  );
  const [date, setDate] = useState(
    editing?.date ?? preset?.createdAt ?? ""
  );
  const [caseId, setCaseId] = useState(
    editing?.relatedCase ?? preset?.protocol ?? ""
  );
  const [caseSearch, setCaseSearch] = useState("");
  const [establishmentId, setEstablishmentId] = useState(
    editing?.establishmentId ??
      preset?.establishmentId ??
      presetEstablishmentId ??
      ""
  );
  const [clientSlug, setClientSlug] = useState(
    editing?.clientSlug ??
      (preset ? slugify(preset.customer) : "")
  );

  /** Texto digitado enquanto o nome ainda não casa com nenhum cliente. */
  const [clientName, setClientName] = useState("");

  /**
   * Como o cliente ficou, e se ia mesmo sair.
   *
   * O registro media só dinheiro, e dinheiro responde metade da
   * pergunta: diz se a conta ficou, não se a relação ficou. Um
   * cancelamento evitado com o cliente furioso volta em três meses, e o
   * total do mês não distingue os dois.
   */
  const [moodAfter, setMoodAfter] = useState<
    number | undefined
  >(editing?.moodAfter);

  const [wouldHaveChurned, setWouldHaveChurned] =
    useState<boolean | undefined>(
      editing?.wouldHaveChurned
    );

  // Custo entra negativo na conta; receita, positivo.
  const sinal =
    tipos.find((item) => item.name === type)
      ?.direction === "custo"
      ? -1
      : 1;

  const resultados = useMemo(() => {

    const termo = caseSearch.trim().toLowerCase();

    if (!termo) return [];

    return cases
      .filter(
        (item) =>
          item.protocol.toLowerCase().includes(termo) ||
          item.customer.toLowerCase().includes(termo) ||
          item.title.toLowerCase().includes(termo)
      )
      .slice(0, 6);

  }, [cases, caseSearch]);

  const valor = Number(
    amount.replace(/\./g, "").replace(",", ".")
  );

  const valido =
    company.trim() !== "" &&
    date !== "" &&
    Number.isFinite(valor) &&
    valor > 0;

  function salvar() {

    if (!valido) return;

    const base: ImpactDraft = {
      type,
      company: company.trim(),
      description: description.trim(),
      amount: Math.round(valor) * sinal,
      owner: session?.name ?? "Operação",
      date,
      relatedCase: caseId.trim() || undefined,
      establishmentId: establishmentId || undefined,
      clientSlug: clientSlug || undefined,
      moodAfter,
      wouldHaveChurned,
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
        editing
          ? "Editar registro de impacto"
          : "Novo registro de impacto"
      }
      description="Vincule o resultado financeiro à reclamação e ao cliente que o originou."
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
            {editing ? "Salvar" : "Registrar"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Tipo de impacto">

          <div className="grid gap-2 sm:grid-cols-2">

            {tipos.map((item) => (

              <button
                key={item.id}
                onClick={() => setType(item.name)}
                title={item.description}
                className={`rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ring-1 ring-inset ${
                  type === item.name
                    ? "bg-violet-50 text-violet-800 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >

                <span className="flex items-center justify-between gap-2">

                  {item.name}

                  <span
                    className={`text-[10px] font-semibold ${
                      item.direction === "receita"
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {item.direction === "receita"
                      ? "entrada"
                      : "custo"}
                  </span>

                </span>

                <span className="mt-1 block text-[11px] font-normal leading-snug text-zinc-500">
                  {item.description}
                </span>

              </button>

            ))}

          </div>

        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Valor (R$)"
            hint={
              sinal < 0
                ? "Será registrado como custo da operação."
                : "Será somado ao resultado da área."
            }
          >
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={inputClass}
            />
          </Field>

          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>

        </div>

        <Field
          label="Nome exibido"
          hint="Preenchido automaticamente ao vincular uma reclamação, cliente ou estabelecimento."
        >
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Nome do cliente ou estabelecimento"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Estabelecimento"
            hint="Opcional — liga este impacto a uma conta."
          >
            <select
              value={establishmentId}
              onChange={(e) => {
                const id = e.target.value;
                setEstablishmentId(id);

                const found = establishments.find(
                  (item) => item.id === id
                );

                if (found && !clientSlug) {
                  setCompany(found.name);
                }
              }}
              className={inputClass}
            >
              <option value="">Sem vínculo</option>

              {establishments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Cliente"
            hint="Opcional — digite para buscar entre todos os clientes da base."
          >

            <input
              value={
                clients.find(
                  (item) => item.slug === clientSlug
                )?.name ?? clientName
              }
              onChange={(e) => {

                const valor = e.target.value;
                setClientName(valor);

                // O datalist devolve o nome; guardamos o slug
                // correspondente para o vínculo ficar estável.
                const found = clients.find(
                  (item) => item.name === valor
                );

                setClientSlug(found?.slug ?? "");
                if (found) setCompany(found.name);
              }}
              list="clientes-impacto"
              placeholder="Buscar cliente..."
              className={inputClass}
            />

            <datalist id="clientes-impacto">
              {clients.map((item) => (
                <option key={item.slug} value={item.name} />
              ))}
            </datalist>

          </Field>

        </div>

        <Field
          label="Reclamação vinculada"
          hint={
            caseId
              ? `Vinculado ao protocolo ${caseId}.`
              : "Opcional — busque pelo protocolo, cliente ou título."
          }
        >

          <div className="relative">

            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={caseSearch}
              onChange={(e) =>
                setCaseSearch(e.target.value)
              }
              placeholder="Buscar reclamação..."
              className={`${inputClass} pl-10`}
            />

          </div>

          {resultados.length > 0 && (

            <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-zinc-200">

              {resultados.map((item) => (

                <li key={item.id}>

                  <button
                    onClick={() => {
                      setCaseId(item.protocol);
                      setCompany(item.customer);
                      setEstablishmentId(
                        item.establishmentId ?? ""
                      );
                      setClientSlug(
                        slugify(item.customer)
                      );
                      setCaseSearch("");
                    }}
                    className="w-full border-b border-zinc-100 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-violet-50/50"
                  >

                    <p className="truncate text-sm font-medium text-zinc-800">
                      {item.title}
                    </p>

                    <p className="mt-0.5 truncate font-mono text-[11px] text-violet-700">
                      {item.protocol} · {item.customer}
                    </p>

                  </button>

                </li>

              ))}

            </ul>

          )}

          {caseId && (
            <button
              onClick={() => setCaseId("")}
              className="mt-2 text-xs font-medium text-rose-600 hover:underline"
            >
              Remover vínculo
            </button>
          )}

        </Field>

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            rows={3}
            placeholder="O que gerou este impacto"
            className={textareaClass}
          />
        </Field>

        {/*
          O que o dinheiro não conta.

          Os dois campos são opcionais de propósito: quem registra um
          "módulo contratado" não negociou retenção nenhuma, e obrigar a
          responder faria inventar resposta. Vazio aqui é "não se
          aplica" ou "não perguntei", e as duas coisas são melhores do
          que um número chutado.
        */}
        <div className="sm:col-span-2">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Depois da negociação
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Opcional. O valor diz se a conta ficou; isto
            diz se a relação ficou.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">

            <div>

              <label className="text-xs font-medium text-zinc-600">
                Como o cliente ficou
              </label>

              <div className="mt-1.5 flex flex-wrap gap-1.5">

                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() =>
                      setMoodAfter(
                        moodAfter === m.value
                          ? undefined
                          : m.value
                      )
                    }
                    title={m.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors ring-1 ring-inset ${
                      moodAfter === m.value
                        ? "bg-violet-50 ring-violet-300"
                        : "ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}

              </div>

            </div>

            <div>

              <label className="text-xs font-medium text-zinc-600">
                Teria cancelado sem esta tratativa?
              </label>

              <div className="mt-1.5 flex gap-2">

                {[
                  { valor: true, rotulo: "Sim, ia sair" },
                  { valor: false, rotulo: "Não ia sair" },
                ].map((o) => (
                  <button
                    key={String(o.valor)}
                    type="button"
                    onClick={() =>
                      setWouldHaveChurned(
                        wouldHaveChurned === o.valor
                          ? undefined
                          : o.valor
                      )
                    }
                    className={`h-10 flex-1 rounded-xl px-3 text-sm font-medium transition-colors ring-1 ring-inset ${
                      wouldHaveChurned === o.valor
                        ? "bg-violet-50 text-violet-800 ring-violet-300"
                        : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {o.rotulo}
                  </button>
                ))}

              </div>

              {/*
                Sem resposta é diferente de "não ia sair".

                É o que separa retenção de cortesia no relatório: um
                desconto a quem não ia sair é custo, e o mesmo desconto a
                quem ia sair é receita preservada.
              */}
              <p className="mt-1.5 text-[11px] text-zinc-400">
                {wouldHaveChurned === undefined
                  ? "Sem resposta — não entra na conta de retenção."
                  : wouldHaveChurned
                    ? "Conta como receita preservada."
                    : "Conta como cortesia, não como retenção."}
              </p>

            </div>

          </div>

        </div>

      </div>

    </Modal>
  );
}
