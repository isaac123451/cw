"use client";

import { useEffect, useRef } from "react";

import { useSearchParams } from "next/navigation";

import { emptyFilters, useCases } from "@/lib/context/CaseContext";

/**
 * Os parâmetros aceitos, e a que filtro cada um corresponde.
 *
 * Em português porque aparecem na barra de endereço, e um link colado
 * num chat é lido por gente: `?categoria=Entrega` diz o que faz;
 * `?cat=Entrega` obriga a adivinhar.
 */
const DE_PARA = {
  categoria: "category",
  status: "status",
  etiqueta: "tag",
  responsavel: "owner",
  cliente: "company",
  estabelecimento: "establishment",
  busca: "search",
  de: "de",
  ate: "ate",
} as const;

/**
 * Deixa a fila do Reclame Aqui chegar já filtrada por link.
 *
 * É o que faz o gráfico responder a segunda pergunta. Um painel que diz
 * "Entrega: 34 reclamações" responde *quantas*, e a próxima coisa que
 * se quer saber é *quais* — que antes custava atravessar a aplicação e
 * remontar o filtro à mão. Com isto, a barra do gráfico é um link para
 * `/reclame-aqui?categoria=Entrega`.
 *
 * **Aplica uma vez, e nunca mais.** O filtro da URL é um ponto de
 * partida, não uma amarra: quem chega por ali e troca a categoria na
 * barra de ferramentas não pode ser puxado de volta ao que o link
 * dizia. Sem a trava, cada render devolveria o filtro original e a
 * pessoa não conseguiria mudar nada.
 *
 * **Substitui, não acumula.** Chegar por um link limpa o que estava
 * filtrado antes — senão o resultado seria a interseção de dois
 * recortes que ninguém pediu junto, e a lista viria vazia sem
 * explicação.
 */
export default function FiltroDaUrl() {

  const params = useSearchParams();
  const { applyFilters } = useCases();

  const aplicado = useRef(false);

  useEffect(() => {

    if (aplicado.current) return;

    const criterio = { ...emptyFilters };
    let achou = false;

    for (const [naUrl, noFiltro] of Object.entries(
      DE_PARA
    )) {

      const valor = params.get(naUrl);

      if (valor) {
        criterio[noFiltro] = valor;
        achou = true;
      }
    }

    aplicado.current = true;

    if (achou) applyFilters(criterio);

  }, [params, applyFilters]);

  return null;
}
