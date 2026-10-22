/**
 * As regras da revisão da mensagem no WhatsApp (22/10/2026) — puras, sem
 * tela, para valerem na hora (sem esperar a IA) e serem conferidas sozinhas.
 *
 * "Quando digitar alguma coisa no WhatsApp, a extensão me ajude com uma
 * resposta, corrija a frase... coisas que podem piorar a relação com o
 * cliente, dicas do que responder até para reter."
 *
 * Três tipos de aviso:
 * - **correção**: erro comum de português, com a troca pronta;
 * - **relação**: o que costuma piorar a conversa com cliente insatisfeito;
 * - **retenção**: o cliente falou em cancelar, e o rascunho não segura.
 */
(() => {
  const CW = (window.CWReputacao = window.CWReputacao || {});

  const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /* Erros comuns, com a troca. A primeira letra maiúscula é preservada na troca. */
  const CORRECOES = [
    [/\bseje\b/gi, "seja"],
    [/\besteje\b/gi, "esteja"],
    [/\bmenas\b/gi, "menos"],
    [/\bconcerteza\b/gi, "com certeza"],
    [/\bderrepente\b/gi, "de repente"],
    [/\bporisso\b/gi, "por isso"],
    [/\bagente (vai|vamos|pode|consegue|tem|esta|está|precisa|verifica|resolve)\b/gi, "a gente $1"],
    [/\bmim (fazer|ver|verificar|enviar|mandar|resolver|falar|explicar)\b/gi, "eu $1"],
    [/\bfazem (\d+|dois|tres|três|quatro|cinco|alguns|muitos) (dias|meses|anos|semanas)\b/gi, "faz $1 $2"],
    [/\bhaviam (dias|meses|pedidos|problemas)\b/gi, "havia $1"],
    [/\bvoce\b/g, "você"],
    [/\bnao\b/g, "não"],
    [/\bobrigado pelo paciencia\b/gi, "obrigado pela paciência"],
    [/ {2,}/g, " "],
  ];

  /* O que piora a relação — o padrão roda no texto sem acento e minúsculo. */
  const RELACAO = [
    { re: /\b(conforme|como) (ja |eu )?(informado|informei|dito|disse|falei|expliquei|mencionado)\b/, tom: "perigo", texto: "\"Conforme já informado\" soa como impaciência. Repita a informação sem cobrar o cliente por não ter lido." },
    { re: /\bnao (e|eh) (nossa|minha|de nossa) (culpa|responsabilidade)\b|\bnao temos (culpa|responsabilidade)\b/, tom: "perigo", texto: "Tirar a responsabilidade soa como desculpa. Diga o que nós vamos fazer, mesmo que a causa seja de outro." },
    { re: /\b(voce|vc) (deveria|devia|tinha que|teria que|nao leu|nao fez|errou|configurou errado)\b/, tom: "perigo", texto: "Isso culpa o cliente. Troque por \"vamos ajustar juntos\" e explique o passo." },
    { re: /\b(nao (tem|ha) (o que|nada que) (fazer|ser feito)|nao podemos fazer nada|nao tem como)\b/, tom: "perigo", texto: "Fecha a porta. Diga o que dá para fazer, nem que seja o próximo passo." },
    { re: /\b(se acalme|fique calmo|fica calmo|calma)\b/, tom: "atencao", texto: "\"Calma\" costuma irritar quem está irritado. Reconheça o problema no lugar." },
    { re: /\binfelizmente\b/, tom: "atencao", texto: "Comece pelo que dá para fazer; o \"infelizmente\" na abertura já prepara para o não." },
    { re: /\b(o )?(sistema|app|aplicativo) (e|eh|funciona) (assim|desse jeito|dessa forma)\b/, tom: "atencao", texto: "\"O sistema é assim\" encerra a conversa. Explique o porquê e ofereça uma alternativa." },
    { re: /\b(vc|vcs|pq|tb|tbm|blz|vlw|msg|obg|q)\b/, tom: "atencao", texto: "Abreviação deixa informal demais para quem está reclamando. Escreva por extenso." },
  ];

  /* Prazo prometido: vira compromisso — e cobrança, se não cumprir. */
  const PRAZO = /\b(ate|em) (hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|\d{1,2}\/\d{1,2}|\d+ ?(h|hora|horas|min|minutos|dia|dias))\b|\b(ainda hoje|hoje mesmo|amanha cedo|ate o fim do dia)\b/;
  const VERBO_DE_PRAZO = /\b(resolv|retorn|corrig|ajust|volt|fica pronto|estara|vai estar|libera|cai|caira|devolv|estorn)/;

  /* O cliente falando em sair. */
  const CANCELAR = /\b(cancelar|cancelamento|vou sair|quero sair|trocar de sistema|outro sistema|concorrente|desistir|encerrar (o |meu )?(plano|contrato)|nao quero mais)\b/;
  /* O rascunho facilitando a saída. */
  const FACILITA_SAIDA = /\b(pode cancelar|segue o link (para|de) cancel|link (para|de) cancelamento|vou (abrir|fazer|seguir com) o cancelamento|cancelamento (foi|sera|esta) (feito|solicitado|aberto))\b/;
  /* O rascunho tentando reter: reconhece, propõe ou oferece algo. */
  const TENTA_RETER = /\b(entendo|entendi|sinto muito|lamento|vamos resolver|posso (te )?(ligar|ajudar|propor|oferecer)|proposta|ajuste|desconto|condicao|antes de|o que (podemos|posso) fazer|me da uma chance|quero resolver)\b/;

  function maiusculasGritando(texto) {
    const palavras = String(texto || "").match(/[A-ZÀ-Ý]{5,}/g) || [];
    return palavras.filter((p) => !/^(PDV|KDS|CNPJ|CPF|IFOOD|PIX|WHATSAPP|URGENTE)$/.test(p)).length >= 2;
  }

  /**
   * A revisão de um rascunho, com as últimas mensagens da conversa.
   * Devolve `{ correcoes: [{de, para}], corrigido, avisos: [{tom, texto}], retencao }`.
   */
  function revisar(texto, mensagens) {
    const original = String(texto || "");
    let corrigido = original;
    const correcoes = [];
    for (const [re, troca] of CORRECOES) {
      corrigido = corrigido.replace(re, (achado, ...grupos) => {
        let para = troca.replace(/\$(\d)/g, (_, n) => grupos[Number(n) - 1] ?? "");
        if (/^[A-ZÀ-Ý]/.test(achado) && para) para = para[0].toUpperCase() + para.slice(1);
        if (para !== achado && achado.trim()) correcoes.push({ de: achado, para });
        return para;
      });
    }

    const norma = sem(original);
    const avisos = [];
    for (const r of RELACAO) if (r.re.test(norma)) avisos.push({ tom: r.tom, texto: r.texto });
    if (maiusculasGritando(original)) avisos.push({ tom: "atencao", texto: "Palavras inteiras em maiúsculas soam como grito." });
    if (/[!?]{3,}/.test(original)) avisos.push({ tom: "atencao", texto: "Pontuação repetida (\"!!!\", \"???\") deixa a mensagem tensa." });
    if (PRAZO.test(norma) && VERBO_DE_PRAZO.test(norma)) avisos.push({ tom: "atencao", texto: "Você está prometendo prazo. Confira se dá para cumprir — prazo perdido pesa mais que prazo nenhum." });

    const doCliente = (Array.isArray(mensagens) ? mensagens : []).filter((m) => m && m.de !== "nos").slice(-6).map((m) => sem(m.texto)).join("\n");
    let retencao = "";
    if (FACILITA_SAIDA.test(norma)) {
      avisos.push({ tom: "perigo", texto: "O rascunho facilita o cancelamento antes de tentar reter." });
      retencao = "Antes do caminho do cancelamento: reconheça o problema, diga o que muda a partir de agora e proponha um próximo passo concreto (ligação, ajuste, acompanhamento).";
    } else if (CANCELAR.test(doCliente) && !TENTA_RETER.test(norma)) {
      retencao = "O cliente falou em sair. Reconheça o motivo dele com as palavras dele, mostre o que vamos fazer e ofereça um próximo passo concreto — uma ligação costuma reter mais que texto.";
    }

    return { correcoes, corrigido: corrigido === original ? original : corrigido, avisos, retencao };
  }

  CW.revisaoDaMensagem = { revisar };
})();
