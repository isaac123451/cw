"use client";

import { useState } from "react";

import { CloudDownload } from "lucide-react";

import Modal, {
  GhostButton,
  PrimaryButton,
} from "@/components/shared/Modal";

import {
  importWootric,
  ResultadoImportacao,
} from "@/lib/actions/nps";

interface Props {
  onDone: (resumo: string, houveErro: boolean) => void;
}

/**
 * Janelas oferecidas.
 *
 * `0` é "continuar de onde parou" — a rodada do dia a dia, que parte da
 * resposta mais nova já importada. As outras refazem a janela inteira,
 * o que é seguro porque a chave é o `externalId` do Wootric: reimportar
 * atualiza, não duplica.
 */
const JANELAS = [
  {
    dias: 0,
    label: "Desde a última importação",
    hint: "O de todo dia. Segundos.",
  },
  { dias: 30, label: "30 dias", hint: "~790 respostas." },
  { dias: 90, label: "90 dias", hint: "~2.100 respostas." },
  {
    dias: 180,
    label: "6 meses",
    hint: "~4.200 respostas. Alguns minutos.",
  },
  {
    dias: 365,
    label: "1 ano",
    hint: "~9.500 respostas. Vai demorar.",
  },
];

/**
 * Tamanho de cada fatia, em dias.
 *
 * Uma janela de um ano são ~9.500 respostas — muito além do que uma
 * server action grava antes de a Vercel cortar a requisição. Então a
 * tela pede pedaço por pedaço, do mais antigo para o mais novo, e cada
 * chamada termina sozinha. A barra de progresso é consequência disso,
 * não enfeite: sem fatiar não haveria o que mostrar.
 */
const FATIA_DIAS = 30;

export default function WootricImport({
  onDone,
}: Props) {

  const [aberto, setAberto] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [feito, setFeito] = useState(0);
  const [total, setTotal] = useState(0);

  async function importar(dias: number) {

    setRodando(true);
    setFeito(0);

    const soma = {
      lidas: 0,
      novas: 0,
      atualizadas: 0,
      semTratativa: 0,
    };

    /** Sem janela escolhida é uma chamada só, incremental. */
    const fatias: { dias: number; ateDias: number }[] =
      dias === 0
        ? [{ dias: 0, ateDias: 0 }]
        : [];

    if (dias > 0) {
      for (
        let inicio = dias;
        inicio > 0;
        inicio -= FATIA_DIAS
      ) {
        fatias.push({
          dias: inicio,
          ateDias: Math.max(inicio - FATIA_DIAS, 0),
        });
      }
    }

    setTotal(fatias.length);

    let erro = "";

    for (const [i, fatia] of fatias.entries()) {

      setProgresso(
        fatia.dias === 0
          ? "Buscando o que chegou desde a última..."
          : `Fatia ${i + 1} de ${fatias.length} — de ${fatia.dias} a ${fatia.ateDias} dias atrás`
      );

      let r: ResultadoImportacao;

      try {
        r = await importWootric(
          fatia.dias === 0
            ? undefined
            : {
                dias: fatia.dias,
                ateDias: fatia.ateDias || undefined,
              }
        );
      } catch (falha) {
        erro =
          falha instanceof Error
            ? falha.message
            : "Falha na chamada.";
        break;
      }

      if (r.erro) {
        erro = r.erro;
        break;
      }

      soma.lidas += r.lidas;
      soma.novas += r.novas;
      soma.atualizadas += r.atualizadas;
      soma.semTratativa += r.semTratativa;

      setFeito(i + 1);
    }

    setRodando(false);
    setAberto(false);
    setProgresso("");

    if (erro) {
      onDone(erro, true);
      return;
    }

    onDone(
      soma.novas === 0 && soma.atualizadas === 0
        ? "Nada novo — a base já está em dia."
        : `${soma.novas} nova(s), ${soma.atualizadas} atualizada(s). ${soma.semTratativa} promotor(es) sem comentário entraram na conta sem abrir ciclo.`,
      false
    );
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        disabled={rodando}
        title="Puxa as respostas da pesquisa direto do Wootric."
        className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
      >
        <CloudDownload size={15} />
        {rodando
          ? total > 1
            ? `Importando ${feito}/${total}...`
            : "Importando..."
          : "Importar do Wootric"}
      </button>

      {aberto && (
        <Modal
          open
          title="Importar do Wootric"
          description="Somente leitura: puxa as respostas da pesquisa. Nada é escrito de volta lá."
          onClose={() =>
            rodando ? undefined : setAberto(false)
          }
          footer={
            <GhostButton
              onClick={() => setAberto(false)}
            >
              {rodando ? "Rodando..." : "Cancelar"}
            </GhostButton>
          }
        >

          <div className="space-y-2">

            {JANELAS.map((j) => (
              <button
                key={j.dias}
                onClick={() => importar(j.dias)}
                disabled={rodando}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3.5 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-zinc-800">
                  {j.label}
                </span>
                <span className="text-xs text-zinc-500">
                  {j.hint}
                </span>
              </button>
            ))}

            {rodando && (
              <div className="rounded-xl bg-violet-50/60 px-3.5 py-2.5 ring-1 ring-inset ring-violet-100">

                <p className="text-xs text-violet-800">
                  {progresso}
                </p>

                {total > 1 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{
                        width: `${Math.round((feito / total) * 100)}%`,
                      }}
                    />
                  </div>
                )}

              </div>
            )}

            <p className="pt-1 text-xs leading-relaxed text-zinc-500">
              Reimportar a mesma janela não duplica: a chave é o id da resposta no Wootric. Nota, comentário e contato são atualizados; status, tipo, causa raiz e todo o pós-contato são trabalho da operação e ficam intactos.
            </p>

            <p className="text-xs leading-relaxed text-zinc-500">
              Para janelas muito grandes, o caminho sem navegador é{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-violet-700">
                npm run nps:wootric -- --dias=365
              </code>
              .
            </p>

          </div>

        </Modal>
      )}
    </>
  );
}
