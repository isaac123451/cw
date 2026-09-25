"use client";

import { useMemo, useRef, useState } from "react";

import { Download, ImagePlus, Loader2, Plus, RotateCcw, X } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import { mudarFatosDoDossie, mudarImagemDoDossie, salvarTextoDoDossie, type DossieAberto } from "@/lib/actions/dossie";
import { useToast } from "@/lib/context/ToastContext";
import { IMAGENS_POR_CASO, textoCorridoDoDossie, type FatoDoDossie, type ImagemDoDossieView } from "@/lib/models/dossieTexto";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const campo = "rounded-lg border border-zinc-200 px-2.5 text-sm outline-none focus:border-violet-400";

/** Reduz a imagem para JPEG de até 1600 px antes de mandar — um print de tela cai para algumas centenas de KB. */
async function comprimir(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("imagem"))), "image/jpeg", 0.82));
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * O dossiê em texto único (1.77).
 *
 * Um texto corrido, escrito do registro, que a pessoa lê, completa e
 * edita; os fatos que só ela sabe (com data, entram na ordem certa); e as
 * imagens — prints, fotos — com legenda. Enquanto ninguém edita, o texto
 * acompanha o registro sozinho; editou, ele fica como a pessoa deixou até
 * ela pedir o texto do registro de volta.
 */
export default function DossieEmTexto({ protocolo, aberto }: { protocolo: string; aberto: DossieAberto }) {
  const { notify } = useToast();
  const [fatos, setFatos] = useState<FatoDoDossie[]>(aberto.fatos);
  const [imagens, setImagens] = useState<ImagemDoDossieView[]>(aberto.imagens);
  const [editado, setEditado] = useState<string | null>(aberto.texto ?? null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novoFato, setNovoFato] = useState({ quando: "", texto: "" });
  const [gravandoFato, setGravandoFato] = useState(false);
  const [enviando, setEnviando] = useState(0);
  const arquivo = useRef<HTMLInputElement>(null);

  const doRegistro = useMemo(
    () => textoCorridoDoDossie(aberto.montado, { fatos, imagens, situacao: aberto.situacao }),
    [aberto, fatos, imagens]
  );
  const texto = editado ?? doRegistro;

  async function salvarTexto(valor: string | null) {
    setSalvando(true);
    const r = await salvarTextoDoDossie(protocolo, valor);
    setSalvando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "O texto não foi salvo.", detail: r.erro });
      return;
    }
    setSujo(false);
    setEditado(valor);
    notify({ tone: "success", title: valor === null ? "O texto voltou a ser o do registro." : `Texto salvo — versão ${r.versao}.` });
  }

  async function acrescentarFato() {
    setGravandoFato(true);
    const r = await mudarFatosDoDossie(protocolo, { acrescentar: { quando: novoFato.quando || undefined, texto: novoFato.texto } });
    setGravandoFato(false);
    if (!r.ok) {
      notify({ tone: "error", title: "O fato não foi acrescentado.", detail: r.erro });
      return;
    }
    setFatos(r.fatos);
    setNovoFato({ quando: "", texto: "" });
    if (editado !== null) notify({ tone: "info", title: "Fato acrescentado.", detail: "O texto está editado à mão: use \"Texto do registro\" para ele entrar no texto." });
  }

  async function tirarFato(id: string) {
    const r = await mudarFatosDoDossie(protocolo, { remover: id });
    if (!r.ok) notify({ tone: "error", title: "O fato não saiu.", detail: r.erro });
    else setFatos(r.fatos);
  }

  async function enviar(lista: File[]) {
    const imagensDaVez = lista.filter((f) => f.type.startsWith("image/")).slice(0, IMAGENS_POR_CASO - imagens.length);
    if (!imagensDaVez.length) return;
    setEnviando(imagensDaVez.length);
    for (const f of imagensDaVez) {
      try {
        const corpo = new FormData();
        corpo.set("protocolo", protocolo);
        corpo.set("arquivo", new File([await comprimir(f)], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        const resposta = await fetch("/api/dossie/imagem", { method: "POST", body: corpo });
        const r = (await resposta.json()) as { imagem?: ImagemDoDossieView; erro?: string };
        if (!resposta.ok || !r.imagem) throw new Error(r.erro ?? "O servidor não aceitou.");
        setImagens((atual) => [...atual, r.imagem!]);
      } catch (erro) {
        notify({ tone: "error", title: `${f.name} não entrou no dossiê.`, detail: erro instanceof Error ? erro.message : undefined });
      }
      setEnviando((n) => n - 1);
    }
  }

  async function legendar(id: string, legenda: string) {
    const atual = imagens.find((i) => i.id === id);
    if ((atual?.legenda ?? "") === legenda.trim()) return;
    const r = await mudarImagemDoDossie(id, { legenda });
    if (!r.ok) notify({ tone: "error", title: "A legenda não foi salva.", detail: r.erro });
    else setImagens((l) => l.map((i) => (i.id === id ? { ...i, legenda: legenda.trim() || undefined } : i)));
  }

  async function tirarImagem(id: string) {
    const r = await mudarImagemDoDossie(id, { remover: true });
    if (!r.ok) notify({ tone: "error", title: "A imagem não saiu.", detail: r.erro });
    else setImagens((l) => l.filter((i) => i.id !== id));
  }

  /** Um .html só, com o texto e as imagens dentro — abre em qualquer lugar e imprime em PDF. */
  async function baixar() {
    const figuras = await Promise.all(
      imagens.map(async (im, i) => {
        const blob = await fetch(`/api/dossie/imagem/${im.id}`).then((r) => r.blob());
        const dados = await new Promise<string>((ok) => {
          const leitor = new FileReader();
          leitor.onload = () => ok(String(leitor.result));
          leitor.readAsDataURL(blob);
        });
        return `<figure><img src="${dados}" alt=""><figcaption>${i + 1}) ${escapar(im.legenda || im.nome)}</figcaption></figure>`;
      })
    );
    const d = aberto.montado.identificacao;
    const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Dossiê ${escapar(d.protocolo)}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#18181b}h1{font-size:20px}p{margin:0 0 14px}figure{margin:18px 0}img{max-width:100%;border:1px solid #e4e4e7;border-radius:8px}figcaption{font-size:13px;color:#52525b}small{color:#71717a}</style>
<h1>Dossiê — ${escapar(d.titulo)}</h1><small>${escapar(d.protocolo)} · ${escapar(d.canal)} · ${hojeNaOperacao().split("-").reverse().join("/")}</small>
${texto.split(/\n{2,}/).map((p) => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`).join("\n")}
${figuras.join("\n")}</html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hojeNaOperacao()}_dossie_${d.protocolo}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="space-y-5"
      onPaste={(e) => {
        /* Colar um print (Ctrl+V) em qualquer lugar do dossiê já o anexa. */
        const arquivos = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
        if (arquivos.length) {
          e.preventDefault();
          void enviar(arquivos);
        }
      }}
    >
      <SurfaceCard
        title="O texto do dossiê"
        description={editado === null ? "Escrito do registro e dos fatos acrescentados — edite à vontade; o que você mudar fica." : "Editado à mão. Os fatos e imagens novos só entram se você voltar ao texto do registro."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {editado !== null && (
              <button type="button" onClick={() => void salvarTexto(null)} disabled={salvando} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
                <RotateCcw size={13} /> Texto do registro
              </button>
            )}
            <button
              type="button"
              onClick={() => void salvarTexto(texto)}
              disabled={salvando || !sujo}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {salvando && <Loader2 size={13} className="animate-spin" />} Salvar o texto
            </button>
          </div>
        }
      >
        <textarea
          id="dossie-texto"
          value={texto}
          onChange={(e) => {
            setEditado(e.target.value);
            setSujo(true);
          }}
          rows={Math.min(24, Math.max(10, texto.split("\n").length + 4))}
          className={`${campo} w-full py-3 leading-relaxed`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <BotaoCopiar texto={texto} rotulo="Copiar o texto" />
          <button type="button" onClick={() => void baixar()} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50">
            <Download size={13} /> Baixar com as imagens (.html)
          </button>
          {sujo && <span className="text-xs text-amber-700">Alterações não salvas.</span>}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SurfaceCard title="Fatos acrescentados" description="O que o registro não tem: uma ligação, uma conversa fora do sistema, um acordo. Com data, entra na ordem do texto.">
          <div className="flex flex-wrap gap-2">
            <input id="dossie-fato-quando" type="date" value={novoFato.quando} onChange={(e) => setNovoFato((f) => ({ ...f, quando: e.target.value }))} className={`${campo} h-9`} aria-label="Quando" />
            <input
              id="dossie-fato-texto"
              value={novoFato.texto}
              onChange={(e) => setNovoFato((f) => ({ ...f, texto: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && novoFato.texto.trim() && void acrescentarFato()}
              placeholder="Ex.: o cliente confirmou por telefone que a impressora voltou"
              className={`${campo} h-9 min-w-0 flex-1`}
              aria-label="O fato"
            />
            <button type="button" onClick={() => void acrescentarFato()} disabled={gravandoFato || novoFato.texto.trim().length < 3} className="flex h-9 items-center gap-1 rounded-lg bg-violet-700 px-3 text-sm font-medium text-white disabled:opacity-40">
              {gravandoFato ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Acrescentar
            </button>
          </div>
          {fatos.length > 0 && (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {fatos.map((f) => (
                <li key={f.id} className="flex items-start gap-2 py-1.5">
                  <span className="w-20 shrink-0 text-xs tabular-nums text-zinc-500">{f.quando ? f.quando.split("-").reverse().join("/") : "sem data"}</span>
                  <span className="min-w-0 flex-1 text-zinc-800">
                    {f.texto}
                    {f.autor && <span className="text-xs text-zinc-400"> · {f.autor}</span>}
                  </span>
                  <button type="button" onClick={() => void tirarFato(f.id)} title="Tirar o fato" aria-label="Tirar o fato" className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard
          title="Imagens"
          description={`Prints e fotos, com legenda. Cole com Ctrl+V ou escolha o arquivo — até ${IMAGENS_POR_CASO} por caso.`}
          action={
            <button
              type="button"
              onClick={() => arquivo.current?.click()}
              disabled={imagens.length >= IMAGENS_POR_CASO || enviando > 0}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-40"
            >
              {enviando > 0 ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {enviando > 0 ? `Enviando ${enviando}` : "Adicionar"}
            </button>
          }
        >
          <input
            ref={arquivo}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void enviar([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          {imagens.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma imagem ainda.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {imagens.map((im, i) => (
                <li key={im.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/dossie/imagem/${im.id}`} alt={im.legenda || im.nome} className="aspect-[4/3] w-full rounded-lg object-cover ring-1 ring-zinc-200" />
                  <button
                    type="button"
                    onClick={() => void tirarImagem(im.id)}
                    title="Tirar a imagem"
                    aria-label="Tirar a imagem"
                    className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-zinc-600 opacity-0 shadow-sm transition-opacity hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                  <input
                    defaultValue={im.legenda ?? ""}
                    onBlur={(e) => void legendar(im.id, e.target.value)}
                    placeholder={`${i + 1}) legenda`}
                    aria-label={`Legenda da imagem ${i + 1}`}
                    className="mt-1 h-7 w-full rounded-md border border-transparent px-1.5 text-xs text-zinc-700 outline-none hover:border-zinc-200 focus:border-violet-300"
                  />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
