"use client";

import { useState } from "react";

import { FileUp, Loader2, ShieldCheck } from "lucide-react";

import Modal from "@/components/shared/Modal";
import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

import Baloes from "@/components/conversas/Baloes";

import { useToast } from "@/lib/context/ToastContext";

import { guardarConversa, previaDaGravacao } from "@/lib/actions/conversas";
import {
  lerExportDoWhatsApp,
  mensagensDoArquivo,
  omitirDadosBancarios,
  palpiteDoNosso,
  type LeituraDoArquivo,
} from "@/lib/models/conversa";
import { textoDoZip } from "@/lib/models/zipDoWhatsApp";

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

type Candidata = { id: string; contatoNome: string; telefone?: string; mensagens: number; novas: number };

/**
 * Guardar a conversa pelo arquivo que o WhatsApp exporta.
 *
 * No WhatsApp: abrir a conversa → ⋮ → Mais → Exportar conversa (com ou
 * sem mídia). O .txt ou o .zip é lido **aqui no navegador** — o .zip
 * com fotos não sobe para lugar nenhum; só o texto das mensagens vai
 * para o servidor, e só quando a pessoa clica em Guardar. A prévia
 * mostra de quem é, qual é o nosso lado (dá para trocar), as últimas
 * mensagens e se o arquivo se junta a uma conversa que já existe —
 * guardar de novo acrescenta só o que é novo.
 */
export default function ImportarConversa({ onClose, onGuardada }: { onClose: () => void; onGuardada: (id: string) => void }) {
  const { notify } = useToast();

  const [lendo, setLendo] = useState(false);
  const [leitura, setLeitura] = useState<LeituraDoArquivo | null>(null);
  const [nomeDoArquivo, setNomeDoArquivo] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nosNome, setNosNome] = useState<string>("");
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [destino, setDestino] = useState<"nova" | string>("nova");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLendo(true);
    setLeitura(null);
    setCandidatas(null);
    try {
      let texto: string;
      let nome = arquivo.name;
      if (/\.zip$/i.test(arquivo.name)) {
        const r = await textoDoZip(await arquivo.arrayBuffer());
        texto = r.texto;
        /* O nome útil é o do .zip ("Conversa do WhatsApp com Fulano.zip"); dentro costuma ser "_chat.txt". */
        nome = /^_chat\.txt$/i.test(r.nome) ? arquivo.name : r.nome;
      } else {
        texto = await arquivo.text();
      }
      const lido = lerExportDoWhatsApp(texto, nome);
      if (lido.mensagens.length === 0) {
        setErro("Não achei mensagens neste arquivo. Ele é o .txt (ou .zip) do \"Exportar conversa\" do WhatsApp?");
        return;
      }
      const nos = palpiteDoNosso(lido);
      const nomeDoContato = lido.contato ?? lido.autores.find((a) => a.nome !== nos)?.nome ?? "";
      setLeitura(lido);
      setNomeDoArquivo(arquivo.name);
      setNosNome(nos ?? "");
      setContato(nomeDoContato);
      /* O contato fora da agenda aparece como o próprio número ("+55 27 99999-6862"). */
      setTelefone(/^\+?[\d\s()-]{8,}$/.test(nomeDoContato) ? nomeDoContato.replace(/\D/g, "") : "");
      await buscarCandidatas(lido, nos ?? "", nomeDoContato, "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler este arquivo.");
    } finally {
      setLendo(false);
    }
  }

  async function buscarCandidatas(lido: LeituraDoArquivo, nos: string, nomeDoContato: string, fone: string) {
    const r = await previaDaGravacao({ contatoNome: nomeDoContato, telefone: fone || null, mensagens: mensagensDoArquivo(lido, nos || null) }).catch(() => null);
    if (r && r.ok) {
      setCandidatas(r.candidatas);
      setDestino(r.candidatas[0]?.id ?? "nova");
    } else setCandidatas([]);
  }

  const mensagens = leitura ? mensagensDoArquivo(leitura, nosNome || null) : [];
  const omitidos = mensagens.reduce((n, m) => n + omitirDadosBancarios(m.texto).omitidos, 0);
  const primeira = leitura?.mensagens[0]?.em;
  const ultima = leitura?.mensagens[leitura.mensagens.length - 1]?.em;
  const destinoEscolhido = candidatas?.find((c) => c.id === destino);

  async function guardar() {
    if (!leitura) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await guardarConversa({ destino, contatoNome: contato, telefone: telefone || null, nosNome: nosNome || null, mensagens });
      if (!r.ok) return setErro(r.erro);
      notify({
        tone: "success",
        title: r.novas > 0 ? `${r.novas} ${r.novas === 1 ? "mensagem guardada" : "mensagens guardadas"}` : "Nada novo para guardar",
        detail: [r.repetidas && `${r.repetidas} já estavam na conversa`, r.omitidos && `${r.omitidos} ${r.omitidos === 1 ? "dado bancário omitido" : "dados bancários omitidos"}`].filter(Boolean).join(" · ") || undefined,
      });
      onGuardada(r.id);
    } catch {
      setErro("Não foi possível falar com o servidor. Nada foi guardado — tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      size="wide"
      title="Guardar conversa do WhatsApp"
      description="Pelo arquivo do “Exportar conversa” (.txt ou .zip). O arquivo é lido aqui no navegador; as fotos do .zip não sobem."
      onClose={onClose}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {leitura
              ? destinoEscolhido
                ? `${destinoEscolhido.novas} de ${mensagens.length} mensagens são novas nesta conversa`
                : `${mensagens.length} mensagens numa conversa nova`
              : "Escolha o arquivo exportado."}
          </p>
          <div className="flex gap-2">
            <RodapeDeSalvar
              salvando={salvando}
              desabilitado={!leitura || (!contato.trim() && !telefone) || (destinoEscolhido ? destinoEscolhido.novas === 0 : false)}
              rotulo="Guardar"
              onSalvar={guardar}
              onCancelar={onClose}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 px-4 py-6 text-center transition-colors hover:bg-violet-50">
          {lendo ? <Loader2 size={20} className="animate-spin text-violet-600" /> : <FileUp size={20} className="text-violet-600" />}
          <span className="text-sm font-medium text-violet-900">{nomeDoArquivo || "Escolher o arquivo (.txt ou .zip)"}</span>
          <span className="text-xs text-zinc-500">WhatsApp → abrir a conversa → ⋮ → Mais → Exportar conversa</span>
          <input type="file" accept=".txt,.zip,text/plain,application/zip" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
        </label>

        {leitura && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Mudou o contato, o telefone ou o nosso lado: a prévia procura de novo onde juntar. */}
              <label className="block space-y-1">
                <Rotulo>Contato</Rotulo>
                <input value={contato} onChange={(e) => setContato(e.target.value)} onBlur={() => buscarCandidatas(leitura, nosNome, contato, telefone)} className={campo} />
              </label>
              <label className="block space-y-1">
                <Rotulo>Telefone (opcional)</Rotulo>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  onBlur={() => buscarCandidatas(leitura, nosNome, contato, telefone)}
                  inputMode="tel"
                  placeholder="Só se o arquivo não trouxer"
                  className={campo}
                />
              </label>
              <label className="block space-y-1">
                <Rotulo>Qual é o nosso lado</Rotulo>
                <select
                  value={nosNome}
                  onChange={(e) => {
                    setNosNome(e.target.value);
                    buscarCandidatas(leitura, e.target.value, contato, telefone);
                  }}
                  className={campo}
                >
                  <option value="">Ninguém (tudo é do cliente)</option>
                  {leitura.autores.map((a) => (
                    <option key={a.nome} value={a.nome}>
                      {a.nome} ({a.mensagens})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs text-zinc-500">
              {leitura.mensagens.length} mensagens
              {primeira && ultima ? `, de ${new Date(primeira).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} a ${new Date(ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}
              {leitura.ignoradas ? ` · ${leitura.ignoradas} linha(s) sem data no começo foram ignoradas` : ""}
            </p>

            {omitidos > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ring-1 ring-inset ring-amber-100">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                {omitidos} {omitidos === 1 ? "trecho parece dado bancário ou de cartão e será omitido" : "trechos parecem dados bancários ou de cartão e serão omitidos"} ao guardar — o original continua só no WhatsApp.
              </p>
            )}

            <div>
              <Rotulo>Onde guardar</Rotulo>
              <div className="mt-1.5 space-y-1.5">
                {(candidatas ?? []).map((c) => (
                  <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-inset ${destino === c.id ? "bg-violet-50 ring-violet-200" : "ring-zinc-200"}`}>
                    <input type="radio" name="destino" checked={destino === c.id} onChange={() => setDestino(c.id)} className="accent-violet-700" />
                    <span className="min-w-0 flex-1 text-sm">
                      Juntar à conversa de <strong>{c.contatoNome || `+${c.telefone}`}</strong>
                      <span className="block text-xs text-zinc-500">
                        {c.mensagens} já guardadas · {c.novas === 0 ? "nada novo neste arquivo" : `${c.novas} ${c.novas === 1 ? "nova" : "novas"}`}
                      </span>
                    </span>
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-inset ${destino === "nova" ? "bg-violet-50 ring-violet-200" : "ring-zinc-200"}`}>
                  <input type="radio" name="destino" checked={destino === "nova"} onChange={() => setDestino("nova")} className="accent-violet-700" />
                  <span className="text-sm">Conversa nova</span>
                </label>
              </div>
            </div>

            <div>
              <Rotulo>As últimas mensagens</Rotulo>
              <div className="mt-1.5 max-h-72 overflow-y-auto rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-100">
                <Baloes mensagens={mensagens.slice(-12).map((m, i) => ({ id: String(i), de: m.de, autor: m.autor, texto: omitirDadosBancarios(m.texto).texto, em: m.em }))} />
              </div>
            </div>
          </>
        )}

        <ErroDoServidor erro={erro} />
      </div>
    </Modal>
  );
}
