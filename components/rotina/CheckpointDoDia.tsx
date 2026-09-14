"use client";

import SurfaceCard from "@/components/shared/SurfaceCard";
import TextoEditavel from "@/components/shared/TextoEditavel";

import type { ResumoDeOntem } from "@/lib/actions/rotina";
import type { Contagem, PlanoDoDia } from "@/lib/models/meuDia";
import type { ChaveDaRotina } from "@/lib/models/rotina";
import { descreverMinutos } from "@/components/rotina/formato";

/**
 * O checkpoint diário com a gestão, pronto para colar no Slack.
 *
 * Item 11 da rotina: "Checkpoint diário com a gestão". Três partes, na
 * ordem em que a gestão pergunta: o que foi feito ontem (contado no
 * banco), o plano de hoje (o mesmo do Plano do dia) e os riscos (o que
 * está fora do prazo). Nada é enviado pela plataforma: o texto é
 * copiado, e quem manda é você.
 */
export function textoDoCheckpoint(entrada: {
  hoje: string;
  ontem: ResumoDeOntem | null;
  plano: PlanoDoDia | null;
  contagens: Record<ChaveDaRotina, Contagem> | null;
  feitas: number;
  total: number;
}) {
  const { ontem, plano, contagens } = entrada;
  const dm = (dia: string) => dia.split("-").reverse().slice(0, 2).join("/");

  const linhas: string[] = [`*Checkpoint — ${dm(entrada.hoje)}*`, ""];

  if (ontem) {
    const feitos = [
      ontem.primeirosContatos ? `${ontem.primeirosContatos} 1º(s) contato(s)` : null,
      ontem.contatos ? `${ontem.contatos} contato(s) registrados` : null,
      ontem.respostasPublicas ? `${ontem.respostasPublicas} resposta(s) pública(s) no Reclame Aqui` : null,
      ontem.pedidosDeAvaliacao ? `${ontem.pedidosDeAvaliacao} pedido(s) de avaliação` : null,
      ontem.tentativasNps ? `${ontem.tentativasNps} tentativa(s) no NPS` : null,
      ontem.googleRespondidas ? `${ontem.googleRespondidas} avaliação(ões) respondida(s) no Google` : null,
    ].filter(Boolean);
    linhas.push(`*Ontem (${dm(ontem.dia)}):* ${feitos.length ? feitos.join(", ") : "nenhum registro na plataforma"}.${ontem.atividadesFeitas ? ` Rotina: ${ontem.atividadesFeitas} atividade(s) marcadas.` : ""}`);
  }

  if (plano && entrada.total === 0 && plano.minutosDisponiveis === 0) {
    linhas.push("*Hoje:* não é dia útil — a rotina diária volta no próximo.");
  } else if (plano) {
    /* Os blocos vêm por frente; o checkpoint fala por atividade. */
    const porAtividade = new Map<string, { titulo: string; itens: number }>();
    for (const b of plano.blocos) {
      if (!b.itens) continue;
      const atual = porAtividade.get(b.atividadeId) ?? { titulo: b.titulo, itens: 0 };
      atual.itens += b.itens;
      porAtividade.set(b.atividadeId, atual);
    }
    const principais = [...porAtividade.values()].slice(0, 5).map((b) => `${b.titulo.toLowerCase()} (${b.itens})`);
    linhas.push(
      `*Hoje:* ${principais.length ? principais.join("; ") : "rotina em dia"}. O dia pede ~${descreverMinutos(plano.minutosNecessarios)} para ${descreverMinutos(plano.minutosDisponiveis)} de expediente${plano.naoCabe.length ? ` — não cabe: ${[...new Set(plano.naoCabe.map((b) => b.titulo.toLowerCase()))].join(", ")}` : ""}. Rotina: ${entrada.feitas} de ${entrada.total} feitas.`
    );
  }

  if (contagens) {
    const riscos = [
      contagens.novos.atrasados ? `${contagens.novos.atrasados} 1º(s) contato(s) fora do prazo` : null,
      contagens["em-aberto"].atrasados ? `${contagens["em-aberto"].atrasados} caso(s) com a solução fora do prazo` : null,
      contagens.areas.atrasados ? `${contagens.areas.atrasados} solicitação(ões) às áreas atrasadas` : null,
      contagens.fups.total ? `${contagens.fups.total} cliente(s) sem notícia há 2 dias úteis` : null,
      contagens.moderacoes.atrasados ? `${contagens.moderacoes.atrasados} moderação(ões) paradas há mais de 10 dias` : null,
    ].filter(Boolean);
    linhas.push(`*Riscos:* ${riscos.length ? riscos.join("; ") : "nenhum prazo estourado agora"}.`);
  }

  return linhas.join("\n");
}

export default function CheckpointDoDia(props: Parameters<typeof textoDoCheckpoint>[0]) {
  const texto = textoDoCheckpoint(props);
  return (
    <SurfaceCard
      title="Checkpoint com a gestão"
      description="Ontem, hoje e os riscos — contado no banco. Acrescente o que só você sabe, copie e cole no Slack; nada é enviado pela plataforma."
    >
      <TextoEditavel gerado={texto} rotulo="Copiar para o Slack" linhasMinimas={6} />
    </SurfaceCard>
  );
}
