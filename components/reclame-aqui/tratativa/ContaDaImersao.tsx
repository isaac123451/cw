"use client";

import { useState } from "react";

import { Link2, Loader2, Plus, Search, TriangleAlert } from "lucide-react";

import { inputClass } from "@/components/shared/Modal";

import type { Case } from "@/lib/models/case";
import { digitosDoDocumento, type Establishment } from "@/lib/models/establishment";
import { normalizar } from "@/lib/models/buscaGlobal";

import { criarEstabelecimentoDoCaso, vincularEstabelecimentoDoCaso } from "@/lib/actions/tratativa";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

interface Props {
  item: Case;
  /** A conta ficou ligada ao caso — já gravado no servidor. */
  onVinculado: (estabelecimentoId: string) => void;
}

function nomeDeBusca(item: Case) {
  const empresa = (item.company ?? "").trim();
  return empresa && !/^n[ãa]o informado$/i.test(empresa) ? empresa : item.customer && !/^n[ãa]o informado$/i.test(item.customer) ? item.customer : "";
}

/**
 * Sem conta vinculada, a imersão acha ou cria a conta ali mesmo.
 *
 * Achar: pelo nome ou pelo CPF/CNPJ, na lista que a tela já tem — sem
 * ida ao servidor a cada tecla. Criar: nome e documento vêm da
 * reclamação, os links do Crisp e do portal são opcionais; a conta nasce
 * ligada ao caso. As duas só dizem "feito" depois de o servidor gravar.
 */
export default function ContaDaImersao({ item, onVinculado }: Props) {

  const { establishments, aplicarDoServidor } = useEstablishments();

  const [termo, setTermo] = useState(() => nomeDeBusca(item) || item.document || "");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState(() => nomeDeBusca(item));
  const [documento, setDocumento] = useState(item.document ?? "");
  const [crisp, setCrisp] = useState("");
  const [portal, setPortal] = useState("");
  const [gravando, setGravando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const busca = normalizar(termo).trim();
  const digitos = termo.replace(/\D/g, "");
  const doc = digitosDoDocumento(item.document);
  const achados: (Establishment & { mesmoDocumento?: boolean })[] = (
    busca.length < 2 && digitos.length < 4
      ? []
      : establishments.filter((e) => {
          const nomeOk = busca.length >= 2 && normalizar(e.name).includes(busca);
          const docOk = digitos.length >= 4 && (e.document ?? "").replace(/\D/g, "").includes(digitos);
          return nomeOk || docOk;
        })
  )
    .map((e) => ({ ...e, mesmoDocumento: Boolean(doc) && (e.document ?? "").replace(/\D/g, "") === doc }))
    .sort((a, b) => Number(b.mesmoDocumento) - Number(a.mesmoDocumento) || a.name.localeCompare(b.name))
    .slice(0, 5);

  async function vincular(id: string) {
    setGravando(id);
    setErro(null);
    try {
      const r = await vincularEstabelecimentoDoCaso({ protocol: item.protocol, establishmentId: id });
      if (!r.ok) return setErro(r.erro);
      onVinculado(id);
    } catch {
      setErro("O vínculo não foi gravado. Tente de novo.");
    } finally {
      setGravando(null);
    }
  }

  async function criar() {
    setGravando("criar");
    setErro(null);
    try {
      const r = await criarEstabelecimentoDoCaso({ protocol: item.protocol, nome, documento, crispUrl: crisp, portalUrl: portal });
      if (!r.ok) return setErro(r.erro);
      aplicarDoServidor(r.estabelecimento);
      onVinculado(r.estabelecimento.id);
    } catch {
      setErro("A conta não foi criada. Tente de novo.");
    } finally {
      setGravando(null);
    }
  }

  const rotulo = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <div className="mt-2 rounded-xl bg-amber-50/60 p-3.5 ring-1 ring-inset ring-amber-100">
      <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-900">
        <TriangleAlert size={14} className="mt-0.5 shrink-0" />
        Nenhum estabelecimento vinculado. Ache a conta pelo nome ou pelo CPF/CNPJ — ou crie aqui.
      </p>

      <label className="mt-3 flex items-center gap-2 rounded-lg bg-white px-2.5 ring-1 ring-inset ring-zinc-200 focus-within:ring-violet-400">
        <Search size={14} className="shrink-0 text-zinc-400" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome do estabelecimento ou CPF/CNPJ"
          aria-label="Procurar o estabelecimento"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </label>

      {achados.length > 0 ? (
        <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-zinc-200">
          {achados.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-zinc-800">{e.name}</span>
                <span className="block truncate text-zinc-500">
                  {[e.document, [e.city, e.state].filter(Boolean).join("/"), e.plan].filter(Boolean).join(" · ") || "sem documento"}
                  {e.mesmoDocumento && <strong className="ml-1 text-emerald-700">· mesmo CPF/CNPJ da reclamação</strong>}
                </span>
              </span>
              <button
                type="button"
                onClick={() => vincular(e.id)}
                disabled={gravando !== null}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50 disabled:opacity-60"
              >
                {gravando === e.id ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Vincular
              </button>
            </li>
          ))}
        </ul>
      ) : (
        busca.length >= 2 && <p className="mt-2 text-xs text-zinc-500">Nenhuma conta com esse nome ou documento.</p>
      )}

      {!criando ? (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline"
        >
          <Plus size={13} /> Não está na lista — criar a conta
        </button>
      ) : (
        <div className="mt-3 space-y-2.5 rounded-lg bg-white p-3 ring-1 ring-inset ring-zinc-200">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className={rotulo}>Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className={`mt-1 h-9 ${inputClass}`} />
            </label>
            <label className="block">
              <span className={rotulo}>CPF/CNPJ</span>
              <input value={documento} onChange={(e) => setDocumento(e.target.value)} maxLength={20} className={`mt-1 h-9 ${inputClass}`} />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Link do Crisp (opcional)</span>
              <input value={crisp} onChange={(e) => setCrisp(e.target.value)} placeholder="https://app.crisp.chat/…" className={`mt-1 h-9 ${inputClass}`} />
            </label>
            <label className="block">
              <span className={rotulo}>Link do portal (opcional)</span>
              <input value={portal} onChange={(e) => setPortal(e.target.value)} placeholder="https://portal.cardapioweb.com/…" className={`mt-1 h-9 ${inputClass}`} />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setCriando(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={criar}
              disabled={gravando !== null || nome.trim().length < 2}
              className="flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {gravando === "criar" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Criar e vincular
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
    </div>
  );
}
