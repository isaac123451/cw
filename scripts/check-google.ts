/**
 * Prova das regras do Google — `lib/models/avaliacoesGoogle.ts`.
 *
 * Sem banco. A tabela de classificação do documento (inclusive os dois
 * casos que a nota sozinha não decide: o elogio com ressalva e a nota
 * média com problema aberto), os prazos de resposta com fim de semana
 * no meio, a régua contra resposta genérica, e os quatro indicadores.
 *
 *   npm run check:google
 */
import {
  classificarAvaliacao,
  conferirResposta,
  indicadoresGoogle,
  prazoDeResposta,
  venceEm,
  type AvaliacaoParaIndicador,
} from "../lib/models/avaliacoesGoogle";
import { sinaisDeCrise } from "../lib/models/redes";
import { descreverRegistro, instanteDe } from "../lib/services/horasUteis";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

function br(texto: string) {
  const [dia, hora] = texto.split(" ");
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m).toISOString();
}

const resumo = (estrelas: number, texto?: string, reincidente = false) => {
  const t = classificarAvaliacao(estrelas, texto, reincidente);
  return [t.classificacao, t.criticidade, ...t.motivos];
};

console.log("\n— A tabela do documento —");
confere("5 estrelas sem crítica: positiva", resumo(5, "Sistema excelente, o suporte me ajudou rápido."), ["positiva", "Normal"]);
confere("5 estrelas sem comentário: positiva", resumo(5), ["positiva", "Normal"]);
confere("3 estrelas: neutra", resumo(3, "Ok."), ["neutra", "Normal"]);
confere("4 estrelas com ressalva: neutra", resumo(4, "Gosto do sistema, mas o suporte demora."), ["neutra", "Normal"]);
confere("4 estrelas relatando problema não resolvido: negativa", resumo(4, "Bom, porém a impressora não funciona desde ontem."), ["negativa", "Alta"]);
confere("1 estrela: negativa Alta", resumo(1, "Péssimo."), ["negativa", "Alta"]);
confere("negativa com Procon: Urgente", resumo(1, "Vou no Procon amanhã."), ["negativa", "Urgente", "juridico"]);
confere("negativa com cobrança indevida: Urgente", resumo(2, "Cobrança indevida no meu cartão."), ["negativa", "Urgente", "cobranca"]);
confere("negativa reincidente: Urgente", resumo(2, "Ruim.", true), ["negativa", "Urgente", "reincidencia"]);
confere("'processo de cadastro' não é risco jurídico", resumo(1, "O processo de cadastro é confuso."), ["negativa", "Alta"]);
confere("'vou processar vocês' é", resumo(1, "Se não devolverem vou processar vocês."), ["negativa", "Urgente", "juridico"]);
confere("5 estrelas não ganha urgência, nem citando processo", resumo(5, "Ótimo processo de implantação.", true), ["positiva", "Normal"]);
confere("'não falta nada' é elogio", resumo(5, "Não falta nada, tudo perfeito."), ["positiva", "Normal"]);
confere("'não poderia ser melhor' é elogio", resumo(5, "Atendimento não poderia ser melhor."), ["positiva", "Normal"]);
confere("'falta' sem o não é ressalva", resumo(4, "Muito bom, falta integração com o iFood."), ["neutra", "Normal"]);
confere("'não consigo mais trabalhar sem' é elogio", resumo(5, "Não consigo mais trabalhar sem o sistema."), ["positiva", "Normal"]);
confere("'não consigo acessar' é problema aberto", resumo(4, "Gostava, mas não consigo acessar o painel."), ["negativa", "Alta"]);

console.log("\n— Prazo de resposta —");
confere("Urgente 4h, Alta 24h, Normal 48h", ["Urgente", "Alta", "Normal", "Baixa"].map((p) => prazoDeResposta(p as never)), [4, 24, 48, 48]);
confere("Urgente às 16h de segunda vence às 10h de terça", descreverRegistro(venceEm(br("2026-09-14 16:00"), "Urgente").toISOString()), "15/09 10:00");
confere("Alta na sexta às 16h vence na segunda às 16h", descreverRegistro(venceEm(br("2026-09-18 16:00"), "Alta").toISOString()), "21/09 16:00");
confere("Normal no sábado conta da abertura de segunda", descreverRegistro(venceEm(br("2026-09-19 11:00"), "Normal").toISOString()), "23/09 08:00");

console.log("\n— A resposta pública —");
const avisos = (resposta: string, classificacao: "positiva" | "neutra" | "negativa", semelhancaMaxima?: number) =>
  conferirResposta({ resposta, autor: "joão pereira", classificacao, semelhancaMaxima }).map((a) => a.aviso.split(" ")[0]);
const longa = "Muito obrigado pelo carinho e por contar como o cardápio digital ajudou no movimento do fim de semana!";
confere("vazia: nada a conferir", avisos("", "positiva"), []);
confere("positiva sem o nome: pede o agradecimento nominal", avisos(longa, "positiva"), ["Agradeça"]);
confere("positiva com o nome, mesmo sem acento", avisos(`Joao, ${longa}`, "positiva"), []);
confere("curta demais", avisos("Obrigado, João!", "positiva"), ["Curta"]);
confere("igual a uma já publicada", avisos(`João, ${longa}`, "positiva", 72), ["72%"]);
const negativaBoa = "Sentimos muito pela experiência com a impressora. Queremos entender o que aconteceu: chame a gente no WhatsApp do suporte.";
confere("negativa com canal privado e sem promessa: ok", avisos(negativaBoa, "negativa"), []);
confere("negativa sem canal privado", avisos("Sentimos muito pela experiência com a impressora e já estamos olhando o que aconteceu no seu caso.", "negativa"), ["Direcione"]);
confere("negativa prometendo solução", avisos(`${negativaBoa} Vamos resolver hoje.`, "negativa"), ["Não"]);
confere("negativa com tom defensivo", avisos(`${negativaBoa} Conforme contrato, a instalação é do cliente.`, "negativa"), ["Tom"]);
confere("a negativa não exige o nome", avisos(negativaBoa, "negativa").includes("Agradeça"), false);

console.log("\n— Indicadores —");
const lista: AvaliacaoParaIndicador[] = [
  { estrelas: 5, classificacao: "positiva", publicadaEm: br("2026-09-14 09:00"), respondidaEm: br("2026-09-14 11:00"), status: "respondida" },
  { estrelas: 1, classificacao: "negativa", publicadaEm: br("2026-09-14 10:00"), respondidaEm: br("2026-09-15 10:00"), notaAtualizada: 4, status: "respondida" },
  { estrelas: 2, classificacao: "negativa", publicadaEm: br("2026-09-14 10:00"), respondidaEm: br("2026-09-17 10:00"), status: "sem-retorno" },
  { estrelas: 3, classificacao: "neutra", publicadaEm: br("2026-09-16 10:00"), status: "aberta" },
  { estrelas: 1, classificacao: "negativa", publicadaEm: br("2026-09-16 10:00"), status: "denunciada" },
];
const ind = indicadoresGoogle(lista);
confere("denunciada fica fora do total", ind.total, 4);
confere("nota média usa a nota atualizada (5+4+2+3)/4", ind.notaMedia, 3.5);
confere("respondidas", [ind.respondidas, ind.percentualRespondidas], [3, 75]);
confere("tempo mediano em minutos úteis (2h, 10h, 30h)", ind.tempoMedianoMin, 600);
confere("dentro de 48h úteis: a de 30h úteis (3 dias corridos) fica fora", ind.noPrazo, 2);
confere("negativas revertidas", [ind.negativas, ind.revertidas, ind.percentualRevertidas], [2, 1, 50]);
confere("sem avaliação, nada inventado", indicadoresGoogle([]).notaMedia, null);

console.log("\n— O mesmo corte jurídico nas Redes —");
const caso = { id: "g1", title: "", category: "Pagamento", createdAt: "2026-09-14", recebidaEm: br("2026-09-14 09:00") };
confere("'o processo de cadastro' nas redes não é crise", sinaisDeCrise({ ...caso, description: "o processo de cadastro é confuso" }, [], new Date(br("2026-09-14 12:00"))), []);
confere("'entrar com uma ação' é", sinaisDeCrise({ ...caso, description: "vou entrar com uma ação" }, [], new Date(br("2026-09-14 12:00"))).map((s) => s.motivo), ["menciona ação judicial"]);

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
