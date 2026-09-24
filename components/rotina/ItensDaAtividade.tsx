"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";

import { Check, CircleSlash, Loader2, Undo2 } from "lucide-react";

import IconeDaFrente from "@/components/shared/IconeDaFrente";
import JanelaDoLink from "@/components/janelas/JanelaDoLink";
import LinksDoRa from "@/components/shared/LinksDoRa";

import { useToast } from "@/lib/context/ToastContext";
import { usePassosParaFechar } from "@/components/rotina/usePassosParaFechar";

import type { DuracaoDaMarca } from "@/lib/actions/rotina";
import { frente, type FrenteId } from "@/lib/models/frentes";
import { chaveDoItem, diaCurtoDaMarca, voltaDoAdiado, type Contagem, type ItemDaRotina, type MarcaDeItem, type TipoDeMarcaDeItem } from "@/lib/models/meuDia";
import OpcoesDeAdiar from "@/components/rotina/OpcoesDeAdiar";
import type { ChaveDaRotina } from "@/lib/models/rotina";
import { resumoDosPassos } from "@/lib/models/guiaParaFechar";
import { janelaDoEndereco } from "@/lib/models/janelas";

type Resultado = { ok: true } | { ok: false; erro: string };

interface Props {
  chave: ChaveDaRotina;
  /** O nome da atividade, para o aviso dizer de onde o item saiu. */
  atividade: string;
  contagem: Contagem;
  marcarItens: (itens: { chave: string; item: string; titulo: string }[], tipo: TipoDeMarcaDeItem, duracao?: DuracaoDaMarca, volta?: string) => Promise<Resultado>;
  desfazerMarcas: (ids: string[]) => Promise<Resultado>;
}

/** Quantos de cada frente aparecem antes do "mostrar mais". */
const POR_VEZ = 25;

const DURACOES: { id: DuracaoDaMarca; rotulo: string; dica: string }[] = [
  { id: "hoje", rotulo: "Só hoje", dica: "Volta amanhã, se ainda for trabalho desta atividade." },
  { id: "semana", rotulo: "Por 7 dias", dica: "Some da atividade durante uma semana." },
  { id: "sempre", rotulo: "Até eu devolver", dica: "Some desta atividade até você devolver, aqui embaixo." },
];

const diaCurto = diaCurtoDaMarca;

function rotuloDaMarca(m: MarcaDeItem) {
  if (m.tipo === "feito") return "feito hoje";
  if (m.tipo === "adiado") return `volta em ${diaCurto(voltaDoAdiado(m) ?? m.dia)}`;
  if (m.ate === null) return "tirado até devolver";
  return m.ate === m.dia ? "tirado hoje" : `tirado até ${diaCurto(m.ate)}`;
}

/**
 * Os itens de uma atividade do Meu dia, na ordem do documento.
 *
 * O Isaac: "tem situações que o caso não some, preciso de uma forma para
 * excluir ou marcar o checklist". A contagem sai dos dados, e o dado às
 * vezes não acompanha o que foi feito. Cada item agora se marca como
 * feito hoje ou se tira da atividade (hoje, por 7 dias ou até devolver)
 * — gravado no banco, e sempre com o caminho de volta logo abaixo.
 */
export default function ItensDaAtividade({ chave, atividade, contagem, marcarItens, desfazerMarcas }: Props) {

  const { notify } = useToast();
  const passosDe = usePassosParaFechar();

  const [gravando, setGravando] = useState<string | null>(null);
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [limite, setLimite] = useState<Record<string, number>>({});
  const [verTirados, setVerTirados] = useState(false);

  /* Os grupos por frente, na ordem que a contagem já deu (a do documento). */
  const grupos: { frente?: FrenteId; itens: ItemDaRotina[] }[] = [];
  for (const i of contagem.itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.frente === i.frente) ultimo.itens.push(i);
    else grupos.push({ frente: i.frente, itens: [i] });
  }

  async function marcar(i: ItemDaRotina, tipo: TipoDeMarcaDeItem, duracao: DuracaoDaMarca = "hoje", volta?: string) {
    const k = chaveDoItem(i, chave);
    setMenuDe(null);
    setGravando(k);
    try {
      const r = await marcarItens([{ chave, item: k, titulo: i.titulo }], tipo, duracao, volta);
      if (!r.ok) {
        notify({ tone: "error", title: "O item não saiu da lista.", detail: r.erro });
        return;
      }
      notify({
        tone: "success",
        title: tipo === "feito" ? "Marcado como feito hoje." : tipo === "adiado" ? `Adiado para ${diaCurto(volta!)}.` : `Tirado de "${atividade}".`,
        detail: `${i.titulo} — ${
          tipo === "feito"
            ? "volta amanhã só se ainda for trabalho desta atividade."
            : tipo === "adiado"
              ? "volta sozinho nesse dia, se ainda for trabalho; dá para devolver antes, no fim desta lista."
            : duracao === "hoje"
              ? "só por hoje."
              : duracao === "semana"
                ? "por 7 dias."
                : "até você devolver, no fim desta lista."
        }`,
      });
    } catch {
      notify({ tone: "error", title: "O item não saiu da lista.", detail: "Tente de novo em instantes." });
    } finally {
      setGravando(null);
    }
  }

  async function devolver(marcas: MarcaDeItem[]) {
    setGravando(marcas.length === 1 ? marcas[0].id : "todos");
    try {
      const r = await desfazerMarcas(marcas.map((m) => m.id));
      if (!r.ok) {
        notify({ tone: "error", title: "Não deu para devolver.", detail: r.erro });
        return;
      }
      notify({
        tone: "success",
        title: marcas.length === 1 ? "Devolvido à atividade." : `${marcas.length} itens devolvidos à atividade.`,
        detail: marcas.length === 1 ? marcas[0].titulo : atividade,
      });
    } catch {
      notify({ tone: "error", title: "Não deu para devolver.", detail: "Tente de novo em instantes." });
    } finally {
      setGravando(null);
    }
  }

  return (
    <div className="border-t border-zinc-100">

      {contagem.itens.length === 0 ? (
        <p className="px-3 py-3 text-xs text-zinc-500">Nenhum item nesta atividade agora.</p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto overscroll-contain px-3 py-2">
          {grupos.map((g) => {
            const k = g.frente ?? "geral";
            const ate = limite[k] ?? POR_VEZ;
            const fora = g.itens.filter((i) => i.atrasado).length;
            return (
              <section key={k} className="py-1">
                {grupos.length > 1 && g.frente && (
                  <p className="flex items-center gap-1.5 pb-1 pt-1.5 text-[11px] font-semibold text-zinc-500">
                    <IconeDaFrente frente={g.frente} size={11} />
                    {frente(g.frente).nome}
                    <span className="font-normal tabular-nums text-zinc-400">
                      {g.itens.length}
                      {fora ? ` · ${fora} fora do prazo` : ""}
                    </span>
                  </p>
                )}
                <ul className="space-y-0.5">
                  {g.itens.slice(0, ate).map((i) => (
                    <Linha
                      key={chaveDoItem(i, chave)}
                      item={i}
                      falta={(() => {
                        const pedido = janelaDoEndereco(i.href, i.titulo);
                        const passos = pedido ? passosDe(pedido.frente, pedido.ref) : null;
                        return passos ? resumoDosPassos(passos).atual?.titulo ?? null : null;
                      })()}
                      gravando={gravando === chaveDoItem(i, chave)}
                      bloqueado={gravando !== null}
                      menuAberto={menuDe === chaveDoItem(i, chave)}
                      onMenu={(aberto) => setMenuDe(aberto ? chaveDoItem(i, chave) : null)}
                      onFeito={() => marcar(i, "feito")}
                      onTirar={(d) => marcar(i, "dispensado", d)}
                      onAdiar={(volta) => marcar(i, "adiado", "hoje", volta)}
                    />
                  ))}
                </ul>
                {g.itens.length > ate && (
                  <button
                    type="button"
                    onClick={() => setLimite((l) => ({ ...l, [k]: ate + POR_VEZ }))}
                    className="mt-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
                  >
                    Mostrar mais {Math.min(POR_VEZ, g.itens.length - ate)} de {g.itens.length - ate}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {contagem.tirados.length > 0 && (
        <div className="border-t border-dashed border-zinc-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVerTirados((v) => !v)}
              aria-expanded={verTirados}
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
            >
              {verTirados ? "Esconder" : "Ver"} os {contagem.tirados.length} tirado(s) desta atividade
            </button>
            {verTirados && contagem.tirados.length > 1 && (
              <button
                type="button"
                onClick={() => devolver(contagem.tirados)}
                disabled={gravando !== null}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                {gravando === "todos" ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />} Devolver todos
              </button>
            )}
          </div>
          {verTirados && (
            <ul className="mt-1 space-y-0.5">
              {contagem.tirados.map((m) => (
                <li key={m.id} className="flex min-w-0 items-center gap-2 text-xs">
                  <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">{rotuloDaMarca(m)}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-500">{m.titulo}</span>
                  <button
                    type="button"
                    onClick={() => devolver([m])}
                    disabled={gravando !== null}
                    className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                  >
                    {gravando === m.id ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />} Devolver
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({
  item,
  falta,
  gravando,
  bloqueado,
  menuAberto,
  onMenu,
  onFeito,
  onTirar,
  onAdiar,
}: {
  item: ItemDaRotina;
  falta: string | null;
  gravando: boolean;
  bloqueado: boolean;
  menuAberto: boolean;
  onMenu: (aberto: boolean) => void;
  onFeito: () => void;
  onTirar: (d: DuracaoDaMarca) => void;
  onAdiar: (volta: string) => void;
}) {

  const raiz = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    function fora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) onMenu(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onMenu(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [menuAberto, onMenu]);

  return (
    <li ref={raiz} className="group relative flex min-w-0 items-start gap-2 rounded-lg px-1 py-1 text-xs hover:bg-zinc-50">
      {item.frente ? <IconeDaFrente frente={item.frente} size={12} className="mt-0.5" /> : <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />}

      <Link href={item.href} className="min-w-0 flex-1">
        <span className={`block truncate font-medium hover:underline ${item.atrasado ? "text-rose-700" : "text-zinc-700"}`}>{item.titulo}</span>
        {item.detalhe && <span className="block truncate text-[11px] text-zinc-500">{item.detalhe}</span>}
        {falta && (
          <span className="block truncate text-[11px] text-zinc-400">
            Falta: <span className="text-zinc-600">{falta.charAt(0).toLowerCase()}{falta.slice(1)}</span>
          </span>
        )}
      </Link>

      <div className="flex shrink-0 items-center gap-0.5">
        {item.atrasado && <span className="mr-1 hidden rounded bg-rose-50 px-1 py-0.5 text-[10px] font-semibold text-rose-700 sm:inline">fora do prazo</span>}
        <button
          type="button"
          onClick={onFeito}
          disabled={bloqueado}
          title="Feito hoje — sai da lista até amanhã"
          aria-label={`Marcar ${item.titulo} como feito hoje`}
          className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
        >
          {gravando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
        </button>
        <button
          type="button"
          onClick={() => onMenu(!menuAberto)}
          disabled={bloqueado}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          title="Não se aplica ou adiar — tirar desta atividade"
          aria-label={`Tirar ou adiar ${item.titulo}`}
          className={`rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40 ${menuAberto ? "bg-zinc-100 text-zinc-700 opacity-100" : "opacity-0"}`}
        >
          <CircleSlash size={13} />
        </button>
        {item.ra && (
          <LinksDoRa caso={item.ra} className="opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [&>a]:p-1" />
        )}
        <JanelaDoLink href={item.href} titulo={item.titulo} className="p-0.5" />
      </div>

      {menuAberto && (
        <div role="menu" className="absolute right-1 top-[calc(100%-2px)] z-30 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Não se aplica</p>
          {DURACOES.map((d) => (
            <button
              key={d.id}
              type="button"
              role="menuitem"
              title={d.dica}
              onClick={() => onTirar(d.id)}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
            >
              {d.rotulo}
            </button>
          ))}
          <div className="mt-1 border-t border-zinc-100 pt-0.5">
            <OpcoesDeAdiar id={`adiar-${item.id}`} onAdiar={onAdiar} />
          </div>
        </div>
      )}
    </li>
  );
}
