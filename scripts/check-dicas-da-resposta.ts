/**
 * As dicas da resposta pública casam pelo assunto, não por palavra solta.
 *
 *   npm run check:dicas-da-resposta
 *
 * 16/11/2026: "a extensão entregou algumas informações coerentes com a
 * reclamação e outras sem sentido". Na reclamação ID 262352671 (sem
 * treinamento nem suporte) aparecia a integração de pedidos com SAIPOS e
 * Foody. Sem banco: aprendizados e reclamações de exemplo, tirados dos reais.
 */
import { analisarResposta } from "../lib/models/analistaDeRespostas";
import { dicasParaAResposta, relevantes, type Aprendizado } from "../lib/models/aprendizados";
import { conferirRascunho } from "../lib/models/rascunho";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)}`);
}

const ap = (assunto: string, texto: string, fonte = "avaliacoes", vezes = 1): Aprendizado => ({ assunto, texto, fonte, vezes });
const APRENDIZADOS = [
  ap("Integração múltipla de pedidos", "A Cardápio Web pode enviar pedidos simultaneamente para mais de uma plataforma de delivery, como SAIPOS e Foody Delivery, quando configurada corretamente.", "whatsapp", 2),
  ap("Múltiplos atendentes gera frustração", "Cliente reclama quando precisa falar com vários atendentes.", "whatsapp"),
  ap("Reabrir WhatsApp no Edge resolve bloqueio", "Fechar e reabrir o WhatsApp no Edge costuma restaurar a conexão.", "whatsapp"),
  ap("Suporte: canal de contato direto", "Oferecer o chat da plataforma e o e-mail de suporte como canais de acompanhamento."),
  ap("Atendimento: reunião agendada", "Respostas boas reconhecem a reunião perdida e reprogramam."),
  ap("Sistema: impressão de pedidos", "Nas boas o problema de impressão é resolvido e o cliente recebe instruções."),
  ap("Financeiro: prazo e comprovante de estorno", "Informe o prazo exato do estorno e envie o comprovante.", "avaliacoes", 3),
  ap("Cancelamento: confirmação e devolução", "Confirme o cancelamento e a devolução com data."),
  ap("Integração iFood: erro resolvido", "Diga o que foi testado e ajustado na integração."),
  ap("Sistema: diagnóstico e prazo de correção", "Diga o que foi encontrado e quando a correção sai."),
];

console.log("\n  DICAS PELO ASSUNTO\n");
const assuntos = (titulo: string, descricao: string) => dicasParaAResposta(APRENDIZADOS, { titulo, descricao }).map((a) => a.assunto);

conferir(
  "ID 262352671: sem treinamento nem suporte → só o contato direto",
  assuntos(
    "Contratei plano para restaurante e não recebi treinamento nem suporte",
    "Fiz a contratação do plano para meu restaurante, levaram uma semana para montar a plataforma, mas não me dispuseram de treinamentos, não respondem no suporte e quando respondem mandam vídeos para que você mesmo resolva o problema."
  ),
  ["Suporte: canal de contato direto"]
);
conferir(
  "reembolso após cancelar → estorno e cancelamento, sem impressão",
  assuntos("Solicitei o cancelamento e não recebi o estorno", "Cancelei faz 20 dias e o reembolso não caiu."),
  ["Cancelamento: confirmação e devolução", "Financeiro: prazo e comprovante de estorno"]
);
conferir(
  "impressora parou → impressão (e a falha)",
  assuntos("Impressora não imprime os pedidos", "Desde ontem a impressão parou."),
  ["Sistema: impressão de pedidos", "Sistema: diagnóstico e prazo de correção"]
);
conferir(
  "integração com 99food com erro → integração e falha",
  assuntos("Erro na integração com 99food", "Os pedidos não chegam."),
  ["Integração iFood: erro resolvido", "Sistema: diagnóstico e prazo de correção"]
);
conferir("reclamação sem assunto reconhecível → nenhuma dica", assuntos("Serviços péssimo", "Não gostei."), []);
conferir(
  "aprendizado do WhatsApp nunca vira dica da resposta pública",
  dicasParaAResposta(APRENDIZADOS, { titulo: "WhatsApp bloqueado no Edge", descricao: "bloqueio" }).some((a) => a.fonte === "whatsapp"),
  false
);

console.log("\n  PALAVRA SOLTA NÃO CASA (relevantes, usado nas conversas)\n");
conferir(
  "'plataforma' e 'quando' não puxam a integração com SAIPOS",
  relevantes(APRENDIZADOS, "não me deram treinamento na plataforma e quando respondem mandam vídeos").map((a) => a.assunto).includes("Integração múltipla de pedidos"),
  false
);

console.log("\n  O ANALISTA\n");
const valida = (t: string) => conferirRascunho(t, { publico: true }).some((a) => a.tipo === "sem-validacao");
conferir("'Entendemos sua insatisfação' reconhece o transtorno", valida("Olá, Maria. Entendemos sua insatisfação e já acionamos o time responsável."), false);
conferir("'Sentimos muito' reconhece o transtorno", valida("Olá, Maria. Sentimos muito pelo ocorrido, já acionamos o time responsável."), false);
conferir("só explicação continua sem validação", valida("Olá, Maria. O plano foi ativado no dia 3 e o time responsável acompanha."), true);
const resolvido = (t: string) => analisarResposta(t, { validado: false }).achados.some((a) => a.tipo === "resolvido-sem-validar");
conferir("'foi resolvido' sem o cliente confirmar avisa", resolvido("Olá, Maria. O problema foi resolvido pelo nosso time."), true);
conferir("'não foi resolvido' não é dizer que resolveu", resolvido("Olá, Maria. Sabemos que o problema não foi resolvido no primeiro contato."), false);
conferir("'ainda não está resolvido' também não", resolvido("Olá, Maria. O problema ainda não está resolvido, e seguimos nele."), false);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
