"use client";

import { useMemo, useState } from "react";

import { Plus, Save, X } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { MacroDraft } from "@/lib/context/MacrosContext";

import {
  Macro,
  MACRO_CHANNELS,
  MacroChannel,
  MACRO_VARS,
} from "@/lib/models/macro";

interface Props {
  open: boolean;
  editing?: Macro;
  onClose: () => void;
  onSave: (data: MacroDraft | Macro) => void;
}

export default function MacroForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const { cases } = useCases();
  const session = useSession();

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
  const [title, setTitle] = useState(
    editing?.title ?? ""
  );
  const [body, setBody] = useState(
    editing?.body ?? ""
  );
  const [owner, setOwner] = useState(
    editing?.owner ?? session?.name ?? "Operação"
  );
  const [tags, setTags] = useState<string[]>(
    editing?.tags ?? []
  );
  const [tagDraft, setTagDraft] = useState("");

  /**
   * As categorias saem dos casos que existem — não de uma lista fixa.
   *
   * Fica **antes** do estado da categoria porque é dela que sai o valor
   * inicial de uma macro nova: a primeira categoria em uso é um palpite
   * melhor do que "Atendimento" escrito no código.
   */
  const categorias = useMemo(
    () =>
      [
        ...new Set(cases.map((item) => item.category)),
      ].sort(),
    [cases]
  );

  const [category, setCategory] = useState(
    editing?.category ??
      categorias[0] ??
      "Atendimento"
  );

  /**
   * Onde o texto vai ser usado.
   *
   * Não é etiqueta: são formatos diferentes. O WhatsApp entende
   * `*negrito*` e emoji; a resposta pública do portal mostra os
   * asteriscos crus, na frente do consumidor.
   */
  const [channel, setChannel] = useState<MacroChannel>(
    editing?.channel ?? "Reclame Aqui"
  );

  /** Insere a variável no fim do texto — o cursor não é rastreado. */
  function inserirVariavel(token: string) {
    setBody((prev) =>
      prev.endsWith(" ") || prev === ""
        ? `${prev}${token}`
        : `${prev} ${token}`
    );
  }

  function adicionarTag() {

    const valor = tagDraft.trim();

    if (!valor || tags.includes(valor)) {
      setTagDraft("");
      return;
    }

    setTags((prev) => [...prev, valor]);
    setTagDraft("");
  }

  const valido =
    title.trim() !== "" && body.trim() !== "";

  function salvar() {

    if (!valido) return;

    const base: MacroDraft = {
      title: title.trim(),
      body: body.trim(),
      category,
      channel,
      owner: owner.trim() || "Operação",
      tags,
    };

    onSave(
      editing
        ? {
            ...base,
            id: editing.id,
            uses: editing.uses,
            updatedAt: editing.updatedAt,
          }
        : base
    );
  }

  return (
    <Modal
      open={open}
      size="wide"
      title={
        editing
          ? "Editar resposta pronta"
          : "Nova resposta pronta"
      }
      description="Texto aprovado que o time insere na resposta pública do Reclame Aqui."
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
            {editing ? "Salvar" : "Criar resposta"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <Field label="Título">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Cobrança indevida — abertura da tratativa"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">

          <Field
            label="Onde é usado"
            hint="O seletor da resposta pública só oferece os do Reclame Aqui."
          >
            <select
              value={channel}
              onChange={(e) =>
                setChannel(
                  e.target.value as MacroChannel
                )
              }
              className={inputClass}
            >
              {MACRO_CHANNELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Categoria"
            hint="Onde esta resposta aparece primeiro na busca."
          >
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value)
              }
              className={inputClass}
            >
              {categorias.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Aprovado por"
            hint="Quem responde pelo texto."
          >
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={inputClass}
            />
          </Field>

        </div>

        <Field
          label="Texto da resposta"
          hint="As variáveis abaixo são trocadas pelos dados do caso na hora de inserir."
        >

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            placeholder="Olá, {{cliente}}! Sou {{responsavel}}, da Cardápio Web..."
            className={textareaClass}
          />

          <div className="mt-2 flex flex-wrap gap-1.5">

            {MACRO_VARS.map((item) => (

              <button
                key={item.token}
                onClick={() =>
                  inserirVariavel(item.token)
                }
                title={`Inserir ${item.label}`}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-600 transition-colors hover:bg-violet-100 hover:text-violet-800"
              >
                <Plus size={10} />
                {item.token}
              </button>

            ))}

          </div>

        </Field>

        <Field label="Etiquetas">

          <div className="flex gap-2">

            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarTag();
                }
              }}
              placeholder="Digite e pressione Enter"
              className={inputClass}
            />

            <button
              onClick={adicionarTag}
              className="shrink-0 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Adicionar
            </button>

          </div>

          {tags.length > 0 && (

            <div className="mt-2 flex flex-wrap gap-1.5">

              {tags.map((tag) => (

                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600"
                >
                  {tag}

                  <button
                    onClick={() =>
                      setTags((prev) =>
                        prev.filter((item) => item !== tag)
                      )
                    }
                    className="text-zinc-400 transition-colors hover:text-rose-600"
                  >
                    <X size={11} />
                  </button>

                </span>

              ))}

            </div>

          )}

        </Field>

      </div>

    </Modal>
  );
}
