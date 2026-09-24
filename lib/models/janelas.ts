/**
 * Mini-janelas: várias fichas abertas enquanto se navega.
 *
 * **O pedido.** "Em cada frente seja possível abrir uma mini janela para
 * preencher as informações ou mudar status. Quero que seja possível
 * abrir mais de uma e navegar entre as páginas enquanto faço isso."
 *
 * **O que isso muda no trabalho.** Até aqui, mexer num caso era sair da
 * lista, abrir a ficha, salvar e voltar — e para comparar dois casos, ou
 * responder um NPS enquanto se lê a reclamação do mesmo cliente, era
 * abrir abas do navegador. As janelas ficam por cima da plataforma, não
 * tapam o fundo (sem desfoque, como o Isaac pediu para os painéis), se
 * arrastam, se minimizam numa bandeja e continuam abertas ao trocar de
 * página.
 *
 * Este arquivo é só a regra — abrir, focar, posicionar, guardar. Nada
 * de React, para a conferência provar sem tela.
 */

export type FrenteDaJanela = "reclame-aqui" | "redes" | "nps" | "google";

export interface Janela {
  /** `frente:ref` — abrir a mesma ficha de novo foca a que já existe. */
  id: string;
  frente: FrenteDaJanela;
  /** O id do caso, da resposta do NPS ou da avaliação do Google. */
  ref: string;
  titulo: string;
  x: number;
  y: number;
  /** Ordem de empilhamento: a maior fica na frente. */
  z: number;
  minimizada: boolean;
  /**
   * A ficha inteira (Fase 12 do roadmap 2.0): mais larga, com tudo o que a
   * tela cheia tem. Sem isto, a janela mostra só o essencial para mudar
   * etapa, prioridade e responsável no meio do dia.
   */
  completa?: boolean;
}

export interface PedidoDeJanela {
  frente: FrenteDaJanela;
  ref: string;
  titulo: string;
}

/**
 * Quantas cabem abertas.
 *
 * Oito é o ponto em que a bandeja ainda cabe numa linha e a pessoa
 * ainda sabe o que abriu. A nona não fecha nenhuma sozinha — quem decide
 * o que sai é quem abriu; a tela avisa.
 */
export const MAXIMO_DE_JANELAS = 8;

export const LARGURA_DA_JANELA = 380;

/** A largura da ficha completa — cabe a ficha empilhada, sem cobrir a tela inteira. */
export const LARGURA_DA_FICHA_COMPLETA = 720;

/**
 * Trocar entre essencial e completa, trazendo a janela para dentro da tela:
 * alargar uma janela que estava no canto direito a jogaria para fora.
 */
export function alternarCompleta(janelas: Janela[], id: string, tela: { largura: number; altura: number }): Janela[] {
  return janelas.map((j) => {
    if (j.id !== id) return j;
    const completa = !j.completa;
    const largura = Math.min(completa ? LARGURA_DA_FICHA_COMPLETA : LARGURA_DA_JANELA, tela.largura - 16);
    const x = Math.max(8, Math.min(j.x, tela.largura - largura - 8));
    const y = completa ? Math.max(8, Math.min(j.y, 56)) : j.y;
    return { ...j, completa, x, y };
  });
}

/** O deslocamento de uma janela nova em relação à anterior. */
const CASCATA = 28;

export function idDaJanela(frente: FrenteDaJanela, ref: string) {
  return `${frente}:${ref}`;
}

/**
 * Onde a janela nova nasce.
 *
 * Em cascata a partir do canto direito, para não nascer em cima do menu
 * nem exatamente em cima da anterior — e volta ao topo quando a cascata
 * chegaria ao fim da tela.
 */
export function posicaoInicial(
  abertas: number,
  tela: { largura: number; altura: number }
) {
  const passos = Math.max(1, Math.floor((tela.altura - 360) / CASCATA));
  const n = abertas % passos;
  const largura = Math.min(LARGURA_DA_JANELA, tela.largura - 16);
  /*
    Nasce inteira na tela. `limitarNaTela` deixa a janela meio para fora
    de propósito (é o limite do arrastar); ao nascer, num celular de
    375 px, isso a punha 29 px além da borda esquerda.
  */
  const x = Math.max(8, Math.min(tela.largura - largura - 8, tela.largura - LARGURA_DA_JANELA - 24 - n * CASCATA));
  return limitarNaTela({ x, y: 80 + n * CASCATA }, tela);
}

/**
 * A janela nunca some da tela.
 *
 * Sobra sempre um pedaço do cabeçalho para pegar de volta — o mesmo
 * cuidado dos painéis arrastáveis, e o que faltaria a uma janela
 * arrastada para fora num monitor e reaberta num notebook.
 */
export function limitarNaTela(
  posicao: { x: number; y: number },
  tela: { largura: number; altura: number }
) {
  const largura = Math.min(LARGURA_DA_JANELA, tela.largura - 16);
  return {
    x: Math.round(Math.max(8 - largura + 120, Math.min(tela.largura - 120, posicao.x))),
    y: Math.round(Math.max(8, Math.min(tela.altura - 48, posicao.y))),
  };
}

export type ResultadoDeAbrir =
  | { tipo: "aberta"; janelas: Janela[]; id: string }
  | { tipo: "focada"; janelas: Janela[]; id: string }
  | { tipo: "cheia"; janelas: Janela[] };

/**
 * Abrir uma ficha numa janela.
 *
 * A mesma ficha duas vezes não vira duas janelas — duas cópias do mesmo
 * caso, cada uma com um rascunho, é o caminho mais curto para uma apagar
 * a outra. A que já existe vem para a frente e sai da bandeja.
 */
export function abrirJanela(
  janelas: Janela[],
  pedido: PedidoDeJanela,
  tela: { largura: number; altura: number }
): ResultadoDeAbrir {

  const id = idDaJanela(pedido.frente, pedido.ref);
  const topo = janelas.reduce((max, j) => Math.max(max, j.z), 0);

  const existente = janelas.find((j) => j.id === id);

  if (existente) {
    return {
      tipo: "focada",
      id,
      janelas: janelas.map((j) =>
        j.id === id ? { ...j, z: topo + 1, minimizada: false, titulo: pedido.titulo || j.titulo } : j
      ),
    };
  }

  if (janelas.length >= MAXIMO_DE_JANELAS) {
    return { tipo: "cheia", janelas };
  }

  const { x, y } = posicaoInicial(janelas.length, tela);

  return {
    tipo: "aberta",
    id,
    janelas: [
      ...janelas,
      { id, frente: pedido.frente, ref: pedido.ref, titulo: pedido.titulo, x, y, z: topo + 1, minimizada: false },
    ],
  };
}

export function focarJanela(janelas: Janela[], id: string): Janela[] {
  const topo = janelas.reduce((max, j) => Math.max(max, j.z), 0);
  const alvo = janelas.find((j) => j.id === id);
  if (!alvo || (alvo.z === topo && !alvo.minimizada)) return janelas;
  return janelas.map((j) => (j.id === id ? { ...j, z: topo + 1, minimizada: false } : j));
}

/**
 * Guardar as janelas abertas entre recarregamentos.
 *
 * Só o endereço de cada uma (frente, ficha, posição) — nunca o conteúdo
 * nem o rascunho: o que está gravado vem do banco quando a janela abre
 * de novo, e o rascunho não salvo é da aba em que foi digitado.
 */
export function lerJanelasGuardadas(
  texto: string | null,
  tela: { largura: number; altura: number }
): Janela[] {

  if (!texto) return [];

  let bruto: unknown;

  try {
    bruto = JSON.parse(texto);
  } catch {
    return [];
  }

  if (!Array.isArray(bruto)) return [];

  const FRENTES: FrenteDaJanela[] = ["reclame-aqui", "redes", "nps", "google"];

  return bruto
    .filter(
      (j): j is Janela =>
        !!j &&
        typeof j === "object" &&
        FRENTES.includes((j as Janela).frente) &&
        typeof (j as Janela).ref === "string" &&
        (j as Janela).ref !== ""
    )
    .slice(0, MAXIMO_DE_JANELAS)
    .map((j, i) => {
      const { x, y } = limitarNaTela({ x: Number(j.x) || 0, y: Number(j.y) || 0 }, tela);
      return {
        id: idDaJanela(j.frente, j.ref),
        frente: j.frente,
        ref: j.ref,
        titulo: String(j.titulo ?? "").slice(0, 120),
        x,
        y,
        z: Number(j.z) || i + 1,
        minimizada: Boolean(j.minimizada),
        completa: Boolean(j.completa),
      };
    });
}

export const ROTULO_DA_FRENTE: Record<FrenteDaJanela, string> = {
  "reclame-aqui": "Reclame Aqui",
  redes: "Redes Sociais",
  nps: "NPS",
  google: "Google",
};

/**
 * O que dá para abrir numa mini-janela, pelo endereço do link.
 *
 * O Meu dia, a Agenda, o cliente e o estabelecimento já apontam para a
 * ficha pelo endereço. Em vez de cada lista saber a frente e o id de cada
 * item, o endereço diz: `/reclame-aqui/<id>`, `/redes-sociais/<id>`,
 * `/nps/<id>` e `/google?avaliacao=<id>`. Qualquer outro link — uma tela,
 * uma lista — não abre janela, e a função devolve `null`.
 */
export function janelaDoEndereco(href: string | undefined | null, titulo: string): PedidoDeJanela | null {
  if (!href) return null;
  const [caminho, busca = ""] = href.split("?");
  const partes = caminho.split("/").filter(Boolean);
  if (partes.length === 2 && partes[0] === "reclame-aqui" && !["analytics", "graficos", "calculadora", "configuracoes", "avaliacoes", "novo", "premio"].includes(partes[1])) {
    return { frente: "reclame-aqui", ref: decodeURIComponent(partes[1]), titulo };
  }
  if (partes.length === 2 && partes[0] === "redes-sociais") return { frente: "redes", ref: decodeURIComponent(partes[1]), titulo };
  if (partes.length === 2 && partes[0] === "nps" && partes[1] !== "analise") return { frente: "nps", ref: decodeURIComponent(partes[1]), titulo };
  if (partes.length === 1 && partes[0] === "google") {
    const id = new URLSearchParams(busca).get("avaliacao");
    if (id) return { frente: "google", ref: id, titulo };
  }
  return null;
}

/**
 * Arrumar as janelas abertas (as minimizadas ficam na bandeja).
 *
 * **Lado a lado:** em colunas da largura de cada uma, da esquerda para a
 * direita a partir do conteúdo, quebrando para uma segunda fileira
 * deslocada quando não cabem. **Cascata:** uma sobre a outra, deslocadas,
 * a partir do canto — a mais recente na frente.
 */
export function organizarJanelas(
  janelas: Janela[],
  modo: "lado-a-lado" | "cascata",
  tela: { largura: number; altura: number }
): Janela[] {
  const visiveis = janelas.filter((j) => !j.minimizada).sort((a, b) => a.z - b.z);
  const largura = (j: Janela) => Math.min(j.completa ? LARGURA_DA_FICHA_COMPLETA : LARGURA_DA_JANELA, tela.largura - 16);
  const novas = new Map<string, { x: number; y: number }>();

  if (modo === "cascata") {
    visiveis.forEach((j, i) => {
      const x = Math.max(8, Math.min(tela.largura - largura(j) - 8, 80 + i * CASCATA));
      novas.set(j.id, { x, y: Math.min(tela.altura - 200, 64 + i * CASCATA) });
    });
  } else {
    let x = 8;
    let fileira = 0;
    for (const j of visiveis) {
      if (x + largura(j) > tela.largura - 8 && x > 8) {
        fileira += 1;
        x = 8 + fileira * CASCATA;
      }
      novas.set(j.id, { x, y: 64 + fileira * 48 });
      x += largura(j) + 8;
    }
  }

  return janelas.map((j) => (novas.has(j.id) ? { ...j, ...novas.get(j.id)! } : j));
}
