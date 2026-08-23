/**
 * Carga completa: a planilha do Reclame Aqui vira a base, o CW Engine
 * completa o que ela não traz.
 *
 *   npm run ra:completo -- --base <arquivo.xlsx> --engine <arquivo.csv>
 *   npm run ra:completo -- ... --gravar          (sem isto, só simula)
 *   npm run ra:completo -- ... --somente-novas   (cria o que falta, não apaga)
 *
 * **Dois modos, e o segundo é o do dia a dia.** A carga completa refaz a
 * base do zero e se faz uma vez; o que acontece toda semana é chegar um
 * export novo do portal e a pergunta ser "o que aqui ainda não está lá?".
 * O `--somente-novas` responde isso sem apagar nada e sem tocar no que já
 * existe — nem para atualizar, porque quem move o caso no quadro é a
 * operação, e regravar desfaria o trabalho dela.
 *
 * **Duas planilhas com papéis diferentes, e isso é o desenho:**
 *
 * - A **base** (`--base`) é o relatório "Previsão para o RA1000". Ela
 *   manda em tudo que tem: relato, contato, nota, resolvida, tempos,
 *   datas. Cada linha dela vira uma reclamação, e só elas.
 * - O **CW Engine** (`--engine`) só preenche buraco. Ele tem informação
 *   errada o bastante para não servir de base — e tem 563 linhas contra
 *   127, das quais as que não estão na base **não entram**. O que ele
 *   traz de único e valioso é o **estabelecimento**: qual restaurante
 *   está por trás da reclamação.
 *
 * Casar as duas não é trivial: o CW Engine reescreve o título de parte
 * das reclamações ("Acesso via HugMe") e abrevia o nome do cliente
 * ("Alex Diego" para "ALEX DIEGO DA SILVA DASCANIO"). Por isso o
 * casamento é uma escada de quatro degraus, do mais seguro ao mais
 * tolerante, e cada degrau só recebe quem o anterior não resolveu.
 *
 * **A carga completa é destrutiva.** Apaga reclamações, clientes e
 * estabelecimentos antes de gravar; rode `npm run db:backup` antes, e ela
 * recusa se não houver backup do dia. O `--somente-novas` não apaga nada
 * e por isso não exige backup.
 *
 * Os dois modos são provados: `npm run check:incremental` monta uma
 * planilha descartável e confere que o incremental cria o que falta e
 * **não toca** no que já existe.
 */
import "dotenv/config";

import { readdirSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import * as XLSX from "xlsx";

import type { Case } from "../lib/models/case";
import { slugify } from "../lib/services/slug";
import {
  classificar,
  classificarPorProblema,
} from "../lib/services/raClassify";
import { importCasesBulk } from "../lib/services/case.repository";

/* ============================================================
   ARGUMENTOS
============================================================ */

const argv = process.argv.slice(2);

function opcao(nome: string) {
  const i = argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : argv[i + 1];
}

const CAMINHO_BASE = opcao("base");
const CAMINHO_ENGINE = opcao("engine");
const GRAVAR = argv.includes("--gravar");

/**
 * Só cria o que falta — não apaga nada.
 *
 * É o modo do dia a dia. A carga completa existe para refazer a base do
 * zero, e isso se faz uma vez; o que acontece toda semana é chegar um
 * export novo do portal e a pergunta ser "o que aqui ainda não está
 * lá?". Sem este modo, a resposta exigia apagar 127 reclamações para
 * regravar 128 — e junto iam as anotações, as etiquetas e as
 * movimentações que a operação tinha feito em cima delas.
 *
 * O que já existe **não é tocado**. Nem para atualizar: o portal reescreve
 * status e nota, mas quem move o caso no quadro é a operação, e uma
 * reimportação que sobrescrevesse isso desfaria o trabalho de alguém.
 */
const SOMENTE_NOVAS = argv.includes("--somente-novas");

if (!CAMINHO_BASE) {
  console.error(
    "\n  Falta --base <arquivo.xlsx> (o relatório do Reclame Aqui).\n"
  );
  process.exit(1);
}

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

/* ============================================================
   LEITURA
============================================================ */

type Linha = Record<string, string>;

/**
 * Lê uma planilha achando o cabeçalho pelo conteúdo.
 *
 * O export do Reclame Aqui põe título e linhas em branco antes da
 * tabela, e a posição varia entre relatórios. Procurar a coluna âncora
 * é o que faz o leitor sobreviver a uma linha a mais no topo.
 */
function ler(
  caminho: string,
  ancora: string,
  codepage?: number
): Linha[] {

  const wb = XLSX.readFile(caminho, { codepage });

  const grade = XLSX.utils.sheet_to_json<unknown[]>(
    wb.Sheets[wb.SheetNames[0]],
    { header: 1, defval: "", raw: false }
  );

  const iCab = grade.findIndex(
    (l) =>
      Array.isArray(l) &&
      l.some(
        (c) => String(c).trim() === ancora
      )
  );

  if (iCab === -1) {
    throw new Error(
      `Cabeçalho não encontrado em ${caminho} — faltou a coluna "${ancora}".`
    );
  }

  const cab = (grade[iCab] as unknown[]).map((c) =>
    String(c).trim()
  );

  return grade
    .slice(iCab + 1)
    .filter(
      (l) =>
        Array.isArray(l) &&
        String(l[0] ?? "").trim() !== ""
    )
    .map((l) => {
      const o: Linha = {};
      cab.forEach((c, i) => {
        if (c) o[c] = String((l as unknown[])[i] ?? "").trim();
      });
      return o;
    });
}

/* ============================================================
   NORMALIZAÇÃO
============================================================ */

/** Texto comparável: sem acento, sem pontuação, sem caixa. */
function chave(valor: unknown) {
  return String(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(valor: unknown) {
  return chave(valor).split(" ").filter(Boolean);
}

/** AAAA-MM-DD a partir de "30/06/2026 18:58" ou "10/7/26". */
function dia(valor: unknown) {

  const m = String(valor).match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/
  );

  if (!m) return null;

  const ano = m[3].length === 2 ? `20${m[3]}` : m[3];

  return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function instante(valor: unknown) {

  const d = dia(valor);

  if (!d) return null;

  const hora =
    String(valor).match(/(\d{1,2}):(\d{2})/) ?? null;

  return new Date(
    `${d}T${hora ? `${hora[1].padStart(2, "0")}:${hora[2]}` : "00:00"}:00Z`
  );
}

/** Tempo decorrido no formato que as telas exibem. */
function decorrido(
  de: Date | null,
  ate: Date | null
) {

  if (!de || !ate) return "-";

  const min = Math.round(
    (ate.getTime() - de.getTime()) / 60000
  );

  if (min < 0) return "-";
  if (min < 60) return `${min}min`;

  const h = Math.round(min / 60);

  return h < 48 ? `${h}h` : `${Math.round(h / 24)} dias`;
}

/**
 * O protocolo é o **ID do Reclame Aqui**, quando o relatório o traz.
 *
 * É o mesmo código que a extensão lê da página como `COD` e que aparece
 * no fim da URL pública (`..._r72QQCpOtF-sFwCZ`). Usá-lo é o que faz a
 * reclamação capturada pela extensão e a mesma reclamação vinda da
 * planilha serem **um registro só**; com qualquer outra chave, a segunda
 * entraria duplicada e ninguém entenderia por quê.
 *
 * Data e hora ficam de reserva, para o relatório antigo que não trazia a
 * coluna. Identificam sem ambiguidade porque não há duas reclamações no
 * mesmo minuto — e o sufixo cobre o empate mesmo assim.
 */
function protocoloDe(
  idRa: string | undefined,
  dataHora: string,
  usados: Set<string>
) {

  const id = String(idRa ?? "").trim();

  const m = String(dataHora).match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/
  );

  const base = id
    ? `RA-${id}`
    : m
      ? `RA-${m[3].slice(2)}${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}${m[4].padStart(2, "0")}${m[5]}`
      : `RA-${chave(dataHora).replace(/ /g, "") || "SEMDATA"}`;

  let saida = base;
  let n = 1;

  while (usados.has(saida)) {
    n += 1;
    saida = `${base}-${n}`;
  }

  usados.add(saida);

  return saida;
}

/* ============================================================
   DE→PARA COM O CW ENGINE
============================================================ */

/**
 * Até esta data, a responsável é a Carla — decisão do Isaac.
 *
 * Uma data e não "o mês de janeiro" porque a regra dita é "de janeiro de
 * 2026 para trás", e o relatório pode um dia trazer 2025.
 */
const LIMITE_CARLA = "2026-01-31";

/**
 * Os times do CW Engine e os desta base não têm os mesmos nomes.
 *
 * De→para explícito, e não criação automática: deixar passar criaria
 * "Implementacão" ao lado de "Implantação" no cadastro de Times, e
 * ninguém saberia qual usar. O que não estiver aqui fica sem time — o
 * que é honesto, e aparece no relatório do fim.
 */
const TIMES: Record<string, string> = {
  implementacao: "Implantação",
  atendimento: "Suporte",
  financeiro: "Financeiro",
  desenvolvimento: "Tecnologia",
  comercial: "Comercial",
  adocao: "Adoção",
  marketing: "Produto",
};

/**
 * Etapa do quadro a partir do status do portal.
 *
 * "Respondido" não é atendimento em andamento: é caso já respondido,
 * esperando a avaliação do consumidor.
 */
function etapaDe(statusRa: string) {
  switch (statusRa) {
    case "Avaliado Resolvido":
      return "Resolvido";
    case "Avaliado Não Resolvido":
      return "Não resolvido";
    case "Não respondida":
    case "Não respondido":
      return "Novo";
    case "Réplica do consumidor":
      return "Aguardando nossa réplica";
    default:
      return "Aguardando avaliação";
  }
}

function prioridadeDe(info: {
  nota: number | null;
  resolvida: boolean;
  avaliada: boolean;
  respondida: boolean;
}): Case["priority"] {

  if (!info.respondida) return "Crítica";
  if (info.avaliada && !info.resolvida) return "Alta";

  if (
    info.avaliada &&
    info.nota !== null &&
    info.nota <= 4
  ) {
    return "Alta";
  }

  return info.avaliada ? "Baixa" : "Média";
}

function etiquetasDe(item: Case) {

  const t: string[] = [];

  if (!item.publicResponse) {
    t.push("Aguardando área interna");
  }

  if (item.resolved && !item.evaluated) {
    t.push("Favorável a avaliação");
  }

  if (item.evaluated && (item.score ?? 0) >= 9) {
    t.push("Possível avaliação positiva");
  }

  if (item.churnRisk) t.push("Risco de nota baixa");

  return t;
}

/* ============================================================
   PROGRAMA
============================================================ */

interface Achado {
  linha: Linha;
  /** Por qual degrau da escada casou — sai no relatório. */
  degrau: string;
}

async function main() {

  /* ---------- 1. as duas planilhas ---------- */

  const base = ler(CAMINHO_BASE!, "Data Reclamação");

  const engine = CAMINHO_ENGINE
    ? ler(CAMINHO_ENGINE, "Titulo", 65001)
    : [];

  console.log(
    `\n  base:   ${base.length} reclamações  (${CAMINHO_BASE})`
  );

  console.log(
    `  engine: ${engine.length} linhas       (${CAMINHO_ENGINE ?? "não informado"})\n`
  );

  /* ---------- 2. índices do CW Engine ---------- */

  const porIdRa = new Map<string, Linha>();
  const porTitulo = new Map<string, Linha[]>();
  const porNomeDia = new Map<string, Linha[]>();
  const porNome = new Map<string, Linha[]>();

  /**
   * O id do Reclame Aqui, extraído do link do CW Engine.
   *
   * O link público termina no código da reclamação, depois do último
   * sublinhado: `.../implementao-incompleta_bfQJdyliSk2uco6t`. É o
   * mesmo código da coluna "ID Reclame Aqui" do relatório — casar por
   * ele é exato, e nenhum outro degrau chega perto disso.
   */
  const idDoLink = (url: string) => {

    const ultimo =
      String(url)
        .replace(/\/+$/, "")
        .split("/")
        .pop() ?? "";

    const i = ultimo.lastIndexOf("_");

    return i < 0 ? "" : ultimo.slice(i + 1);
  };

  const guardar = (
    mapa: Map<string, Linha[]>,
    k: string,
    v: Linha
  ) => {
    if (!k.trim()) return;
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(v);
  };

  for (const r of engine) {

    const id = idDoLink(r["Link Reclame Aqui"]);

    if (id && !porIdRa.has(id)) porIdRa.set(id, r);

    guardar(porTitulo, chave(r.Titulo), r);
    guardar(porNome, chave(r.Cliente), r);
    guardar(
      porNomeDia,
      `${chave(r.Cliente)}|${dia(r["Publicado em"])}`,
      r
    );
  }

  /**
   * Quarto degrau: nome abreviado, data próxima.
   *
   * O CW Engine grava "Alex Diego" onde o portal tem "ALEX DIEGO DA
   * SILVA DASCANIO". Um nome é aceito como o outro quando **todos** os
   * seus pedaços aparecem no outro — o que exclui "Mariana Poças" da
   * mesma data e aceita "Marcos Brum" para "ANTONIO MARCOS BRUM
   * SOARES". A folga de dois dias cobre a diferença entre a data de
   * publicação no portal e a de abertura do ticket.
   */
  function porNomeParecido(
    nome: string,
    quando: string | null
  ) {

    const alvo = tokens(nome);

    if (alvo.length < 2 || !quando) return [];

    const limite = 2 * 86400000;
    const t = new Date(`${quando}T00:00:00Z`).getTime();

    return engine.filter((r) => {

      const d = dia(r["Publicado em"]);

      if (!d) return false;

      const dt = new Date(`${d}T00:00:00Z`).getTime();

      if (Math.abs(dt - t) > limite) return false;

      const outro = tokens(r.Cliente);

      if (outro.length < 2) return false;

      const contido = (a: string[], b: string[]) =>
        a.every((x) => b.includes(x));

      return (
        contido(outro, alvo) || contido(alvo, outro)
      );
    });
  }

  /* ---------- 3. a escada ---------- */

  const degraus: Record<string, number> = {
    "id do RA": 0,
    título: 0,
    "nome + data": 0,
    "nome abreviado": 0,
    "nome único": 0,
    "sem par": 0,
  };

  function casar(r: Linha): Achado | null {

    /**
     * Primeiro o id do portal — é o único degrau exato.
     *
     * Os outros são heurística: título muda quando o CW Engine
     * reescreve, nome muda quando ele abrevia. O id não muda.
     */
    const porId = porIdRa.get(
      (r["ID Reclame Aqui"] ?? "").trim()
    );

    if (porId) {
      degraus["id do RA"] += 1;
      return { linha: porId, degrau: "id do RA" };
    }

    const t = porTitulo.get(chave(r["Título"]));

    if (t?.length) {
      degraus["título"] += 1;
      return { linha: t[0], degrau: "título" };
    }

    const d = dia(r["Data Reclamação"]);

    const nd = porNomeDia.get(
      `${chave(r.Nome)}|${d}`
    );

    if (nd?.length) {
      degraus["nome + data"] += 1;
      return { linha: nd[0], degrau: "nome + data" };
    }

    const parecidos = porNomeParecido(r.Nome, d);

    if (parecidos.length === 1) {
      degraus["nome abreviado"] += 1;
      return {
        linha: parecidos[0],
        degrau: "nome abreviado",
      };
    }

    const n = porNome.get(chave(r.Nome));

    if (n?.length === 1) {
      degraus["nome único"] += 1;
      return { linha: n[0], degrau: "nome único" };
    }

    degraus["sem par"] += 1;
    return null;
  }

  /* ---------- 4. montagem ---------- */

  const usados = new Set<string>();

  const estabelecimentos = new Map<
    string,
    {
      slug: string;
      name: string;
      externalId?: string;
      portalUrl?: string;
    }
  >();

  const clientes = new Map<
    string,
    { slug: string; document?: string; conta?: string }
  >();

  const timesIgnorados = new Set<string>();

  /** Quantas foram para a Carla pela regra de janeiro. */
  let porRegraDaCarla = 0;

  /**
   * O casamento roda **uma vez por linha**, e o resultado fica guardado.
   *
   * Chamar `casar` de novo mais adiante contaria o mesmo acerto duas
   * vezes no relatório — e o relatório é o que diz se a carga está certa.
   */
  const pares = base.map(casar);

  const casos: Case[] = base.map((r, i) => {

    const e = pares[i]?.linha;

    const criada = instante(r["Data Reclamação"]);
    const respondida = instante(r["Data de Resposta"]);
    const avaliada = instante(r["Data Avaliacao"]);

    const notaBruta = r["Nota"];

    const nota =
      notaBruta === "" || notaBruta === undefined
        ? null
        : Number(notaBruta);

    const temNota = nota !== null && !Number.isNaN(nota);

    const resolvida =
      r["Seu problema foi resolvido?"] === "Sim";

    const voltaria =
      r["Voltaria a fazer negócio?"] === "Sim";

    const nome = r["Nome"] || "Não informado";

    /**
     * Categoria: a do CW Engine primeiro, o palpite depois.
     *
     * A planilha do Reclame Aqui traz "Outros" nas 127 linhas — o campo
     * existe e não classifica nada. O CW Engine tem classificação de
     * verdade, feita por gente. Onde ele não tem, o classificador por
     * título entra, que é melhor do que deixar tudo em "Não
     * classificado".
     */
    const doEngine = (e?.Categorias ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];

    const subDoEngine =
      e?.Subcategoria && e.Subcategoria !== "-"
        ? e.Subcategoria
        : "";

    /**
     * Três fontes de classificação, em ordem de confiança.
     *
     * 1. **O CW Engine**, quando tem — é classificação feita por gente
     *    da operação, com o vocabulário dela.
     * 2. **O `Problema RA`** do export "Base de dados", que o próprio
     *    consumidor escolhe no portal ao abrir a reclamação. Cobre 312
     *    das 340 linhas, e é dado de origem, não palpite.
     * 3. **O classificador por título**, que é chute informado.
     *
     * O relatório "Previsão para o RA1000" não traz `Problema RA`; o
     * "Base de dados" traz. Por isso o degrau existe em vez de escolher
     * um dos dois: o mesmo comando lê os dois arquivos.
     */
    const problemaRa = (r["Problema RA"] ?? "").trim();

    const doPortal = problemaRa
      ? classificarPorProblema(
          problemaRa,
          r["Título"] ?? ""
        )
      : null;

    const palpite =
      doPortal ?? classificar(r["Título"] ?? "");

    const categoria = doEngine || palpite.categoria;

    const subcategoria =
      doEngine && subDoEngine
        ? subDoEngine
        : doEngine
          ? undefined
          : palpite.subcategoria;

    /* ---- estabelecimento ---- */

    const conta = (e?.Conta ?? "").trim();

    if (conta) {

      const slug = slugify(conta);

      if (!estabelecimentos.has(slug)) {
        estabelecimentos.set(slug, {
          slug,
          name: conta,
          externalId: e?.["Company ID"] || undefined,
          portalUrl: e?.["Link portal"] || undefined,
        });
      }
    }

    /* ---- cliente ---- */

    const slugCliente = slugify(nome);

    const documento = (r["CPF/CNPJ"] ?? "").replace(
      /\D/g,
      ""
    );

    if (!clientes.has(slugCliente)) {
      clientes.set(slugCliente, {
        slug: slugCliente,
        document: documento || undefined,
        conta: conta || undefined,
      });
    } else if (conta) {
      const atual = clientes.get(slugCliente)!;
      atual.conta = atual.conta ?? conta;
      atual.document = atual.document ?? (documento || undefined);
    }

    /* ---- time e responsável ---- */

    const timeBruto = (e?.Times ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0];

    const time = timeBruto
      ? TIMES[chave(timeBruto).replace(/ /g, "")]
      : undefined;

    if (timeBruto && !time) {
      timesIgnorados.add(timeBruto);
    }

    /**
     * Até janeiro de 2026, a responsável é a Carla.
     *
     * Decisão do Isaac, e ela **vence** o que o CW Engine diz: naquele
     * período o registro de responsável no CW Engine estava incompleto,
     * e quem cuidou da fila foi ela. Sem esta regra, treze reclamações
     * ficariam sem dono ou com o dono errado.
     */
    const ateJaneiro =
      (dia(r["Data Reclamação"]) ?? "") <= LIMITE_CARLA;

    if (ateJaneiro) porRegraDaCarla += 1;

    const dono = ateJaneiro
      ? "Carla Campos"
      : (e?.Responsavel ?? "").trim();

    /**
     * CPF e CNPJ entram, os dois.
     *
     * A pergunta do portal é "CPF **ou** CNPJ", e a Cardápio Web cadastra
     * estabelecimento das duas formas: 122 das 127 linhas respondem com
     * CPF. Guardar só catorze dígitos — como esta carga fazia antes —
     * deixaria de fora quase todo o vínculo que existe na base.
     */
    const doc =
      documento.length === 11 || documento.length === 14
        ? documento
        : undefined;

    const item: Case = {
      id: "",
      protocol: protocoloDe(
        r["ID Reclame Aqui"],
        r["Data Reclamação"],
        usados
      ),

      // O export trata o reclamante como a empresa: não traz o restaurante.
      company: nome,
      customer: nome,

      document: doc,

      email: r["Email"] || undefined,
      phone:
        (r["Telefones"] ?? "").split(";")[0].trim() ||
        undefined,

      city: r["Cidade"] || undefined,
      state: r["Estado"] || undefined,

      source: "Reclame Aqui",

      category: categoria,
      subcategory: subcategoria,

      priority: prioridadeDe({
        nota: temNota ? nota : null,
        resolvida,
        avaliada: temNota,
        respondida: Boolean(respondida),
      }),

      status: etapaDe(r["Status RA"] ?? ""),

      owner: dono || undefined,
      department: time,

      title: r["Título"] || "Sem título",

      description:
        (r["Texto da Reclamação"] ?? "")
          .replace(/\r/g, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim() ||
        "Reclamação registrada no Reclame Aqui.",

      /**
       * A resposta pública, quando o export a traz.
       *
       * O "Base de dados RA" tem a coluna `Resposta da empresa` com o
       * texto inteiro — 327 das 340 linhas. O "Previsão para o RA1000"
       * não tem, e ali só dá para dizer *que* houve resposta.
       *
       * A frase de reserva importa: é ela que faz `tagsOf` não marcar
       * "aguardando área interna" numa reclamação já respondida.
       */
      publicResponse:
        (r["Resposta da empresa"] ?? "")
          .replace(/\r/g, "")
          .trim() ||
        (respondida
          ? "Resposta pública registrada no portal."
          : ""),

      score: temNota ? nota : undefined,
      evaluated: temNota,

      /**
       * O portal marca as avaliações que ele mesmo invalidou.
       *
       * Aqui vira sinalização; quem tira do cálculo da nota é o
       * `reputation.service`. Sem ler esta coluna, uma nota que o
       * Reclame Aqui já descartou continuaria pesando no indicador
       * daqui — e os dois números divergiriam sem explicação.
       */
      scoreDisregarded:
        (r["Avaliações desconsideradas RA"] ?? "")
          .trim()
          .toLowerCase() === "sim" || undefined,

      resolved: resolvida,
      wouldDoBusiness: voltaria,

      evaluatedAt: avaliada
        ? avaliada.toISOString().slice(0, 10)
        : undefined,

      responseTime: decorrido(criada, respondida),
      solutionTime: decorrido(criada, avaliada),

      sla: resolvida ? "Concluído" : "48h",

      raUrl: e?.["Link Reclame Aqui"] || undefined,

      churnRisk: temNota && !resolvida && !voltaria,

      createdAt:
        (dia(r["Data Reclamação"]) as string) ?? "",

      updatedAt:
        dia(r["Data Avaliacao"]) ??
        dia(r["Data de Resposta"]) ??
        dia(r["Data Reclamação"]) ??
        undefined,

      lastInteraction:
        dia(r["Data última réplica"]) ??
        dia(r["Data Avaliacao"]) ??
        dia(r["Data de Resposta"]) ??
        undefined,

      tags: [],
    };

    // O id do modelo é o que a URL usa; sem id de portal, é o protocolo.
    item.id = item.protocol;
    item.tags = etiquetasDe(item);


    return item;
  });

  /* ---------- 4.5. o que já está no banco ---------- */

  /**
   * No modo incremental, o filtro acontece **antes** do relatório.
   *
   * Assim os números que saem na tela são os do que vai realmente
   * entrar, e não os do arquivo inteiro — que é a diferença entre "vou
   * criar 1" e "vou criar 127", lida por quem está prestes a apertar
   * `--gravar`.
   */
  const jaNoBanco = new Set(
    (
      await prisma.case.findMany({
        select: { protocol: true },
      })
    ).map((c) => c.protocol)
  );

  const novas = casos.filter(
    (c) => !jaNoBanco.has(c.protocol)
  );

  if (SOMENTE_NOVAS) {
    console.log(
      `  base atual: ${jaNoBanco.size} reclamações · do arquivo, ${casos.length - novas.length} já estão lá e ${novas.length} são novas\n`
    );
  }

  /* ---------- 5. relatório ---------- */

  console.log("  CASAMENTO COM O CW ENGINE");

  for (const [k, v] of Object.entries(degraus)) {
    console.log(`    ${k.padEnd(16)} ${v}`);
  }

  const comEstabelecimento = pares.filter((p) =>
    Boolean(p?.linha.Conta?.trim())
  ).length;

  console.log(
    `\n  estabelecimentos distintos: ${estabelecimentos.size}`
  );

  console.log(`  clientes distintos:         ${clientes.size}`);

  console.log(
    `  reclamações com estabelecimento: ${comEstabelecimento} de ${casos.length}`
  );

  const usuarios = new Map(
    (
      await prisma.user.findMany({
        select: { id: true, name: true },
      })
    ).map((u) => [chave(u.name), u.id])
  );

  const porDono = new Map<string, number>();

  for (const c of casos) {
    if (!c.owner) continue;
    porDono.set(c.owner, (porDono.get(c.owner) ?? 0) + 1);
  }

  const semUsuario = [...porDono.keys()].filter(
    (d) => !usuarios.has(chave(d))
  );

  console.log("\n  RESPONSÁVEIS");

  console.log(
    `    (${porRegraDaCarla} até ${LIMITE_CARLA} foram para a Carla pela regra, vencendo o CW Engine)`
  );

  for (const [nome, n] of [...porDono].sort(
    (a, b) => b[1] - a[1]
  )) {

    const conhecido = usuarios.has(chave(nome));

    console.log(
      `    ${nome.padEnd(16)} ${String(n).padStart(3)}${conhecido ? "" : "   sem cadastro — será criado"}`
    );
  }

  if (timesIgnorados.size) {
    console.log(
      `  times do CW Engine sem correspondente: ${[...timesIgnorados].join(", ")}`
    );
  }

  const semTexto = casos.filter(
    (c) => c.description.length < 40
  ).length;

  console.log(
    `
  protocolo: ${casos[0]?.protocol} (o ID do Reclame Aqui — o mesmo que a extensão lê como COD)`
  );

  console.log(
    `\n  reclamações sem relato: ${semTexto} | com nota: ${casos.filter((c) => c.evaluated).length} | resolvidas: ${casos.filter((c) => c.resolved).length}`
  );

  /**
   * O que o arquivo trouxe além do básico.
   *
   * Os dois exports do portal têm colunas diferentes, e sem esta linha
   * não dá para saber qual deles foi usado — nem por que uma carga
   * ficou com resposta pública e a outra com a frase de reserva.
   */
  const comRespostaReal = casos.filter(
    (c) =>
      c.publicResponse &&
      c.publicResponse !==
        "Resposta pública registrada no portal."
  ).length;

  const doPortalRa = base.filter((r) =>
    (r["Problema RA"] ?? "").trim()
  ).length;

  console.log(
    `  com a resposta pública inteira: ${comRespostaReal} | classificadas pelo portal: ${doPortalRa} | avaliações desconsideradas: ${casos.filter((c) => c.scoreDisregarded).length}`
  );

  if (SOMENTE_NOVAS && novas.length === 0) {
    console.log(
      "\n  Nada a criar: tudo que está no arquivo já está na base.\n"
    );
    return;
  }

  if (!GRAVAR) {
    console.log(
      `\n  SIMULAÇÃO — nada foi gravado. Repita com --gravar.\n`
    );
    return;
  }

  /* ---------- 6. trava do backup ---------- */

  /**
   * A trava do backup é da carga completa, não do modo incremental.
   *
   * Ela existe porque a carga **apaga** a base antes de gravar, e sem
   * cópia não há de onde voltar. O modo incremental não apaga nada:
   * exigir backup ali seria atrito por simetria, e atrito por simetria
   * é o que faz as pessoas contornarem a trava quando ela importa.
   */
  if (!SOMENTE_NOVAS) {

    const hoje = new Date()
      .toISOString()
      .slice(0, 10);

    const temBackup = readdirSync(process.cwd()).some(
      (f) =>
        f.startsWith(`backup-${hoje}`) &&
        f.endsWith(".json")
    );

    if (!temBackup) {
      console.error(
        `\n  Não há backup de hoje na pasta. Rode "npm run db:backup" antes — este comando apaga a base.\n`
      );
      process.exit(1);
    }
  }

  /* ---------- 7. limpeza (só na carga completa) ---------- */

  if (!SOMENTE_NOVAS) {

    console.log("\n  APAGANDO");

    const apagados = {
      casos: (await prisma.case.deleteMany({})).count,
      clientes: (
        await prisma.clientProfile.deleteMany({})
      ).count,
      estabelecimentos: (
        await prisma.establishment.deleteMany({})
      ).count,
      empresas: (await prisma.company.deleteMany({}))
        .count,
    };

    console.log(`    ${JSON.stringify(apagados)}`);
  }

  /** No modo incremental, só as que faltam entram. */
  const paraGravar = SOMENTE_NOVAS ? novas : casos;

  /* ---------- 8. estabelecimentos ---------- */

  /**
   * Só os estabelecimentos que têm reclamação nesta base.
   *
   * O CW Engine lista 405; criar todos encheria o cadastro de contas que
   * ninguém pediu e que não têm caso nenhum apontando para elas. As que
   * ficarem de fora entram quando a reclamação delas aparecer.
   */
  const idPorSlug = new Map<string, string>();

  /**
   * No modo incremental, o cadastro que já existe é **reaproveitado**.
   *
   * Criar de novo estouraria o `slug` único, e recriar seria pior: a
   * ficha do restaurante carrega plano, MRR e responsável preenchidos à
   * mão, e nada disso vem de planilha nenhuma.
   */
  if (SOMENTE_NOVAS) {
    for (const e of await prisma.establishment.findMany({
      select: { id: true, slug: true },
    })) {
      idPorSlug.set(e.slug, e.id);
    }
  }

  let criados = 0;

  for (const e of estabelecimentos.values()) {

    if (idPorSlug.has(e.slug)) continue;

    const criado = await prisma.establishment.create({
      data: {
        slug: e.slug,
        name: e.name,
        externalId: e.externalId ?? null,
        portalUrl: e.portalUrl ?? null,

        /**
         * Plano e situação não vêm de planilha nenhuma. "Ativo" e
         * "Essencial" são o que o modelo exige; quem souber o real
         * corrige na tela, e o valor de partida não finge precisão que
         * não existe.
         */
        plan: "Essencial",
        status: "Ativo",

        notes:
          "Criado pela carga do Reclame Aqui, a partir da conta do CW Engine. Plano e situação ainda não conferidos.",
      },
      select: { id: true, slug: true },
    });

    idPorSlug.set(criado.slug, criado.id);
    criados += 1;
  }

  console.log(
    `\n  ${criados} estabelecimentos criados`
  );

  /* ---------- 9. reclamações ---------- */

  /**
   * O vínculo é resolvido aqui, e não pelo CNPJ.
   *
   * `persistCase` liga reclamação a estabelecimento pelo CNPJ do RA
   * Forms — que a planilha não traz. Aqui a ligação vem do CW Engine,
   * então ela é gravada direto, com `establishmentManual` para a
   * varredura do cron não tentar refazer o que já está feito.
   */
  const indice = new Map(
    casos.map((c, i) => [c.protocol, i])
  );

  paraGravar.forEach((item) => {

    const i = indice.get(item.protocol) ?? -1;
    const conta = pares[i]?.linha.Conta?.trim();

    if (!conta) return;

    item.establishmentId = idPorSlug.get(
      slugify(conta)
    );

    item.establishmentManual = true;
  });

  /**
   * Quem atendeu continua atendendo, mesmo sem conta nesta base.
   *
   * Sem usuário, `persistCase` deixaria o caso sem dono — e a informação
   * de quem cuidou de cada reclamação se perderia na carga, em silêncio.
   *
   * A pessoa é criada **do mesmo jeito que a tela de Times cria**: nome,
   * sem e-mail, endereço interno `@sem-acesso.local` gerado pelo
   * servidor. Não é um caminho especial da carga — é o mesmo cadastro,
   * e quem for criado aqui aparece lá para ser editado.
   *
   * `passwordHash` vazio não é senha em branco: o login exige um hash
   * bcrypt válido e recusa qualquer outra coisa.
   */
  for (const nome of semUsuario) {

    const criado = await prisma.user.create({
      data: {
        name: nome,
        email: `${slugify(nome)}@sem-acesso.local`,
        passwordHash: "",
        role: "LEITURA",
        jobTitle: "Analista de Reputação",
      },
      select: { id: true, name: true },
    });

    console.log(
      `  responsável criado: ${criado.name}`
    );
  }

  const saida = await importCasesBulk(
    prisma,
    paraGravar
  );

  console.log(
    `  ${saida.gravadas ?? paraGravar.length} reclamações gravadas`
  );

  /* ---------- 10. clientes ---------- */

  /**
   * O cliente é **derivado** da reclamação — ver `ClientProfile`.
   *
   * Gravar aqui não cria a pessoa: cria o enriquecimento dela. O que a
   * reclamação não sabe dizer e a planilha sabe é o documento; o que o
   * CW Engine sabe é a qual restaurante ela pertence.
   */
  let comDocumento = 0;

  /** Quem já tem enriquecimento não é recriado — o slug é único. */
  const clientesExistentes = new Set(
    (
      await prisma.clientProfile.findMany({
        select: { slug: true },
      })
    ).map((c) => c.slug)
  );

  for (const c of clientes.values()) {

    if (clientesExistentes.has(c.slug)) continue;

    const establishmentId = c.conta
      ? idPorSlug.get(slugify(c.conta))
      : undefined;

    if (!c.document && !establishmentId) continue;

    await prisma.clientProfile.create({
      data: {
        slug: c.slug,
        manual: false,
        document: c.document ?? null,
        establishmentId: establishmentId ?? null,
        kind: establishmentId
          ? "Proprietário"
          : null,
        tags: [],
      },
    });

    comDocumento += 1;
  }

  console.log(
    `  ${comDocumento} clientes enriquecidos (documento e/ou estabelecimento)`
  );

  /* ---------- 10.5. o documento sobe para o estabelecimento ---------- */

  /**
   * Sem isto, o vínculo automático morre depois desta carga.
   *
   * O CW Engine diz **qual** restaurante está por trás de cada
   * reclamação, mas não diz o CPF/CNPJ dele — então os 105 cadastros
   * nascem sem documento. E é o documento do cadastro que a extensão
   * consulta para ligar a próxima reclamação sozinha: sem ele, toda
   * captura futura cairia como órfã, e o mecanismo que acabou de ser
   * construído nunca mais dispararia.
   *
   * A pergunta do RA Forms é "CPF ou CNPJ **de cadastro no portal**" —
   * é o documento do estabelecimento, não o do consumidor. Por isso ele
   * pode subir.
   *
   * **Só quando as reclamações concordam.** Onde duas apontam documentos
   * diferentes o campo fica vazio e o nome sai no relatório: pode ser um
   * restaurante que migrou de CPF para CNPJ, e escolher um dos dois no
   * escuro ligaria as próximas capturas ao cadastro errado — que é pior
   * do que não ligar nenhuma.
   */
  const documentosPorEst = new Map<string, Set<string>>();

  for (const c of await prisma.case.findMany({
    where: {
      establishmentId: { not: null },
      document: { not: null },
    },
    select: { establishmentId: true, document: true },
  })) {

    const k = c.establishmentId!;

    if (!documentosPorEst.has(k)) {
      documentosPorEst.set(k, new Set());
    }

    documentosPorEst.get(k)!.add(c.document!);
  }

  let comDocumentoNoCadastro = 0;
  const divergentes: string[] = [];

  /**
   * Cadastro que já tem documento não é tocado.
   *
   * Pode ter sido corrigido à mão — é exatamente o caso dos três que a
   * carga deixou vazios de propósito, por divergência. Sobrescrever
   * aqui desfaria a decisão de quem olhou.
   */
  const semDocumento = new Set(
    (
      await prisma.establishment.findMany({
        where: { document: null },
        select: { id: true },
      })
    ).map((e) => e.id)
  );

  for (const [id, docs] of documentosPorEst) {

    if (!semDocumento.has(id)) continue;

    if (docs.size !== 1) {

      const e = await prisma.establishment.findUnique({
        where: { id },
        select: { name: true },
      });

      divergentes.push(
        `${e?.name ?? id} (${[...docs].join(" / ")})`
      );

      continue;
    }

    await prisma.establishment.update({
      where: { id },
      data: { document: [...docs][0] },
    });

    comDocumentoNoCadastro += 1;
  }

  console.log(
    `  ${comDocumentoNoCadastro} estabelecimentos ganharam o documento das próprias reclamações`
  );

  if (divergentes.length) {
    console.log(
      `\n  ${divergentes.length} com documentos divergentes — ficam sem, para alguém decidir:`
    );

    for (const d of divergentes) {
      console.log(`    ${d}`);
    }
  }

  /* ---------- 11. conferência ---------- */

  const conferencia = {
    casos: await prisma.case.count(),
    comEstabelecimento: await prisma.case.count({
      where: { establishmentId: { not: null } },
    }),
    estabelecimentos:
      await prisma.establishment.count(),
    clientes: await prisma.clientProfile.count(),
    /**
     * Relato de verdade, não o texto de reserva.
     *
     * Contar `description IS NOT NULL` daria 127 sempre — toda
     * reclamação recebe uma frase de reserva quando a planilha vem sem
     * o texto. O número que interessa é quantas trouxeram o relato do
     * consumidor, porque é dele que a IA e a triagem vivem.
     */
    comRelato: await prisma.case.count({
      where: {
        NOT: {
          description:
            "Reclamação registrada no Reclame Aqui.",
        },
      },
    }),

    comTime: await prisma.case.count({
      where: { teamId: { not: null } },
    }),

    comDono: await prisma.case.count({
      where: { ownerId: { not: null } },
    }),

    estComDocumento: await prisma.establishment.count({
      where: { document: { not: null } },
    }),
    comTelefone: await prisma.case.count({
      where: { phone: { not: null } },
    }),
    comEmail: await prisma.case.count({
      where: { email: { not: null } },
    }),
  };

  console.log("\n  NO BANCO AGORA");

  for (const [k, v] of Object.entries(conferencia)) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }

  console.log("");
}

main()
  .catch((erro) => {
    console.error("\n  ERRO:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
