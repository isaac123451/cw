"use client";

import { useEffect, useRef, useState } from "react";

import {
  ChevronDown,
  Copy,
  FileText,
  Trash2,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  limparDossie,
  loadDossie,
} from "@/lib/actions/cases";

/**
 * O dossiê que a extensão salvou, na ficha do caso.
 *
 * O Isaac pediu as duas metades: "quero que você salve o dossiê caso eu
 * clique em salvar pela extensão e assim apareça na ferramenta" e "o
 * resumo deve aparecer na reclamação".
 *
 * O dossiê é montado no WhatsApp, onde o atendimento acontece — mas
 * quem abre o caso pela aplicação no dia seguinte é outra pessoa, ou a
 * mesma sem o painel aberto. Sem isto, a leitura morria na aba do
 * navegador de quem a pediu, e o próximo montava de novo: outros quinze
 * segundos, outra chamada ao modelo, e uma leitura ligeiramente
 * diferente da anterior.
 *
 * **Some quando não há dossiê.** Um cartão vazio dizendo "nenhum dossiê
 * ainda" ocuparia espaço em 341 casos para avisar de uma ausência que
 * não é problema — a maioria dos casos não precisa de dossiê.
 *
 * **Recolhido por padrão.** São milhares de caracteres; aberto, empurra
 * o relato e a resposta pública para fora da tela, e eles é que são a
 * primeira leitura.
 */
export default function DossieCard({
  data,
}: {
  data: Case;
}) {

  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [apagado, setApagado] = useState(false);

  /**
   * O dossiê, buscado por este cartão.
   *
   * **Ele nunca apareceu antes disto.** O campo saiu da listagem por
   * peso — milhares de caracteres por caso — e a busca sob demanda da
   * tela de detalhe pedia só o relato. `data.dossier` chegava sempre
   * `undefined`, o cartão some quando não há dossiê, e o resultado era
   * um recurso completo e invisível: a extensão gravava, o banco
   * guardava, e a ficha do caso não mostrava nada.
   *
   * **Estado próprio, e não o rascunho da tela.** O relato é editável e
   * entra no rascunho; o dossiê não se edita. Empurrá-lo por ali faria
   * a barra "Salvar" aparecer só de abrir o caso, anunciando uma
   * alteração que ninguém fez.
   */
  const [guardado, setGuardado] = useState<{
    dossier: string;
    dossierAt?: string;
    dossierBy?: string;
  } | null>(null);

  const buscado = useRef<string>("");

  useEffect(() => {

    /* Já veio na carga (a extensão acabou de gravar): não busca. */
    if (data.dossier) {
      setGuardado({
        dossier: data.dossier,
        dossierAt: data.dossierAt,
        dossierBy: data.dossierBy,
      });
      return;
    }

    if (buscado.current === data.protocol) return;

    buscado.current = data.protocol;

    const pedido = data.protocol;

    loadDossie(pedido)
      .then((achado) => {
        /*
          Confere o protocolo, e não um booleano de "ainda montado".

          O padrão comum aqui é `let ativo = true` com
          `return () => { ativo = false }`. Ele **não funciona** junto
          com um `ref` de "já busquei": em desenvolvimento o React monta,
          desmonta e monta de novo cada componente de propósito, e a
          sequência vira — busca começa, limpeza marca `ativo = false`,
          segundo efeito sai cedo pelo `ref`, e a resposta que chega é
          descartada. Nenhuma segunda busca acontece, e o dado nunca
          aparece.

          Foi exatamente o que escondeu este cartão enquanto eu tentava
          conferi-lo, e é o mesmo motivo de o relato da reclamação vir
          vazio em desenvolvimento. Comparar o protocolo responde a
          pergunta certa: "esta resposta ainda é do caso que está na
          tela?".
        */
        if (buscado.current !== pedido) return;

        if (achado) setGuardado(achado);
      })
      .catch((erro: unknown) => {
        console.error(
          "[caso] dossiê não carregou",
          erro
        );
      });

  }, [
    data.protocol,
    data.dossier,
    data.dossierAt,
    data.dossierBy,
  ]);

  if (!guardado || apagado) return null;

  /**
   * O parecer, a capa e as peças, a partir do texto guardado.
   *
   * A extensão grava as duas metades num campo só, separadas por um
   * cabeçalho fixo. Guardar em dois campos seria mais limpo e custaria
   * uma migração para desfazer o que já está salvo — e o separador é
   * escrito por nós, num formato que não aparece em texto humano.
   *
   * Dossiê antigo, salvo antes das peças existirem, não tem o
   * separador: `leitura` recebe o texto inteiro e a pasta simplesmente
   * não aparece, que é a verdade sobre ele.
   */
  const SEPARADOR = "=== AS PEÇAS DESTE DOSSIÊ ===";

  const corte = guardado.dossier.indexOf(SEPARADOR);

  const leitura =
    corte < 0
      ? guardado.dossier
      : guardado.dossier.slice(0, corte).trimEnd();

  const restante =
    corte < 0
      ? ""
      : guardado.dossier
          .slice(corte + SEPARADOR.length)
          .replace(/^\n+/, "");

  /*
    A primeira linha do resto é a capa: "4 documento(s) · de … · …".

    Ela sobe para o cabeçalho do `<details>` porque é exatamente o que
    responde "vale a pena abrir?".
  */
  const quebra = restante.indexOf("\n");

  const capa =
    quebra < 0 ? restante : restante.slice(0, quebra);

  const pasta =
    quebra < 0
      ? ""
      : restante.slice(quebra + 1).replace(/^\n+/, "");

  const quando = guardado.dossierAt
    ? new Date(guardado.dossierAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  /*
    Fixado antes do `async`.

    Dentro da função, o TypeScript já não confia no `if (!guardado)`
    lá de cima — entre a checagem e o `await`, outro render pode ter
    zerado o estado. Ler agora é o que garante que o texto copiado é o
    que estava na tela quando a pessoa clicou.
  */
  const textoCompleto = guardado.dossier;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        textoCompleto
      );
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* Navegador sem permissão: o texto está na tela para copiar à mão. */
    }
  }

  return (
    <SurfaceCard
      title="Dossiê do atendimento"
      description={
        quando
          ? `Salvo pela extensão em ${quando}${guardado.dossierBy ? ` por ${guardado.dossierBy}` : ""}.`
          : "Salvo pela extensão."
      }
      action={
        <div className="flex shrink-0 items-center gap-1.5">

          <button
            type="button"
            onClick={copiar}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
          >
            <Copy size={13} />
            {copiado ? "Copiado" : "Copiar"}
          </button>

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            {aberto ? "Recolher" : "Ler"}
            <ChevronDown
              size={13}
              className={`transition-transform ${aberto ? "rotate-180" : ""}`}
            />
          </button>

        </div>
      }
    >

      {aberto ? (

        <>
          {/*
            A leitura e a pasta, separadas.

            O texto guardado traz as duas metades coladas, divididas
            pelo cabeçalho das peças. Mostradas num parágrafo único, as
            peças viravam um paredão de texto no fim da narrativa — o
            oposto do que a palavra "organizado" promete na definição
            que o Isaac mandou.

            Quem abre o caso quer ler o parecer; quem vai conferir de
            onde saiu cada afirmação abre a pasta. São dois gestos
            diferentes, e agora são dois blocos.
          */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
            {leitura}
          </p>

          {pasta && (

            <details className="mt-4 rounded-xl border border-zinc-200/80 p-3.5">

              <summary className="cursor-pointer text-sm font-medium text-zinc-700">
                As peças deste dossiê
                {capa && (
                  <span className="ml-2 font-normal text-zinc-500">
                    {capa}
                  </span>
                )}
              </summary>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                {pasta}
              </p>

            </details>

          )}

          {/*
            Apagar existe porque o dossiê envelhece.

            Ele é um retrato do caso no dia em que foi montado; depois de
            três movimentações ele descreve um caso que já não existe, e
            um texto desatualizado com cara de resumo oficial é pior do
            que nenhum. Quem apaga sabe que basta montar de novo pela
            extensão.
          */}
          <button
            type="button"
            disabled={apagando}
            onClick={async () => {

              setApagando(true);

              await limparDossie(data.protocol);

              /*
                Some da tela na hora, e a recarga confirma.

                A lista de casos vem de um cache com etiqueta; esperar
                a revalidação para o cartão sumir deixaria a pessoa
                clicando duas vezes.
              */
              setApagado(true);
              setApagando(false);
            }}
            className="mt-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            <Trash2 size={13} />
            {apagando ? "Apagando…" : "Apagar este dossiê"}
          </button>
        </>

      ) : (

        <p className="flex items-start gap-2 text-sm leading-relaxed text-zinc-500">

          <FileText
            size={15}
            className="mt-0.5 shrink-0 text-violet-500"
          />

          {/*
            A prévia é do parecer, não do texto guardado inteiro.

            Cortar o campo cru em 180 caracteres podia devolver o
            cabeçalho das peças pela metade — "=== AS PEÇAS DESTE" —,
            que não diz nada sobre o caso.
          */}
          <span>
            {leitura.slice(0, 180)}
            {leitura.length > 180 && "…"}
            {capa && (
              <span className="ml-1 text-zinc-400">
                · {capa}
              </span>
            )}
          </span>

        </p>

      )}

    </SurfaceCard>
  );
}
