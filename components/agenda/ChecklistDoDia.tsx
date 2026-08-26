"use client";

import { useState } from "react";

import {
  AtSign,
  CircleAlert,
  Gauge,
  ListChecks,
  MessageSquareWarning,
  Sparkles,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

interface Item {
  titulo: string;
  porque: string;
  frente: "reclame-aqui" | "social" | "nps" | "geral";
  quantos?: number;
}

interface Checklist {
  abertura: string;
  itens: Item[];
  atencao?: string;
}

const ICONE = {
  "reclame-aqui": MessageSquareWarning,
  social: AtSign,
  nps: Gauge,
  geral: ListChecks,
};

const NOME_DA_FRENTE = {
  "reclame-aqui": "Reclame Aqui",
  social: "Redes Sociais",
  nps: "NPS",
  geral: "Geral",
};

/**
 * O checklist do dia, lido das três frentes.
 *
 * A agenda mostra o que **alguém marcou**. Isso é metade do dia: a
 * outra metade é o que está aberto e ninguém marcou — a reclamação sem
 * resposta, o detrator sem primeiro contato, o atendimento do Instagram
 * parado. Nenhuma dessas vira tarefa sozinha, e é por isso que somem.
 *
 * **Os fatos vêm contados do servidor; a IA ordena e explica.** Cada
 * número sai de uma consulta ao banco. Pedir a contagem a um modelo
 * seria trocar um número exato por um plausível, e numa lista de
 * pendências um item inventado manda alguém trabalhar no caso errado.
 *
 * O checklist é montado por clique, e não ao abrir a tela. Custa uma
 * chamada ao modelo e ~10 s; quem abre a agenda para dar baixa numa
 * tarefa não deveria pagar isso sem pedir.
 */
export default function ChecklistDoDia() {

  const [carregando, setCarregando] = useState(false);
  const [checklist, setChecklist] =
    useState<Checklist | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<Set<number>>(
    new Set()
  );

  async function montar() {

    setCarregando(true);
    setErro(null);

    try {

      const r = await fetch(
        "/api/assistente/checklist",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const d = await r.json();

      if (!r.ok || d.erro) {
        setErro(
          d.erro ?? "Não deu para montar o checklist."
        );
        return;
      }

      setChecklist(d.checklist);
      setFeitos(new Set());

    } catch {
      setErro("Não deu para falar com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SurfaceCard
      title="Checklist do dia"
      description="O que está aberto nas três frentes e ninguém marcou como tarefa."
      action={
        <button
          type="button"
          onClick={montar}
          disabled={carregando}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={15} />
          {carregando
            ? "Lendo as três frentes…"
            : checklist
              ? "Refazer"
              : "Montar (~30 s)"}
        </button>
      }
    >

      {erro && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

      {!checklist && !erro && (
        <p className="py-6 text-center text-sm text-zinc-500">
          Lê o que está aberto no Reclame Aqui, nas Redes
          Sociais e no NPS, e devolve a ordem do dia. Os
          números são contados no banco — a IA só ordena e
          explica.
        </p>
      )}

      {checklist && (

        <div className="space-y-4">

          <p className="text-sm leading-relaxed text-zinc-700">
            {checklist.abertura}
          </p>

          <ul className="space-y-2">

            {checklist.itens.map((item, i) => {

              const Icone =
                ICONE[item.frente] ?? ListChecks;

              const feito = feitos.has(i);

              return (
                <li key={`${item.titulo}-${i}`}>

                  <button
                    type="button"
                    onClick={() =>
                      setFeitos((prev) => {
                        const proximo = new Set(prev);
                        if (proximo.has(i)) {
                          proximo.delete(i);
                        } else {
                          proximo.add(i);
                        }
                        return proximo;
                      })
                    }
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      feito
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-zinc-200 hover:border-violet-200 hover:bg-zinc-50"
                    }`}
                  >

                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        feito
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-zinc-300"
                      }`}
                    >
                      {feito && "✓"}
                    </span>

                    <span className="min-w-0 flex-1">

                      <span
                        className={`block text-sm font-medium ${
                          feito
                            ? "text-zinc-400 line-through"
                            : "text-zinc-800"
                        }`}
                      >
                        {item.titulo}
                      </span>

                      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                        {item.porque}
                      </span>

                    </span>

                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600">
                      <Icone size={11} />
                      {NOME_DA_FRENTE[item.frente]}
                      {typeof item.quantos === "number" &&
                        item.quantos > 0 && (
                          <span className="tabular-nums">
                            · {item.quantos}
                          </span>
                        )}
                    </span>

                  </button>

                </li>
              );
            })}

          </ul>

          {checklist.atencao && (
            <p className="flex items-start gap-2 rounded-xl bg-violet-50/60 px-3.5 py-3 text-sm leading-relaxed text-zinc-700 ring-1 ring-inset ring-violet-100">
              <CircleAlert
                size={15}
                className="mt-0.5 shrink-0 text-violet-600"
              />
              <span>
                <strong className="font-semibold">
                  Atenção:
                </strong>{" "}
                {checklist.atencao}
              </span>
            </p>
          )}

          {/*
            A marcação vale nesta sessão, e a tela diz isso.

            Guardar no banco seria criar uma segunda lista de tarefas ao
            lado da agenda, com duas verdades sobre o mesmo trabalho. O
            checklist é um retrato do momento — para virar compromisso,
            existe o botão de marcar atividade.
          */}
          <p className="text-[11px] text-zinc-400">
            As marcas valem só nesta tela. O que virar
            compromisso, marque como atividade — aí fica.
          </p>

        </div>

      )}

    </SurfaceCard>
  );
}
