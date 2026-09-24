import type { ResumoDeOntem } from "@/lib/actions/rotina";
import { diaCurtoDaMarca, voltaDoAdiado, type Contagem, type MarcaDeItem, type PlanoDoDia } from "@/lib/models/meuDia";
import type { AtividadeDaRotina, ChaveDaRotina } from "@/lib/models/rotina";

/**
 * O fim do dia que se escreve sozinho (Fase 24).
 *
 * O checkpoint da manhã diz o que foi feito ontem e o plano de hoje. No
 * fim do expediente a pergunta é outra: o que andou hoje, o que ficou e
 * por quê. Tudo sai do que o banco sabe — os registros do dia, as marcas
 * de feito, tirado e adiado, o que ainda está nas atividades e o que o
 * plano disse que não cabia. Quem escreve só acrescenta o que só ela sabe.
 */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Até três títulos, e "e mais N" — o texto vai para o Slack, não é a lista inteira. */
function alguns(titulos: string[]) {
  const unicos = [...new Set(titulos)];
  const primeiros = unicos.slice(0, 3).map((t) => (t.length > 48 ? `${t.slice(0, 47).trimEnd()}…` : t));
  return unicos.length > 3 ? `${primeiros.join("; ")} e mais ${unicos.length - 3}` : primeiros.join("; ");
}

export function textoDoFimDoDia(entrada: {
  hoje: string;
  feito: ResumoDeOntem | null;
  /** As marcas que valem hoje — só as feitas hoje entram. */
  marcas: MarcaDeItem[];
  atividades: Pick<AtividadeDaRotina, "id" | "titulo" | "chave">[];
  contagens: Partial<Record<ChaveDaRotina, Contagem>> | null;
  plano: PlanoDoDia | null;
  feitas: number;
  total: number;
}) {
  const { feito, contagens, plano } = entrada;
  const linhas: string[] = [`*Fim do dia — ${diaCurtoDaMarca(entrada.hoje)}*`, ""];

  /* ---------- o que andou ---------- */
  const registros = feito
    ? [
        feito.primeirosContatos ? plural(feito.primeirosContatos, "primeiro contato", "primeiros contatos") : null,
        feito.contatos - feito.primeirosContatos - feito.pedidosDeAvaliacao > 0
          ? plural(feito.contatos - feito.primeirosContatos - feito.pedidosDeAvaliacao, "outro contato registrado", "outros contatos registrados")
          : null,
        feito.respostasPublicas ? plural(feito.respostasPublicas, "resposta pública no Reclame Aqui", "respostas públicas no Reclame Aqui") : null,
        feito.pedidosDeAvaliacao ? plural(feito.pedidosDeAvaliacao, "pedido de avaliação", "pedidos de avaliação") : null,
        feito.tentativasNps ? plural(feito.tentativasNps, "tentativa no NPS", "tentativas no NPS") : null,
        feito.googleRespondidas ? plural(feito.googleRespondidas, "avaliação respondida no Google", "avaliações respondidas no Google") : null,
      ].filter(Boolean)
    : [];
  linhas.push(`*Feito:* ${registros.length ? registros.join(", ") : "nenhum registro na plataforma hoje"}. Rotina: ${entrada.feitas} de ${entrada.total} atividades.`);

  /* ---------- o que saiu da fila por marca ---------- */
  const deHoje = entrada.marcas.filter((m) => m.dia === entrada.hoje);
  const porItem = new Map<string, MarcaDeItem>();
  for (const m of deHoje) if (!porItem.has(m.item)) porItem.set(m.item, m);
  const marcas = [...porItem.values()];
  const porFora = marcas.filter((m) => m.tipo === "feito");
  const tirados = marcas.filter((m) => m.tipo === "dispensado");
  const adiados = marcas.filter((m) => m.tipo === "adiado");
  const saidas = [
    porFora.length ? `${plural(porFora.length, "feito por fora", "feitos por fora")} (${alguns(porFora.map((m) => m.titulo))})` : null,
    tirados.length ? `${plural(tirados.length, "tirado como não se aplica", "tirados como não se aplica")} (${alguns(tirados.map((m) => m.titulo))})` : null,
    adiados.length
      ? `${plural(adiados.length, "adiado", "adiados")} (${alguns(adiados.map((m) => `${m.titulo}, volta em ${diaCurtoDaMarca(voltaDoAdiado(m) ?? m.dia)}`))})`
      : null,
  ].filter(Boolean);
  if (saidas.length) linhas.push(`*Saiu da fila sem registro:* ${saidas.join("; ")}.`);

  /* ---------- o que ficou, e por quê ---------- */
  if (contagens) {
    const naoCoube = new Set((plano?.naoCabe ?? []).map((b) => b.atividadeId));
    const ficou = entrada.atividades
      .map((a) => ({ a, c: a.chave ? contagens[a.chave] : undefined }))
      .filter((x): x is { a: typeof x.a; c: Contagem } => Boolean(x.c && x.c.total > 0))
      .map(({ a, c }) => {
        const porque = [c.atrasados ? `${c.atrasados} fora do prazo` : null, naoCoube.has(a.id) ? "não coube no expediente" : null].filter(Boolean);
        return `${a.titulo.toLowerCase()} (${c.total}${porque.length ? ` — ${porque.join(", ")}` : ""})`;
      });
    linhas.push(`*Ficou para amanhã:* ${ficou.length ? ficou.join("; ") : "nada — as atividades de hoje zeraram"}.`);
  }

  return linhas.join("\n");
}
