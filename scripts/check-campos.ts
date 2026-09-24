/**
 * O campo que existe no banco chega até a tela?
 *
 *   npm run check:campos
 *
 * As outras varreduras provam **fiação**: que a rota confere quem
 * chama, que o mutador chama o servidor, que o botão tem tratador.
 * Nenhuma delas prova **comportamento** — e a diferença ficou clara
 * quando o Isaac reportou gráficos com defeito numa tela que o
 * `check:telas` havia aprovado.
 *
 * Esta olha a camada do meio, que é onde mora "salvei e voltou vazio":
 * uma coluna que existe no Postgres, que o formulário preenche, e que
 * o mapeamento da carga esquece de ler. O dado está lá; a tela nunca o
 * mostra. Nada disso aparece em `tsc` — o objeto simplesmente não tem a
 * chave, e ninguém pediu que tivesse.
 *
 * A comparação é entre três lugares que precisam concordar:
 *
 *   coluna no schema.prisma  →  leitura em workspace.ts  →  campo do modelo
 *
 * **Coluna ausente na carga é candidata, não culpada.** Muita coluna é
 * de uso interno — carimbo de tempo, chave estrangeira, marcação que só
 * o servidor lê. Cada uma dessas está declarada aqui embaixo com o
 * motivo, e o que sobrar é para alguém olhar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const schema = readFileSync(
  resolve(RAIZ, "prisma/schema.prisma"),
  "utf8"
);

/*
  A carga do workspace e os tradutores que ela chama.

  Desde 12/09/2026 a regra de SLA e o expediente são traduzidos fora do
  arquivo — `slaRuleDoBanco` e `expedienteDoBanco` —, porque a ação que
  grava os prazos da documentação devolve a mesma forma. Ler só o
  workspace daria as colunas por perdidas quando elas chegam à tela.
*/
const workspace = [
  "lib/actions/workspace.ts",
  "lib/models/sla.ts",
  "lib/services/operacao.service.ts",
]
  .map((arquivo) => readFileSync(resolve(RAIZ, arquivo), "utf8"))
  .join("\n");

let falhas = 0;

/**
 * Colunas que a tela não precisa ver, por modelo.
 *
 * `*` vale para qualquer modelo — são as de infraestrutura, que
 * aparecem em quase todos e nunca são conteúdo.
 */
const INTERNAS: Record<string, string[]> = {
  "*": [
    "id",
    "createdAt",
    "updatedAt",
    "passwordHash",
  ],
  Case: [
    // A reclamação tem carga própria (`listCases`), não vem no workspace.
    "*",
  ],
  NpsResponse: ["*"],

  /*
    O historico diario tem carga propria, como a reclamacao.

    Ele nao vem no workspace: a tela de Analytics le por `lerMetricas`,
    um mes de cada vez, porque carregar duzentos e quarenta e seis dias
    na abertura da aplicacao seria pagar por um dado que quase ninguem
    abre — e a carga do quadro acabou de ser cortada de 701 ms para
    139 ms justamente tirando de la o que a tela nao mostra.
  */
  MetricaDiaria: ["*"],
  NpsAttempt: ["*"],

  /**
   * Anotação de um ciclo de NPS.
   *
   * Vem junto da resposta em `listNpsResponses`, que tem carga própria
   * — como `CaseComment` vem junto do caso. O que sobra aqui são as
   * chaves da relação, que a tela não desenha porque já sabe de que
   * ciclo está falando.
   */
  NpsNote: ["*"],
  User: ["*"],
  UserPreference: ["*"],
  UserModuleRole: ["*"],
  GoogleAccount: ["*"],
  AllowedEmail: ["*"],
  CaseTag: ["*"],
  CaseComment: ["*"],
  CaseEvent: ["*"],
  CaseChecklistMark: ["*"],
  ImpactRecord: ["caseId", "establishmentId"],
  Establishment: ["mrrCents"],
  Team: ["legacyName"],
  Subcategory: ["categoryId"],
  JourneyTopic: ["stageId"],
  JourneyEntry: ["topicId"],
  JourneyPlacement: ["*"],
  ClientProfile: ["manual"],
  WebhookConfig: ["*"],
  WebhookDelivery: ["*"],
  SavedFilter: ["*"],
  Company: ["*"],
  IaConfig: ["*"],

  /**
   * Marca da última importação do Wootric.
   *
   * Não é conteúdo: a tela não a desenha, ela só pergunta ao servidor
   * "vale buscar agora?". Ver lerSeguranca abaixo, mesmo caso.
   */
  WootricSync: ["*"],

  /**
   * Freio de tentativas de login.
   *
   * Uma linha por e-mail que errou a senha, lida só pelo `signIn`. Não
   * vai para tela nenhuma de propósito: a lista de endereços que alguém
   * tentou não é informação para exibir, e a rotina diária a apaga
   * depois de quinze minutos.
   */
  TentativaDeLogin: ["*"],

  /**
   * Configuração de acesso, com carga própria (`lerSeguranca`).
   *
   * Fora do workspace de propósito: ela só interessa a quem administra,
   * e mandá-la na carga que toda tela recebe espalharia a postura de
   * segurança da empresa por todo `sessionStorage` de todo navegador.
   */
  SecurityConfig: ["*"],

  /**
   * **Nada daqui pode chegar a tela nenhuma.**
   *
   * É o código de login em si. `codeHash` numa carga de cliente seria
   * entregar ao navegador o material para quebrar a segunda etapa
   * offline; `attempts` e `expiresAt` diriam a quem tenta quanto ainda
   * dá para chutar. Este modelo é lido só no servidor, por
   * `lib/auth/two-factor.ts`, e a ausência aqui é o comportamento certo.
   */
  LoginChallenge: ["*"],
  Plan: ["*"],
  NpsStage: ["*"],
  NpsKind: ["*"],
  NpsRootCause: ["*"],
  ReputationGoal: ["*"],
  CaseMovement: ["caseId", "lateNotifiedAt"],

  /**
   * Contatos de um caso: carga própria (`listarContatos`), aberta
   * com a tela do caso — como `CaseComment`. O resumo que o quadro
   * precisa (1º contato, último, tentativas) mora no próprio caso.
   */
  CaseContato: ["*"],

  /**
   * Ofertas e renegociações: carga própria (`listarNegociacoes` na
   * lateral do caso, `resumoDoMes` no Impacto), como os contatos. Todas
   * as colunas chegam à tela por lá — `paraView` em
   * `lib/actions/negociacao.ts` — e não pela carga do quadro.
   */
  Negociacao: ["*"],

  /**
   * Avaliações do Google: carga própria (`listarAvaliacoesGoogle`, na
   * tela `/google`), com `paraView` em `lib/actions/avaliacoesGoogle.ts`
   * levando cada coluna — como as negociações.
   */
  AvaliacaoGoogle: ["*"],

  /**
   * A rotina do agente: carga própria (`listarRotina` e `lerMeuDia`, em
   * `lib/actions/rotina.ts`), aberta pelo Meu dia e pela Agenda. As
   * marcas são de cada pessoa e só chegam como "feita ou não" — o
   * `feitaEm` é registro.
   */
  AtividadeDaRotina: ["*"],
  MarcaDaRotina: ["*"],

  /**
   * O relatório do ciclo: carga própria (`lerRelatorio`, em
   * `lib/actions/relatorio.ts`). O texto volta à tela; `dados` é o
   * retrato daquele dia, guardado para reler sem recalcular.
   */
  RelatorioDoCiclo: ["*"],

  /**
   * Os atalhos de Ferramentas e Acessos: carga própria (`listarAtalhos`,
   * em `lib/actions/atalhos.ts`) na página e no resumo da extensão —
   * fora do workspace, que toda tela recebe.
   */
  Atalho: ["*"],

  /**
   * As conversas do WhatsApp guardadas: carga própria (`listarConversas`
   * e `lerConversa`, em `lib/actions/conversas.ts`) — o texto das
   * conversas não viaja na carga que toda tela recebe.
   */
  Conversa: ["*"],
  MensagemDaConversa: ["*"],

  /** Quem mudou o expediente por último — registro, não conteúdo. */
  OperacaoConfig: ["updatedBy"],

  /**
   * Os itens tirados de uma atividade no Meu dia (1.31): carga própria
   * (`lerMeuDia`, em `lib/actions/rotina.ts`), que devolve só as marcas
   * que valem hoje — `userId` e `criadoEm` são registro.
   */
  MarcaDeItemDaRotina: ["*"],

  /**
   * O último sucesso e o último erro da IA (1.34): carga própria
   * (`lerSaudeDaIA`, no cartão de Integrações), fora da carga de toda tela.
   */
  SaudeDaIA: ["*"],

  /**
   * O telefone confirmado como de um cliente (1.36): só a extensão lê,
   * pela rota `quem-e` e pelo `contexto`.
   */
  ContatoConhecido: ["*"],

  /**
   * O Prêmio Reclame Aqui (1.54–1.56): carga própria (`lerPremio`, em
   * `lib/actions/premio.ts`), aberta só na tela do Prêmio.
   */
  CampanhaDoPremio: ["*"],
  PedidoDeVoto: ["*"],

  /**
   * As partes escritas do dossiê (1.58): carga própria (`abrirDossie`,
   * em `lib/actions/dossie.ts`), na tela do dossiê do caso.
   */
  DossieDoCaso: ["*"],

  /**
   * O texto editado antes de enviar, que ensina o próximo rascunho dos
   * três tons (1.67): só a rota `aprender-resposta` da extensão lê.
   */
  EdicaoDeResposta: ["*"],
};


/** Modelos e suas colunas, lidos do schema. */
function modelos() {

  const saida: Record<string, string[]> = {};

  for (const bloco of schema.split(/\nmodel\s+/).slice(1)) {

    const nome = bloco.slice(0, bloco.indexOf(" ")).trim();

    const corpo = bloco.slice(
      bloco.indexOf("{") + 1,
      bloco.indexOf("\n}")
    );

    const colunas: string[] = [];

    for (const linha of corpo.split("\n")) {

      const limpa = linha.trim();

      // Comentário, atributo de bloco ou linha vazia.
      if (
        limpa === "" ||
        limpa.startsWith("//") ||
        limpa.startsWith("///") ||
        limpa.startsWith("@@")
      ) {
        continue;
      }

      const m = limpa.match(
        /^([a-zA-Z][a-zA-Z0-9_]*)\s+([A-Za-z]+)(\[\])?(\?)?/
      );

      if (!m) continue;

      /**
       * Relação não é campo — é o outro lado do vínculo.
       *
       * `establishment Establishment?` não precisa aparecer na carga:
       * quem aparece é o `establishmentId`, e a tela resolve o nome.
       */
      const ehRelacao =
        /^[A-Z]/.test(m[2]) &&
        ![
          "String",
          "Int",
          "Float",
          "Boolean",
          "DateTime",
          "Json",
          "Decimal",
          "BigInt",
          "Bytes",
        ].includes(m[2]) &&
        !/^(Role|Channel|Priority)$/.test(m[2]);

      if (ehRelacao) continue;

      colunas.push(m[1]);
    }

    saida[nome] = colunas;
  }

  return saida;
}

function interna(modelo: string, coluna: string) {

  const doModelo = INTERNAS[modelo] ?? [];

  if (doModelo.includes("*")) return true;

  return (
    doModelo.includes(coluna) ||
    (INTERNAS["*"] ?? []).includes(coluna)
  );
}

console.log(
  "\n  CAMPOS — a coluna do banco chega à tela?\n"
);

const todos = modelos();

let lidas = 0;
let internas = 0;

const orfas: { modelo: string; coluna: string }[] = [];

for (const [modelo, colunas] of Object.entries(todos)) {

  const perdidas: string[] = [];

  for (const coluna of colunas) {

    if (interna(modelo, coluna)) {
      internas += 1;
      continue;
    }

    /**
     * Três formas de a coluna chegar à tela.
     *
     * Direta (`r.color`), renomeada (`cor: r.color`) e — a que faltava
     * — **resolvida pela relação**: `ownerId` não aparece na carga
     * porque o que a tela mostra é `owner: r.owner?.name`. Sem
     * reconhecer isso, toda chave estrangeira viraria candidata, e o
     * relatório encheria de alarme falso.
     *
     * É busca de texto, e por isso o resultado é **candidato**: colisão
     * de nome entre modelos é possível, e conferir à mão é parte do
     * trabalho.
     */
    const semSufixo = coluna.replace(/Id$/, "");

    const lida =
      new RegExp(
        `\\br\\.${coluna}\\b|\\b${coluna}:\\s*r\\.`
      ).test(workspace) ||
      (coluna.endsWith("Id") &&
        new RegExp(`\\br\\.${semSufixo}\\?\\.`).test(
          workspace
        ));

    if (lida) lidas += 1;
    else perdidas.push(coluna);
  }

  if (perdidas.length === 0) continue;

  falhas += perdidas.length;

  for (const c of perdidas) {
    orfas.push({ modelo, coluna: c });
  }

  console.log(
    `FALHA  ${modelo.padEnd(20)} não chega à tela: ${perdidas.join(", ")}`
  );
}

console.log(
  `\n  ${Object.keys(todos).length} modelos · ${lidas} colunas lidas pela carga · ${internas} internas com motivo declarado`
);

if (orfas.length > 0) {
  console.log(
    "\n  Cada uma é candidata: ou falta na tela, ou é interna e precisa de motivo escrito aqui."
  );
}

console.log(
  falhas === 0
    ? "\n  Toda coluna de conteúdo chega à tela.\n"
    : `\n  ${falhas} coluna(s) para decidir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
