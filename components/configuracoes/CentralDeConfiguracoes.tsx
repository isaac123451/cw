"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";

import {
  ArrowUpRight,
  BellRing,
  Bot,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  DatabaseBackup,
  FileBarChart,
  GitBranch,
  Info,
  KeyRound,
  LibraryBig,
  ListChecks,
  Plug,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Stethoscope,
  Tags,
  Target,
  UserCog,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import BackupCard from "@/components/configuracoes/BackupCard";
import IaCard from "@/components/configuracoes/IaCard";
import SaudeDosDadosCard from "@/components/configuracoes/SaudeDosDadosCard";
import SegurancaCard from "@/components/configuracoes/SegurancaCard";
import WootricCard from "@/components/configuracoes/WootricCard";
import EnvioAutomatico from "@/components/relatorio/EnvioAutomatico";
import { pluralDe } from "@/lib/plural";

/**
 * A central de configurações (1.115): "remodele as configurações do CW
 * Reputação".
 *
 * Antes eram nove cartões numa grade, e metade do que se ajusta morava em
 * outras telas (IA e Wootric em Integrações, backup em Segurança, o envio
 * do relatório no Relatório, as etapas do NPS dentro do NPS, a rotina
 * dentro do Meu dia). Agora tudo está aqui, por assunto, com uma busca:
 *
 * - o que é curto abre **na própria página** (IA, Wootric, segurança,
 *   backup, relatório automático) — uma linha que se expande, sem modal;
 * - o que é grande (o fluxo do quadro, as permissões, os prazos) leva à
 *   tela dele, já na aba certa.
 */

type Painel = "ia" | "wootric" | "seguranca" | "backup" | "relatorio" | "saude";

interface ItemDeConfiguracao {
  id: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  /** Palavras que a busca também acha. */
  palavras?: string;
  href?: string;
  painel?: Painel;
}

interface Secao {
  id: string;
  titulo: string;
  descricao: string;
  itens: ItemDeConfiguracao[];
}

const PAINEIS: Record<Painel, ComponentType> = {
  ia: IaCard,
  wootric: WootricCard,
  seguranca: SegurancaCard,
  backup: BackupCard,
  relatorio: EnvioAutomatico,
  saude: SaudeDosDadosCard,
};

export const SECOES: Secao[] = [
  {
    id: "operacao",
    titulo: "Operação",
    descricao: "Como o trabalho anda: etapas, prazos, rotina e metas.",
    itens: [
      { id: "fluxo", titulo: "Etapas do quadro", descricao: "As colunas do Reclame Aqui e das Redes, cores, limite de cartões e lembrete de caso parado.", icone: Workflow, href: "/reclame-aqui/configuracoes?tab=status", palavras: "kanban colunas status fluxo" },
      { id: "categorias", titulo: "Categorias e subcategorias", descricao: "A classificação das reclamações, usada na triagem, nas causas e nos relatórios.", icone: Tags, href: "/reclame-aqui/configuracoes?tab=categorias", palavras: "assuntos classificação" },
      { id: "etiquetas", titulo: "Etiquetas", descricao: "As etiquetas dos casos.", icone: Tags, href: "/reclame-aqui/configuracoes?tab=tags", palavras: "tags" },
      { id: "checklist", titulo: "Checklist do caso", descricao: "Os passos que cada caso precisa cumprir.", icone: ListChecks, href: "/reclame-aqui/configuracoes?tab=checklist" },
      { id: "prazos", titulo: "Prazos, expediente e feriados", descricao: "O SLA de cada etapa, o horário de trabalho e os feriados que o relógio pula.", icone: CalendarClock, href: "/processos", palavras: "sla horário dias úteis processos áreas" },
      { id: "rotina", titulo: "Rotina do dia", descricao: "As atividades do Meu dia, a frequência, o horário e a duração de cada uma.", icone: ClipboardList, href: "/meu-dia?configurar=rotina", palavras: "atividades meu dia" },
      { id: "recuperacao", titulo: "Plano de recuperação", descricao: "Por frente: se o plano do acumulado aparece no Meu dia, a partir de quantos fora do prazo, em quantos dias úteis zerar e a cota por dia.", icone: Target, href: "/meu-dia?configurar=recuperacao", palavras: "acumulado cota atrasados vencidos fora do prazo" },
      { id: "metas", titulo: "Metas de hoje e do ciclo", descricao: "Os números das metas — ajustáveis no próprio Meu dia, só hoje ou daqui para frente.", icone: Target, href: "/meu-dia", palavras: "metas ciclo ajustar" },
      { id: "nps-etapas", titulo: "Etapas e tipos do NPS", descricao: "As colunas do NPS e os tipos de resposta (o que cada um exige para encerrar).", icone: Workflow, href: "/nps?configurar=etapas", palavras: "nps encerrado tipos" },
      { id: "nps-causas", titulo: "Causas do NPS", descricao: "O catálogo de causas raiz usado na análise do NPS.", icone: Tags, href: "/nps?configurar=causas", palavras: "causa raiz" },
    ],
  },
  {
    id: "pessoas",
    titulo: "Pessoas e acesso",
    descricao: "Quem atende, quem pode o quê, e como se entra.",
    itens: [
      { id: "times", titulo: "Times e responsáveis", descricao: "Quem atende e em que time.", icone: Users, href: "/reclame-aqui/configuracoes?tab=times", palavras: "equipe pessoas" },
      { id: "permissoes", titulo: "Permissões por módulo", descricao: "O papel de cada pessoa em cada módulo; quem fica em Padrão segue o papel da conta.", icone: ShieldCheck, href: "/configuracoes/permissoes", palavras: "papel acesso administrador agente leitura" },
      { id: "seguranca", titulo: "Código de acesso (duas etapas)", descricao: "Exigir o código por e-mail, por quanto tempo ele vale e quantos palpites.", icone: KeyRound, painel: "seguranca", palavras: "2fa senha login código validade" },
      { id: "distribuicao", titulo: "Distribuição e ausências", descricao: "A carga de cada pessoa, quem está fora e a fila redistribuída.", icone: Shuffle, href: "/distribuicao", palavras: "férias ausência carga" },
      { id: "conta", titulo: "Minha conta e avisos", descricao: "Seus dados, sua senha e quais avisos chegam para você.", icone: UserCog, href: "/conta", palavras: "perfil notificações senha" },
      { id: "avisos", titulo: "Notificações", descricao: "Os avisos do sino e da extensão.", icone: BellRing, href: "/conta?aba=notificacoes", palavras: "sino alertas" },
    ],
  },
  {
    id: "cadastros",
    titulo: "Cadastros",
    descricao: "As listas que as outras telas usam.",
    itens: [
      { id: "saude", titulo: "Saúde dos dados", descricao: "O que na base parece errado e mexe nos números: mensalidade fora de escala, plano fora da tabela, responsável de teste, resposta sem data e outros — com o caminho para corrigir.", icone: Stethoscope, painel: "saude", palavras: "dados errados anomalia conferência mensalidade plano qualidade" },
      { id: "estabelecimentos", titulo: "Estabelecimentos", descricao: "Os restaurantes clientes, com plano e situação da conta.", icone: Building2, href: "/estabelecimentos", palavras: "contas lojas cnpj" },
      { id: "clientes", titulo: "Clientes", descricao: "As pessoas por trás das reclamações.", icone: Users, href: "/clientes" },
      { id: "planos", titulo: "Planos e módulos", descricao: "A tabela de preços que as respostas prontas usam.", icone: Wallet, href: "/configuracoes/planos", palavras: "preço valores" },
      { id: "respostas", titulo: "Respostas prontas", descricao: "Os modelos de resposta do Reclame Aqui e do WhatsApp.", icone: LibraryBig, href: "/base-conhecimento", palavras: "macros modelos" },
      { id: "causas", titulo: "Catálogo de causas raiz", descricao: "As causas, com área e prazo de cada uma.", icone: Tags, href: "/causas-raiz", palavras: "área dono" },
    ],
  },
  {
    id: "automacoes",
    titulo: "Automações",
    descricao: "O que a plataforma faz sozinha.",
    itens: [
      { id: "relatorio", titulo: "Relatório que chega sozinho", descricao: "Para quem o relatório do ciclo vai por e-mail, na madrugada depois de cada ciclo.", icone: FileBarChart, painel: "relatorio", palavras: "e-mail ciclo envio" },
      { id: "backup", titulo: "Backup diário", descricao: "A cópia de todos os dados, fora do banco, e o download na hora.", icone: DatabaseBackup, painel: "backup", palavras: "cópia segurança download" },
      { id: "segmento", titulo: "Empresas comparadas", descricao: "As empresas parecidas que a extensão lê no Reclame Aqui — editáveis no Índice.", icone: Sparkles, href: "/reclame-aqui/indice", palavras: "concorrentes segmento goomer anota" },
    ],
  },
  {
    id: "integracoes",
    titulo: "Integrações",
    descricao: "Os serviços de fora que a plataforma usa.",
    itens: [
      { id: "ia", titulo: "Inteligência artificial", descricao: "O provedor da IA (só gratuitos) e a ordem de reserva.", icone: Bot, painel: "ia", palavras: "gemini groq openrouter ia" },
      { id: "wootric", titulo: "Wootric (NPS)", descricao: "A importação das respostas e a devolução do encerramento.", icone: Plug, painel: "wootric", palavras: "nps pesquisa" },
      { id: "webhooks", titulo: "Webhooks", descricao: "Eventos para outro sistema, com assinatura e histórico de entregas.", icone: GitBranch, href: "/configuracoes/integracoes", palavras: "api integração eventos" },
    ],
  },
];

/** Sem acento e em minúsculas, para a busca. */
const simples = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default function CentralDeConfiguracoes({ versao, secaoInicial, abertoInicial }: { versao?: string; secaoInicial?: string; abertoInicial?: string }) {
  /* A seção do endereço, ou a do item pedido em ?abrir=, ou Operação. */
  const [secao, setSecao] = useState(
    SECOES.some((s) => s.id === secaoInicial) ? secaoInicial! : (SECOES.find((s) => s.itens.some((i) => i.id === abertoInicial))?.id ?? "operacao")
  );
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(abertoInicial ?? null);

  const achados = useMemo(() => {
    const q = simples(busca.trim());
    if (!q) return null;
    return SECOES.flatMap((s) => s.itens.filter((i) => simples(`${i.titulo} ${i.descricao} ${i.palavras ?? ""}`).includes(q)).map((i) => ({ ...i, secao: s.titulo })));
  }, [busca]);

  const atual = SECOES.find((s) => s.id === secao) ?? SECOES[0];
  const itens = achados ?? atual.itens.map((i) => ({ ...i, secao: atual.titulo }));

  return (
    <div className="grid gap-5 lg:grid-cols-[13rem_1fr]">
      <nav aria-label="Seções das configurações" className="lg:sticky lg:top-20 lg:self-start">
        <div className="relative mb-3">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar…"
            aria-label="Procurar configuração"
            className="h-9 w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-violet-400"
          />
        </div>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECOES.map((s) => (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSecao(s.id);
                  setBusca("");
                }}
                aria-current={!achados && secao === s.id ? "page" : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  !achados && secao === s.id ? "bg-violet-50 font-medium text-violet-800" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                {s.titulo}
                <span className="text-xs tabular-nums text-zinc-400">{s.itens.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 hidden items-center gap-1.5 px-3 text-xs text-zinc-400 lg:flex">
          <Info size={12} /> Versão {versao ?? "—"} ·{" "}
          <Link href="/novidades" className="hover:text-violet-700">
            novidades
          </Link>
        </p>
      </nav>

      <section aria-label={achados ? "Resultado da busca" : atual.titulo}>
        <header className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900">{achados ? `${achados.length} ${pluralDe(achados.length, "resultado", "resultados")} para "${busca.trim()}"` : atual.titulo}</h2>
          {!achados && <p className="text-sm text-zinc-500">{atual.descricao}</p>}
        </header>

        {itens.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">Nada com esse nome. Tente outra palavra.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {itens.map((item) => {
              const Icone = item.icone;
              const Painel = item.painel ? PAINEIS[item.painel] : null;
              const estaAberto = aberto === item.id;
              const corpo = (
                <>
                  <span className="rounded-lg bg-violet-50 p-2 text-violet-600 ring-1 ring-inset ring-violet-100">
                    <Icone size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900">
                      {item.titulo}
                      {achados && <span className="ml-2 text-xs font-normal text-zinc-400">{item.secao}</span>}
                    </span>
                    <span className="block text-xs leading-relaxed text-zinc-500">{item.descricao}</span>
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {Painel ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setAberto(estaAberto ? null : item.id)}
                        aria-expanded={estaAberto}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
                      >
                        {corpo}
                        <ChevronDown size={16} className={`shrink-0 text-zinc-400 transition-transform ${estaAberto ? "rotate-180" : ""}`} />
                      </button>
                      {estaAberto && (
                        <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-4">
                          <Painel />
                        </div>
                      )}
                    </>
                  ) : (
                    <Link href={item.href!} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50">
                      {corpo}
                      <ArrowUpRight size={15} className="shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
