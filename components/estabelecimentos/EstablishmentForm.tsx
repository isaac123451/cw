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

import { useTeams } from "@/lib/context/TeamsContext";
import { useSession } from "@/lib/context/SessionContext";
import { EstablishmentDraft } from "@/lib/context/EstablishmentsContext";

import {
  Establishment,
  EstablishmentPlan,
  EstablishmentStatus,
  ESTABLISHMENT_PLANS,
  ESTABLISHMENT_SEGMENTS,
  ESTABLISHMENT_STATUSES,
} from "@/lib/models/establishment";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const statusHint: Record<EstablishmentStatus, string> = {
  Ativo: "Contrato em dia e plataforma em uso.",
  "Em risco": "Sinalizou cancelamento ou tem reclamação aberta grave.",
  Trial: "Período de teste, ainda sem contrato assinado.",
  Cancelado: "Encerrou o contrato — mantido para histórico.",
};

interface Props {
  open: boolean;
  editing?: Establishment;
  onClose: () => void;
  onSave: (
    data: EstablishmentDraft | Establishment
  ) => void;
}

/**
 * Máscara de **CPF ou CNPJ**, decidida pelo tamanho.
 *
 * A Cardápio Web cadastra restaurante das duas formas — a maioria dos
 * pequenos entra pelo CPF do proprietário. Forçar a máscara de CNPJ em
 * onze dígitos escreveria `12.345.678/901`, e quem digitou concluiria,
 * com razão, que errou o número.
 *
 * A virada é em onze: até lá desenha CPF, dali em diante CNPJ.
 */
function mascaraDeDocumento(value: string) {

  const d = value.replace(/\D/g, "").slice(0, 14);

  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function EstablishmentForm({
  open,
  editing,
  onClose,
  onSave,
}: Props) {

  const { people } = useTeams();
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
  const [name, setName] = useState(
    editing?.name ?? ""
  );
  const [documento, setDocumento] = useState(
    editing?.document ?? ""
  );
  const [segment, setSegment] = useState(
    editing?.segment ?? ""
  );
  const [city, setCity] = useState(
    editing?.city ?? ""
  );
  const [state, setState] = useState(
    editing?.state ?? ""
  );
  const [plan, setPlan] = useState<EstablishmentPlan>(
    editing?.plan ?? "Essencial"
  );
  const [status, setStatus] =
    useState<EstablishmentStatus>(
      editing?.status ?? "Ativo"
    );
  const [mrr, setMrr] = useState(
    editing?.mrr ? String(editing.mrr) : ""
  );
  const [owner, setOwner] = useState(
    editing?.owner ?? session?.name ?? "Operação"
  );
  /** Cadastro novo começa hoje: é o que quem cadastra vai digitar. */
  const [startedAt, setStartedAt] = useState(
    editing?.startedAt ??
      new Date().toISOString().slice(0, 10)
  );
  const [phone, setPhone] = useState(
    editing?.phone ?? ""
  );
  const [email, setEmail] = useState(
    editing?.email ?? ""
  );
  const [notes, setNotes] = useState(
    editing?.notes ?? ""
  );
  const [crispUrl, setCrispUrl] = useState(
    editing?.crispUrl ?? ""
  );

  /**
   * Os dois ids do restaurante, que são números diferentes.
   *
   * `externalId` é a conta no CW Engine; `portalId` é o do link do
   * portal. A conta 27409 abre em /25681 — confundir os dois leva a
   * operação para a ficha de outro restaurante, e quem clica não tem
   * como perceber.
   */
  const [externalId, setExternalId] = useState(
    editing?.externalId ?? ""
  );

  const [portalId, setPortalId] = useState(
    editing?.portalId ?? ""
  );
  const [npsWhatsapp, setNpsWhatsapp] = useState(
    editing?.npsWhatsapp ?? ""
  );

  const responsaveis = useMemo(
    () =>
      [
        ...new Set(
          [
            session?.name,
            ...people.map((item) => item.name),
          ].filter((item): item is string => !!item)
        ),
      ].sort(),
    [people, session]
  );

  const valorMrr = Number(
    mrr.replace(/\./g, "").replace(",", ".")
  );

  const mrrValido =
    mrr.trim() === "" ||
    (Number.isFinite(valorMrr) && valorMrr >= 0);

  const valido = name.trim() !== "" && mrrValido;

  function salvar() {

    if (!valido) return;

    const base: EstablishmentDraft = {
      name: name.trim(),
      document: documento.trim() || undefined,
      segment: segment.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      plan,
      status,
      mrr: mrr.trim() === "" ? undefined : valorMrr,
      owner: owner.trim() || undefined,
      startedAt: startedAt || undefined,
      phone: phone.trim() || undefined,
      email: email.trim().toLowerCase() || undefined,
      notes: notes.trim() || undefined,
      crispUrl: crispUrl.trim() || undefined,
      externalId: externalId.trim() || undefined,

      /*
        Aceita o id puro ou a URL inteira colada.

        Quem tem a planilha copia o número; quem está com a conta aberta
        copia a barra de endereço. Recusar o segundo seria pedir para a
        pessoa editar o texto à mão antes de colar.
      */
      portalId:
        portalId
          .trim()
          .replace(
            /^https?:\/\/(www\.)?portal\.cardapioweb\.com\//i,
            ""
          )
          .replace(/^\/+|\/+$/g, "") || undefined,
      npsWhatsapp: npsWhatsapp.trim() || undefined,
    };

    onSave(
      editing
        ? {
            ...base,
            id: editing.id,
            slug: editing.slug,
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
          ? "Editar estabelecimento"
          : "Novo estabelecimento"
      }
      description="O restaurante que contrata a Cardápio Web. As pessoas ficam em Clientes."
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
            {editing ? "Salvar" : "Criar estabelecimento"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-5">

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">

          <Field label="Nome do estabelecimento">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Pizzaria do Bairro"
              className={inputClass}
            />
          </Field>

          <Field
            label="CPF ou CNPJ"
            hint="É por ele que a reclamação encontra este estabelecimento sozinha."
          >
            <input
              value={documento}
              onChange={(e) =>
                setDocumento(
                  mascaraDeDocumento(e.target.value)
                )
              }
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              inputMode="numeric"
              className={inputClass}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px]">

          <Field
            label="Segmento"
            hint="Escolha um da lista ou digite outro."
          >

            <input
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              list="segmentos-estabelecimento"
              placeholder="Ex.: Hamburgueria"
              className={inputClass}
            />

            <datalist id="segmentos-estabelecimento">
              {ESTABLISHMENT_SEGMENTS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>

          </Field>

          <Field label="Cidade">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className={inputClass}
            />
          </Field>

          <Field label="UF">
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>

              {UFS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <Field label="Plano">

          <div className="flex items-center rounded-xl border border-zinc-200 p-1">

            {ESTABLISHMENT_PLANS.map((item) => (

              <button
                key={item}
                onClick={() => setPlan(item)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  plan === item
                    ? "bg-violet-700 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item}
              </button>

            ))}

          </div>

        </Field>

        <Field
          label="Situação da conta"
          hint={statusHint[status]}
        >

          <div className="grid gap-2 sm:grid-cols-4">

            {ESTABLISHMENT_STATUSES.map((item) => (

              <button
                key={item}
                onClick={() => setStatus(item)}
                title={statusHint[item]}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ring-1 ring-inset ${
                  status === item
                    ? "bg-violet-50 text-violet-800 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {item}
              </button>

            ))}

          </div>

        </Field>

        <div className="grid gap-4 sm:grid-cols-3">

          <Field
            label="Mensalidade (R$)"
            hint={
              mrrValido
                ? "Usada no cálculo de receita em risco."
                : "Informe um número válido."
            }
          >
            <input
              value={mrr}
              onChange={(e) => setMrr(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={`${inputClass} ${
                mrrValido
                  ? ""
                  : "border-rose-300 focus:border-rose-400"
              }`}
            />
          </Field>

          <Field label="Responsável na CW">
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={inputClass}
            >
              <option value="">Sem responsável</option>

              {responsaveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cliente desde">
            <input
              type="date"
              value={startedAt}
              onChange={(e) =>
                setStartedAt(e.target.value)
              }
              className={inputClass}
            />
          </Field>

        </div>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field label="Telefone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </Field>

          <Field label="E-mail">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@estabelecimento.com.br"
              className={inputClass}
            />
          </Field>

        </div>

        {/*
          Os canais de atendimento, cada um no seu lugar.

          Ficam juntos e separados do telefone da loja porque respondem
          perguntas diferentes: "como falo com a recepção" é uma coisa,
          "onde está a conversa que este restaurante já abriu" é outra.
          Sem isto, a extensão só sabia oferecer WhatsApp — que no
          ManyChat leva a outro canal e, no NPS, ao número errado.
        */}
        <div className="rounded-2xl bg-zinc-50/70 p-4">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Canais de atendimento
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Cada link preenchido vira um botão na extensão.
            Vazio, o botão não aparece — botão que leva a
            lugar nenhum é pior do que botão ausente.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">

            <Field label="Link do Crisp">
              <input
                value={crispUrl}
                onChange={(e) =>
                  setCrispUrl(e.target.value)
                }
                placeholder="https://app.crisp.chat/website/.../inbox/..."
                className={inputClass}
              />
            </Field>

            <Field label="WhatsApp do NPS">
              <input
                value={npsWhatsapp}
                onChange={(e) =>
                  setNpsWhatsapp(e.target.value)
                }
                placeholder="(00) 00000-0000"
                className={inputClass}
              />
            </Field>

            <Field
              label="Id da conta no CW Engine"
              hint="A coluna Company ID do export."
            >
              <input
                value={externalId}
                onChange={(e) =>
                  setExternalId(e.target.value)
                }
                placeholder="27409"
                className={inputClass}
              />
            </Field>

            <Field
              label="Id do link do portal"
              hint="Abre portal.cardapioweb.com/<id>. Não é o mesmo número do CW Engine."
            >
              <input
                value={portalId}
                onChange={(e) =>
                  setPortalId(e.target.value)
                }
                placeholder="25681"
                className={inputClass}
              />
            </Field>

          </div>

          {portalId.trim() && (
            <p className="mt-3 truncate text-xs text-zinc-500">
              Vai abrir:{" "}
              <span className="font-mono text-violet-700">
                portal.cardapioweb.com/
                {portalId
                  .trim()
                  .replace(
                    /^https?:\/\/(www\.)?portal\.cardapioweb\.com\//i,
                    ""
                  )
                  .replace(/^\/+|\/+$/g, "")}
              </span>
            </p>
          )}

          {/*
            O ManyChat é o canal, mas a conversa mora no Crisp; e quem
            responde o NPS é uma pessoa, não a recepção da loja.
          */}
          <p className="mt-3 text-xs leading-relaxed text-zinc-400">
            O Crisp é onde a conversa do ManyChat fica de
            verdade. O WhatsApp do NPS é o de quem respondeu
            a pesquisa — ligar para a loja sobre uma nota
            que o dono deu em particular costuma piorar a
            relação.
          </p>

        </div>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Contexto da conta, acordos, histórico comercial..."
            className={textareaClass}
          />
        </Field>

      </div>

    </Modal>
  );
}
