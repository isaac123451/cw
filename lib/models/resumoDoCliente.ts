import type { RetratoDoCliente } from "@/lib/actions/tratativa";

/**
 * O resumo do cliente para a imersão — o que ler antes da 1ª mensagem.
 *
 * O Isaac pediu "um resumo também seria interessante" na imersão. O
 * retrato já trazia tudo em listas; faltava a leitura: quem é a conta,
 * se é a primeira reclamação, o que disse no NPS e no Google, e a última
 * fala guardada. Frases montadas do dado, sem IA — cada uma diz de onde
 * veio e nenhuma inventa o que a base não sabe.
 */

const DIA_MS = 86_400_000;

function ddmm(dia: string) {
  const [a, m, d] = dia.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function curto(texto: string, max = 90) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1).trimEnd()}…` : limpo;
}

export function resumoDoCliente(
  retrato: RetratoDoCliente,
  caso: { createdAt: string }
): string[] {
  const linhas: string[] = [];
  const est = retrato.estabelecimento;

  if (est) {
    const partes = [
      est.plano ? `plano ${est.plano}` : null,
      est.mrr !== undefined ? `${est.mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês` : null,
      est.desde ? `cliente desde ${ddmm(est.desde).slice(3)}` : null,
    ].filter(Boolean);
    linhas.push(`${est.nome}${partes.length ? `: ${partes.join(", ")}` : ""} — ${est.fase.toLowerCase()}.`);
  } else {
    linhas.push("Sem estabelecimento vinculado: ache ou crie a conta abaixo antes do contato.");
  }

  const outras = retrato.outrasReclamacoes;
  if (outras.length === 0) {
    linhas.push("Primeira reclamação deste cliente na base.");
  } else {
    const anterior = outras[0];
    const referencia = Date.parse(`${caso.createdAt.slice(0, 10)}T12:00:00Z`);
    const em90 = outras.filter((c) => referencia - Date.parse(`${c.dia}T12:00:00Z`) <= 90 * DIA_MS).length;
    linhas.push(
      `${outras.length + 1}ª reclamação na base${em90 > 0 ? ` (${em90} nos 90 dias antes desta — reincidência)` : ""}. A anterior, em ${ddmm(anterior.dia)}: "${curto(anterior.titulo, 70)}" · ${anterior.status}${anterior.nota !== undefined ? ` · nota ${anterior.nota}` : ""}.`
    );
  }

  const nps = retrato.nps[0];
  if (nps) {
    linhas.push(`Último NPS: nota ${nps.nota} em ${ddmm(nps.dia)}${nps.comentario ? ` — "${curto(nps.comentario)}"` : ", sem comentário"}.`);
  }

  const google = retrato.google.find((a) => a.estrelas <= 3) ?? retrato.google[0];
  if (google) {
    linhas.push(`Google: ${google.estrelas}★ em ${ddmm(google.dia)}${google.texto ? ` — "${curto(google.texto)}"` : ""}.`);
  }

  if (retrato.redes.length > 0) {
    linhas.push(`${retrato.redes.length === 1 ? "Um atendimento" : `${retrato.redes.length} atendimentos`} em redes sociais — o último em ${ddmm(retrato.redes[0].dia)}.`);
  }

  const fala = retrato.conversas.ultimaFala;
  if (fala) {
    const quando = fala.em ? ` em ${ddmm(fala.em)}` : "";
    linhas.push(`Na conversa guardada, a última fala do cliente${quando}: "${curto(fala.texto)}".`);
  }

  const fase = est?.fase ?? retrato.faseSemCadastro;
  if (fase === "Risco de cancelamento") linhas.push("Atenção: risco de cancelamento — o contato é de retenção.");
  if (fase === "Implantação") linhas.push("Está na implantação: a reclamação costuma ser de expectativa do começo — alinhe o que foi vendido.");

  return linhas;
}
