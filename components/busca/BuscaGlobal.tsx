"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AppWindow,
  Building2,
  CornerDownLeft,
  FileText,
  History,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Search,
  Smile,
  UserRound,
  Zap,
} from "lucide-react";

import { menuItems } from "@/core/navigation/menu";

import { listarConversas } from "@/lib/actions/conversas";
import { useCases } from "@/lib/context/CaseContext";
import { useClients } from "@/lib/context/ClientsContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useNps } from "@/lib/context/NpsContext";

import {
  agruparResultados,
  buscarNaPlataforma,
  normalizar,
  ROTULO_DO_TIPO,
  type ResultadoDaBusca,
  type TelaDaBusca,
  type TipoDoResultado,
} from "@/lib/models/buscaGlobal";

/**
 * A busca da plataforma: Ctrl+K (ou Cmd+K, ou "/") de qualquer tela.
 *
 * O campo do topo era só desenho — não buscava nada. Agora abre esta
 * paleta, que acha casos, NPS, clientes, estabelecimentos, conversas e as
 * próprias telas, inclusive pelos nomes que as pessoas usam ("sla",
 * "planos", "permissões"). Enter abre; Shift+Enter abre o caso numa
 * mini-janela, sem sair de onde se está.
 */

const TELAS_EXTRAS: TelaDaBusca[] = [
  { titulo: "Novo caso no Reclame Aqui", href: "/reclame-aqui/novo", grupo: "Ação", sinonimos: ["criar caso", "nova reclamacao", "cadastrar reclamacao"] },
  { titulo: "Integrações", href: "/configuracoes/integracoes", grupo: "Configurações", sinonimos: ["wootric", "google", "webhook", "api", "extensao"] },
  { titulo: "Planos e módulos", href: "/configuracoes/planos", grupo: "Configurações", sinonimos: ["planos", "mensalidade", "precos"] },
  { titulo: "Permissões", href: "/configuracoes/permissoes", grupo: "Configurações", sinonimos: ["acesso", "papel", "usuarios"] },
  { titulo: "Segurança do acesso", href: "/configuracoes/seguranca", grupo: "Configurações", sinonimos: ["duas etapas", "2fa", "senha"] },
  { titulo: "Minha conta", href: "/conta", grupo: "Conta", sinonimos: ["perfil", "notificacoes", "preferencias"] },
  { titulo: "Times", href: "/times", grupo: "Configurações", sinonimos: ["equipe", "responsaveis"] },
];

const SINONIMOS: Record<string, string[]> = {
  "/processos": ["sla", "prazos", "expediente", "feriados", "areas", "movimentacoes"],
  "/reclame-aqui/avaliacoes": ["pedir avaliacao", "fila de avaliacao"],
  "/relatorio": ["relatorio de reputacao", "ciclo", "gestao"],
  "/base-conhecimento": ["macros", "modelos de resposta", "respostas prontas"],
  "/meu-dia": ["rotina", "plano do dia", "hoje"],
  "/impacto": ["reembolso", "credito", "financeiro"],
  "/conversas": ["whatsapp", "mensagens"],
  "/documentacao": ["documentos", "guias", "manual"],
  "/reclame-aqui/calculadora": ["simulador", "nota", "ra1000"],
  "/configuracoes": ["categorias", "etiquetas", "tags", "configurar"],
};

const ICONE: Record<TipoDoResultado, typeof Search> = {
  tela: LayoutGrid,
  acao: Zap,
  caso: FileText,
  nps: Smile,
  cliente: UserRound,
  estabelecimento: Building2,
  conversa: MessageCircle,
};

const CHAVE_RECENTES = "cw:busca-recentes";

function lerRecentes(): ResultadoDaBusca[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(bruto) ? bruto.filter((r) => r && typeof r.href === "string" && typeof r.titulo === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

function guardarRecente(r: ResultadoDaBusca) {
  try {
    const lista = [r, ...lerRecentes().filter((x) => x.href !== r.href)].slice(0, 8);
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch {
    /* Sem armazenamento: a busca funciona, só não lembra. */
  }
}

export default function BuscaGlobal() {
  const [aberta, setAberta] = useState(false);

  const abrir = useCallback(() => setAberta(true), []);

  useEffect(() => {
    function teclas(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta((a) => !a);
      } else if (e.key === "/" && !digitando) {
        e.preventDefault();
        setAberta(true);
      }
    }
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Buscar na plataforma (Ctrl+K)"
        className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white md:w-72"
      >
        <Search size={16} className="shrink-0" />
        <span className="hidden flex-1 text-left md:inline">Buscar casos, clientes, telas…</span>
        <kbd className="hidden rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-zinc-500 md:inline">Ctrl K</kbd>
      </button>
      {aberta && <Paleta onFechar={() => setAberta(false)} />}
    </>
  );
}

function Paleta({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const { cases } = useCases();
  const { responses } = useNps();
  const { clients } = useClients();
  const { establishments } = useEstablishments();
  const { abrir: abrirJanela } = useJanelas();

  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [conversas, setConversas] = useState<{ para: string; itens: ResultadoDaBusca[] } | null>(null);
  const [recentes] = useState(lerRecentes);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  /* Digitar não trava: a lista acompanha no tempo que der. */
  const adiado = useDeferredValue(termo);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  const telas = useMemo<TelaDaBusca[]>(
    () => [
      ...menuItems.flatMap((m) => [
        { titulo: m.title, href: m.href, grupo: m.group, sinonimos: SINONIMOS[m.href] },
        ...(m.children ?? [])
          .filter((f) => f.href !== m.href)
          .map((f) => ({ titulo: `${m.title} · ${f.title}`, href: f.href, grupo: m.group, sinonimos: SINONIMOS[f.href] })),
      ]),
      ...TELAS_EXTRAS,
    ],
    []
  );

  const resultados = useMemo(
    () =>
      buscarNaPlataforma({
        termo: adiado,
        telas,
        casos: cases,
        nps: responses,
        clientes: clients,
        estabelecimentos: establishments,
      }),
    [adiado, telas, cases, responses, clients, establishments]
  );

  /* As conversas não estão em memória: vão ao servidor, com uma pausa entre teclas. */
  const termoDasConversas = normalizar(adiado).length >= 3 ? adiado.trim() : "";
  useEffect(() => {
    if (!termoDasConversas) return;
    let vivo = true;
    const t = setTimeout(() => {
      listarConversas(termoDasConversas)
        .then((r) => {
          if (!vivo || !r.ok) return;
          setConversas({
            para: termoDasConversas,
            itens: r.conversas.slice(0, 5).map((c) => ({
              tipo: "conversa" as const,
              id: c.id,
              titulo: c.contatoNome,
              subtitulo: c.ultimoTexto,
              href: `/conversas?id=${encodeURIComponent(c.id)}`,
              pontos: 30,
            })),
          });
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [termoDasConversas]);

  const todos = useMemo(() => {
    const extras = conversas && conversas.para === termoDasConversas ? conversas.itens : [];
    return agruparResultados([...resultados, ...extras]);
  }, [resultados, conversas, termoDasConversas]);

  const planos = termo.trim() ? todos.flatMap((g) => g.itens) : recentes;
  const indice = Math.min(ativo, Math.max(0, planos.length - 1));
  const selecionado = planos[indice];

  function escolher(r: ResultadoDaBusca | undefined, emJanela: boolean) {
    if (!r) return;
    guardarRecente({ ...r, pontos: 0 });
    onFechar();
    if (emJanela && r.janela) abrirJanela(r.janela);
    else router.push(r.href);
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, planos.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(selecionado, e.shiftKey);
    }
  }

  /* O item ativo fica à vista quando se anda com as setas. */
  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const posicao = new Map(planos.map((r, i) => [`${r.tipo}:${r.id}`, i]));
  const linha = (r: ResultadoDaBusca) => {
    const i = posicao.get(`${r.tipo}:${r.id}`) ?? 0;
    const Icone = ICONE[r.tipo];
    const eAtivo = i === indice;
    return (
      <div
        key={`${r.tipo}:${r.id}`}
        role="option"
        aria-selected={eAtivo}
        data-indice={i}
        onMouseMove={() => ativo !== i && setAtivo(i)}
        className={`group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${eAtivo ? "bg-violet-50" : ""}`}
        onClick={(e) => escolher(r, e.shiftKey)}
      >
        <Icone size={16} className={`shrink-0 ${eAtivo ? "text-violet-600" : "text-zinc-400"}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{r.titulo}</p>
          {r.subtitulo && <p className="truncate text-xs text-zinc-500">{r.subtitulo}</p>}
        </div>
        {r.janela && (
          <button
            type="button"
            title="Abrir numa mini-janela (Shift+Enter)"
            aria-label={`Abrir ${r.titulo} numa mini-janela`}
            onClick={(e) => {
              e.stopPropagation();
              escolher(r, true);
            }}
            className={`rounded-md p-1 text-zinc-400 hover:bg-white hover:text-violet-700 ${eAtivo ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <AppWindow size={14} />
          </button>
        )}
        {eAtivo && <CornerDownLeft size={13} className="shrink-0 text-zinc-400" />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-zinc-900/20 px-3 pt-[10vh]" onMouseDown={onFechar}>
      <div
        role="dialog"
        aria-label="Buscar na plataforma"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]"
      >
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4">
          <Search size={17} className="shrink-0 text-zinc-400" />
          <input
            ref={campo}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAtivo(0);
            }}
            onKeyDown={teclas}
            placeholder="Protocolo, cliente, CPF/CNPJ, telefone, tela…"
            aria-label="O que você procura"
            role="combobox"
            aria-expanded="true"
            aria-controls="resultados-da-busca"
            className="h-14 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          {termo !== adiado && <Loader2 size={15} className="animate-spin text-zinc-300" />}
          <kbd className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-400">Esc</kbd>
        </div>

        <div ref={lista} id="resultados-da-busca" role="listbox" className="flex-1 overflow-y-auto p-2">
          {!termo.trim() ? (
            recentes.length > 0 ? (
              <>
                <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  <History size={12} /> Abertos recentemente
                </p>
                {recentes.map(linha)}
              </>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-zinc-500">
                Busque por protocolo, nome do cliente, CPF/CNPJ, telefone, estabelecimento ou pelo nome de uma tela.
              </p>
            )
          ) : planos.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">
              Nada encontrado para &ldquo;{termo.trim()}&rdquo;. Tente só parte do nome, ou os últimos dígitos do telefone.
            </p>
          ) : (
            todos.map((g) => (
              <div key={g.tipo} className="pb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{ROTULO_DO_TIPO[g.tipo]}</p>
                {g.itens.map(linha)}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
          <span><kbd className="font-sans">↑↓</kbd> navegar</span>
          <span><kbd className="font-sans">Enter</kbd> abrir</span>
          <span><kbd className="font-sans">Shift+Enter</kbd> abrir em mini-janela</span>
          <span className="ml-auto">Ctrl K ou / de qualquer tela</span>
        </div>
      </div>
    </div>
  );
}
