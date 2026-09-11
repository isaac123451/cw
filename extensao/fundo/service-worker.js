import {
  gravarConfig,
  lerConfig,
  normalizarBase,
  padraoDeOrigem,
} from "../comum/config.js";

import {
  ehDesafio,
  enderecoDaLista,
  enderecoDaReclamacao,
  lerLista,
  lerReclamacao,
} from "../comum/portal-ra.js";

/**
 * O service worker é o único que fala com o CW Reputação.
 *
 * Todo o resto da extensão — painel, popup, opções — manda uma mensagem
 * para cá. A concentração existe por dois motivos concretos:
 *
 * 1. **Cookie.** A sessão (`cw_session`) é `httpOnly`: página nenhuma
 *    consegue lê-la por JavaScript. Só a API `chrome.cookies`, que
 *    existe aqui e não no script de conteúdo.
 * 2. **Origem cruzada.** Desde o Manifest V3, script de conteúdo está
 *    sujeito a CORS como qualquer página. O service worker, não: ele
 *    atravessa por causa de `host_permissions`. Buscar daqui é o que
 *    faz a chamada funcionar sem afrouxar o servidor.
 */

const CAMINHOS = {
  sessao: "/api/extensao/sessao",
  contexto: "/api/extensao/contexto",
  resumo: "/api/extensao/resumo",
  caso: "/api/extensao/caso",
  lembretes: "/api/extensao/lembretes",
  conversa: "/api/extensao/conversa",
  nps: "/api/extensao/nps",
  mover: "/api/extensao/mover",
  fila: "/api/extensao/fila",
  anotar: "/api/extensao/anotar",
  detalhe: "/api/extensao/detalhe",
  agenda: "/api/extensao/agenda",
  triagem: "/api/extensao/triagem",
  resumoCaso: "/api/extensao/resumo-caso",
  pendencias: "/api/extensao/pendencias",
  salvarDossie: "/api/extensao/salvar-dossie",
  whatsapp: "/api/extensao/whatsapp",
  respostas: "/api/extensao/respostas",
  raNovas: "/api/extensao/ra-novas",
  raVigia: "/api/extensao/ra-vigia",
  completar: "/api/extensao/completar",
};

/**
 * Guarda respostas por pouco tempo.
 *
 * O DOM do WhatsApp se reescreve o tempo todo, e o detector dispara com
 * frequência. Sem isto, trocar de conversa e voltar renderia dezenas de
 * consultas iguais em poucos segundos.
 */
/**
 * Fresco por dois minutos; servível por trinta.
 *
 * Dois prazos porque são duas perguntas diferentes. Dentro do primeiro,
 * o dado é bom e a resposta sai sem tocar na rede. Entre um e outro, o
 * dado é **velho mas útil**: o painel desenha na hora com ele e pede
 * uma atualização em seguida — que é a diferença entre uma gaveta que
 * abre instantânea e uma que fica dois segundos em "Consultando…".
 */
const FRESCO_MS = 120_000;
const SERVIVEL_MS = 30 * 60_000;

/**
 * O cache mora no `chrome.storage.session`, não em memória.
 *
 * Isto era um `Map`, e o `Map` não sobrevivia: no Manifest V3 o service
 * worker é **encerrado depois de poucos segundos ocioso** e recriado na
 * próxima mensagem. Na prática quase nenhuma consulta acertava o cache,
 * e cada abertura do painel pagava a ida completa ao servidor — era boa
 * parte da lentidão que se sentia.
 *
 * `session` e não `local`: some ao fechar o navegador, que é o
 * comportamento certo para retrato de cliente. Nada de contato de
 * consumidor fica gravado em disco.
 */
const deposito =
  chrome.storage.session ?? chrome.storage.local;

function chaveDoCache(chave) {
  return `cache:${chave}`;
}

async function doCache(chave) {

  try {

    const nome = chaveDoCache(chave);

    const guardado = (await deposito.get(nome))[nome];

    if (!guardado) return null;

    const idade = Date.now() - guardado.em;

    if (idade > SERVIVEL_MS) {
      await deposito.remove(nome);
      return null;
    }

    return {
      dados: guardado.dados,
      vencido: idade > FRESCO_MS,
    };

  } catch {
    // Storage indisponível não pode derrubar a consulta.
    return null;
  }
}

async function guardar(chave, dados) {
  try {
    await deposito.set({
      [chaveDoCache(chave)]: { em: Date.now(), dados },
    });
  } catch {
    /**
     * Cota do storage estourada, por exemplo. Perder o cache é
     * aceitável; perder a resposta que já está em mãos, não.
     */
  }
}

/** Esquece tudo — depois de gravar, o retrato guardado envelheceu. */
async function limparCache() {
  try {
    const tudo = await deposito.get(null);

    const nossas = Object.keys(tudo).filter((k) =>
      k.startsWith("cache:")
    );

    if (nossas.length) await deposito.remove(nossas);
  } catch {
    /* nada a fazer */
  }
}

/* ============================================================
   CHAMADA
============================================================ */

class FalhaNaChamada extends Error {
  constructor(codigo, mensagem, extra = {}) {
    super(mensagem);
    this.codigo = codigo;
    Object.assign(this, extra);
  }
}

/**
 * `corpo` transforma a chamada em POST.
 *
 * Três rotas escrevem: a que cria reclamação a partir do que a extensão
 * leu no portal, a que registra a tratativa de NPS, e a que pede o
 * resumo da conversa (que grava nada, mas manda texto e por isso não
 * cabe numa query string). Todas as outras seguem sendo GET.
 */
async function chamar(caminho, parametros = {}, corpo) {

  const config = await lerConfig();

  const base = normalizarBase(config.base);

  if (!base) {
    throw new FalhaNaChamada(
      "sem-endereco",
      "Endereço do CW Reputação não configurado."
    );
  }

  const origem = padraoDeOrigem(base);

  const temPermissao = await chrome.permissions.contains({
    origins: [origem],
  });

  if (!temPermissao) {
    throw new FalhaNaChamada(
      "sem-permissao",
      `A extensão ainda não tem permissão para acessar ${base}.`,
      { base }
    );
  }

  /**
   * A sessão vai no cabeçalho, e não solta como cookie.
   *
   * O cookie é `SameSite=Lax`, e uma requisição que nasce em
   * `chrome-extension://` é de outro site aos olhos do navegador — o
   * que torna o envio automático imprevisível. Lendo e mandando
   * explicitamente, o comportamento é o mesmo em qualquer versão, e a
   * rota do servidor aceita esse cabeçalho de propósito.
   */
  let cookie = null;

  try {
    cookie = await chrome.cookies.get({
      url: base,
      name: "cw_session",
    });
  } catch {
    cookie = null;
  }

  const url = new URL(base + caminho);

  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  }

  const cabecalhos = { Accept: "application/json" };

  if (cookie?.value) {
    cabecalhos["X-CW-Sessao"] = cookie.value;
  }

  if (corpo !== undefined) {
    cabecalhos["Content-Type"] = "application/json";
  }

  let resposta;

  try {
    resposta = await fetch(url.toString(), {
      method: corpo === undefined ? "GET" : "POST",
      headers: cabecalhos,
      body:
        corpo === undefined
          ? undefined
          : JSON.stringify(corpo),
      credentials: "omit",
      cache: "no-store",
    });
  } catch (erro) {
    throw new FalhaNaChamada(
      "rede",
      `Não foi possível falar com ${base}. O endereço está certo e a aplicação está no ar?`,
      { base, detalhe: String(erro?.message ?? erro) }
    );
  }

  if (resposta.status === 401) {
    throw new FalhaNaChamada(
      "sessao",
      "Sessão expirada. Entre no CW Reputação neste navegador.",
      { base }
    );
  }

  if (!resposta.ok) {

    let detalhe = "";

    try {
      const corpo = await resposta.json();
      detalhe = corpo?.erro ?? corpo?.error ?? "";
    } catch {
      detalhe = "";
    }

    /**
     * 404 numa rota que a extensão conhece tem **um** significado.
     *
     * Todos os caminhos daqui saem de `CAMINHOS`, e `check:fiacao`
     * confere que cada um existe no repositório. Então, se o servidor
     * responde 404 num deles, o arquivo existe aqui e não lá: a
     * aplicação no ar é mais antiga que esta extensão — falta um push,
     * ou o deploy falhou.
     *
     * Foi exatamente isto em 09/09/2026, com o atalho de respostas
     * rápidas: a rota estava no repositório, a extensão já a chamava, a
     * produção ainda não a tinha. E a mensagem que aparecia era
     * "A aplicação respondeu 404." — que não diz nada e manda procurar
     * defeito no lugar errado.
     */
    if (resposta.status === 404) {
      throw new FalhaNaChamada(
        "versao",
        `A aplicação em ${base} ainda não tem esta função. A extensão está na frente do que está no ar — falta publicar a versão nova (git push, e o deploy passar).`,
        { base, status: 404 }
      );
    }

    throw new FalhaNaChamada(
      "http",
      detalhe ||
        `A aplicação respondeu ${resposta.status}.`,
      { base, status: resposta.status }
    );
  }

  /**
   * Resposta 200 que não é JSON.
   *
   * Acontece de verdade, e o sintoma era péssimo: um
   * `Unexpected token '<', "<!DOCTYPE "...` cru chegava à tela, sem
   * dizer o que fazer. As causas são todas de endereço — apontar para
   * um servidor que não é o CW Reputação, para um proxy com página de
   * login, ou para uma aplicação de uma versão anterior à rota que a
   * extensão está chamando. Todas se resolvem em Opções, e é isso que
   * a mensagem precisa dizer.
   */
  const tipo =
    resposta.headers.get("content-type") ?? "";

  if (!tipo.includes("json")) {

    const inicio = (await resposta.text())
      .slice(0, 120)
      .replace(/\s+/g, " ")
      .trim();

    throw new FalhaNaChamada(
      "resposta",
      `${base} respondeu uma página, não dados. Confira o endereço do CW Reputação nas Opções — e se a aplicação no ar já tem esta versão.`,
      { base, inicio }
    );
  }

  try {
    return await resposta.json();
  } catch {
    throw new FalhaNaChamada(
      "resposta",
      `${base} respondeu algo que não dá para ler. Confira o endereço nas Opções.`,
      { base }
    );
  }
}

/* ============================================================
   MENSAGENS
============================================================ */

async function tratar(mensagem) {

  if (mensagem?.tipo === "config") {
    const config = await lerConfig();
    return {
      ok: true,
      dados: { ...config, base: normalizarBase(config.base) },
    };
  }

  if (mensagem?.tipo === "sessao") {
    return { ok: true, dados: await chamar(CAMINHOS.sessao) };
  }

  if (mensagem?.tipo === "contexto") {

    const consulta = mensagem.consulta ?? {};

    const chave = JSON.stringify(consulta);

    const guardado = mensagem.forcar
      ? null
      : await doCache(chave);

    if (guardado) {
      /**
       * Velho ainda serve — e o painel decide o que fazer com isso.
       * `vencido` é o sinal para ele pedir a atualização depois de já
       * ter desenhado.
       */
      return {
        ok: true,
        dados: guardado.dados,
        doCache: true,
        vencido: guardado.vencido,
      };
    }

    const dados = await chamar(
      CAMINHOS.contexto,
      consulta
    );

    await guardar(chave, dados);

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "resumo") {

    const dados = await chamar(CAMINHOS.resumo);

    await aplicarContador(dados);

    return { ok: true, dados };
  }

  /**
   * Preferência gravada pelo próprio painel — tema e largura.
   *
   * Fica aqui e não no script de conteúdo porque `chrome.storage` não
   * existe do lado de lá com a mesma garantia, e porque o popup e a
   * tela de opções precisam ler o mesmo valor.
   */
  if (mensagem?.tipo === "salvar") {
    const config = await gravarConfig(
      mensagem.parcial ?? {}
    );
    return { ok: true, dados: config };
  }

  /**
   * Cria (ou atualiza) uma reclamação a partir do que a extensão leu
   * no portal. É a única escrita da extensão, e ela é explícita: só
   * acontece quando alguém clica em "Adicionar ao Kanban".
   */
  if (mensagem?.tipo === "criarCaso") {

    const dados = await chamar(
      CAMINHOS.caso,
      {},
      mensagem.caso ?? {}
    );

    // A base mudou: o retrato guardado envelheceu na hora.
    await limparCache();

    return { ok: true, dados };
  }

  /**
   * Avança ou volta um caso uma etapa do quadro.
   *
   * A extensão manda a **direção**, não a etapa: a ordem das colunas é
   * cadastro, muda na tela de configurações, e uma extensão instalada
   * há três semanas teria uma cópia velha dela. Quem resolve é o
   * servidor.
   */
  if (mensagem?.tipo === "moverCaso") {

    const dados = await chamar(CAMINHOS.mover, {}, {
      protocolo: mensagem.protocolo,
      direcao: mensagem.direcao,
      para: mensagem.para,
    });

    await limparCache();

    return { ok: true, dados };
  }

  /**
   * A fila aberta de um canal, sem depender de contato.
   *
   * Sem cache, ao contrário do contexto: esta é a lista de
   * trabalho, e uma fila de 45 segundos atrás já não descreve o que
   * está aberto agora.
   */
  /**
   * Anotação de caso ou tarefa de agenda.
   *
   * Limpa o cache porque a anotação entra na linha do tempo que o
   * painel mostra logo abaixo dela.
   */
  /**
   * Os textos aprovados, para o atalho ao lado da caixa de mensagem.
   *
   * Sem cache, e de propósito. A lista muda por duas vias que um
   * retrato guardado não veria: alguém edita um texto na Base de
   * Conhecimento, e o próprio atalho conta o uso — que é o que
   * reordena a lista. Guardar congelaria o topo justamente naquilo
   * que a ordenação existe para corrigir.
   *
   * É uma consulta por clique, não por conversa: a lista só é buscada
   * quando alguém abre o atalho.
   */
  if (mensagem?.tipo === "respostas") {

    const dados = await chamar(
      CAMINHOS.respostas,
      mensagem.consulta ?? {}
    );

    return { ok: true, dados };
  }

  /**
   * O texto foi colado na caixa: conta o uso.
   *
   * Chamada solta, sem ninguém esperando — o texto já está na tela de
   * quem clicou. Falhar aqui não pode desfazer nem atrapalhar a
   * inserção, então quem chama ignora o retorno.
   */
  /**
   * Quais reclamações desta página do portal ainda não estão aqui.
   *
   * Sem cache: a resposta muda no instante em que alguém importa uma
   * delas, e mostrar "nova" para o que já entrou faria a pessoa
   * capturar de novo. A varredura só pergunta quando o conjunto de
   * links da página muda, então o custo é baixo.
   */
  if (mensagem?.tipo === "raNovas") {

    const dados = await chamar(
      CAMINHOS.raNovas,
      {},
      { codigos: mensagem.codigos ?? [] }
    );

    return { ok: true, dados };
  }

  /**
   * A leitura do portal: pelo botão ("manual") ou ao abrir a plataforma.
   *
   * **Só estas duas portas, por pedido do Isaac:** "só verifique a
   * página do Reclame Aqui da Cardápio somente quando eu abra a
   * plataforma, crie um botão de atualizar/leitura". Não há mais relógio
   * lendo o portal em segundo plano.
   *
   * Abrir a plataforma várias vezes seguidas — outra aba, um F5 — não
   * vira várias leituras: dentro do intervalo mínimo devolve a última.
   * O botão sempre lê.
   */
  if (mensagem?.tipo === "vigiaAgora") {

    const { estado } = await lerEstadoDoVigia();

    const idade = estado?.em ? Date.now() - estado.em : Infinity;

    const parado =
      estado && !estado.ok && String(estado.codigo ?? "").startsWith("portal");

    const vale =
      mensagem.motivo === "manual" ||
      parado ||
      idade > INTERVALO_MINIMO_MIN * 60_000;

    return {
      ok: true,
      dados: vale
        ? await vigiar(mensagem.motivo === "manual" ? "manual" : "plataforma")
        : { ...(estado ?? {}), reaproveitada: true },
    };
  }

  /**
   * O que falta a esta reclamação no quadro.
   *
   * Perguntado quando a área da empresa mostra uma reclamação: o painel
   * só oferece "Completar no quadro" se falta algo que a página tem.
   */
  if (mensagem?.tipo === "completarPergunta") {

    const dados = await chamar(CAMINHOS.completar, {
      cod: mensagem.cod,
      id: mensagem.id,
    });

    return { ok: true, dados };
  }

  /** Completa, depois do clique — só o que estava vazio. */
  if (mensagem?.tipo === "completarNoQuadro") {

    const dados = await chamar(
      CAMINHOS.completar,
      {},
      mensagem.dados ?? {}
    );

    await limparCache();

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "vigiaEstado") {

    const config = await lerConfig();
    const { estado } = await lerEstadoDoVigia();

    return {
      ok: true,
      dados: {
        ...(estado ?? {}),
        ligado: config.vigia !== false,
        emCurso: vigiaEmCurso !== null,
      },
    };
  }

  if (mensagem?.tipo === "usarResposta") {

    const dados = await chamar(
      CAMINHOS.respostas,
      {},
      { id: mensagem.id }
    );

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "anotar") {

    const dados = await chamar(
      CAMINHOS.anotar,
      {},
      mensagem.anotacao ?? {}
    );

    await limparCache();

    return { ok: true, dados };
  }

  /**
   * O caso inteiro, para ler dentro do painel.
   *
   * Sem cache: quem abre o detalhe quer o estado de agora, e a
   * própria tela move etapa e anota logo em seguida.
   */
  /**
   * Triagem: dá para responder agora, ou precisa de análise?
   *
   * Sem cache — custa uma chamada ao modelo e só acontece quando
   * alguém clica. Guardar pareceria economia, mas o caso muda
   * (ganha resposta, muda de etapa) e triagem velha é pior do que
   * triagem nenhuma.
   */
  if (mensagem?.tipo === "triagem") {

    const dados = await chamar(CAMINHOS.triagem, {}, {
      protocolo: mensagem.protocolo,
      rapido: mensagem.rapido,
    });

    return { ok: true, dados };
  }

  /**
   * Resumo do caso: o geral e o que aconteceu por último.
   *
   * Sem cache, pelo mesmo motivo da triagem — e por um a mais: a
   * segunda metade do resumo é justamente "o que mudou", e servir uma
   * cópia guardada responderia essa pergunta com o estado de antes,
   * que é a única resposta pior do que não responder.
   */
  if (mensagem?.tipo === "resumoCaso") {

    /**
     * Tudo que o painel mandou vai junto, e não só o protocolo.
     *
     * Esta lista já esteve curta — `protocolo` e `rapido` — e o efeito
     * era mudo: a transcrição importada, o nome e o telefone do contato
     * eram lidos no painel, apareciam na tela como carregados, e o
     * worker os descartava no caminho. O servidor então montava o
     * dossiê sem eles e devolvia um resumo plausível, sem erro nenhum
     * para denunciar a perda. Campo novo daqui para frente entra aqui
     * também.
     */
    const dados = await chamar(
      CAMINHOS.resumoCaso,
      {},
      {
        protocolo: mensagem.protocolo,
        rapido: mensagem.rapido,
        transcricao: mensagem.transcricao,
        arquivoDaTranscricao:
          mensagem.arquivoDaTranscricao,
        nome: mensagem.nome,
        telefone: mensagem.telefone,
      }
    );

    return { ok: true, dados };
  }

  /**
   * A fila do Reclame Aqui, com o que falta em cada caso.
   *
   * Sem cache, e por um motivo que vale escrever: a lista existe para
   * dizer o que **ainda** não foi feito. Servir uma cópia de cinco
   * minutos atrás mostraria como pendente o caso que a pessoa acabou de
   * responder — e mandaria alguém responder de novo.
   */
  /**
   * Guarda o dossiê na ficha do caso.
   *
   * Só o dossiê — a transcrição do Crisp não vai junto, e é decisão do
   * Isaac: ela já vive no Crisp, e uma segunda cópia de conversa bruta
   * aqui é sistema duplicado. O que vale guardar é a leitura, que é o
   * trabalho.
   */
  /**
   * "Este WhatsApp é do Reclame Aqui" ou "é do NPS".
   *
   * Limpa o cache porque o número muda quem o painel encontra na
   * conversa seguinte — sem isso, a mesma conversa continuaria
   * dizendo "sem contato" pelos próximos dois minutos.
   */
  if (mensagem?.tipo === "whatsappDaFrente") {

    const dados = await chamar(
      CAMINHOS.whatsapp,
      {},
      {
        numero: mensagem.numero,
        frente: mensagem.frente,
        protocolo: mensagem.protocolo,
        npsId: mensagem.npsId,
        tambemNoEstabelecimento:
          mensagem.tambemNoEstabelecimento,
      }
    );

    await limparCache();

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "salvarDossie") {

    const dados = await chamar(
      CAMINHOS.salvarDossie,
      {},
      {
        protocolo: mensagem.protocolo,
        dossie: mensagem.dossie,
      }
    );

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "pendencias") {

    const dados = await chamar(
      CAMINHOS.pendencias,
      {},
      {
        resumir: mensagem.resumir === true,
        conversa: mensagem.conversa,
        rapido: mensagem.rapido,
      }
    );

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "detalhe") {

    const chave = `detalhe:${mensagem.protocolo}`;

    const guardado = mensagem.forcar
      ? null
      : await doCache(chave);

    if (guardado) {
      return {
        ok: true,
        dados: guardado.dados,
        doCache: true,
        vencido: guardado.vencido,
      };
    }

    const dados = await chamar(CAMINHOS.detalhe, {
      protocolo: mensagem.protocolo,
    });

    await guardar(chave, dados);

    return { ok: true, dados };
  }

  /**
   * A agenda do dia — e o atrasado, que vem junto.
   *
   * `escopo` é da aba de Atividades: vazio traz o que está vencendo
   * (hoje e atrasado), "proximos" o que vem pela frente, "concluidas" o
   * que já foi fechado. Sem cache: é lista de trabalho, e uma agenda de
   * um minuto atrás pode ter uma tarefa a menos.
   */
  if (mensagem?.tipo === "agenda") {

    const dados = await chamar(CAMINHOS.agenda, {
      escopo: mensagem.escopo,
    });

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "concluirTarefa") {

    const dados = await chamar(CAMINHOS.agenda, {}, {
      id: mensagem.id,
      concluida: mensagem.concluida,
    });

    await limparCache();

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "fila") {

    const dados = await chamar(CAMINHOS.fila, {
      canal: mensagem.canal,
      etapa: mensagem.etapa,
      segmento: mensagem.segmento,
      recorte: mensagem.recorte,
    });

    return { ok: true, dados };
  }

  /**
   * Registra a tratativa de NPS — uma tentativa de contato ou o
   * pós-contato (régua de humor e "resolveu ou não").
   *
   * Limpa o cache pelo mesmo motivo de `criarCaso`: o retrato guardado
   * ainda diz "0 tentativas" e "ainda não registrado", e é exatamente
   * isso que o painel vai redesenhar em seguida.
   */
  if (mensagem?.tipo === "registrarNps") {

    const dados = await chamar(
      CAMINHOS.nps,
      {},
      mensagem.registro ?? {}
    );

    await limparCache();

    return { ok: true, dados };
  }

  /**
   * Resumo da conversa.
   *
   * É a única mensagem que carrega texto de conversa, e ela só existe
   * porque alguém clicou em "Resumir" — o painel nunca manda isso
   * sozinho. Sem cache: um resumo de dez minutos atrás descreve outra
   * conversa.
   */
  if (mensagem?.tipo === "resumirConversa") {

    const dados = await chamar(
      CAMINHOS.conversa,
      {},
      mensagem.conversa ?? {}
    );

    return { ok: true, dados };
  }

  if (mensagem?.tipo === "abrir") {
    await chrome.tabs.create({ url: mensagem.url });
    return { ok: true };
  }

  if (mensagem?.tipo === "opcoes") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  return {
    ok: false,
    erro: "Mensagem desconhecida.",
    codigo: "desconhecida",
  };
}

chrome.runtime.onMessage.addListener(
  (mensagem, _remetente, responder) => {

    tratar(mensagem)
      .then(responder)
      .catch((erro) =>
        responder({
          ok: false,
          codigo: erro?.codigo ?? "erro",
          erro: erro?.message ?? String(erro),
          base: erro?.base,
        })
      );

    // true mantém o canal aberto até a promessa resolver.
    return true;
  }
);

/* ============================================================
   CONTADOR NO ÍCONE
============================================================ */

/**
 * Pendências no ícone.
 *
 * Só os alertas graves entram na conta: um número que sobe com aviso
 * informativo vira ruído e some da atenção em dois dias.
 */
async function aplicarContador(resumo) {

  const config = await lerConfig();

  if (!config.contador) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const graves = (resumo?.alertas ?? []).filter(
    (item) => item.tom === "danger"
  );

  const total = graves.reduce(
    (soma, item) => soma + (item.quantidade ?? 1),
    0
  );

  await chrome.action.setBadgeBackgroundColor({
    color: "#DC2626",
  });

  await chrome.action.setBadgeText({
    text: total > 0 ? String(Math.min(total, 99)) : "",
  });

  await chrome.action.setTitle({
    title:
      graves.length > 0
        ? `CW Reputação — ${graves[0].titulo}`
        : "CW Reputação",
  });

  await avisar(resumo, graves, config);
}

/**
 * Aviso de área de trabalho, no máximo um por dia.
 *
 * É a versão possível do "resumo diário" da Peça B enquanto o cron não
 * existe — e é honestamente menos do que ela: só dispara com o
 * navegador aberto.
 */
async function avisar(resumo, graves, config) {

  if (!config.aviso || graves.length === 0) return;

  const agora = new Date();

  if (agora.getHours() < 8) return;

  const hoje = agora.toISOString().slice(0, 10);

  const { ultimoAviso } = await chrome.storage.local.get(
    "ultimoAviso"
  );

  if (ultimoAviso === hoje) return;

  await chrome.storage.local.set({ ultimoAviso: hoje });

  const resto =
    graves.length > 1
      ? `\n+ ${graves.length - 1} outro(s) alerta(s).`
      : "";

  chrome.notifications.create(`cw-${hoje}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
    title: `CW Reputação — nota ${
      resumo?.reputacao?.indisponivel
        ? "indisponível"
        : resumo?.reputacao?.nota
    }`,
    message: `${graves[0].titulo}\n${graves[0].detalhe}${resto}`,
    priority: 1,
  });
}

/* ============================================================
   COBRANÇA DAS ETAPAS DO FLUXO
============================================================ */

const ALARME_LEMBRETE = "cw-lembretes";

/**
 * De quanto em quanto tempo o alarme acorda.
 *
 * Cinco minutos, e não dez: o intervalo de verdade é o da etapa, e
 * acordar na metade dele garante que uma cobrança de dez minutos saia
 * aos dez, não aos vinte. Quando não há nada parado, o ciclo é uma
 * requisição e nada mais.
 */
const CICLO_LEMBRETE_MIN = 5;

/**
 * Agrupa por etapa, e não por caso.
 *
 * Oito casos parados virariam oito notificações a cada dez minutos —
 * que é o caminho mais curto para alguém desligar o aviso e perder os
 * oito. Uma por etapa diz o mesmo e continua sendo lida na terceira
 * semana.
 */
async function cobrarEtapas() {

  const config = await lerConfig();

  if (!config.lembretes) return;

  let dados;

  try {
    dados = await chamar(CAMINHOS.lembretes);
  } catch {
    // Sem sessão ou fora do ar: a cobrança não é o lugar de reclamar.
    return;
  }

  const guardado = await chrome.storage.local.get(
    "cobrancas"
  );

  const ultima = guardado.cobrancas ?? {};
  const agora = Date.now();
  const proximas = {};

  for (const etapa of dados?.etapas ?? []) {

    if (!etapa.parados) continue;

    const intervalo =
      Math.max(Number(etapa.minutos) || 10, 1) * 60000;

    const quando = ultima[etapa.nome] ?? 0;

    // Ainda não deu a hora desta etapa: mantém o relógio como está.
    if (agora - quando < intervalo) {
      proximas[etapa.nome] = quando;
      continue;
    }

    proximas[etapa.nome] = agora;

    const daEtapa = (dados.casos ?? []).filter(
      (caso) => caso.status === etapa.nome
    );

    const primeiro = daEtapa[0];

    chrome.notifications.create(
      `cw-etapa-${etapa.nome}-${agora}`,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL(
          "icones/icone-128.png"
        ),
        title: `${etapa.parados} caso(s) em "${etapa.nome}"`,
        message: primeiro
          ? `${primeiro.cliente} — ${primeiro.titulo}`.slice(
              0,
              160
            )
          : "Casos parados nesta etapa.",
        contextMessage: `Cobrando a cada ${etapa.minutos} min até sair da etapa`,
        priority: 1,
      }
    );
  }

  /**
   * Etapa que esvaziou perde o relógio.
   *
   * Sem isto, um caso que volta para a etapa três dias depois seria
   * cobrado no mesmo instante, porque o intervalo já teria "vencido"
   * há muito tempo.
   */
  await chrome.storage.local.set({ cobrancas: proximas });
}

/* ============================================================
   VIGIA DO RECLAME AQUI
============================================================ */

/**
 * Confere a lista pública da Cardápio Web no Reclame Aqui e põe no
 * quadro o que ainda não está lá.
 *
 * **O pedido.** "Queria que você ficasse verificando na página da
 * Cardápio Web no Reclame Aqui para adicionar as reclamações." O
 * servidor não consegue: o Cloudflare do portal barra quem não é
 * navegador. O Chrome de quem está logado passa — medido em
 * 11/09/2026, a mesma página que o servidor recebe como "Just a
 * moment…" chega aqui inteira, em 60 ms.
 *
 * **O que uma volta faz:**
 *
 * 1. pergunta ao servidor se pode gravar e quais reclamações estão sem
 *    texto (`GET /ra-vigia`);
 * 2. lê a lista do portal, página a página, até achar uma reclamação
 *    conhecida — e pergunta ao servidor quais são novas e quais o
 *    portal já passou à frente (respondida lá, avaliada lá);
 * 3. abre a página de cada uma dessas, até doze por volta;
 * 4. manda o que leu (`POST /ra-vigia`). O servidor decide o que
 *    grava: nova entra inteira, existente só recebe o que o portal é
 *    dono, e nada é sobrescrito.
 *
 * Uma vez por dia a lista vai mais fundo — trinta páginas —, porque o
 * consumidor avalia semanas depois, e a reclamação avaliada já saiu da
 * primeira página há muito tempo.
 *
 * **Quando:** ao abrir a plataforma (pela ponte, `conteudo/ponte.js`) e
 * no botão "Ler o Reclame Aqui" da barra do quadro ou "Conferir agora"
 * do popup. Não há leitura em segundo plano — a 0.46.0 tinha um relógio
 * de quinze minutos, e o Isaac pediu que fosse só ao abrir.
 *
 * **O que ele não faz:** atravessar a verificação do Cloudflare. Se o
 * portal pedir, a volta para, a plataforma e o popup dizem o que
 * aconteceu, e abrir o portal numa aba resolve.
 */

/**
 * O alarme de quinze minutos da 0.46.0, que saiu.
 *
 * O nome fica para ser **apagado**: alarme de extensão sobrevive à
 * atualização, e quem instalou a 0.46.0 continuaria lendo o portal de
 * quinze em quinze minutos sem ninguém pedir.
 */
const ALARME_VIGIA_ANTIGO = "cw-vigia-ra";

/**
 * Abrir a plataforma de novo dentro deste intervalo reaproveita a
 * última leitura. Dez minutos cobrem o F5 e a segunda aba sem esconder
 * uma reclamação que chegou de manhã de quem abre à tarde.
 */
const INTERVALO_MINIMO_MIN = 10;

/** Páginas da lista numa volta comum; cada uma traz cinco. */
const PAGINAS_POR_VOLTA = 4;

/** Páginas na volta funda, uma vez por dia. */
const PAGINAS_NA_FUNDA = 30;

/** Páginas de reclamação abertas por volta; o resto espera na fila. */
const ABERTAS_POR_VOLTA = 12;

/**
 * Pendente que o portal não completou espera um dia para ser tentada
 * de novo — senão uma reclamação que saiu do ar ocuparia um lugar da
 * volta para sempre.
 */
const ESPERA_DA_PENDENTE_MS = 24 * 60 * 60_000;

/** Uma volta por vez: o alarme e o "Conferir agora" não correm juntos. */
let vigiaEmCurso = null;

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function doPortal(url) {

  let resposta;

  try {
    resposta = await fetch(url, {
      credentials: "include",
      cache: "no-store",
    });
  } catch (erro) {
    throw new FalhaNaChamada(
      "portal-rede",
      "Não foi possível abrir o Reclame Aqui — a internet caiu, ou o portal está fora do ar.",
      { detalhe: String(erro?.message ?? erro) }
    );
  }

  const html = await resposta.text();

  if (ehDesafio(resposta.status, html)) {
    throw new FalhaNaChamada(
      "portal-desafio",
      "O Reclame Aqui pediu a verificação de navegador. Abra o portal numa aba — a próxima volta do vigia segue sozinha."
    );
  }

  if (!resposta.ok) {
    throw new FalhaNaChamada(
      "portal-http",
      `O Reclame Aqui respondeu ${resposta.status}.`,
      { status: resposta.status }
    );
  }

  return html;
}

async function lerEstadoDoVigia() {

  const guardado = await chrome.storage.local.get([
    "vigia",
    "vigiaFila",
    "vigiaTentadas",
    "vigiaFunda",
  ]);

  return {
    estado: guardado.vigia ?? null,
    fila: Array.isArray(guardado.vigiaFila) ? guardado.vigiaFila : [],
    tentadas: guardado.vigiaTentadas ?? {},
    funda: guardado.vigiaFunda ?? "",
  };
}

async function salvarVigia(estado, extra = {}) {
  await chrome.storage.local.set({ vigia: estado, ...extra });
  return estado;
}

function vigiar(motivo) {

  if (!vigiaEmCurso) {
    vigiaEmCurso = umaVolta(motivo).finally(() => {
      vigiaEmCurso = null;
    });
  }

  return vigiaEmCurso;
}

function falhaDoVigia(erro, agora, fila) {
  return {
    em: agora,
    ok: false,
    codigo: erro?.codigo ?? "erro",
    erro: erro?.message ?? String(erro),
    naFila: fila.length,
  };
}

async function umaVolta(motivo) {

  const config = await lerConfig();

  const {
    estado: anterior,
    fila: guardada,
    tentadas,
    funda,
  } = await lerEstadoDoVigia();

  /* Desligado nas opções: o alarme segue vivo, a volta não sai. */
  if (config.vigia === false && motivo !== "manual") {
    return anterior;
  }

  const agora = Date.now();

  let plano;

  try {
    plano = await chamar(CAMINHOS.raVigia);
  } catch (erro) {
    return salvarVigia(falhaDoVigia(erro, agora, guardada));
  }

  if (!plano?.podeGravar) {
    return salvarVigia({
      em: agora,
      ok: false,
      codigo: "leitura",
      erro: "Seu acesso é somente leitura — o vigia só grava com acesso de agente.",
      naFila: 0,
    });
  }

  /* O dia de Brasília, e não o UTC: depois das 21h o UTC já é amanhã. */
  const hoje = new Date(agora).toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });

  const fundaHoje = funda !== hoje;

  const novas = [];
  const atrasadas = [];
  let total = null;

  try {

    const paginas = fundaHoje ? PAGINAS_NA_FUNDA : PAGINAS_POR_VOLTA;

    for (let pagina = 1; pagina <= paginas; pagina += 1) {

      const lista = lerLista(await doPortal(enderecoDaLista(pagina)));

      if (!lista) {
        throw new FalhaNaChamada(
          "portal-formato",
          "A lista do Reclame Aqui mudou de formato e o vigia não a reconhece mais. Nada foi gravado."
        );
      }

      total ??= lista.total;

      if (lista.itens.length === 0) break;

      const resposta = await chamar(
        CAMINHOS.raNovas,
        {},
        { itens: lista.itens }
      );

      novas.push(...(resposta?.novos ?? []));
      atrasadas.push(...(resposta?.atrasadas ?? []));

      /*
        Na volta comum, a primeira conhecida encerra a leitura: a lista
        vem da mais nova para a mais velha, e o resto já passou por
        aqui. A funda segue, atrás de avaliação nova em reclamação velha.
      */
      if (
        !fundaHoje &&
        (resposta?.novos ?? []).length < lista.itens.length
      ) {
        break;
      }

      await esperar(300);
    }
  } catch (erro) {
    return salvarVigia(falhaDoVigia(erro, agora, guardada));
  }

  const pedidas = (plano.pendentes ?? []).filter(
    (codigo) => agora - (tentadas[codigo] ?? 0) > ESPERA_DA_PENDENTE_MS
  );

  /* Novas primeiro: é a que tem prazo correndo. */
  const fila = [
    ...new Set([...novas, ...atrasadas, ...guardada, ...pedidas]),
  ];

  const agoraAbrir = fila.slice(0, ABERTAS_POR_VOLTA);

  const lidas = [];
  const abertas = new Set();

  for (const codigo of agoraAbrir) {

    try {
      const lida = lerReclamacao(
        await doPortal(enderecoDaReclamacao(codigo))
      );

      abertas.add(codigo);

      if (lida) lidas.push(lida);
    } catch (erro) {
      /* A verificação vale para a volta inteira: para aqui. */
      if (erro?.codigo === "portal-desafio") break;
      abertas.add(codigo);
    }

    await esperar(400);
  }

  let resultado = { criadas: [], completadas: [], inalteradas: 0 };

  if (lidas.length > 0) {
    try {
      resultado = await chamar(
        CAMINHOS.raVigia,
        {},
        { reclamacoes: lidas }
      );
    } catch (erro) {
      /* Não gravou: a fila fica inteira para a próxima volta. */
      return salvarVigia(falhaDoVigia(erro, agora, fila), {
        vigiaFila: fila.filter((c) => !pedidas.includes(c)).slice(0, 200),
      });
    }
  }

  /* Pendente tentada espera um dia; tentativa com mais de um dia é esquecida. */
  const tentadasAgora = Object.fromEntries(
    Object.entries(tentadas).filter(
      ([, quando]) => agora - quando < ESPERA_DA_PENDENTE_MS
    )
  );

  for (const codigo of abertas) {
    if (pedidas.includes(codigo)) tentadasAgora[codigo] = agora;
  }

  /*
    O que ficou para depois. As pendentes não entram: o servidor as
    devolve na próxima volta, e guardá-las aqui as faria furar a espera
    de um dia.
  */
  const restante = fila
    .filter((c) => !abertas.has(c) && !pedidas.includes(c))
    .slice(0, 200);

  const estado = {
    em: agora,
    ok: true,
    criadas: resultado.criadas ?? [],
    completadas: (resultado.completadas ?? []).length,
    naFila: restante.length,
    total,
    funda: fundaHoje,
  };

  await salvarVigia(estado, {
    vigiaFila: restante,
    vigiaTentadas: tentadasAgora,
    ...(fundaHoje ? { vigiaFunda: hoje } : {}),
  });

  if (estado.criadas.length > 0) avisarNovas(estado.criadas);

  return estado;
}

/** Uma notificação por volta, não uma por reclamação. */
function avisarNovas(criadas) {

  chrome.notifications.create(`cw-vigia-${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icones/icone-128.png"),
    title:
      criadas.length === 1
        ? "1 reclamação nova no Reclame Aqui"
        : `${criadas.length} reclamações novas no Reclame Aqui`,
    message: criadas
      .slice(0, 3)
      .map((c) => c.titulo)
      .join("\n")
      .slice(0, 240),
    contextMessage: "Já estão no quadro, na coluna Novo",
    priority: 2,
  });
}

/* ============================================================
   ROTINA
============================================================ */

const ALARME = "cw-resumo";

async function atualizarEmSilencio() {
  try {
    const dados = await chamar(CAMINHOS.resumo);
    await aplicarContador(dados);
  } catch {
    /**
     * Falhar em silêncio é intencional: sem sessão, sem endereço ou
     * fora da VPN, a rotina de fundo não tem o que fazer, e transformar
     * isso em erro visível encheria a tela de aviso inútil. O popup
     * mostra a falha de verdade quando você abre.
     */
    await chrome.action.setBadgeText({ text: "" });
  }
}

function agendar() {

  chrome.alarms.create(ALARME, {
    delayInMinutes: 1,
    periodInMinutes: 30,
  });

  chrome.alarms.create(ALARME_LEMBRETE, {
    delayInMinutes: 1,
    periodInMinutes: CICLO_LEMBRETE_MIN,
  });

  chrome.alarms.clear(ALARME_VIGIA_ANTIGO);
}

/* ============================================================
   PONTE COM A PLATAFORMA
============================================================ */

const PONTE = "cw-ponte";

/**
 * Põe `conteudo/ponte.js` nas páginas da própria plataforma.
 *
 * É o que deixa a plataforma pedir "leia o Reclame Aqui" — ao abrir, e
 * no botão da barra do quadro. A página não fala com a extensão sozinha:
 * ela não sabe o id da extensão, e o id de uma extensão descompactada
 * muda de máquina para máquina.
 *
 * Registrada **em tempo de execução**, e não no manifesto, porque o
 * endereço da plataforma é configurado nas Opções — o manifesto só
 * conhece o `localhost`. Sem permissão para o endereço, não registra:
 * a ponte segue a mesma permissão que todo o resto.
 */
async function registrarPonte() {

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [PONTE] });
  } catch {
    /* não estava registrada */
  }

  const config = await lerConfig();
  const base = normalizarBase(config.base);

  if (!base) return;

  const origem = padraoDeOrigem(base);

  if (!(await chrome.permissions.contains({ origins: [origem] }))) return;

  await chrome.scripting.registerContentScripts([
    {
      id: PONTE,
      matches: [origem],
      js: ["conteudo/ponte.js"],
      runAt: "document_start",
      persistAcrossSessions: true,
    },
  ]);

  /*
    Abas da plataforma que já estavam abertas não recebem script
    registrado depois. Injetar nelas evita o "atualize a página" logo
    depois de instalar ou de trocar o endereço.
  */
  try {
    const abas = await chrome.tabs.query({ url: origem });

    for (const aba of abas) {
      if (aba.id === undefined) continue;
      chrome.scripting
        .executeScript({ target: { tabId: aba.id }, files: ["conteudo/ponte.js"] })
        .catch(() => {});
    }
  } catch {
    /* sem abas, ou sem acesso a elas: a próxima abertura recebe */
  }
}

chrome.runtime.onInstalled.addListener(() => {
  agendar();
  atualizarEmSilencio();
  registrarPonte();
});

chrome.runtime.onStartup.addListener(() => {
  agendar();
  registrarPonte();
});

/* Trocar o endereço nas Opções move a ponte junto. */
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "sync" && mudancas["cw-reputacao-config"]) registrarPonte();
});

chrome.permissions.onAdded.addListener(() => registrarPonte());

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME) atualizarEmSilencio();
  if (alarme.name === ALARME_LEMBRETE) cobrarEtapas();
});

chrome.notifications.onClicked.addListener(async (id) => {

  const config = await lerConfig();
  const base = normalizarBase(config.base);

  if (!base) return;

  // Cobrança de etapa e reclamação nova levam ao quadro; o resto, ao painel do dia.
  chrome.tabs.create({
    url:
      id.startsWith("cw-etapa-") || id.startsWith("cw-vigia-")
        ? `${base}/reclame-aqui`
        : `${base}/dashboard`,
  });
});
