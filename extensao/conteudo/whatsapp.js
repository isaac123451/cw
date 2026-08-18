/**
 * Detector do WhatsApp Web.
 *
 * **O que este arquivo lê:** o identificador da conversa aberta e o
 * nome no cabeçalho. Só isso. Não lê mensagem, não lê histórico, não
 * envia nada para lugar nenhum além da consulta ao próprio CW
 * Reputação — que recebe um telefone, não uma conversa.
 *
 * **Por que ler o `data-id` e não só o cabeçalho:** com o contato
 * salvo na agenda, o cabeçalho mostra o apelido ("Pizzaria do João") e
 * o número não aparece em lugar nenhum da tela. O atributo `data-id`
 * das mensagens carrega o identificador real — `...5527999996862@c.us`
 * —, que é o que serve para cruzar com a base.
 *
 * **Por que pesquisa em intervalo em vez de observar o DOM:** o
 * WhatsApp Web reescreve a árvore continuamente, e um `MutationObserver`
 * na página inteira dispararia milhares de vezes por minuto. Uma
 * leitura barata a cada 1,2 s custa menos e erra menos.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  CW.painel.montar();

  const INTERVALO = 1200;

  function lerConversa() {

    const principal = document.querySelector("#main");

    if (!principal) return null;

    let telefone = "";
    let grupo = false;

    const comId = principal.querySelector("[data-id]");

    if (comId) {

      const bruto = comId.getAttribute("data-id") ?? "";

      if (bruto.includes("@g.us")) grupo = true;

      const achado = bruto.match(/(\d{8,20})@c\.us/);

      if (achado) telefone = achado[1];
    }

    const cabecalho = principal.querySelector("header");

    let nome = "";

    if (cabecalho) {

      const comTitulo =
        cabecalho.querySelector("span[title]");

      nome =
        comTitulo?.getAttribute("title")?.trim() ??
        CW.texto(cabecalho.querySelector("span"), 80);
    }

    /**
     * Contato fora da agenda: o cabeçalho já é o próprio número. Serve
     * de rede quando a conversa ainda não tem mensagem e o `data-id`
     * não existe.
     */
    if (!telefone && nome) {

      const digitos = CW.digitos(nome);

      if (
        digitos.length >= 10 &&
        /^[+\d\s()\-]+$/.test(nome)
      ) {
        telefone = digitos;
      }
    }

    if (!telefone && !nome) return null;

    return { telefone, nome, grupo };
  }

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    const conversa = lerConversa();

    if (!conversa) {
      ultimaChave = "";
      return;
    }

    const chave = `${conversa.telefone}|${conversa.nome}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    /**
     * Grupo não é cliente: um grupo de suporte com dez pessoas casaria
     * com qualquer coisa e não representa ninguém.
     */
    if (conversa.grupo) {
      CW.painel.definirContexto({
        rotulo: "conversa em grupo",
      });
      return;
    }

    CW.painel.definirContexto({
      telefone: conversa.telefone,
      nome: conversa.nome,
      rotulo: conversa.nome || conversa.telefone,
    });
  }

  setInterval(verificar, INTERVALO);

  verificar();
})();
