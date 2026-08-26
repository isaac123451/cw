import Link from "next/link";

import { Distribution } from "@/lib/services/case.service";

import { ptBR } from "@/lib/services/reputation.service";

interface Props {
  data: Distribution[];
  limit?: number;
  color?: string;
  emptyLabel?: string;

  /**
   * Para onde cada barra leva, se levar a algum lugar.
   *
   * Recebe o rótulo e devolve o endereço. O Isaac pediu isto três
   * vezes, em três telas diferentes: "quando eu passo o mouse em cima
   * das principais causas, quero que seja possível ir para outra aba
   * visualizar esses casos", "quando eu for clicar em uma categoria é
   * interessante visualizar o atendimentos", "quando eu clicar em um
   * assunto frequente seja possível verificar os casos daquela
   * categoria".
   *
   * É a mesma pergunta em todas: o número diz *quantos*, e a próxima
   * coisa que se quer saber é *quais*. Sem o link, a resposta custa
   * atravessar a aplicação e remontar o filtro à mão.
   *
   * Ausente, a lista continua sendo só leitura — é o caso de gráficos
   * cujo recorte não existe como filtro.
   */
  hrefDe?: (rotulo: string) => string;
}

/**
 * Distribuição horizontal em barras. Usa largura percentual relativa
 * ao maior item para que a comparação visual fique correta.
 */
export default function BarList({
  data,
  limit = 6,
  color = "#7C3AED",
  emptyLabel = "Sem dados para exibir.",
  hrefDe,
}: Props) {

  const items = data.slice(0, limit);

  const max = Math.max(
    ...items.map((item) => item.value),
    1
  );

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-4">

      {items.map((item) => {

        const href = hrefDe?.(item.label);

        /*
          O conteúdo é o mesmo com ou sem link.

          Escrever duas vezes faria as duas versões divergirem na
          primeira mudança — e a que ninguém olha é a que fica para
          trás.
        */
        const conteudo = (
          <>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">

            <span
              className={`truncate text-sm font-medium ${
                href
                  ? "text-zinc-700 group-hover/barra:text-violet-700"
                  : "text-zinc-700"
              }`}
            >
              {item.label}
            </span>

            <span className="flex shrink-0 items-baseline gap-1.5 text-sm font-semibold tabular-nums text-zinc-900">
              {item.value}
              <span className="text-xs font-normal text-zinc-400">
                {/*
                  Vírgula, não ponto.

                  `{item.percent}` era o número cru do JavaScript, que
                  imprime "1.1". Em português isso não é "um vírgula um"
                  — é o começo de "1.100", e num painel cheio de
                  contagem inteira ao lado a leitura errada é a mais
                  natural.
                */}
                ({ptBR(item.percent)}%)
              </span>
            </span>

          </div>

          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">

            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: color,
              }}
            />

          </div>
          </>
        );

        return (
          <li key={item.label}>

            {href ? (
              <Link
                href={href}
                title={`Ver as reclamações de ${item.label}`}
                className="group/barra block rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                {conteudo}
              </Link>
            ) : (
              conteudo
            )}

          </li>
        );
      })}

    </ul>
  );
}
