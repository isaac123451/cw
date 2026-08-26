"use client";

import { useState } from "react";

import { Monitor, Moon, Sun } from "lucide-react";

import { Tema, useTema } from "@/lib/context/ThemeContext";

const OPCOES: {
  id: Tema;
  label: string;
  hint: string;
  icone: typeof Sun;
}[] = [
  {
    id: "auto",
    label: "Automático",
    hint: "Segue o tema do sistema.",
    icone: Monitor,
  },
  {
    id: "claro",
    label: "Claro",
    hint: "Sempre claro, mesmo com o sistema escuro.",
    icone: Sun,
  },
  {
    id: "escuro",
    label: "Escuro",
    hint: "Sempre escuro, mesmo com o sistema claro.",
    icone: Moon,
  },
];

/**
 * A troca de tema, na barra de cima.
 *
 * Fica ao lado das notificações e do menu da conta porque é ali que
 * moram os ajustes do próprio uso — e porque é o único lugar presente em
 * toda tela. Um tema que só se troca em Configurações obriga a
 * atravessar a aplicação para responder a uma incômodo imediato: a sala
 * escureceu.
 */
export default function ThemeToggle() {

  const { tema, efetivo, definir } = useTema();

  const [aberto, setAberto] = useState(false);

  const atual =
    OPCOES.find((o) => o.id === tema) ?? OPCOES[0];

  const Icone = atual.icone;

  return (
    <div className="relative">

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={`Tema: ${atual.label}${tema === "auto" ? ` (agora ${efetivo})` : ""}`}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Icone size={17} />
      </button>

      {aberto && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAberto(false)}
          />

          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]"
          >

            {OPCOES.map((o) => {

              const OIcone = o.icone;
              const ativo = o.id === tema;

              return (
                <button
                  key={o.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={ativo}
                  onClick={() => {
                    definir(o.id);
                    setAberto(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    ativo
                      ? "bg-violet-50 text-violet-800"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >

                  <OIcone
                    size={15}
                    className="mt-0.5 shrink-0"
                  />

                  <span className="min-w-0">

                    <span className="block text-sm font-medium">
                      {o.label}

                      {/*
                        No automático, dizer o que está valendo agora.

                        "Automático" sozinho não responde a pergunta que
                        a pessoa tem ao abrir este menu, que é por que a
                        tela está como está.
                      */}
                      {o.id === "auto" &&
                        tema === "auto" && (
                          <span className="ml-1.5 font-normal text-zinc-500">
                            · agora {efetivo}
                          </span>
                        )}
                    </span>

                    <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {o.hint}
                    </span>

                  </span>

                </button>
              );
            })}

          </div>
        </>

      )}

    </div>
  );
}
