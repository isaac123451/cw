/**
 * Os textos que o leitor de planilha põe no lugar do que a planilha não
 * traz.
 *
 * A planilha do Reclame Aqui diz **se** a empresa respondeu, e não **o
 * que** respondeu. Para a reclamação não nascer com o campo vazio — o
 * que faria o índice de resposta contar errado —, o leitor grava um
 * marcador.
 *
 * **São marcadores, não conteúdo, e a diferença custa caro.** Gravar
 * por cima de uma reclamação que já existe troca a resposta de verdade
 * pelos 38 caracteres daqui. Foram 334 reclamações a um passo disso pelo
 * script, e 142 pelo botão Importar da tela.
 *
 * **Módulo próprio, e leve, de propósito.** Moravam em
 * `raImport.service`, que carrega a biblioteca de planilha (`xlsx`, perto
 * de 1 MB). A regra que recusa os marcadores é usada pela gravação de
 * casos — e com ela, pela rota da extensão que roda a cada conversa
 * aberta no WhatsApp. Importar daqui não arrasta a planilha junto.
 */
export const RESPOSTA_SINTETICA =
  "Resposta pública registrada no portal.";

export const RELATO_SINTETICO =
  "Reclamação registrada no Reclame Aqui.";
