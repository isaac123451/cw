"use client";

import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

/**
 * Novidades da 1.0 (Fase 10.5).
 *
 * A versão 1.0 fecha o roadmap que transformou a documentação de
 * reputação no funcionamento da plataforma. Esta página diz, em uma
 * leitura, o que mudou — cada item com o lugar onde ele está, porque
 * novidade que não diz onde fica é só propaganda.
 *
 * O detalhe técnico de cada entrega, com o que foi medido e as provas,
 * mora no ROADMAP.md do repositório.
 */

interface Novidade {
  titulo: string;
  texto: string;
  href?: string;
}

const FASES: { nome: string; itens: Novidade[] }[] = [
  {
    nome: "O relógio certo",
    itens: [
      { titulo: "Horas úteis em todo prazo", texto: "Segunda a sexta, no expediente configurado, com feriados. O mesmo relógio no Reclame Aqui, nas Redes, no NPS, nas áreas e no sino.", href: "/processos" },
      { titulo: "Criticidade da documentação", texto: "Urgente, Alta e Normal, com a triagem pelos critérios da tabela — e agora com a sugestão pelos dados: reincidência pelo CPF/CNPJ, alto ticket e risco de cancelamento.", href: "/reclame-aqui" },
    ],
  },
  {
    nome: "Reclame Aqui, passo a passo",
    itens: [
      { titulo: "A trilha do caso", texto: "O passo da vez no alto da ficha, com a ação na frente: 1º contato, tentativas, áreas, confirmação do cliente, pedido de avaliação." },
      { titulo: "Pedir avaliação na hora certa", texto: "A fila de hoje e dos próximos dias, com o efeito na nota.", href: "/reclame-aqui/avaliacoes" },
      { titulo: "Resposta pública conferida", texto: "Nome, canal privado, promessa, tom e dado pessoal conferidos antes de copiar — também dentro do HugMe e do Reclame Aqui, pela extensão." },
    ],
  },
  {
    nome: "As quatro frentes juntas",
    itens: [
      { titulo: "Redes, Google e NPS no mesmo desenho", texto: "Ficha própria para cada ciclo do NPS, avaliações do Google com prazo e reincidência, redes no fluxo do documento.", href: "/nps" },
      { titulo: "Mini-janelas", texto: "Abra a ficha de um caso, NPS ou avaliação por cima de qualquer tela — várias ao mesmo tempo — e continue navegando." },
      { titulo: "Conversas do WhatsApp", texto: "Guardadas pela extensão ou pelo arquivo, com quem está esperando a gente, busca dentro da conversa e vínculo sugerido pelo telefone.", href: "/conversas" },
    ],
  },
  {
    nome: "A rotina do agente",
    itens: [
      { titulo: "Meu dia", texto: "O que pede ação agora, o que move a nota e as conquistas de hoje; a rotina e o plano do dia pela quantidade e pela urgência.", href: "/meu-dia" },
      { titulo: "Relatório do ciclo pronto sozinho", texto: "Indicadores das abas do portal, o selo RA1000, o tempo até o 1º contato por frente e os pontos de atenção, em texto para o Slack e planilha.", href: "/relatorio" },
    ],
  },
  {
    nome: "Documentação viva e IA",
    itens: [
      { titulo: "O agente conhece a documentação", texto: "Responde citando a seção do documento, avisa antes de perguntar e escreve pelas regras — o texto da IA passa pela mesma conferência do digitado.", href: "/assistente" },
      { titulo: "Documentos e acessos no lugar", texto: "A documentação, as ferramentas e o primeiro acesso guiado para quem chega.", href: "/documentacao" },
    ],
  },
  {
    nome: "Extensão",
    itens: [
      { titulo: "Onde o trabalho acontece", texto: "Portal Cardápio Web, Crisp, Google Perfil da Empresa, WhatsApp Web, HugMe e Reclame Aqui. Alt+Shift+C abre o painel." },
      { titulo: "Meu dia de bolso", texto: "O popup mostra a rotina, os prazos, o que move a nota e as conquistas de hoje; o ícone conta o que está estourando." },
    ],
  },
  {
    nome: "Acabamento",
    itens: [
      { titulo: "Nada se perde", texto: "Duas pessoas no mesmo caso sem uma apagar a outra, e toda gravação diz o que aconteceu — inclusive quando não aconteceu." },
      { titulo: "Mais rápida para abrir", texto: "A plataforma carrega tudo numa ida só: os dados da abertura chegam em cerca de 1 s, contra quase 3 s antes." },
      { titulo: "No celular e sem beco sem saída", texto: "As telas principais cabem em 375 px, e toda lista vazia diz por quê e oferece o próximo passo." },
    ],
  },
];

export default function NovidadesPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeading
          eyebrow="Conhecimento"
          title="Novidades da 1.0"
          description="A documentação de reputação virou o funcionamento da plataforma. O que mudou, e onde está cada coisa."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {FASES.map((fase) => (
            <SurfaceCard key={fase.nome} title={fase.nome}>
              <ul className="space-y-3">
                {fase.itens.map((item) => (
                  <li key={item.titulo}>
                    {item.href ? (
                      <Link href={item.href} className="group inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-violet-700">
                        {item.titulo}
                        <ArrowUpRight size={13} className="text-zinc-300 group-hover:text-violet-600" />
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-zinc-900">{item.titulo}</p>
                    )}
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">{item.texto}</p>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          ))}
        </div>

        <p className="text-xs text-zinc-500">
          O detalhe de cada entrega — o que foi medido, os defeitos achados no caminho e as provas — está no ROADMAP.md do repositório.
        </p>
      </div>
    </MainLayout>
  );
}
