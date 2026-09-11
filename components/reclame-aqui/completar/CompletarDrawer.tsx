"use client";

import { useEffect, useRef, useState } from "react";

import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  UserRoundPen,
  X,
} from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  inputClass,
  PrimaryButton,
} from "@/components/shared/Modal";

import {
  Case,
  descreverFaltas,
  faltaNoCadastro,
  semNome,
  semValor,
} from "@/lib/models/case";

import { useCases } from "@/lib/context/CaseContext";
import { useToast } from "@/lib/context/ToastContext";
import { enderecoNaAreaDaEmpresa } from "@/lib/extensao/ponte";

interface Props {
  caseId: string;
  onClose: () => void;
}

/**
 * O painel rápido para completar os dados do consumidor.
 *
 * **O pedido.** "Os casos que foram adicionados não estarão com as
 * informações completas. Quero um botão tanto no Kanban e lista para
 * completar as informações abrindo uma aba rápida."
 *
 * Dois caminhos, na ordem em que valem:
 *
 * 1. **A área da empresa do Reclame Aqui**, que é o único lugar onde
 *    nome, telefone, e-mail e o CPF/CNPJ do RA Forms aparecem. A
 *    extensão lê a página e oferece "Completar no quadro"; ao voltar para
 *    esta aba, o painel relê e mostra o que entrou.
 * 2. **À mão**, para quando a extensão não está no navegador ou a página
 *    não mostra o dado. Grava por Salvar, com confirmação — e mostra o
 *    que muda antes.
 */
export default function CompletarDrawer({ caseId, onClose }: Props) {

  const { cases } = useCases();

  const data = cases.find((item) => item.id === caseId);

  useEffect(() => {

    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }

    document.addEventListener("keydown", tecla);

    return () => document.removeEventListener("keydown", tecla);

  }, [onClose]);

  if (!data) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />

      <aside
        role="dialog"
        aria-label={`Completar ${data.protocol}`}
        className="fixed right-0 top-0 z-50 flex h-screen w-[460px] max-w-full flex-col bg-white shadow-2xl"
      >
        <Conteudo data={data} onClose={onClose} />
      </aside>
    </>
  );
}

/** Os campos, como a pessoa os digita. */
interface Rascunho {
  nome: string;
  telefone: string;
  email: string;
  documento: string;
  cidade: string;
  estado: string;
}

function rascunhoDe(data: Case): Rascunho {
  return {
    nome: semNome(data.customer) ? "" : data.customer,
    telefone: semValor(data.phone) ? "" : (data.phone ?? ""),
    email: semValor(data.email) ? "" : (data.email ?? ""),
    documento: data.document ?? "",
    cidade: data.city ?? "",
    estado: data.state ?? "",
  };
}

const ROTULOS: Record<keyof Rascunho, string> = {
  nome: "Nome",
  telefone: "Telefone",
  email: "E-mail",
  documento: "CPF/CNPJ",
  cidade: "Cidade",
  estado: "UF",
};

/** O que o formulário recusa antes de gravar — o dado errado é pior que o vazio. */
function problemas(r: Rascunho) {

  const lista: string[] = [];

  const digitosDoc = r.documento.replace(/\D/g, "");
  const digitosFone = r.telefone.replace(/\D/g, "");

  if (r.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
    lista.push("O e-mail não parece um endereço.");
  }

  if (digitosDoc && digitosDoc.length !== 11 && digitosDoc.length !== 14) {
    lista.push("CPF tem 11 dígitos e CNPJ, 14.");
  }

  if (digitosFone && (digitosFone.length < 10 || digitosFone.length > 13)) {
    lista.push("O telefone precisa do DDD — 10 ou 11 dígitos.");
  }

  if (r.estado.trim() && !/^[A-Za-z]{2}$/.test(r.estado.trim())) {
    lista.push("A UF tem duas letras.");
  }

  return lista;
}

function Conteudo({ data, onClose }: { data: Case; onClose: () => void }) {

  const { updateCase, recarregar } = useCases();
  const { notify } = useToast();

  const faltas = faltaNoCadastro(data);

  const original = rascunhoDe(data);

  /*
    Só o que a pessoa editou fica guardado; o resto segue o quadro.

    Guardar o formulário inteiro na abertura congelaria os valores: se a
    extensão completasse o telefone com o painel aberto, o campo seguiria
    vazio aqui — e um Salvar depois disso apagaria o telefone que acabou
    de entrar.
  */
  const [editados, setEditados] = useState<Partial<Rascunho>>({});

  const rascunho: Rascunho = { ...original, ...editados };

  const editar = (campo: keyof Rascunho, valor: string) =>
    setEditados({ ...editados, [campo]: valor });

  const [confirmando, setConfirmando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [conferindo, setConferindo] = useState(false);

  /** Abriu o Reclame Aqui: ao voltar para esta aba, relê. */
  const abriuOPortal = useRef(false);

  const endereco = enderecoNaAreaDaEmpresa(data.protocol);

  const mudancas = (Object.keys(editados) as (keyof Rascunho)[]).filter(
    (campo) => rascunho[campo].trim() !== original[campo].trim()
  );

  const erros = problemas(rascunho);

  async function conferir() {
    setConferindo(true);
    await recarregar();
    setConferindo(false);
  }

  /*
    Voltar do Reclame Aqui relê as reclamações.

    A extensão grava pelo servidor, e esta aba não tem como saber. O foco
    de volta na janela é o sinal de que a pessoa terminou lá.
  */
  useEffect(() => {

    function voltou() {
      if (!abriuOPortal.current) return;
      abriuOPortal.current = false;
      recarregar();
    }

    window.addEventListener("focus", voltou);

    return () => window.removeEventListener("focus", voltou);

  }, [recarregar]);

  async function gravar() {

    setGravando(true);

    /*
      Só o campo editado muda; o resto vai como o quadro tem.

      Um telefone mascarado da importação aparece vazio no formulário —
      mandar o formulário inteiro o apagaria sem ninguém ter tocado nele.
    */
    const valor = (
      campo: keyof Rascunho,
      atual: string | undefined,
      ajustar: (texto: string) => string = (texto) => texto
    ) =>
      campo in editados
        ? ajustar(rascunho[campo].trim()) || undefined
        : atual;

    const nome = valor("nome", undefined);

    const resultado = await updateCase({
      ...data,
      customer: nome || data.customer,
      company: nome && semNome(data.company) ? nome : data.company,
      phone: valor("telefone", data.phone),
      email: valor("email", data.email),
      document: valor("documento", data.document, (t) => t.replace(/\D/g, "")),
      city: valor("cidade", data.city),
      state: valor("estado", data.state, (t) => t.toUpperCase()),
    });

    setGravando(false);
    setConfirmando(false);

    if (resultado.ok) {
      setEditados({});
      notify({
        tone: "success",
        title: `Dados do consumidor gravados em ${data.protocol}.`,
      });
    } else {
      notify({
        tone: "error",
        title: "Não foi possível gravar.",
        detail: resultado.erro,
      });
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200/80 px-6 py-4">

        <div className="min-w-0">

          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <UserRoundPen size={13} />
            Completar dados do consumidor
          </p>

          <p className="mt-1 font-mono text-xs text-violet-700">
            {data.protocol}
          </p>

          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-zinc-800">
            {data.title}
          </p>

        </div>

        <button
          onClick={onClose}
          title="Fechar (Esc)"
          className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X size={17} />
        </button>

      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">

        {faltas.length > 0 ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
            <strong className="font-semibold">Falta {descreverFaltas(faltas)}.</strong>{" "}
            {/*
              O motivo muda conforme a falta. Sem nome é a que o vigia
              trouxe da página pública; só sem documento é, quase sempre,
              reclamação antiga que nunca teve o RA Forms lido.
            */}
            {faltas.includes("nome")
              ? "Esta reclamação entrou pela página pública do Reclame Aqui, que não mostra os dados do consumidor."
              : faltas.length === 1 && faltas[0] === "documento"
                ? "O CPF/CNPJ é o que liga a reclamação ao estabelecimento; ele aparece no RA Forms, na área da empresa."
                : "Esses dados só aparecem na área da empresa do Reclame Aqui."}
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-100">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong className="font-semibold">Completa.</strong> Nome,
              contato e CPF/CNPJ estão no quadro.
            </span>
          </p>
        )}

        {/* 1. Pela área da empresa */}
        <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">

          <p className="text-sm font-semibold text-zinc-800">
            Pela área da empresa do Reclame Aqui
          </p>

          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            É o único lugar onde nome, telefone, e-mail e o CPF/CNPJ
            aparecem. Com a extensão, a página mostra o que ela leu e o
            botão <strong>Completar no quadro</strong> — confira e clique.
            Ao voltar para esta aba, os dados aparecem aqui.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">

            {endereco ? (
              <a
                href={endereco}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  abriuOPortal.current = true;
                }}
                className="flex items-center gap-2 rounded-xl bg-violet-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800"
              >
                <ExternalLink size={15} />
                Abrir no Reclame Aqui
              </a>
            ) : (
              <span className="text-xs text-zinc-500">
                Esta reclamação não tem o código do portal.
              </span>
            )}

            <button
              type="button"
              onClick={conferir}
              disabled={conferindo}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={conferindo ? "animate-spin" : ""} />
              Conferir agora
            </button>

          </div>

        </section>

        {/* 2. À mão */}
        <section>

          <p className="text-sm font-semibold text-zinc-800">
            Ou preencha aqui
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Copiando da área da empresa, por exemplo. Nada é gravado sem
            você clicar em Salvar e confirmar.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">

            {(["nome", "telefone", "email", "documento"] as const).map((campo) => (
              <Field
                key={campo}
                label={ROTULOS[campo]}
                className={campo === "nome" ? "sm:col-span-2" : ""}
              >
                <input
                  value={rascunho[campo]}
                  onChange={(e) => editar(campo, e.target.value)}
                  placeholder={
                    campo === "nome"
                      ? "Como aparece no Reclame Aqui"
                      : campo === "documento"
                        ? "Só números ou com pontuação"
                        : ""
                  }
                  className={inputClass}
                />
              </Field>
            ))}

            <Field label={ROTULOS.cidade}>
              <input
                value={rascunho.cidade}
                onChange={(e) => editar("cidade", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label={ROTULOS.estado}>
              <input
                value={rascunho.estado}
                maxLength={2}
                onChange={(e) => editar("estado", e.target.value)}
                className={`${inputClass} uppercase`}
              />
            </Field>

          </div>

          {erros.length > 0 && mudancas.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-rose-700">
              {erros.map((erro) => (
                <li key={erro}>{erro}</li>
              ))}
            </ul>
          )}

        </section>

      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">

        <span className="text-xs text-zinc-500">
          {mudancas.length > 0
            ? `${mudancas.length} campo(s) alterado(s), ainda não salvo(s).`
            : ""}
        </span>

        <PrimaryButton
          onClick={() => setConfirmando(true)}
          disabled={mudancas.length === 0 || erros.length > 0 || gravando}
        >
          <Save size={15} />
          Salvar
        </PrimaryButton>

      </div>

      <Modal
        open={confirmando}
        title="Gravar os dados do consumidor?"
        description={`Em ${data.protocol}. O que muda:`}
        onClose={() => setConfirmando(false)}
        footer={
          <>
            <GhostButton onClick={() => setConfirmando(false)}>
              Cancelar
            </GhostButton>
            <PrimaryButton onClick={gravar} disabled={gravando}>
              {gravando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {gravando ? "Gravando…" : "Gravar"}
            </PrimaryButton>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {mudancas.map((campo) => (
            <div key={campo} className="contents">
              <dt className="text-zinc-500">{ROTULOS[campo]}</dt>
              <dd className="min-w-0 break-words text-zinc-800">
                <span className="text-zinc-400 line-through">
                  {original[campo] || "vazio"}
                </span>{" "}
                → <strong className="font-semibold">{rascunho[campo].trim() || "vazio"}</strong>
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}
